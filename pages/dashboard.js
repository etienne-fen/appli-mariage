import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'
import ProtectedRoute from '../src/components/ProtectedRoute'

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const GREEN  = '#1E4A2E'
const CREAM  = '#F5E8D0'
const CORAL  = '#C04040'
const GOLD   = '#E8A020'

const NAV_ITEMS = [
  { path: '/group',      icon: '👥', FR: 'Mon groupe',     EN: 'My group'      },
  { path: '/rsvp',       icon: '✉️', FR: 'Mes réponses',   EN: 'My RSVPs'      },
  { path: '/meals',      icon: '🍽️', FR: 'Mon menu',       EN: 'My meal'       },
  { path: '/info',       icon: 'ℹ️', FR: 'Infos mariage',  EN: 'Wedding info'  },
  { path: '/directions', icon: '📍', FR: 'Comment venir',  EN: 'Getting there' },
  { path: '/photos',     icon: '📸', FR: 'Photos',         EN: 'Photos'        },
]

const t = {
  FR: { welcome: 'Bienvenue', explore: 'Explorer', signOut: 'Déconnexion' },
  EN: { welcome: 'Welcome',   explore: 'Explore',  signOut: 'Sign out'    },
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}

function Dashboard() {
  const { signOut, person } = useAuth()
  const router           = useRouter()
  const [lang, setLang]         = useState('FR')
  const [menuOpen, setMenuOpen] = useState(false)
  const strings = t[lang]

  // First name from the signed-in person's record; falls back to nothing while loading
  const firstName = person?.prenom ?? null

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button onClick={() => setMenuOpen(true)} style={s.burgerBtn} aria-label="Menu">
          <span style={s.bar} />
          <span style={s.bar} />
          <span style={s.bar} />
        </button>
        <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
          {lang === 'FR' ? 'EN' : 'FR'}
        </button>
      </div>

      {/* Hero */}
      <div style={s.hero}>
        {/* Welcome */}
        <div style={s.welcomeBlock}>
          <p style={s.welcomeLine}>{strings.welcome},</p>
          <p style={s.firstName}>{firstName ? `${firstName} !` : '!'}</p>
        </div>

        {/* Divider */}
        <WavyLine />

        {/* Wedding info */}
        <div style={s.coupleBlock}>
          <p style={s.coupleName}>Charlotte &amp; Etienne</p>
          <p style={s.tagline}>Du Sud, d'Est en Ouest</p>
          <p style={s.weddingDate}>3 juillet 2027</p>
        </div>

        {/* CTA */}
        <button onClick={() => setMenuOpen(true)} style={s.exploreBtn}>
          {strings.explore} &rarr;
        </button>
      </div>

      {/* Gold scallop strip */}
      <ScallopBottom />

      {/* Drawer */}
      <Drawer
        open={menuOpen}
        lang={lang}
        strings={strings}
        onClose={() => setMenuOpen(false)}
        onNav={path => { setMenuOpen(false); router.push(path) }}
        onSignOut={handleSignOut}
      />
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function Drawer({ open, lang, strings, onClose, onNav, onSignOut }) {
  return (
    <>
      {/* Dimmed overlay */}
      <div
        onClick={onClose}
        style={{
          ...d.overlay,
          opacity:       open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Slide-in panel */}
      <div style={{ ...d.panel, transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
        {/* Drawer header */}
        <div style={d.header}>
          <div>
            <p style={d.drawerCouple}>Charlotte &amp; Etienne</p>
            <p style={d.drawerDate}>3 juillet 2027</p>
          </div>
          <button onClick={onClose} style={d.closeBtn}>✕</button>
        </div>

        <div style={d.divider} />

        {/* Nav links */}
        <nav style={d.nav}>
          {NAV_ITEMS.map(item => (
            <button key={item.path} onClick={() => onNav(item.path)} style={d.navItem}>
              <span style={d.navIcon}>{item.icon}</span>
              <span style={d.navLabel}>{item[lang]}</span>
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={d.divider} />
        <button onClick={onSignOut} style={d.signOut}>{strings.signOut}</button>
      </div>
    </>
  )
}

// ── Decorative ────────────────────────────────────────────────────────────────

function WavyLine() {
  return (
    <svg
      viewBox="0 0 240 16"
      style={{ display: 'block', width: '100%', maxWidth: '160px', margin: '0 auto' }}
      aria-hidden="true"
    >
      <path d="M0,8 Q30,2 60,8 Q90,14 120,8 Q150,2 180,8 Q210,14 240,8"
        fill="none" stroke={CORAL} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0,12 Q30,6 60,12 Q90,18 120,12 Q150,6 180,12 Q210,18 240,12"
        fill="none" stroke={CORAL} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ScallopBottom() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', overflow: 'hidden', lineHeight: 0 }}>
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 28, height: 14, borderRadius: '14px 14px 0 0', background: GOLD }} />
      ))}
    </div>
  )
}

// ── Styles — page ─────────────────────────────────────────────────────────────

const s = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: `radial-gradient(ellipse 100% 55% at 50% -5%, #EEC5B5 0%, transparent 65%), ${CREAM}`,
    overflow: 'hidden',
    fontFamily: SERIF,
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    zIndex: 10,
  },

  burgerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  bar: {
    display: 'block',
    width: 24,
    height: 2,
    background: GREEN,
    borderRadius: 2,
  },

  langBtn: {
    background: 'none',
    border: `1px solid ${GREEN}44`,
    borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: GREEN,
    fontFamily: SERIF,
    letterSpacing: '0.05em',
  },

  hero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '5rem 2rem 4rem',
    gap: '1.5rem',
  },

  welcomeBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' },
  welcomeLine: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 'clamp(1.2rem, 5vw, 1.6rem)',
    color: `${GREEN}cc`,
    margin: 0,
    fontWeight: 400,
  },
  firstName: {
    fontFamily: SERIF,
    fontWeight: 700,
    fontSize: 'clamp(2.8rem, 11vw, 4.5rem)',
    color: GREEN,
    margin: 0,
    lineHeight: 1.05,
  },

  coupleBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' },
  coupleName: {
    fontFamily: SERIF,
    fontWeight: 700,
    fontSize: 'clamp(1.4rem, 6vw, 2rem)',
    color: GREEN,
    margin: 0,
    letterSpacing: '0.02em',
  },
  tagline: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)',
    color: CORAL,
    margin: 0,
  },
  weddingDate: {
    fontFamily: SERIF,
    fontSize: '0.8rem',
    color: `${GREEN}88`,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    margin: '0.25rem 0 0',
  },

  exploreBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem 2rem',
    borderRadius: '3rem',
    background: GREEN,
    color: CREAM,
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: SERIF,
    letterSpacing: '0.06em',
    cursor: 'pointer',
  },
}

