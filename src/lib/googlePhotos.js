import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Browser version of scripts/photos-to-google.js, for the "Envoyer vers Google
// Photos" button in Réglages. Same bookkeeping as the script (photos/{id}.googlePhotos,
// album in settings/googlePhotos), so both can be used interchangeably.
//
// The site is a static export (no server): the admin signs in to Google in a
// popup (Google Identity Services, "Web application" OAuth client of the
// appli-mariage Cloud project, id in NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID) and
// the browser talks to the Photos API directly. Downloading the originals
// needs the Storage bucket CORS set by scripts/storage-cors.js.

export const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID || ''
const ALBUM_TITLE = 'Mariage Charlotte & Etienne — photos des invités'
const SCOPE = 'https://www.googleapis.com/auth/photoslibrary.appendonly'
const API = 'https://photoslibrary.googleapis.com/v1'

// ── Google sign-in ──────────────────────────────────────────────────────────

let gisPromise
export function loadGoogleSignIn() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisPromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = 'https://accounts.google.com/gsi/client'
    el.async = true
    el.onload = resolve
    el.onerror = () => { gisPromise = null; reject(new Error('Impossible de charger la connexion Google.')) }
    document.head.appendChild(el)
  })
  return gisPromise
}

// Opens the Google popup. Call it directly from the click handler (after
// loadGoogleSignIn has resolved) or browsers block the popup.
export function requestGoogleToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: r => r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || 'Connexion Google refusée.')),
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Fenêtre Google fermée.' : (e.message || 'Connexion Google impossible.'))),
    })
    client.requestAccessToken()
  })
}

// ── Firestore side ──────────────────────────────────────────────────────────

// Shared photos not sent yet, oldest first (same order as the script).
export async function pendingPhotos() {
  const snap = await getDocs(query(collection(firestore, 'photos'), where('status', '==', 'approved')))
  return snap.docs
    .filter(d => !d.data().googlePhotos)
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

export async function albumInfo() {
  const snap = await getDoc(doc(firestore, 'settings', 'googlePhotos'))
  return snap.exists() ? snap.data() : null
}

// "Photo de Prénom Nom": uploader uid → guests/{uid}.phoneNumber → persons.phone.
const nameCache = {}
async function uploaderName(uid) {
  if (uid in nameCache) return nameCache[uid]
  let name = ''
  try {
    const phone = (await getDoc(doc(firestore, 'guests', uid))).data()?.phoneNumber
    if (phone) {
      const snap = await getDocs(query(collection(firestore, 'persons'), where('phone', '==', phone), limit(1)))
      if (!snap.empty) name = [snap.docs[0].data().prenom, snap.docs[0].data().nom].filter(Boolean).join(' ')
    }
  } catch { /* unknown uploader: no caption */ }
  return (nameCache[uid] = name)
}

// ── Photos API ──────────────────────────────────────────────────────────────

async function api(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } })
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* not JSON */ }
    throw new Error(msg)
  }
  return res
}

async function ensureAlbum(token) {
  const info = await albumInfo()
  if (info?.albumId) return info.albumId
  const { id, productUrl } = await (await api(token, `${API}/albums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ album: { title: ALBUM_TITLE } }),
  })).json()
  await setDoc(doc(firestore, 'settings', 'googlePhotos'), { albumId: id, albumUrl: productUrl, createdAt: serverTimestamp() })
  return id
}

// Sends every pending photo. onProgress({ done, total, failed }) after each one.
// Returns { sent, failed: [{ id, error }] }.
export async function syncToGooglePhotos(token, onProgress = () => {}) {
  const todo = await pendingPhotos()
  const albumId = todo.length ? await ensureAlbum(token) : null
  const failed = []
  let sent = 0
  onProgress({ done: 0, total: todo.length, failed: 0 })

  for (const p of todo) {
    try {
      const file = await fetch(p.downloadURL)
      if (!file.ok) throw new Error(`téléchargement impossible (${file.status})`)
      const bytes = await file.blob()
      const uploadToken = await (await api(token, `${API}/uploads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Goog-Upload-Content-Type': bytes.type || 'image/jpeg',
          'X-Goog-Upload-Protocol': 'raw',
        },
        body: bytes,
      })).text()
      const name = await uploaderName(p.guestId)
      const data = await (await api(token, `${API}/mediaItems:batchCreate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId,
          newMediaItems: [{
            description: name ? `Photo de ${name}` : '',
            simpleMediaItem: { uploadToken, fileName: p.storagePath.split('/').pop() },
          }],
        }),
      })).json()
      const item = data.newMediaItemResults?.[0]
      if (!item?.mediaItem) throw new Error(item?.status?.message || 'réponse inattendue')
      await updateDoc(doc(firestore, 'photos', p.id), {
        googlePhotos: { mediaItemId: item.mediaItem.id, syncedAt: serverTimestamp() },
      })
      sent++
    } catch (e) {
      // "Failed to fetch" on the download = bucket CORS missing (scripts/storage-cors.js).
      failed.push({ id: p.id, error: e.message })
    }
    onProgress({ done: sent + failed.length, total: todo.length, failed: failed.length })
  }
  return { sent, failed }
}
