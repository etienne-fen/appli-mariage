import { useState } from 'react'
import { useRouter } from 'next/router'
import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../../src/firebase/firebaseClient'
import { SECTIONS } from '../../src/lib/seedInfo'
import useInfoSection from '../../src/hooks/useInfoSection'
import useAdmin from '../../src/hooks/useAdmin'
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

export default function SectionPage({ sectionId }) {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const { data, loading } = useInfoSection(sectionId)
  const { isAdmin } = useAdmin()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const t = strings[lang]

  const meta = SECTIONS.find(s => s.id === sectionId)
  const title = meta ? (lang === 'FR' ? meta.labelFR : meta.labelEN) : sectionId

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
      await setDoc(doc(firestore, 'info', sectionId), { [lang]: draft }, { merge: true })
      setEditing(false)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/info')} style={s.backBtn}>
          ← {t.backHub}
        </button>
        <div style={s.navRight}>
          <button onClick={() => { if (editing) cancelEditing(); setLang(l => l === 'FR' ? 'EN' : 'FR') }} style={s.langBtn}>
            {lang === 'FR' ? 'EN' : 'FR'}
          </button>
        </div>
      </nav>

      <div style={s.titleRow}>
        <h1 style={s.title}>{meta?.icon} {title}</h1>
        {isAdmin && !loading && !editing && (
          <button onClick={startEditing} style={s.editBtn}>✎ Modifier</button>
        )}
      </div>

      {loading ? (
        <p style={s.muted}>{t.loading}</p>
      ) : editing ? (
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
          <InfoEditor sectionId={sectionId} draft={draft} onChange={setDraft} lang={lang} />
        </div>
      ) : !data || !data[lang] ? (
        <p style={s.muted}>{t.notFound}</p>
      ) : (
        <SectionContent content={data[lang]} />
      )}
    </main>
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

  // Edit mode banner
  editorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff3cd', borderRadius: '0.5rem', padding: '0.6rem 0.875rem', marginBottom: '1rem' },
  bannerLabel:  { fontSize: '0.8rem', fontWeight: 600, color: '#856404' },
  bannerActions:{ display: 'flex', gap: '0.5rem' },
  cancelBtn:    { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #ccc', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' },
  saveBtn:      { padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: 'none', background: '#1a1a1a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
}
