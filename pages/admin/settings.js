import { useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../src/components/ProtectedRoute'
import useAdmin from '../../src/hooks/useAdmin'
import useSections, { MENU_TARGET_DATE, setInfoEnabled, setMenuEnabled, setRoomsVisible } from '../../src/hooks/useSections'
import { SECTIONS } from '../../src/lib/seedInfo'

// Admin switches: open/close the Menu and each "Infos mariage" page.
// A closed section stays visible to guests, greyed out as "Bientôt disponible".
export default function SettingsPage() {
  return <ProtectedRoute><Settings /></ProtectedRoute>
}

function Settings() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const { menuEnabled, roomsVisible, infoEnabled, loading } = useSections()
  const [error, setError] = useState(null)

  const run = async fn => {
    setError(null)
    try { await fn() } catch (e) { setError(e.message) }
  }

  if (adminLoading || loading) return <main style={s.main}><p style={s.muted}>Chargement…</p></main>
  if (!isAdmin) return <main style={s.main}><p style={s.muted}>Réservé aux administrateurs.</p></main>

  return (
    <main style={s.main}>
      <button onClick={() => router.push('/dashboard')} style={s.back}>← Retour</button>
      <h1 style={s.h1}>Réglages</h1>
      <p style={s.intro}>
        Une section désactivée reste visible pour les invités, grisée avec la mention
        « Bientôt disponible ». Les admins peuvent toujours l’ouvrir.
      </p>

      <h2 style={s.h2}>Mon menu</h2>
      <Toggle
        icon="🍽️"
        label="Choix du menu (dîner du samedi)"
        hint={menuEnabled
          ? 'Ouvert : les invités peuvent choisir leur plat.'
          : `Fermé. À ouvrir environ 2 mois avant le mariage (vers le ${MENU_TARGET_DATE}), quand le menu du chef est définitif.`}
        on={menuEnabled}
        onChange={v => run(() => setMenuEnabled(v))}
      />

      <h2 style={s.h2}>Hébergement</h2>
      <Toggle
        icon="🛏️"
        label="Chambres attribuées visibles"
        offLabel="Masquées aux invités"
        hint={roomsVisible
          ? 'Visibles : chaque invité voit sa chambre (Mon profil) et son bâtiment surligné sur le plan.'
          : 'Masquées : les invités lisent « Votre chambre vous sera communiquée prochainement ». Vous pouvez réorganiser les chambres librement, puis activer quand c’est définitif.'}
        on={roomsVisible}
        onChange={v => run(() => setRoomsVisible(v))}
      />

      <h2 style={s.h2}>Infos mariage</h2>
      {SECTIONS.map(sec => (
        <Toggle
          key={sec.id}
          icon={sec.icon}
          label={sec.labelFR}
          on={infoEnabled(sec.id)}
          onChange={v => run(() => setInfoEnabled(sec.id, v))}
        />
      ))}

      {error && <p style={s.err}>{error}</p>}
    </main>
  )
}

function Toggle({ icon, label, hint, on, onChange, offLabel = 'Désactivé · « Bientôt disponible »' }) {
  const [busy, setBusy] = useState(false)
  async function flip() {
    setBusy(true)
    try { await onChange(!on) } finally { setBusy(false) }
  }
  return (
    <div style={s.row}>
      <span style={s.icon} aria-hidden="true">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={s.label}>{label}</p>
        <p style={{ ...s.state, color: on ? '#27ae60' : '#999' }}>{on ? 'Activé' : offLabel}</p>
        {hint && <p style={s.hint}>{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={busy}
        onClick={flip}
        style={{ ...s.switch, background: on ? '#1E4A2E' : '#ccc', opacity: busy ? 0.6 : 1 }}
      >
        <span style={{ ...s.knob, transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  )
}

const s = {
  main:  { maxWidth: 480, margin: '0 auto', padding: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back:  { background: 'none', border: 'none', cursor: 'pointer', color: '#555', marginBottom: '1.25rem', padding: 0, fontSize: '0.9rem' },
  h1:    { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  intro: { fontSize: '0.85rem', color: '#888', margin: '0 0 1.5rem' },
  h2:    { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E4A2E', margin: '1.5rem 0 0.5rem' },
  row:   { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #eee' },
  icon:  { fontSize: '1.4rem' },
  label: { margin: 0, fontWeight: 600, fontSize: '0.95rem' },
  state: { margin: '0.1rem 0 0', fontSize: '0.75rem', fontWeight: 600 },
  hint:  { margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#777' },
  switch:{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: 'none', padding: 3, cursor: 'pointer', transition: 'background 0.2s' },
  knob:  { display: 'block', width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'transform 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' },
  muted: { color: '#aaa' },
  err:   { color: '#c0392b', fontSize: '0.85rem', marginTop: '1rem' },
}
