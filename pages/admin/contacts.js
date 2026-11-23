import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { firestore } from '../../src/firebase/firebaseClient'
import ProtectedRoute from '../../src/components/ProtectedRoute'
import useAdmin from '../../src/hooks/useAdmin'
import { formatPhone } from '../../src/lib/phone'
import { GREEN } from '../../src/theme'

// Admin: pick guests and get their numbers for WhatsApp (no message is sent
// from the app). WhatsApp only lets you add SAVED contacts to a group or a
// broadcast list, hence the .vcf export; the per-guest links open a chat with
// the message prefilled without saving anything.
export default function ContactsPage() {
  return <ProtectedRoute><Contacts /></ProtectedRoute>
}

const GROUPS = [
  { key: 'all',     label: 'Tous' },
  { key: 'friday',  label: 'Invités vendredi' },
  { key: 'lodging', label: 'Logés au Domaine' },
]

function Contacts() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [group, setGroup] = useState('all')
  const [primaryOnly, setPrimaryOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      try {
        const [persons, households, friday, lodging] = await Promise.all([
          getDocs(collection(firestore, 'persons')),
          getDocs(collection(firestore, 'households')),
          getDoc(doc(firestore, 'access', 'friday')),
          getDoc(doc(firestore, 'access', 'lodging')),
        ])
        setData({
          persons: persons.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.phone),
          households: Object.fromEntries(households.docs.map(d => [d.id, d.data()])),
          friday: new Set(friday.data()?.householdIds ?? []),
          lodging: new Set(lodging.data()?.householdIds ?? []),
        })
      } catch (e) { setError(e.message) }
    })()
  }, [isAdmin])

  // Guests matching the filters, grouped by household (alphabetical).
  const visible = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.persons
      .filter(p => group === 'all' || data[group].has(p.householdId))
      .filter(p => !primaryOnly || p.isPrimaryContact)
      .filter(p => !q || `${p.prenom} ${p.nom} ${data.households[p.householdId]?.displayName ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => householdName(data, a).localeCompare(householdName(data, b)) || a.prenom.localeCompare(b.prenom))
  }, [data, group, primaryOnly, search])

  const chosen = data ? data.persons.filter(p => selected.has(p.id)) : []
  const allVisibleSelected = visible.length > 0 && visible.every(p => selected.has(p.id))

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllVisible() {
    setSelected(prev => {
      const n = new Set(prev)
      visible.forEach(p => allVisibleSelected ? n.delete(p.id) : n.add(p.id))
      return n
    })
  }

  async function copyNumbers() {
    try {
      await navigator.clipboard.writeText(chosen.map(p => p.phone).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError('Copie impossible sur ce navigateur.') }
  }

  function downloadVcf() {
    const blob = new Blob([toVcf(chosen)], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `invites-mariage-${chosen.length}.vcf` })
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (adminLoading) return <main style={s.main}><p style={s.muted}>Chargement…</p></main>
  if (!isAdmin) return <main style={s.main}><p style={s.muted}>Réservé aux administrateurs.</p></main>

  return (
    <main style={s.main}>
      <button onClick={() => router.push('/admin/settings')} style={s.back}>← Réglages</button>
      <h1 style={s.h1}>Contacts WhatsApp</h1>
      <p style={s.intro}>
        Sélectionnez des invités puis copiez leurs numéros ou téléchargez-les en contacts.
        WhatsApp n’accepte dans un groupe ou une liste de diffusion que des numéros enregistrés
        dans votre téléphone : importez d’abord le fichier .vcf. Seuls les invités avec un numéro apparaissent.
      </p>

      {!data ? <p style={s.muted}>{error ?? 'Chargement…'}</p> : <>
        <div style={s.chips}>
          {GROUPS.map(g => (
            <button key={g.key} onClick={() => setGroup(g.key)}
              style={{ ...s.chip, ...(group === g.key ? s.chipOn : {}) }}>{g.label}</button>
          ))}
        </div>
        <label style={s.check}>
          <input type="checkbox" checked={primaryOnly} onChange={e => setPrimaryOnly(e.target.checked)} />
          Un seul contact par foyer (contact principal)
        </label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un nom ou un foyer…" style={s.input} />

        <div style={s.listHead}>
          <span style={s.muted}>{visible.length} affiché{visible.length > 1 ? 's' : ''}</span>
          <button onClick={toggleAllVisible} style={s.link} disabled={!visible.length}>
            {allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>
        <div style={s.list}>
          {visible.map((p, i) => {
            const hh = householdName(data, p)
            const newHousehold = i === 0 || householdName(data, visible[i - 1]) !== hh
            return (
              <div key={p.id}>
                {newHousehold && <p style={s.hh}>{hh}</p>}
                <label style={s.person}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span style={{ flex: 1 }}>{p.prenom} {p.nom}{p.isPrimaryContact && <span style={s.star} title="Contact principal"> ★</span>}</span>
                  <span style={s.phone}>{formatPhone(p.phone)}</span>
                </label>
              </div>
            )
          })}
        </div>

        {/* Actions on the selection */}
        <div style={s.bar}>
          <p style={s.count}>{chosen.length} numéro{chosen.length > 1 ? 's' : ''} sélectionné{chosen.length > 1 ? 's' : ''}
            {chosen.length > 0 && <button onClick={() => setSelected(new Set())} style={{ ...s.link, marginLeft: '0.5rem' }}>vider</button>}
          </p>
          <div style={s.actions}>
            <button onClick={copyNumbers} disabled={!chosen.length} style={btn(chosen.length)}>
              {copied ? '✓ Copiés' : '📋 Copier les numéros'}
            </button>
            <button onClick={downloadVcf} disabled={!chosen.length} style={btn(chosen.length)}>
              📇 Contacts (.vcf)
            </button>
          </div>
        </div>

        <h2 style={s.h2}>Message individuel (facultatif)</h2>
        <p style={s.hint}>
          Écrivez un message : chaque bouton ouvre WhatsApp sur la conversation avec l’invité, message
          pré-rempli, sans enregistrer le contact. Pratique pour quelques personnes.
        </p>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} style={s.input}
          placeholder="Bonjour ! Petit rappel : …" />
        {chosen.length > 0 && (
          <div style={s.list}>
            {chosen.map(p => (
              <div key={p.id} style={s.person}>
                <span style={{ flex: 1 }}>{p.prenom} {p.nom}</span>
                <a href={waLink(p.phone, message)} target="_blank" rel="noopener noreferrer" style={s.wa}>WhatsApp ↗</a>
              </div>
            ))}
          </div>
        )}

        {error && <p style={s.err}>{error}</p>}
      </>}
    </main>
  )
}

function householdName(data, p) {
  return data.households[p.householdId]?.displayName ?? p.householdId ?? '—'
}

// https://faq.whatsapp.com/5913398998672934 — number in international format, digits only.
function waLink(phone, text) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${text.trim() ? `?text=${encodeURIComponent(text.trim())}` : ''}`
}

