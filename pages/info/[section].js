import { useState } from 'react'
import { useRouter } from 'next/router'
import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../../src/firebase/firebaseClient'
import { SECTIONS } from '../../src/lib/seedInfo'
import useInfoSection from '../../src/hooks/useInfoSection'
import useAdmin from '../../src/hooks/useAdmin'
import { useAuth } from '../../src/context/AuthContext'
import useRoom from '../../src/hooks/useRoom'
import DomainMap from '../../src/components/DomainMap'
import InfoEditor from '../../src/components/InfoEditor'
import strings from '../../src/i18n/info'

export function getStaticPaths() {
  return {
    paths: SECTIONS.map(s => ({ params: { section: s.id } })),
    fallback: false,
  }
}
export function getStaticProps({ params }) {
  return { props: { sectionId: params.section } }
}

// Invitation-only blocks appended to a section. The security rules refuse the
// read for non-invited guests, and the block then renders nothing at all.
const RESTRICTED_BLOCKS = {
  schedule: [{ docId: 'schedule-friday', titleKey: 'fridayTitle' }],
}

export default function SectionPage({ sectionId }) {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const { isAdmin } = useAdmin()
  const t = strings[lang]

  const meta = SECTIONS.find(s => s.id === sectionId)
  const title = meta ? (lang === 'FR' ? meta.labelFR : meta.labelEN) : sectionId

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/info')} style={s.backBtn}>
          ← {t.backHub}
        </button>
        <div style={s.navRight}>
          <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
            {lang === 'FR' ? 'EN' : 'FR'}
          </button>
        </div>
      </nav>

      <h1 style={{ ...s.title, marginBottom: '1.25rem' }}>{meta?.icon} {title}</h1>

      {sectionId === 'accommodation' && <AccommodationMap lang={lang} />}

      {/* key={lang}: switching language discards an in-progress edit */}
      <EditableBlock key={`${sectionId}-${lang}`} docId={sectionId} lang={lang} isAdmin={isAdmin} t={t} />

      {(RESTRICTED_BLOCKS[sectionId] ?? []).map(block => (
        <RestrictedBlock key={`${block.docId}-${lang}`} {...block} lang={lang} isAdmin={isAdmin} t={t} />
      ))}
    </main>
  )
}

// Plan of the domain; for a signed-in guest with a room, their building is
// highlighted and their room is summarised above the plan.
function AccommodationMap({ lang }) {
  const { person } = useAuth()
  const { room } = useRoom(person?.roomId ?? null)
  const t = strings[lang]
  return (
    <>
      {room && (
        <div style={s.myRoom}>
          <p style={s.myRoomLabel}>{t.myRoom}</p>
          <p style={s.myRoomName}>{room.chambre}</p>
          <p style={s.myRoomMeta}>{room.batiment} · {room.niveau}</p>
        </div>
      )}
      <DomainMap highlight={room?.batiment ?? null} lang={lang} />
    </>
  )
}

function RestrictedBlock({ docId, titleKey, lang, isAdmin, t }) {
  const { user } = useAuth()
  const { data, loading } = useInfoSection(docId, user?.uid ?? null)
  // Hidden while loading, and entirely absent when the read was refused (null).
  // Admins still see an empty block so they can write its first version.
  if (loading || (data === null && !isAdmin)) return null
  return (
    <section style={s.restricted}>
      <h2 style={s.restrictedTitle}>{t[titleKey]}</h2>
      <EditableBlock docId={docId} lang={lang} isAdmin={isAdmin} t={t} preloaded={{ data, loading }} />
    </section>
  )
}

function EditableBlock({ docId, lang, isAdmin, t, preloaded }) {
  const own = useInfoSection(preloaded ? null : docId)
  const { data, loading } = preloaded ?? own
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setDraft(data?.[lang] ?? '')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft(null)
  }

  async function saveEditing() {
    setSaving(true)
    try {
      await setDoc(doc(firestore, 'info', docId), { [lang]: draft }, { merge: true })
      setEditing(false)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={s.muted}>{t.loading}</p>

  if (editing) {
    return (
      <div>
        <div style={s.editorBanner}>
          <span style={s.bannerLabel}>
            Édition — {lang === 'FR' ? 'Français' : 'English'}
          </span>
          <div style={s.bannerActions}>
            <button onClick={cancelEditing} style={s.cancelBtn}>{t.cancel ?? 'Annuler'}</button>
            <button onClick={saveEditing} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? '…' : (t.save ?? 'Enregistrer')}
            </button>
          </div>
        </div>
        <InfoEditor sectionId={docId} draft={draft} onChange={setDraft} lang={lang} />
      </div>
    )
  }

  return (
    <div>
      {isAdmin && (
        <div style={s.editRow}>
          <button onClick={startEditing} style={s.editBtn}>✎ Modifier</button>
        </div>
      )}
      {!data || !data[lang]
        ? <p style={s.muted}>{t.notFound}</p>
        : <SectionContent content={data[lang]} />}
    </div>
  )
}

// ── Read-only renderer ────────────────────────────────────────────────────────

function SectionContent({ content }) {
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: content }} />
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  main:    { maxWidth: '480px', margin: '0 auto', padding: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh' },
  nav:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  navRight:{ display: 'flex', gap: '0.5rem', alignItems: 'center' },
  backBtn: { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0 },
  langBtn: { background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666' },
  titleRow:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.5rem' },
  title:   { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  editBtn: { padding: '0.35rem 0.75rem', borderRadius: '0.4rem', border: '1.5px solid #ddd', background: 'none', fontSize: '0.8rem', cursor: 'pointer', color: '#555', whiteSpace: 'nowrap', flexShrink: 0 },
  muted:   { color: '#aaa', fontSize: '0.9rem' },
  editRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' },
  myRoom:      { background: '#E8A0201f', border: '1.5px solid #E8A020', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' },
  myRoomLabel: { margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a5a00' },
  myRoomName:  { margin: '0.15rem 0 0', fontSize: '1.1rem', fontWeight: 700 },
  myRoomMeta:  { margin: '0.1rem 0 0', fontSize: '0.85rem', color: '#666' },
  restricted:      { marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #eee' },
  restrictedTitle: { fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.75rem' },

  // Edit mode banner
  editorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff3cd', borderRadius: '0.5rem', padding: '0.6rem 0.875rem', marginBottom: '1rem' },
  bannerLabel:  { fontSize: '0.8rem', fontWeight: 600, color: '#856404' },
  bannerActions:{ display: 'flex', gap: '0.5rem' },
  cancelBtn:    { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #ccc', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' },
  saveBtn:      { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: 'none', background: '#1a1a1a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
}
