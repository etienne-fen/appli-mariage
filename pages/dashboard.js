import { useState } from 'react'
import useLang from '../src/context/LangContext'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'
import ProtectedRoute from '../src/components/ProtectedRoute'
import useAdmin from '../src/hooks/useAdmin'
import useSections from '../src/hooks/useSections'

// Look & feel taken from the invitation poster (public/main_picture.jpg):
// arch illustration, chunky green lettering with a pink "&", orange scallops.
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"
const GREEN    = '#1F5135' // lettering, hills
const CREAM    = '#F5ECDD' // poster background
const PINK     = '#C9748B' // "&", tagline, wavy line
const SKY      = '#EBB9AE' // pink sky
const SUN      = '#E89C2E' // sun, scallops
const LAVENDER = '#9D8DCB' // far hills
const SEA      = '#5D70B5' // sea
const SALMON   = '#E7957F' // beach
const CORAL    = '#C04040' // chili (kept for the drawer)

const WEDDING_DAY = new Date('2027-07-03T00:00:00')

// Each shortcut takes one colour of the poster.
const NAV_ITEMS = [
  { path: '/group',      icon: '👤', FR: 'Mon profil',     EN: 'My profile',    bg: SKY,      fg: GREEN },
  { path: '/rsvp',       icon: '✉️', FR: 'Mes réponses',   EN: 'My RSVPs',      bg: GREEN,    fg: CREAM },
  { path: '/meals',      icon: '🍽️', FR: 'Mon menu',       EN: 'My meal',       bg: SUN,      fg: GREEN },
  { path: '/info',       icon: 'ℹ️', FR: 'Infos mariage',  EN: 'Wedding info',  bg: SEA,      fg: CREAM },
  { path: '/directions', icon: '📍', FR: 'Comment venir',  EN: 'Getting there', bg: SALMON,   fg: GREEN },
  { path: '/photos',     icon: '📸', FR: 'Photos',         EN: 'Photos',        bg: LAVENDER, fg: CREAM },
]

const ADMIN_ITEM = { path: '/admin/settings', icon: '⚙️', FR: 'Réglages (admin)', EN: 'Settings (admin)', bg: '#fff', fg: GREEN }

const t = {
  FR: {
    welcome: 'Bienvenue',
    tagline: 'Mariage - Le Sud, d’Est en Ouest…',
    date: 'Samedi 3 juillet 2027',
    place: 'Domaine du Possible',
    countdown: n => n > 1 ? `Plus que ${n} jours` : n === 1 ? 'C’est demain !' : n === 0 ? 'C’est aujourd’hui !' : '',
    signOut: 'Déconnexion', soon: 'Bientôt disponible', hidden: 'masqué aux invités',
  },
  EN: {
    welcome: 'Welcome',
    tagline: 'Wedding - The South, from East to West…',
    date: 'Saturday 3 July 2027',
    place: 'Domaine du Possible',
    countdown: n => n > 1 ? `${n} days to go` : n === 1 ? 'It’s tomorrow!' : n === 0 ? 'It’s today!' : '',
    signOut: 'Sign out', soon: 'Coming soon', hidden: 'hidden from guests',
  },
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
  const [lang, setLang]         = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const strings = t[lang]
  const { isAdmin } = useAdmin()
  const { menuEnabled } = useSections()

  // The Menu is switchable by admins: closed → greyed "coming soon" for guests,
  // still reachable (and tagged) for admins.
  const navItems = [
    ...NAV_ITEMS.map(item => {
      if (item.path !== '/meals' || menuEnabled) return item
      return isAdmin ? { ...item, tag: strings.hidden } : { ...item, disabled: true, tag: strings.soon }
    }),
    ...(isAdmin ? [ADMIN_ITEM] : []),
  ]

  const firstName = person?.prenom ?? null
  const daysLeft = Math.ceil((WEDDING_DAY - new Date()) / 86400000)

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

      <main style={s.content}>
        {/* Arch illustration cut out of the poster (its own lettering is redrawn below) */}
        <div style={s.arch}>
          <img src="/main_picture.jpg" alt="" style={s.archImg} />
        </div>

        <p style={s.welcome}>
          {strings.welcome}{firstName ? `, ${firstName}` : ''} !
        </p>

        <h1 style={s.couple}>
          <span style={s.coupleLine}>Charlotte</span>
          <span style={s.coupleLine}><span style={{ color: PINK }}>&amp;</span> Etienne</span>
        </h1>

        <WavyLine />
        <p style={s.tagline}>{strings.tagline}</p>

        <div style={s.datePill}>
          <span>{strings.date}</span>
          <span style={s.dot} aria-hidden="true">·</span>
          <span>{strings.place}</span>
        </div>
        {daysLeft >= 0 && <p style={s.countdown}>☀️ {strings.countdown(daysLeft)}</p>}

        {/* Shortcuts — same entries as the menu */}
        <nav style={s.grid}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => !item.disabled && router.push(item.path)}
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              style={{
                ...s.tile,
                background: item.bg,
                color: item.fg,
                ...(item.path === ADMIN_ITEM.path ? s.tileAdmin : {}),
                ...(item.disabled ? s.tileDisabled : {}),
              }}
            >
              <span style={s.tileIcon} aria-hidden="true">{item.icon}</span>
              <span style={s.tileLabel}>{item[lang]}</span>
              {item.tag && <span style={s.tileTag}>{item.tag}</span>}
            </button>
          ))}
        </nav>
      </main>


      <Drawer
        open={menuOpen}
        items={navItems}
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