// vCard 3.0, one card per guest; category "Mariage" to find (or delete) them later.
function toVcf(persons) {
  const esc = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1')
  return persons.map(p => [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(p.nom)};${esc(p.prenom)};;;`,
    `FN:${esc(`${p.prenom} ${p.nom}`.trim())}`,
    `TEL;TYPE=CELL:${p.phone}`,
    'CATEGORIES:Mariage',
    'NOTE:Invité mariage 3 juillet 2027',
    'END:VCARD',
  ].join('\r\n')).join('\r\n') + '\r\n'
}

const btn = enabled => ({ ...s.btn, ...(enabled ? {} : { background: '#bbb', cursor: 'not-allowed' }) })

const s = {
  main:   { maxWidth: 480, margin: '0 auto', padding: '1.25rem 1.25rem 7rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  back:   { background: 'none', border: 'none', cursor: 'pointer', color: '#555', marginBottom: '1.25rem', padding: 0, fontSize: '0.9rem' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  intro:  { fontSize: '0.85rem', color: '#777', margin: '0 0 1.25rem', lineHeight: 1.5 },
  h2:     { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E4A2E', margin: '1.75rem 0 0.5rem' },
  hint:   { fontSize: '0.8rem', color: '#777', margin: '0 0 0.5rem', lineHeight: 1.45 },
  muted:  { color: '#999', fontSize: '0.85rem' },
  chips:  { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' },
  chip:   { padding: '0.45rem 0.8rem', borderRadius: 999, border: '1px solid #ccc', background: '#fff', fontSize: '0.85rem', cursor: 'pointer', color: '#444' },
  chipOn: { background: GREEN, borderColor: GREEN, color: '#fff', fontWeight: 600 },
  check:  { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', marginBottom: '0.75rem', cursor: 'pointer' },
  input:  { width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.7rem', borderRadius: '0.55rem', border: '1px solid #ccc', fontSize: '16px', fontFamily: 'inherit', background: '#fff', marginBottom: '0.5rem' },
  listHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0 0.4rem' },
  link:   { background: 'none', border: 'none', color: GREEN, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', padding: 0, textDecoration: 'underline' },
  list:   { background: '#fff', borderRadius: '0.75rem', padding: '0.25rem 0.75rem' },
  hh:     { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999', margin: '0.75rem 0 0.15rem' },
  person: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', fontSize: '0.92rem', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' },
  star:   { color: '#E89C2E' },
  phone:  { fontSize: '0.8rem', color: '#777', whiteSpace: 'nowrap' },
  bar:    { position: 'sticky', bottom: '1.5rem', marginTop: '1rem', background: '#fff', borderRadius: '0.9rem', padding: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' },
  count:  { margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 },
  actions:{ display: 'flex', gap: '0.5rem' },
  btn:    { flex: 1, padding: '0.7rem 0.5rem', borderRadius: '0.6rem', border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' },
  wa:     { background: '#25D366', color: '#fff', padding: '0.35rem 0.7rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' },
  err:    { color: '#c0392b', fontSize: '0.85rem', marginTop: '1rem' },
}