// ── Styles — drawer ───────────────────────────────────────────────────────────

const d = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: `${GREEN}60`,
    zIndex: 100,
    transition: 'opacity 0.3s ease',
  },

  panel: {
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    width: 'min(300px, 85vw)',
    background: CREAM,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 0 1.5rem',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1.5rem 1.25rem 1.25rem',
    background: GREEN,
  },
  drawerCouple: {
    fontFamily: SERIF,
    fontWeight: 700,
    fontSize: '1.1rem',
    color: CREAM,
    margin: '0 0 0.15rem',
  },
  drawerDate: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: '0.8rem',
    color: `${CREAM}bb`,
    margin: 0,
    letterSpacing: '0.04em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: `${CREAM}cc`,
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.1rem',
    lineHeight: 1,
    marginTop: '0.1rem',
  },

  divider: {
    height: 1,
    background: `${GREEN}22`,
    margin: '0.5rem 1.25rem',
  },

  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.5rem 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.875rem 1.5rem',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
    borderRadius: 0,
  },
  navIcon:  { fontSize: '1.2rem', flexShrink: 0 },
  navLabel: { fontFamily: SERIF, fontSize: '1rem', color: GREEN, fontWeight: 600 },

  signOut: {
    margin: '0.5rem 1.25rem 0',
    padding: '0.65rem 1rem',
    background: 'none',
    border: `1.5px solid ${GREEN}44`,
    borderRadius: '0.5rem',
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: '0.875rem',
    color: `${GREEN}99`,
    cursor: 'pointer',
    textAlign: 'center',
  },
}
