#!/usr/bin/env node
// Creates the missing full-screen copies (photos/…_medium.jpg, 1600 px) for
// photos uploaded before the app made them. Without one, opening a photo
// downloads the original (several MB). Same copy as pages/photos.js makes.
//
//   node scripts/photos-backfill-medium.js            → create the missing copies
//   node scripts/photos-backfill-medium.js --dry-run  → only list them
//
// Safe to re-run. A photo already ≤ 1600 px needs no copy (the original is used).
// Needs `sharp` (devDependency).

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

const MEDIUM_SIZE = 1600 // keep in sync with pages/photos.js
const CACHE = 'public, max-age=31536000, immutable'
const DRY_RUN = process.argv.includes('--dry-run')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const bucketName = env.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.*)/)?.[1].trim()
initializeApp({
  credential: cert(require(process.env.FIREBASE_SA || path.join(os.homedir(), '.secrets', 'appli-mariage-service-account.json'))),
  storageBucket: bucketName,
})
const db = getFirestore()
const bucket = getStorage().bucket()

;(async () => {
  const todo = (await db.collection('photos').get()).docs.filter(d => !d.data().mediumPath)
  console.log(`${todo.length} photo(s) sans copie plein écran.`)
  let made = 0

  for (const d of todo) {
    const p = d.data()
    try {
      const [orig] = await bucket.file(p.storagePath).download()
      const { width, height } = await sharp(orig).rotate().metadata()
      if (Math.max(width, height) <= MEDIUM_SIZE) { console.log(`  = ${d.id} : déjà petite (${width}×${height})`); continue }
      if (DRY_RUN) { console.log(`  · ${d.id} : ${Math.round(orig.length / 1024)} KB`); continue }

      // Same orientation handling as the browser (EXIF applied), then resized.
      const medium = await sharp(orig).rotate()
        .resize(MEDIUM_SIZE, MEDIUM_SIZE, { fit: 'inside' })
        .jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      const mediumPath = p.storagePath.replace(/\.jpg$/i, '') + '_medium.jpg'
      const token = crypto.randomUUID()
      await bucket.file(mediumPath).save(medium, {
        contentType: 'image/jpeg',
        metadata: { cacheControl: CACHE, metadata: { firebaseStorageDownloadTokens: token } },
      })
      const mediumURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(mediumPath)}?alt=media&token=${token}`
      await d.ref.update({ mediumPath, mediumURL })
      made++
      console.log(`  ✓ ${d.id} : ${Math.round(orig.length / 1024)} KB → ${Math.round(medium.length / 1024)} KB`)
    } catch (e) {
      console.log(`  ✗ ${d.id} : ${e.message}`)
    }
  }
  if (!DRY_RUN) console.log(`\n${made} copie(s) créée(s).`)
})().catch(e => { console.error(e.message); process.exit(1) })
