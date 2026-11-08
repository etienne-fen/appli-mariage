import { useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../src/components/ProtectedRoute'

// ── Venue — update these three constants ─────────────────────────────────────
const VENUE_NAME    = 'Le Domaine du Possible'
const VENUE_ADDRESS = 'Lieu dit Escoubet, 32800 Eauze, France'
const VENUE_LAT     = 43.89328783686889
const VENUE_LNG     = 0.11913227663971257
// ─────────────────────────────────────────────────────────────────────────────

const strings = {
  FR: {
    title:      'Comment venir',
    address:    'Adresse',
    copy:       'Copier l\'adresse',
    copied:     'Copié !',
    openIn:     'Ouvrir dans…',
    back:       'Retour',
  },
  EN: {
    title:      'Getting there',
    address:    'Address',
    copy:       'Copy address',
    copied:     'Copied!',
    openIn:     'Open in…',
    back:       'Back',
  },
}

export default function DirectionsPage() {
  return (
    <ProtectedRoute>
      <Directions />
    </ProtectedRoute>
  )
}

function Directions() {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const [copied, setCopied] = useState(false)
  const t = strings[lang]

  const query      = `${VENUE_LAT},${VENUE_LNG}`
  const googleUrl  = `https://maps.google.com/?q=${query}`
  const wazeUrl    = `https://waze.com/ul?ll=${query}&navigate=yes`
  const appleUrl   = `https://maps.apple.com/?ll=${query}&q=${encodeURIComponent(VENUE_NAME)}`

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${VENUE_NAME}\n${VENUE_ADDRESS}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available (http / old browser) — silent fail
    }
  }

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

      <h1 style={s.title}>📍 {t.title}</h1>

      {/* Address card */}
      <div style={s.card}>
        <p style={s.venueName}>{VENUE_NAME}</p>
        <p style={s.address}>{VENUE_ADDRESS}</p>
        <button onClick={copyAddress} style={{ ...s.copyBtn, background: copied ? '#e6f4ea' : '#f5f5f5', color: copied ? '#2e7d32' : '#333' }}>
          {copied ? `✓ ${t.copied}` : `📋 ${t.copy}`}
        </button>
      </div>

      {/* Navigation buttons */}
      <p style={s.openLabel}>{t.openIn}</p>
      <div style={s.navButtons}>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.navBtn, background: '#4285F4' }}>
          <span style={s.navIcon}>🗺️</span>
          <span style={s.navLabel}>Google Maps</span>
        </a>
        <a href={wazeUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.navBtn, background: '#06ADEF' }}>
          <span style={s.navIcon}>🚗</span>
          <span style={s.navLabel}>Waze</span>
        </a>
        <a href={appleUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.navBtn, background: '#1a1a1a' }}>
          <span style={s.navIcon}>🍎</span>
          <span style={s.navLabel}>Apple Maps</span>
        </a>
      </div>
    </main>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  main:       { maxWidth: '480px', margin: '0 auto', padding: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh' },
  nav:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  backBtn:    { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0 },
  langBtn:    { background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666' },
  title:      { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1.25rem' },

  card:       { background: '#f5f5f5', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem' },
  venueName:  { fontWeight: 700, fontSize: '1rem', margin: '0 0 0.4rem' },
  address:    { fontSize: '0.9rem', color: '#555', lineHeight: 1.5, margin: '0 0 1rem' },
  copyBtn:    { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, transition: 'background 0.15s' },

  openLabel:  { fontSize: '0.8rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' },
  navButtons: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  navBtn:     { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '0.875rem', textDecoration: 'none', color: '#fff', fontWeight: 600 },
  navIcon:    { fontSize: '1.5rem', flexShrink: 0 },
  navLabel:   { fontSize: '1rem' },
}
