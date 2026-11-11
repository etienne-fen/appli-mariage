#!/usr/bin/env node
// Copies the guests' shared photos (status "approved", i.e. not hidden) into an
// album of the admin's OWN Google Photos account — e.g. to build a printed album.
//
//   node scripts/photos-to-google.js            → send the photos not sent yet
//   node scripts/photos-to-google.js --dry-run  → only list what would be sent
//
// Safe to re-run: each sent photo is marked in Firestore (photos/{id}.googlePhotos)
// and skipped next time. Originals are sent untouched (full print quality).
//
// One-time setup (Google Cloud console, project "appli-mariage"):
//   1. APIs & Services → Library → enable "Photos Library API".
//   2. OAuth consent screen → External, "Testing", add your Gmail as test user.
//   3. Credentials → Create OAuth client ID → "Desktop app" → download JSON to
//      %USERPROFILE%\.secrets\google-photos-oauth-client.json
// First run opens a Google sign-in link; the token is kept in
// %USERPROFILE%\.secrets\google-photos-token.json (never in the repo).
// While the consent screen is in "Testing", Google asks to sign in again after 7 days.

const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const { OAuth2Client } = require('google-auth-library')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { getAuth } = require('firebase-admin/auth')

const ALBUM_TITLE = 'Mariage Charlotte & Etienne — photos des invités'
const SECRETS = path.join(os.homedir(), '.secrets')
const CLIENT_FILE = path.join(SECRETS, 'google-photos-oauth-client.json')
const TOKEN_FILE = path.join(SECRETS, 'google-photos-token.json')
const SCOPES = ['https://www.googleapis.com/auth/photoslibrary.appendonly']
const API = 'https://photoslibrary.googleapis.com/v1'
const DRY_RUN = process.argv.includes('--dry-run')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const bucket = env.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.*)/)?.[1].trim()
initializeApp({
  credential: cert(require(process.env.FIREBASE_SA || path.join(SECRETS, 'appli-mariage-service-account.json'))),
  storageBucket: bucket,
})
const db = getFirestore()

// ── Google sign-in (OAuth "Desktop app", loopback redirect) ─────────────────

async function googleClient() {
  if (!fs.existsSync(CLIENT_FILE)) {
    throw new Error(`Fichier manquant : ${CLIENT_FILE}\nVoir la configuration en tête de ce script.`)
  }
  const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8')).installed
  const saved = fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null

  if (saved?.refresh_token) {
    const client = new OAuth2Client(client_id, client_secret)
    client.setCredentials(saved)
    try { await client.getAccessToken(); return client } catch { /* expired → sign in again */ }
  }

  // Local one-shot server to receive Google's redirect.
  const server = http.createServer()
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const redirect = `http://127.0.0.1:${server.address().port}`
  const client = new OAuth2Client(client_id, client_secret, redirect)
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES })
  console.log(`\nOuvrez ce lien et connectez-vous avec VOTRE compte Google Photos :\n\n${url}\n`)

  const code = await new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const q = new URL(req.url, redirect).searchParams
      res.end(q.get('code') ? 'Connexion réussie, vous pouvez fermer cet onglet.' : 'Connexion refusée.')
      server.close()
      q.get('code') ? resolve(q.get('code')) : reject(new Error(q.get('error') || 'connexion refusée'))
    })
  })
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens))
  return client
}

// ── Album (created by this script, so the API may add photos to it) ─────────

async function albumId(client) {
  const ref = db.doc('settings/googlePhotos')
  const snap = await ref.get()
  if (snap.exists && snap.data().albumId) return snap.data().albumId
  const { data } = await client.request({ url: `${API}/albums`, method: 'POST', data: { album: { title: ALBUM_TITLE } } })
  await ref.set({ albumId: data.id, albumUrl: data.productUrl, createdAt: FieldValue.serverTimestamp() })
  console.log(`Album créé : ${data.productUrl}`)
  return data.id
}

// "Photo de Prénom Nom" — uploader found via their Auth phone number.
const nameCache = {}
async function uploaderName(uid) {
  if (uid in nameCache) return nameCache[uid]
  let name = ''
  try {
    const { phoneNumber } = await getAuth().getUser(uid)
    const snap = await db.collection('persons').where('phone', '==', phoneNumber).limit(1).get()
    if (!snap.empty) name = [snap.docs[0].data().prenom, snap.docs[0].data().nom].filter(Boolean).join(' ')
  } catch { /* unknown uploader: no caption */ }
  return (nameCache[uid] = name)
}

// ── Main ────────────────────────────────────────────────────────────────────

;(async () => {
  const snap = await db.collection('photos').where('status', '==', 'approved').get()
  const todo = snap.docs.filter(d => !d.data().googlePhotos).sort((a, b) =>
    (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0))
  console.log(`${snap.size} photo(s) partagée(s), ${todo.length} à envoyer vers Google Photos.`)
  if (DRY_RUN || !todo.length) return

  const client = await googleClient()
  const album = await albumId(client)
  const files = getStorage().bucket()
  let sent = 0

  for (const d of todo) {
    const p = d.data()
    try {
      const [bytes] = await files.file(p.storagePath).download()
      const [meta] = await files.file(p.storagePath).getMetadata()
      const { data: uploadToken } = await client.request({
        url: `${API}/uploads`, method: 'POST', body: bytes, responseType: 'text',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Goog-Upload-Content-Type': meta.contentType || 'image/jpeg',
          'X-Goog-Upload-Protocol': 'raw',
        },
      })
      const name = await uploaderName(p.guestId)
      const { data } = await client.request({
        url: `${API}/mediaItems:batchCreate`, method: 'POST',
        data: {
          albumId: album,
          newMediaItems: [{
            description: name ? `Photo de ${name}` : '',
            simpleMediaItem: { uploadToken, fileName: path.basename(p.storagePath) },
          }],
        },
      })
      const result = data.newMediaItemResults?.[0]
      if (!result?.mediaItem) throw new Error(result?.status?.message || 'réponse inattendue')
      await d.ref.update({ googlePhotos: { mediaItemId: result.mediaItem.id, syncedAt: FieldValue.serverTimestamp() } })
      sent++
      console.log(`  ✓ ${d.id}${name ? ` (${name})` : ''}`)
    } catch (e) {
      console.log(`  ✗ ${d.id} : ${e.response?.data?.error?.message || e.message}`)
    }
  }
  const url = (await db.doc('settings/googlePhotos').get()).data()?.albumUrl
  console.log(`\n${sent}/${todo.length} envoyée(s).${url ? ` Album : ${url}` : ''}`)
})().catch(e => { console.error(e.message); process.exit(1) })