function Drawer({ open, items, lang, strings, onClose, onNav, onSignOut }) {
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
      <div style={{ ...d.panel, transform: open ? 'translateX(0)' : 'translateX(-100%)', boxShadow: open ? d.panel.boxShadow : 'none' }}>
        <div style={d.header}>
          <div>
            <p style={d.drawerCouple}>Charlotte <span style={{ color: SKY }}>&amp;</span> Etienne</p>
            <p style={d.drawerDate}>3 juillet 2027</p>
          </div>
          <button onClick={onClose} style={d.closeBtn}>✕</button>
        </div>

        <div style={d.divider} />

        <nav style={d.nav}>
          {items.map(item => (
            <button
              key={item.path}
              onClick={() => !item.disabled && onNav(item.path)}
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              style={{ ...d.navItem, ...(item.disabled ? d.navDisabled : {}) }}
            >
              <span style={d.navIcon}>{item.icon}</span>
              <span style={d.navText}>
                <span style={d.navLabel}>{item[lang]}</span>
                {item.tag && <span style={d.navTag}>{item.tag}</span>}
              </span>
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
    <svg viewBox="0 0 240 12" style={{ display: 'block', width: '150px', margin: '0.35rem auto 0' }} aria-hidden="true">
      <path d="M2,6 Q17,0 32,6 T62,6 T92,6 T122,6 T152,6 T182,6 T212,6 T238,6"
        fill="none" stroke={PINK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── Styles — page ─────────────────────────────────────────────────────────────

// Arch crop inside the 1054×1492 poster: x 120→935, y 40→1100.
const ARCH = { x: 120, y: 40, w: 815, h: 1060, imgW: 1054 }

const s = {
  page: {
    position: 'relative',
    minHeight: 'calc(100vh - 30px)',
    overflow: 'hidden',
    fontFamily: SERIF,
    color: GREEN,
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    zIndex: 10,
  },
  burgerBtn: {
    background: `${CREAM}d9`, border: 'none', cursor: 'pointer', padding: '0.45rem',
    borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '5px',
  },
  bar: { display: 'block', width: 22, height: 2, background: GREEN, borderRadius: 2 },
  langBtn: {
    background: `${CREAM}d9`, border: `1px solid ${GREEN}44`, borderRadius: '0.35rem',
    padding: '0.25rem 0.55rem', fontSize: '0.75rem', cursor: 'pointer', color: GREEN,
    fontFamily: SERIF, letterSpacing: '0.05em',
  },

  content: {
    maxWidth: '440px',
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3.75rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },

  arch: {
    position: 'relative',
    width: 'min(78%, 300px)',
    aspectRatio: `${ARCH.w} / ${ARCH.h}`,
    overflow: 'hidden',
    borderRadius: `50% 50% 0 0 / ${(ARCH.w / 2 / ARCH.h * 100).toFixed(1)}% ${(ARCH.w / 2 / ARCH.h * 100).toFixed(1)}% 0 0`,
    // Soft fade at the bottom so the beach melts into the page.
    WebkitMaskImage: 'linear-gradient(to bottom, #000 82%, transparent 100%)',
    maskImage: 'linear-gradient(to bottom, #000 82%, transparent 100%)',
  },
  archImg: {
    position: 'absolute',
    width: `${(ARCH.imgW / ARCH.w * 100).toFixed(2)}%`,
    left: `${(-ARCH.x / ARCH.w * 100).toFixed(2)}%`,
    top: `${(-ARCH.y / ARCH.w * 100).toFixed(2)}%`, // % of width, like the rest
    maxWidth: 'none',
    display: 'block',
  },

  welcome: {
    margin: '0.25rem 0 0.35rem',
    fontStyle: 'italic',
    fontWeight: 500,
    fontSize: 'clamp(1.05rem, 4.5vw, 1.3rem)',
    color: PINK,
  },
  couple: {
    margin: 0,
    fontWeight: 900,
    fontSize: 'clamp(2.3rem, 11vw, 3.2rem)',
    lineHeight: 0.98,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
    color: GREEN,
    fontVariationSettings: "'SOFT' 100, 'WONK' 0",
  },
  coupleLine: { display: 'block' },
  tagline: {
    margin: '0.45rem 0 0',
    fontWeight: 600,
    fontSize: 'clamp(1rem, 4.2vw, 1.15rem)',
    color: PINK,
  },
  datePill: {
    marginTop: '1.1rem',
    display: 'inline-flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.15rem 0.45rem',
    padding: '0.45rem 1rem',
    borderRadius: '999px',
    border: `1.5px solid ${GREEN}33`,
    fontSize: '0.85rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  dot: { color: SUN, fontWeight: 900 },
  countdown: { margin: '0.6rem 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: `${GREEN}b3` },

  grid: {
    width: '100%',
    marginTop: '1.75rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.7rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: '0.35rem',
    minHeight: '92px',
    padding: '0.85rem 0.9rem',
    border: 'none',
    borderRadius: '1.1rem 1.1rem 0.4rem 1.1rem',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: SERIF,
    boxShadow: '0 2px 0 rgba(0,0,0,0.08)',
  },
  tileIcon: { fontSize: '1.35rem', lineHeight: 1 },
  tileLabel: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.15 },
  tileTag: { fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.85 },
  tileAdmin: { gridColumn: '1 / -1', minHeight: 0, flexDirection: 'row', alignItems: 'center', border: `1.5px dashed ${GREEN}55`, boxShadow: 'none' },
  tileDisabled: { opacity: 0.45, cursor: 'default', filter: 'grayscale(0.6)' },
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
  drawerCouple: { fontFamily: SERIF, fontWeight: 800, fontSize: '1.1rem', color: CREAM, margin: '0 0 0.15rem' },
  drawerDate: { fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.8rem', color: `${CREAM}bb`, margin: 0, letterSpacing: '0.04em' },
  closeBtn: { background: 'none', border: 'none', color: `${CREAM}cc`, fontSize: '1.25rem', cursor: 'pointer', padding: '0.1rem', lineHeight: 1, marginTop: '0.1rem' },
  divider: { height: 1, background: `${GREEN}22`, margin: '0.5rem 1.25rem' },
  nav: { display: 'flex', flexDirection: 'column', padding: '0.5rem 0' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1.5rem',
    background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%', borderRadius: 0,
  },
  navIcon:  { fontSize: '1.2rem', flexShrink: 0 },
  navLabel: { fontFamily: SERIF, fontSize: '1rem', color: GREEN, fontWeight: 600 },
  navText:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  navTag:   { fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.75rem', color: `${GREEN}99` },
  navDisabled: { opacity: 0.45, cursor: 'default' },
  signOut: {
    margin: '0.5rem 1.25rem 0', padding: '0.65rem 1rem', background: 'none',
    border: `1.5px solid ${CORAL}55`, borderRadius: '0.5rem', fontFamily: SERIF, fontStyle: 'italic',
    fontSize: '0.875rem', color: CORAL, cursor: 'pointer', textAlign: 'center',
  },
}
