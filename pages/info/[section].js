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
import useSections from '../../src/hooks/useSections'
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

// Sections with an invitation-only FULL alternative version. A guest who can
// read the variant doc (security rules: Friday invitees only) sees it INSTEAD
// of the standard one; everyone else gets the standard doc. Admins get tabs to
// preview/edit both.
const VARIANTS = {
  schedule: { docId: 'schedule-friday', tabKey: 'variantFriday' },
}

export default function SectionPage({ sectionId }) {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const { isAdmin } = useAdmin()
  const { infoEnabled, loading: sectionsLoading } = useSections()
  const enabled = infoEnabled(sectionId)
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

      {sectionsLoading ? null : !enabled && !isAdmin ? (
        <div style={s.soon}>
          <p style={s.soonTitle}>{t.soon}</p>
          <p style={s.muted}>{t.soonText}</p>
        </div>
      ) : (
        <>
          {!enabled && <p style={s.adminClosed}>🔒 {t.adminClosed}</p>}

          {sectionId === 'accommodation' && <AccommodationMap lang={lang} />}

          {VARIANTS[sectionId] ? (
            <VariantContent sectionId={sectionId} variant={VARIANTS[sectionId]} lang={lang} isAdmin={isAdmin} t={t} />
          ) : (
            /* key={lang}: switching language discards an in-progress edit */
            <EditableBlock key={`${sectionId}-${lang}`} docId={sectionId} lang={lang} isAdmin={isAdmin} t={t} />
          )}
        </>
      )}
    </main>
  )
}

// Plan of the domain; for a signed-in guest with a room, their building is
// highlighted and their room is summarised above the plan.
// Rooms switch (admin) off → guests see a "coming soon" note and no highlight;
// admins still see their room, tagged as hidden from guests.
function AccommodationMap({ lang }) {
  const { person } = useAuth()
  const { isAdmin } = useAdmin()
  const { roomsVisible } = useSections()
  const { room: myRoom } = useRoom(person?.roomId ?? null)
  const t = strings[lang]
  const room = roomsVisible || isAdmin ? myRoom : null
  return (
    <>
      {room ? (
        <div style={s.myRoom}>
          {!roomsVisible && <p style={s.adminClosed}>🔒 {t.roomsHiddenAdmin}</p>}
          <p style={s.myRoomLabel}>{t.myRoom}</p>
          <p style={s.myRoomName}>{room.chambre}</p>
          <p style={s.myRoomMeta}>{room.batiment} · {room.niveau}</p>
        </div>
      ) : myRoom && !roomsVisible ? (
        <div style={s.myRoom}>
          <p style={s.myRoomLabel}>{t.myRoom}</p>
          <p style={s.myRoomMeta}>{t.roomSoon}</p>
        </div>
      ) : null}
      <DomainMap highlight={room?.batiment ?? null} lang={lang} />
    </>
  )
}

function VariantContent({ sectionId, variant, lang, isAdmin, t }) {
  const { user } = useAuth()
  // null when the rules refuse the read (not invited) or the doc doesn't exist.
  const variantDoc = useInfoSection(variant.docId, user?.uid ?? null)
  const [tab, setTab] = useState('standard')

  if (variantDoc.loading) return <p style={s.muted}>{t.loading}</p>

  if (isAdmin) {
    const docId = tab === 'standard' ? sectionId : variant.docId
    return (
      <>
        <div style={s.tabs} role="tablist">
          {[['standard', t.variantStandard], ['variant', t[variant.tabKey]]].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
        <p style={s.tabHint}>{tab === 'standard' ? t.variantStandardHint : t.variantFridayHint}</p>
        <EditableBlock key={`${docId}-${lang}`} docId={docId} lang={lang} isAdmin t={t} />
      </>
    )
  }

  // Invited guest → the variant only; everyone else → the standard version.
  return variantDoc.data
    ? <EditableBlock key={`${variant.docId}-${lang}`} docId={variant.docId} lang={lang} isAdmin={false} t={t} preloaded={variantDoc} />
    : <EditableBlock key={`${sectionId}-${lang}`} docId={sectionId} lang={lang} isAdmin={false} t={t} />
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
  soon:      { textAlign: 'center', background: '#f5f5f5', borderRadius: '0.75rem', padding: '2rem 1.25rem' },
  soonTitle: { fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem' },
  adminClosed: { fontSize: '0.8rem', color: '#856404', background: '#fff3cd', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', margin: '0 0 1rem' },
  myRoom:      { background: '#E8A0201f', border: '1.5px solid #E8A020', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' },
  myRoomLabel: { margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a5a00' },
  myRoomName:  { margin: '0.15rem 0 0', fontSize: '1.1rem', fontWeight: 700 },
  myRoomMeta:  { margin: '0.1rem 0 0', fontSize: '0.85rem', color: '#666' },
  tabs:    { display: 'flex', gap: '0.25rem', background: '#f0f0f0', borderRadius: '0.6rem', padding: '0.25rem', marginBottom: '0.5rem' },
  tab:     { flex: 1, padding: '0.5rem 0.4rem', border: 'none', borderRadius: '0.45rem', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#666', cursor: 'pointer' },
  tabActive: { background: '#fff', color: '#1a1a1a', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  tabHint: { fontSize: '0.75rem', color: '#888', margin: '0 0 1rem' },

  // Edit mode banner
  editorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff3cd', borderRadius: '0.5rem', padding: '0.6rem 0.875rem', marginBottom: '1rem' },
  bannerLabel:  { fontSize: '0.8rem', fontWeight: 600, color: '#856404' },
  bannerActions:{ display: 'flex', gap: '0.5rem' },
  cancelBtn:    { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #ccc', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' },
  saveBtn:      { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: 'none', background: '#1a1a1a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
}
