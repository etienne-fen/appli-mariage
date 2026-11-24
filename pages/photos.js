import { useState, useRef, useCallback, useEffect } from 'react'
import useLang from '../src/context/LangContext'
import { useRouter } from 'next/router'
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { firestore, storage } from '../src/firebase/firebaseClient'
import { useAuth } from '../src/context/AuthContext'
import useAdmin from '../src/hooks/useAdmin'
import usePhotos from '../src/hooks/usePhotos'
import usePhotoSettings from '../src/hooks/usePhotoSettings'
import ProtectedRoute from '../src/components/ProtectedRoute'
import { isImage, toJpeg } from '../src/lib/imageToJpeg'

const strings = {
  FR: {
    title:        'Photos',
    upload:       '📷 Ajouter',
    uploading:    p => `Envoi… ${p}%`,
    empty:        'Aucune photo pour l\'instant — soyez le premier à partager !',
    hide:         'Masquer',
    show:         'Afficher',
    delete:       'Supprimer',
    back:         'Retour',
    tabAll:       'Toutes',
    tabHidden:    'Masquées',
    error:        'Erreur lors de l\'envoi. Réessayez.',
    confirmDel:   'Supprimer cette photo définitivement ?',
    // Admin settings panel
    settings:     'Paramètres du partage',
    openingDate:  'Ouverture aux invités',
    sharingOn:    'Partage activé',
    sharingOff:   'Partage désactivé',
    save:         'Enregistrer',
    saved:        'Enregistré ✓',
    // Guest gate messages
    notEnabled:   'Le partage de photos n\'est pas encore ouvert.',
    opensOn:      date => `Le partage ouvrira le ${date}.`,
    rulesTitle:   'Comment ça marche ?',
    rules: [
      'Les photos que vous ajoutez rejoignent un album commun, visible par tous les invités connectés.',
      'Photos uniquement (pas de vidéos), 20 Mo maximum par photo, une à la fois.',
      'Elles sont envoyées en qualité originale : les mariés les gardent toutes en souvenir.',
      'Les mariés peuvent masquer une photo si besoin.',
    ],
    tooBig:       'Cette photo dépasse 20 Mo. Choisissez-en une plus légère.',
    notImage:     'Seules les photos sont acceptées (pas de vidéos).',
    convertError: 'Impossible de lire cette photo. Essayez-en une autre ou faites une capture d’écran.',
  },
  EN: {
    title:        'Photos',
    upload:       '📷 Add',
    uploading:    p => `Uploading… ${p}%`,
    empty:        'No photos yet — be the first to share one!',
    hide:         'Hide',
    show:         'Show',
    delete:       'Delete',
    back:         'Back',
    tabAll:       'All',
    tabHidden:    'Hidden',
    error:        'Upload failed. Please try again.',
    confirmDel:   'Permanently delete this photo?',
    settings:     'Sharing settings',
    openingDate:  'Opens for guests on',
    sharingOn:    'Sharing enabled',
    sharingOff:   'Sharing disabled',
    save:         'Save',
    saved:        'Saved ✓',
    notEnabled:   'Photo sharing is not open yet.',
    opensOn:      date => `Sharing will open on ${date}.`,
    rulesTitle:   'How it works',
    rules: [
      'Photos you add go into a shared album that every signed-in guest can see.',
      'Photos only (no videos), 20 MB max per photo, one at a time.',
      'They are sent in original quality: the couple keeps them all as a memory.',
      'The couple can hide a photo if needed.',
    ],
    tooBig:       'This photo is larger than 20 MB. Please choose a lighter one.',
    notImage:     'Only photos are accepted (no videos).',
    convertError: 'This photo can’t be read. Try another one, or take a screenshot of it.',
  },
}

const MAX_BYTES = 20 * 1024 * 1024 // keep in sync with storage.rules
const THUMB_SIZE  = 600             // px, longest side — gallery grid
const MEDIUM_SIZE = 1600            // px, longest side — full-screen view
// Uploaded files never change (storage.rules: no update), so browsers may keep them a year.
const CACHE = 'public, max-age=31536000, immutable'

