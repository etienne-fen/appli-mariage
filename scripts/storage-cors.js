#!/usr/bin/env node
// CORS of the Firebase Storage bucket: lets the app's own pages DOWNLOAD photo
// files with fetch() — needed by the "Envoyer vers Google Photos" button in
// Réglages (src/lib/googlePhotos.js). Read-only (GET); access is still governed
// by the download token / storage.rules. <img> tags never needed this.
//
//   node scripts/storage-cors.js          → apply
//   node scripts/storage-cors.js --show   → print the current setting only

const fs = require('fs')
const os = require('os')
const path = require('path')
const { initializeApp, cert } = require('firebase-admin/app')
const { getStorage } = require('firebase-admin/storage')

const CORS = [{
  origin: [
    'https://appli-mariage.web.app',
    'https://appli-mariage.firebaseapp.com',
    'http://localhost:3000',
  ],
  method: ['GET', 'HEAD'],
  responseHeader: ['Content-Type'],
  maxAgeSeconds: 3600,
}]

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const bucketName = env.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.*)/)?.[1].trim()
initializeApp({
  credential: cert(require(process.env.FIREBASE_SA || path.join(os.homedir(), '.secrets', 'appli-mariage-service-account.json'))),
  storageBucket: bucketName,
})

;(async () => {
  const bucket = getStorage().bucket()
  if (!process.argv.includes('--show')) {
    await bucket.setCorsConfiguration(CORS)
    console.log('CORS appliqué.')
  }
  const [meta] = await bucket.getMetadata()
  console.log(JSON.stringify(meta.cors ?? null, null, 2))
})().catch(e => { console.error(e.message); process.exit(1) })
