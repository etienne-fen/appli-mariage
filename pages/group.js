import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'
import ProtectedRoute from '../src/components/ProtectedRoute'
import useHousehold from '../src/hooks/useHousehold'
import useRoom from '../src/hooks/useRoom'
import strings from '../src/i18n/group'

export default function GroupPage() {
  return (
    <ProtectedRoute>
      <Group />
    </ProtectedRoute>
  )
}

function personName(p) {
  return [p.prenom, p.nom].filter(Boolean).join(' ')
}

function Group() {
  const router = useRouter()
  const { personId } = useAuth()
  const { household, members, loading } = useHousehold()
  const [lang, setLang] = useState('FR')
  const t = strings[lang]

  const me = members.find(m => m.personId === personId)
  const roomId = me?.roomId ?? members[0]?.roomId ?? null
  const { room, occupants, loading: roomLoading } = useRoom(roomId)

  const byId = Object.fromEntries(members.map(m => [m.personId, m]))
  const roommateHouseholds = {}
  occupants
    .filter(o => o.householdId !== household?.householdId)
    .forEach(o => {
      const key = o.householdId || o.personId
      if (!roommateHouseholds[key]) roommateHouseholds[key] = []
      roommateHouseholds[key].push(o)
    })

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/dashboard')} style={s.backBtn}>
          ← {t.back}
        </button>
        <button
          onClick={() => setLang(l => (l === 'FR' ? 'EN' : 'FR'))}
          style={s.langBtn}
        >
          {lang === 'FR' ? 'EN' : 'FR'}
        </button>
      </nav>

      <h1 style={s.title}>{t.title}</h1>
      {!loading && members.length > 0 && <p style={s.count}>{t.memberCount(members.length)}</p>}

      {loading ? (
        <p style={s.hint}>{t.loading}</p>
      ) : members.length === 0 ? (
        <p style={s.hint}>{t.noHousehold}</p>
      ) : (
        <>
          <ul style={s.list}>
            {members.map(m => (
              <li key={m.personId} style={s.row}>
                <div style={s.nameGroup}>
                  <span style={s.name}>{personName(m)}</span>
                  {m.personId === personId && <span style={s.tag}>{t.you}</span>}
                  <span style={s.tag}>{m.kind === 'adult' ? t.adult : t.child}</span>
                </div>
                {m.partnerId && byId[m.partnerId] && (
                  <p style={s.partner}>{t.withPartner(personName(byId[m.partnerId]))}</p>
                )}
              </li>
            ))}
          </ul>

          <h2 style={s.sectionTitle}>{t.roomTitle}</h2>
          {roomLoading ? (
            <p style={s.hint}>{t.loading}</p>
          ) : !room ? (
            <p style={s.hint}>{t.noRoom}</p>
          ) : (
            <div style={s.roomCard}>
              <p style={s.roomName}>{room.chambre}</p>
              <p style={s.roomMeta}>{room.batiment} · {room.niveau}</p>
              <p style={s.roomMeta}>{t.capacity(room.capacite)}</p>
            </div>
          )}

          {Object.keys(roommateHouseholds).length > 0 && (
            <>
              <h2 style={s.sectionTitle}>{t.roommatesTitle}</h2>
              <ul style={s.list}>
                {Object.values(roommateHouseholds).map(group => (
                  <li key={group[0].personId} style={s.row}>
                    <span style={s.name}>{group.map(personName).join(', ')}</span>
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

const s = {
  main: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1.25rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: '#555',
    padding: 0,
  },
  langBtn: {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: '#666',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  count: {
    color: '#888',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
  },
  hint: {
    color: '#aaa',
    fontSize: '0.9rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    margin: '1.75rem 0 0.75rem',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  row: {
    background: '#f9f9f9',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
  },
  nameGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  name: {
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  partner: {
    margin: '0.25rem 0 0',
    fontSize: '0.8rem',
    color: '#888',
    fontStyle: 'italic',
  },
  tag: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#ececec',
    color: '#555',
    whiteSpace: 'nowrap',
  },
  roomCard: {
    background: '#f9f9f9',
    borderRadius: '0.75rem',
    padding: '1rem',
  },
  roomName: {
    fontWeight: 700,
    fontSize: '1rem',
    margin: '0 0 0.25rem',
  },
  roomMeta: {
    fontSize: '0.85rem',
    color: '#888',
    margin: '0.15rem 0 0',
  },
}