// Resized JPEG copy of the bitmap, or null when the photo is already that
// small (the original is then used instead: a re-encoded copy of a small
// photo would only be bigger).
async function resized(bitmap, maxSide, quality) {
  if (Math.max(bitmap.width, bitmap.height) <= maxSide) return null
  const scale  = maxSide / Math.max(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', quality))
}

// Thumbnail (grid) + medium (full-screen) blobs, decoded once. Both null if
// the browser can't decode the format.
async function makeCopies(file) {
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { return { thumb: null, medium: null } }
  try {
    const [thumb, medium] = await Promise.all([
      resized(bitmap, THUMB_SIZE, 0.8).catch(() => null),
      resized(bitmap, MEDIUM_SIZE, 0.85).catch(() => null),
    ])
    return { thumb, medium }
  } finally {
    bitmap.close?.()
  }
}

// Upload with byte progress; resolves { path, url }.
function put(path, blob, onBytes) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: 'image/jpeg', cacheControl: CACHE })
    task.on('state_changed', snap => onBytes(snap.bytesTransferred), reject,
      () => getDownloadURL(task.snapshot.ref).then(url => resolve({ path, url }), reject))
  })
}

export default function PhotosPage() {
  return (
    <ProtectedRoute>
      <Photos />
    </ProtectedRoute>
  )
}

