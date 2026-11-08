import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'
import ProtectedRoute from '../src/components/ProtectedRoute'
import useHousehold from '../src/hooks/useHousehold'
import useRoom from '../src/hooks/useRoom'
import useRooms from '../src/hooks/useRooms'
import useEvents from '../src/hooks/useEvents'
import useRsvp from '../src/hooks/useRsvp'
import { formatPhone } from '../src/lib/phone'
import strings from '../src/i18n/group'

// "Mon profil": the signed-in guest, then "Ma tribu" (the other members of
// their household) — each with phone, accommodation and missing RSVP answers.
export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Profile />
    </ProtectedRoute>
  )
}

function personName(p) {
  return [p.prenom, p.nom].filter(Boolean).join(' ')
}

function Profile() {
  const router = useRouter()
  const { personId } = useAuth()
  const { household, members, loading: hLoading } = useHousehold()
  const { events, loading: eLoading } = useEvents()
  const { rsvpMap } = useRsvp(members)
  const [lang, setLang] = useState('FR')
  const t = strings[lang]

  const me = members.find(m => m.personId === personId)
  const tribe = members.filter(m => m.personId !== personId)
  const rooms = useRooms(members.map(m => m.roomId))

  // Guests from other households sleeping in my room.
  const { occupants } = useRoom(me?.roomId ?? null)
  const roommates = occupants.filter(o => o.householdId !== household?.householdId)

  // Events visible to this household (Friday ones only if invited) not yet answered.
  const pendingFor = pid =>
    events.filter(e => {
      const val = rsvpMap[e.id]?.[pid]
      return val !== true && val !== false
    }).length

  const loading = hLoading || eLoading
  const goRsvp = () => router.push('/rsvp')

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/dashboard')} style={s.backBtn}>
          ← {t.back}
        </button>
        <button onClick={() => setLang(l => (l === 'FR' ? 'EN' : 'FR'))} style={s.langBtn}>
          {lang === 'FR' ? 'EN' : 'FR'}
        </button>
      </nav>

      <h1 style={s.title}>{t.title}</h1>

      {loading ? (
        <p style={s.hint}>{t.loading}</p>
      ) : !me ? (
        <p style={s.hint}>{t.noHousehold}</p>
      ) : (
        <>
          <PersonCard
            person={me}
            room={rooms[me.roomId]}
            pending={pendingFor(me.personId)}
            roommates={roommates}
            isYou
            onAnswer={goRsvp}
            onShowMap={() => router.push('/info/accommodation')}
            t={t}
          />

          {tribe.length > 0 && (
            <>
              <h2 style={s.sectionTitle}>{t.tribeTitle}</h2>
              <ul style={s.list}>
                {tribe.map(m => (
                  <li key={m.personId}>
                    <PersonCard
                      person={m}
                      room={rooms[m.roomId]}
                      pending={pendingFor(m.personId)}
                      onAnswer={goRsvp}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  )
}

function PersonCard({ person, room, pending, roommates = [], isYou = false, onAnswer, onShowMap, t }) {
  const clickable = Boolean(room && onShowMap)
  return (
    <div style={s.card}>
      <div style={s.nameGroup}>
        <span style={s.name}>{personName(person)}</span>
        {isYou && <span style={s.tag}>{t.you}</span>}
        <span style={s.tag}>{person.kind === 'adult' ? t.adult : t.child}</span>
      </div>
      {person.phone && <p style={s.phone}>📞 {formatPhone(person.phone)}</p>}

      <div
        style={{ ...s.block, ...(clickable ? s.blockLink : {}) }}
        {...(clickable && {
          role: 'link',
          tabIndex: 0,
          onClick: onShowMap,
          onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShowMap() } },
        })}
      >
        <p style={s.blockLabel}>
          {t.roomTitle}
          {clickable && <span style={s.mapLink}>🗺️ {t.seeOnMap}</span>}
        </p>
        {person.roomId && room === undefined ? (
          <p style={s.hint}>{t.loading}</p>
        ) : !room ? (
          <p style={s.hint}>{t.noRoom}</p>
        ) : (
          <>
            <p style={s.roomName}>{room.chambre}</p>
            <p style={s.meta}>{room.batiment} · {room.niveau} · {t.capacity(room.capacite)}</p>
            {roommates.length > 0 && (
              <p style={s.meta}>{t.sharedWith(roommates.map(personName).join(', '))}</p>
            )}
          </>
        )}
      </div>

      {pending > 0 ? (
        <button onClick={onAnswer} style={{ ...s.pending, ...s.pendingTodo }}>
          <span>⏳ {t.pending(pending)}</span>
          <span style={s.answerLink}>{t.answerNow}</span>
        </button>
      ) : (
        <p style={{ ...s.pending, ...s.pendingDone }}>{t.pending(0)}</p>
      )}
    </div>
  )
}

const s = {
  main:     { maxWidth: '480px', margin: '0 auto', padding: '1.25rem', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh' },
  nav:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  backBtn:  { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0 },
  langBtn:  { background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666' },
  title:    { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1rem' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: 700, margin: '1.75rem 0 0.75rem' },
  hint:     { color: '#aaa', fontSize: '0.875rem', margin: 0 },
  list:     { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card:     { background: '#f9f9f9', borderRadius: '0.75rem', padding: '1rem' },
  nameGroup:{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  name:     { fontWeight: 700, fontSize: '1rem' },
  tag:      { fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#ececec', color: '#555', whiteSpace: 'nowrap' },
  phone:    { margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#555' },
  block:    { marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' },
  blockLabel: { margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' },
  blockLink: { cursor: 'pointer', borderRadius: '0.5rem', margin: '0.75rem -0.5rem 0', padding: '0.75rem 0.5rem 0.5rem', background: '#fff', border: '1.5px solid #E8A020' },
  mapLink:  { color: '#8a5a00', textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  roomName: { margin: 0, fontWeight: 600, fontSize: '0.95rem' },
  meta:     { margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#888' },
  pending:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', width: '100%', boxSizing: 'border-box', margin: '0.75rem 0 0', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit', border: 'none', textAlign: 'left' },
  pendingTodo: { background: '#fff3cd', color: '#856404', cursor: 'pointer', fontWeight: 600 },
  pendingDone: { background: '#e8f5e9', color: '#2e7d32' },
  answerLink:  { whiteSpace: 'nowrap', textDecoration: 'underline' },
}
