import { useState, useRef, useCallback, useEffect } from 'react'
import useLang from '../src/context/LangContext'
import { useRouter } from 'next/router'
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { firestore, storage } from '../src/firebase/firebaseClient'
import { useAuth } from '../src/context/AuthContext'
import useAdmin from '../src/hooks/useAdmin'
import usePhotos from '../src/hooks/usePhotos'
import usePhotoSettings from '../src/hooks/usePhotoSettings'
import ProtectedRoute from '../src/components/ProtectedRoute'

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
  },
}

const MAX_BYTES = 20 * 1024 * 1024 // keep in sync with storage.rules
const THUMB_SIZE = 600              // px, longest side

// Builds a small JPEG preview in the browser and uploads it next to the
// original. Returns { path, url }, or null if the format can't be decoded
// (the gallery then falls back to the original).
async function uploadThumbnail(file, path) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale  = Math.min(1, THUMB_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))
    if (!blob) return null
    const r = ref(storage, path)
    await uploadBytes(r, blob, { contentType: 'image/jpeg' })
    return { path, url: await getDownloadURL(r) }
  } catch {
    return null
  }
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
  const [lightbox, setLightbox] = useState(null)
  const [adminTab, setAdminTab] = useState('all')
  const fileRef = useRef(null)
  const t = strings[lang]

  const { photos, loading }       = usePhotos(isAdmin)
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
    if (!file.type.startsWith('image/')) return setError(t.notImage)
    if (file.size > MAX_BYTES) return setError(t.tooBig)
    setProgress(0)

    const stamp    = Date.now()
    const ext      = file.name.split('.').pop() || 'jpg'
    const storPath = `photos/${user.uid}/${stamp}.${ext}`
    // Small preview for the gallery grid (keeps it fast with hundreds of photos).
    const thumb    = await uploadThumbnail(file, `photos/${user.uid}/${stamp}_thumb.jpg`)
    const task     = uploadBytesResumable(ref(storage, storPath), file)

    task.on(
      'state_changed',
      snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      ()   => { setError(t.error); setProgress(null) },
      async () => {
        try {
          const downloadURL = await getDownloadURL(task.snapshot.ref)
          await addDoc(collection(firestore, 'photos'), {
            guestId: user.uid, storagePath: storPath,
            downloadURL, status: 'approved',
            ...(thumb && { thumbPath: thumb.path, thumbURL: thumb.url }),
            createdAt: serverTimestamp(),
          })
        } catch { setError(t.error) }
        finally  { setProgress(null) }
      }
    )
  }

  // ── Admin actions ───────────────────────────────────────────────────────────

  const handleHide = useCallback(async (photo) => {
    await updateDoc(doc(firestore, 'photos', photo.id), {
      status: photo.status === 'hidden' ? 'approved' : 'hidden',
    })
  }, [])

  const handleDelete = useCallback(async (photo) => {
    if (!window.confirm(t.confirmDel)) return
    await deleteDoc(doc(firestore, 'photos', photo.id))
    try { await deleteObject(ref(storage, photo.storagePath)) } catch {}
    if (photo.thumbPath) try { await deleteObject(ref(storage, photo.thumbPath)) } catch {}
    if (lightbox?.id === photo.id) setLightbox(null)
  }, [lightbox, t.confirmDel])

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

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

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
      {!loading && displayed.length === 0 && <p style={s.empty}>{t.empty}</p>}
      {displayed.length > 0 && (
        <div style={s.grid}>
          {displayed.map(photo => (
            <PhotoCard key={photo.id} photo={photo} isAdmin={isAdmin} t={t}
              onOpen={() => setLightbox(photo)}
              onHide={() => handleHide(photo)}
              onDelete={() => handleDelete(photo)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={s.overlay} onClick={() => setLightbox(null)}>
          <button style={s.closeBtn} onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox.downloadURL} alt="" style={s.lightboxImg}
            onClick={e => e.stopPropagation()} />
        </div>
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
  adminBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.9)' },
  adminBtn:     { background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600, color: '#333', padding: '0.1rem 0.15rem' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  closeBtn:     { position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1, zIndex: 1001 },
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