function Photos() {
  const router      = useRouter()
  const { user }    = useAuth()
  const { isAdmin } = useAdmin()
  const [lang, setLang]         = useLang()
  const [progress, setProgress] = useState(null)
  const [error, setError]       = useState('')
  const [openId, setOpenId]     = useState(null) // photo shown full screen
  const [adminTab, setAdminTab] = useState('all')
  const [preview, setPreview]   = useState(null) // local URL of the photo being uploaded
  const fileRef = useRef(null)
  const t = strings[lang]

  const { photos, loading, loadingMore, hasMore, loadMore, patchLocal } = usePhotos(isAdmin)
  const sentinelRef = useRef(null)
  const [nearEnd, setNearEnd] = useState(false)

  // Infinite scroll: load the next page when the end of the grid comes near.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setNearEnd(entry.isIntersecting), { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loading])
  // Re-checked after each page: keeps loading while the end is still in view
  // (e.g. a page made only of hidden photos).
  useEffect(() => {
    if (nearEnd && hasMore && !loadingMore) loadMore()
  }, [nearEnd, hasMore, loadingMore, loadMore])
  const { settings, loading: sl } = usePhotoSettings()

  // Resolve whether guests may currently upload
  const startDate    = settings?.sharingStartsAt?.toDate?.() ?? null
  const guestCanUpload = !!(settings?.sharingEnabled && startDate && new Date() >= startDate)
  const canUpload    = isAdmin || guestCanUpload

  // Gate message for guests
  function guestGateMessage() {
    if (!settings?.sharingEnabled) return t.notEnabled
    if (startDate && new Date() < startDate) {
      const fmt = startDate.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      return t.opensOn(fmt)
    }
    return null
  }
  const gateMsg = !isAdmin ? guestGateMessage() : null

  const displayed = isAdmin && adminTab === 'hidden'
    ? photos.filter(p => p.status === 'hidden')
    : photos

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError('')
    // Same limits as storage.rules — tell the guest instead of failing silently.
    if (!isImage(file)) return setError(t.notImage)
    if (file.size > MAX_BYTES) return setError(t.tooBig)
    setProgress(0)

    // Always store JPEG (HEIC etc. converted in the browser).
    let jpeg
    try { jpeg = await toJpeg(file) }
    catch (err) { console.error('photos: JPEG conversion failed', err); setProgress(null); return setError(t.convertError) }
    if (jpeg.size > MAX_BYTES) { setProgress(null); return setError(t.tooBig) }

    const base = `photos/${user.uid}/${Date.now()}`
    // Small preview for the grid + medium copy for full-screen viewing (keeps
    // the gallery fast; the original is only for the couple's album).
    const copies = await makeCopies(jpeg)
    // Shown in the grid at once, with the progress, while the files upload.
    const previewUrl = URL.createObjectURL(copies.thumb || jpeg)
    setPreview(previewUrl)

    // The three files upload in parallel; one progress bar for all bytes.
    const files = [['orig', `${base}.jpg`, jpeg]]
    if (copies.thumb)  files.push(['thumb',  `${base}_thumb.jpg`,  copies.thumb])
    if (copies.medium) files.push(['medium', `${base}_medium.jpg`, copies.medium])
    const total = files.reduce((n, [, , b]) => n + b.size, 0)
    const sent  = {}
    const onBytes = key => bytes => {
      sent[key] = bytes
      setProgress(Math.round(Object.values(sent).reduce((a, b) => a + b, 0) / total * 100))
    }

    try {
      const done = await Promise.all(files.map(([key, path, blob]) =>
        key === 'orig'
          ? put(path, blob, onBytes(key))
          : put(path, blob, onBytes(key)).catch(() => null))) // a copy may fail: the original is used instead
      const [orig, ...rest] = done
      const got = Object.fromEntries(files.slice(1).map(([key], i) => [key, rest[i]]))
      await addDoc(collection(firestore, 'photos'), {
        guestId: user.uid, storagePath: orig.path,
        downloadURL: orig.url, status: 'approved',
        ...(got.thumb  && { thumbPath: got.thumb.path,   thumbURL: got.thumb.url }),
        ...(got.medium && { mediumPath: got.medium.path, mediumURL: got.medium.url }),
        createdAt: serverTimestamp(),
      })
    } catch {
      setError(t.error)
    } finally {
      setProgress(null)
      setPreview(null)
      URL.revokeObjectURL(previewUrl)
    }
  }

  // ── Admin actions ───────────────────────────────────────────────────────────

  const handleHide = useCallback(async (photo) => {
    const status = photo.status === 'hidden' ? 'approved' : 'hidden'
    await updateDoc(doc(firestore, 'photos', photo.id), { status })
    patchLocal(photo.id, { status })
  }, [patchLocal])

  const handleDelete = useCallback(async (photo) => {
    if (!window.confirm(t.confirmDel)) return
    await deleteDoc(doc(firestore, 'photos', photo.id))
    patchLocal(photo.id, null)
    for (const path of [photo.storagePath, photo.thumbPath, photo.mediumPath].filter(Boolean)) {
      try { await deleteObject(ref(storage, path)) } catch {}
    }
    // If it was open, the viewer moves on by itself (see the openId effect).
  }, [t.confirmDel, patchLocal])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main style={s.main}>
      {/* Nav */}
      <nav style={s.nav}>
        <button onClick={() => router.push('/dashboard')} style={s.backBtn}>← {t.back}</button>
        <div style={s.navRight}>
          {canUpload && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={progress !== null}
              style={{ ...s.uploadBtn, opacity: progress !== null ? 0.6 : 1 }}
            >
              {progress !== null ? t.uploading(progress) : t.upload}
            </button>
          )}
          <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
            {lang === 'FR' ? 'EN' : 'FR'}
          </button>
        </div>
      </nav>

      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={handleFileChange} />

      <h1 style={s.title}>📸 {t.title}</h1>

      <div style={s.rules}>
        <p style={s.rulesTitle}>{t.rulesTitle}</p>
        <ul style={s.rulesList}>
          {t.rules.map(r => <li key={r}>{r}</li>)}
        </ul>
      </div>

      {/* Admin settings panel */}
      {isAdmin && !sl && <AdminSettings settings={settings} t={t} lang={lang} />}

      {/* Progress bar */}
      {progress !== null && (
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
      )}

      {error && <p style={s.errorMsg}>{error}</p>}

      {/* Guest gate message */}
      {gateMsg && <p style={s.gateMsg}>{gateMsg}</p>}

      {/* Admin tab switcher */}
      {isAdmin && (
        <div style={s.tabs}>
          <button onClick={() => setAdminTab('all')}
            style={{ ...s.tab, ...(adminTab === 'all' ? s.tabActive : {}) }}>
            {t.tabAll}
          </button>
          <button onClick={() => setAdminTab('hidden')}
            style={{ ...s.tab, ...(adminTab === 'hidden' ? s.tabActive : {}) }}>
            {t.tabHidden}
          </button>
        </div>
      )}

      {/* Gallery */}
      {!loading && !preview && displayed.length === 0 && <p style={s.empty}>{t.empty}</p>}
      {(displayed.length > 0 || preview) && (
        <div style={s.grid}>
          {preview && (
            <div style={s.cell}>
              <img src={preview} alt="" style={{ ...s.thumb, opacity: 0.6, cursor: 'default' }} />
              <span style={s.previewPct}>{progress ?? 0}%</span>
            </div>
          )}
          {displayed.map(photo => (
            <PhotoCard key={photo.id} photo={photo} isAdmin={isAdmin} t={t}
              onOpen={() => setOpenId(photo.id)}
              onHide={() => handleHide(photo)}
              onDelete={() => handleDelete(photo)}
            />
          ))}
        </div>
      )}
      {/* Infinite-scroll trigger */}
      {!loading && <div ref={sentinelRef} style={{ height: 1 }} />}
      {loadingMore && <p style={s.loadingMore}>…</p>}

      {/* Lightbox — medium copy (≈1600 px); the thumbnail shows while it loads.
          Older photos without one fall back to the original. */}
      {openId && (
        <Lightbox photos={displayed} openId={openId} setOpenId={setOpenId}
          hasMore={hasMore} loadingMore={loadingMore} loadMore={loadMore} />
      )}
    </main>
  )
}

