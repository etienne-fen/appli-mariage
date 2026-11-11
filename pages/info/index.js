import { useState } from 'react'
import { useRouter } from 'next/router'
import { SECTIONS } from '../../src/lib/seedInfo'
import strings from '../../src/i18n/info'
import useSections from '../../src/hooks/useSections'
import useAdmin from '../../src/hooks/useAdmin'

export default function InfoHub() {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const t = strings[lang]
  const { infoEnabled } = useSections()
  const { isAdmin } = useAdmin()

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/dashboard')} style={s.backBtn}>
          ← {t.back}
        </button>
        <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
          {lang === 'FR' ? 'EN' : 'FR'}
        </button>
      </nav>

      <h1 style={s.title}>{t.hub}</h1>
      <p style={s.sub}>{t.hubSub}</p>

      <div style={s.grid}>
        {SECTIONS.map(sec => {
          const enabled = infoEnabled(sec.id)
          // Closed sections: greyed "coming soon" for guests; admins can still open them.
          const locked = !enabled && !isAdmin
          return (
            <button
              key={sec.id}
              onClick={() => !locked && router.push(`/info/${sec.id}`)}
              disabled={locked}
              aria-disabled={locked || undefined}
              style={{ ...s.card, ...(enabled ? {} : s.cardOff) }}
            >
              <span style={s.icon}>{sec.icon}</span>
              <span style={s.label}>{lang === 'FR' ? sec.labelFR : sec.labelEN}</span>
              {!enabled && <span style={s.tag}>{isAdmin ? t.hiddenAdmin : t.soon}</span>}
            </button>
          )
        })}
      </div>
    </main>
  )
}

const s = {
  main: {
    maxWidth: '480px', margin: '0 auto', padding: '1.25rem',
    fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh',
  },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  backBtn: { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0 },
  langBtn: {
    background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub:   { color: '#888', fontSize: '0.875rem', marginBottom: '1.5rem' },
  grid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  card:  {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '0.5rem', padding: '1.5rem 1rem', borderRadius: '0.75rem',
    background: '#f5f5f5', border: 'none', cursor: 'pointer',
    textAlign: 'center',
  },
  cardOff: { opacity: 0.5, cursor: 'default' },
  tag:   { fontSize: '0.7rem', fontStyle: 'italic', color: '#777' },
  icon:  { fontSize: '1.75rem' },
  label: { fontSize: '0.9rem', fontWeight: 600, color: '#222' },
}