// ── Admin settings panel ──────────────────────────────────────────────────────

function AdminSettings({ settings, t }) {
  const [draftDate,    setDraftDate]    = useState('')
  const [draftEnabled, setDraftEnabled] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  useEffect(() => {
    setDraftEnabled(settings?.sharingEnabled ?? false)
    if (settings?.sharingStartsAt) {
      const d = settings.sharingStartsAt.toDate()
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const pad = n => String(n).padStart(2, '0')
      setDraftDate(
        `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      )
    }
  }, [settings])

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(firestore, 'settings', 'photos'), {
        sharingEnabled:  draftEnabled,
        sharingStartsAt: draftDate ? Timestamp.fromDate(new Date(draftDate)) : null,
      }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div style={p.panel}>
      <p style={p.panelTitle}>⚙️ {t.settings}</p>
      <div style={p.row}>
        <label style={p.label}>{t.openingDate}</label>
        <input
          type="datetime-local"
          value={draftDate}
          onChange={e => setDraftDate(e.target.value)}
          style={p.dateInput}
        />
      </div>
      <div style={p.row}>
        <label style={p.label}>{draftEnabled ? t.sharingOn : t.sharingOff}</label>
        <button
          onClick={() => setDraftEnabled(v => !v)}
          style={{ ...p.toggle, background: draftEnabled ? '#1a1a1a' : '#ccc' }}
        >
          <span style={{ ...p.toggleKnob, transform: draftEnabled ? 'translateX(18px)' : 'translateX(2px)' }} />
        </button>
      </div>
      <button onClick={save} disabled={saving} style={{ ...p.saveBtn, opacity: saving ? 0.6 : 1 }}>
        {saved ? t.saved : t.save}
      </button>
    </div>
  )
}

// ── Full-screen viewer ────────────────────────────────────────────────────────

// Previous / next among the photos of the current tab (newest first):
// swipe on phones, ‹ › buttons and ←/→ keys on computers, Esc or the phone's
// back button to close.
function Lightbox({ photos, openId, setOpenId, hasMore, loadingMore, loadMore }) {
  const router    = useRouter()
  const index     = photos.findIndex(p => p.id === openId)
  const lastIndex = useRef(index)
  const pushed    = useRef(false) // our history entry is on top
  const touch     = useRef(null)
  const swiped    = useRef(false)

  // Closing goes through history when our entry is there, so "back" and ✕ agree.
  const close = useCallback(() => {
    if (pushed.current) window.history.back() // → popstate below closes
    else setOpenId(null)
  }, [setOpenId])

  // Phone back button closes the photo instead of leaving the page: one
  // history entry while open (same URL). Next's router is told to ignore that
  // pop. The state check avoids a second entry under React strict mode (dev).
  useEffect(() => {
    if (!window.history.state?.lightbox) {
      window.history.pushState({ ...window.history.state, lightbox: true }, '')
    }
    pushed.current = true
    const onPop = () => {
      if (!pushed.current) return true
      pushed.current = false
      setOpenId(null)
      return false
    }
    router.beforePopState(onPop)
    window.addEventListener('popstate', onPop) // when Next skips beforePopState
    return () => {
      window.removeEventListener('popstate', onPop)
      router.beforePopState(() => true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Open photo gone (deleted, or hidden while on the "Masquées" tab): show the
  // one now at its place, or close if none is left.
  useEffect(() => {
    if (index !== -1) { lastIndex.current = index; return }
    const next = photos[Math.min(lastIndex.current, photos.length - 1)]
    if (next) setOpenId(next.id)
    else close()
  }, [index, photos, setOpenId, close])

  // Near the end of what's loaded: fetch the next batch, so swiping never stops early.
  useEffect(() => {
    if (index !== -1 && index >= photos.length - 3 && hasMore && !loadingMore) loadMore()
  }, [index, photos.length, hasMore, loadingMore, loadMore])

  // Preload the neighbours so the next swipe is instant.
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) {
      if (p) new Image().src = p.mediumURL || p.downloadURL
    }
  }, [index, photos])

  const go = useCallback(step => {
    const p = photos[index + step]
    if (p) setOpenId(p.id)
  }, [photos, index, setOpenId])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, close])

  const photo = photos[index]
  if (!photo) return null
  const stop = fn => e => { e.stopPropagation(); fn() }

  return (
    <div
      style={s.overlay}
      onClick={() => { if (!swiped.current) close() }}
      onTouchStart={e => {
        swiped.current = false
        const t = e.touches[0]
        touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null // ignore pinch-zoom
      }}
      onTouchEnd={e => {
        const start = touch.current
        touch.current = null
        if (!start) return
        const t = e.changedTouches[0]
        const dx = t.clientX - start.x, dy = t.clientY - start.y
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { // horizontal swipe, not a tap
          swiped.current = true
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      <button style={s.closeBtn} onClick={stop(close)} aria-label="Fermer">✕</button>
      {index > 0 && (
        <button style={{ ...s.navBtn, left: '0.5rem' }} onClick={stop(() => go(-1))} aria-label="Photo précédente">‹</button>
      )}
      {index < photos.length - 1 && (
        <button style={{ ...s.navBtn, right: '0.5rem' }} onClick={stop(() => go(1))} aria-label="Photo suivante">›</button>
      )}
      <LightboxImage key={photo.id} photo={photo} />
    </div>
  )
}

// Shows the (already cached) thumbnail at once, then swaps in the medium copy
// when it has loaded. Older photos without a medium copy use the original.
function LightboxImage({ photo }) {
  const full = photo.mediumURL || photo.downloadURL
  const [ready, setReady] = useState(!photo.thumbURL)
  return (
    <>
      {!ready && <img src={photo.thumbURL} alt="" style={{ ...s.lightboxImg, width: '100%', filter: 'blur(2px)' }}
        onClick={e => e.stopPropagation()} />}
      <img src={full} alt="" onLoad={() => setReady(true)}
        style={ready ? s.lightboxImg : { display: 'none' }}
        onClick={e => e.stopPropagation()} />
    </>
  )
}

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({ photo, isAdmin, t, onOpen, onHide, onDelete }) {
  const hidden = photo.status === 'hidden'
  return (
    <div style={{ ...s.cell, opacity: hidden ? 0.45 : 1 }}>
      <img src={photo.thumbURL || photo.downloadURL} alt="" loading="lazy" decoding="async" style={s.thumb} onClick={onOpen} />
      {isAdmin && (
        <div style={s.adminBar}>
          <button style={s.adminBtn} onClick={onHide}>{hidden ? t.show : t.hide}</button>
          <button style={{ ...s.adminBtn, color: '#c0392b' }} onClick={onDelete}>{t.delete}</button>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  main:         { maxWidth: '480px', margin: '0 auto', padding: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  nav:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.5rem' },
  navRight:     { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  backBtn:      { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0, flexShrink: 0 },
  uploadBtn:    { padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: '#1a1a1a', color: '#fff', border: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  langBtn:      { background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666' },
  title:        { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.75rem' },
  rules:        { background: '#fff', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#555', lineHeight: 1.5 },
  rulesTitle:   { margin: '0 0 0.3rem', fontWeight: 700, color: '#1F5135', fontSize: '0.85rem' },
  rulesList:    { margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  progressTrack:{ height: 4, background: '#e8e8e8', borderRadius: 2, overflow: 'hidden', marginBottom: '1rem' },
  progressFill: { height: '100%', background: '#1a1a1a', borderRadius: 2, transition: 'width 0.15s ease' },
  errorMsg:     { color: '#c0392b', fontSize: '0.875rem', marginBottom: '0.75rem' },
  gateMsg:      { fontSize: '0.875rem', color: '#888', background: '#fff', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem' },
  tabs:         { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  tab:          { padding: '0.35rem 0.875rem', borderRadius: '2rem', border: '1.5px solid #ddd', background: 'none', fontSize: '0.8rem', cursor: 'pointer', color: '#555' },
  tabActive:    { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  empty:        { color: '#aaa', fontSize: '0.9rem', textAlign: 'center', marginTop: '3rem', lineHeight: 1.6 },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
  cell:         { position: 'relative', borderRadius: '0.625rem', overflow: 'hidden', background: '#f0f0f0', aspectRatio: '1' },
  thumb:        { width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' },
  previewPct:   { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.1rem', textShadow: '0 1px 3px rgba(0,0,0,0.6)' },
  adminBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.9)' },
  adminBtn:     { background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600, color: '#333', padding: '0.1rem 0.15rem' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  closeBtn:     { position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1, zIndex: 1001 },
  loadingMore:  { textAlign: 'center', color: '#aaa', fontSize: '1.25rem', margin: '1rem 0' },
  navBtn:       { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '2.75rem', height: '2.75rem', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '1.9rem', lineHeight: 1, cursor: 'pointer', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '0.2rem' },
  lightboxImg:  { maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '0.5rem' },
}

// Admin settings panel styles
const p = {
  panel:     { background: '#f0f4ff', border: '1.5px solid #d0d8f0', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' },
  panelTitle:{ fontWeight: 700, fontSize: '0.85rem', color: '#3a4a8a', margin: '0 0 0.875rem' },
  row:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' },
  label:     { fontSize: '0.85rem', color: '#444', flex: 1 },
  dateInput: { fontSize: '0.8rem', padding: '0.35rem 0.5rem', border: '1.5px solid #ccc', borderRadius: '0.4rem', color: '#333', flexShrink: 0 },
  toggle:    { position: 'relative', width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, padding: 0 },
  toggleKnob:{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', display: 'block' },
  saveBtn:   { marginTop: '0.25rem', padding: '0.45rem 1rem', borderRadius: '0.4rem', border: 'none', background: '#3a4a8a', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
}
