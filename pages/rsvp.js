import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'
import ProtectedRoute from '../src/components/ProtectedRoute'
import useHousehold from '../src/hooks/useHousehold'
import useEvents from '../src/hooks/useEvents'
import useRsvp from '../src/hooks/useRsvp'
import useAdmin from '../src/hooks/useAdmin'
import AdminExportButton from '../src/components/AdminExportButton'
import strings from '../src/i18n/rsvp'

export default function RsvpPage() {
  return (
    <ProtectedRoute>
      <Rsvp />
    </ProtectedRoute>
  )
}

function Rsvp() {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const t = strings[lang]

  const { personId } = useAuth()
  const { household, members: rawMembers, loading: hLoading } = useHousehold()
  const { events, loading: eLoading } = useEvents()
  const { rsvpMap, setAttendance, setAttendanceMany } = useRsvp(rawMembers)
  const { isAdmin } = useAdmin()

  const loading = hLoading || eLoading

  // The signed-in guest first, then the rest of the tribe in household order.
  const members = rawMembers
    .map(m => ({
      memberId: m.personId,
      name: [m.prenom, m.nom].filter(Boolean).join(' '),
      isAdult: m.kind === 'adult',
      isYou: m.personId === personId,
    }))
    .sort((a, b) => b.isYou - a.isYou)

  // Events are already sorted by `order`; group them by day, keeping that order.
  const days = []
  events.forEach(e => {
    const key = e.dayKey ?? 'other'
    let day = days.find(d => d.key === key)
    if (!day) days.push(day = { key, events: [] })
    day.events.push(e)
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

      {isAdmin && (
        <AdminExportButton
          label={t.exportAll}
          busyLabel={t.exporting}
          doneLabel={t.exportDone}
          run={() => import('../src/lib/exportRsvp').then(m => m.exportRsvpXlsx())}
        />
      )}

      {loading ? (
        <p style={s.hint}>{t.loading}</p>
      ) : !household ? (
        <p style={s.hint}>{t.noHousehold}</p>
      ) : events.length === 0 ? (
        <p style={s.hint}>{t.noEvents}</p>
      ) : (
        <>
          {days.map(day => (
            <DaySection
              key={day.key}
              theme={DAY_THEMES[day.key] ?? DAY_THEMES.other}
              label={t.days[day.key] ?? ''}
              events={day.events}
              members={members}
              rsvpMap={rsvpMap}
              onToggle={setAttendance}
              onToggleDay={val => setAttendanceMany(members.map(m => m.memberId), day.events, val)}
              lang={lang}
              t={t}
            />
          ))}

          <Summary events={events} members={members} rsvpMap={rsvpMap} lang={lang} t={t} />
        </>
      )}
    </main>
  )
}

// One day: a "whole day" Yes/No that sets every answer of that day for every
// member shown, then the day's questions. The whole-day button lights up only
// when all answers of the day already match it; clicking it again clears them.
// One colour per day, from the app palette (see dashboard.js).
const DAY_THEMES = {
  friday:   { accent: '#C04040', tint: '#C040400f', icon: '🌙' },
  saturday: { accent: '#1E4A2E', tint: '#1E4A2E0d', icon: '💍' },
  sunday:   { accent: '#B07810', tint: '#E8A0201a', icon: '☀️' },
  other:    { accent: '#555555', tint: '#0000000a', icon: '📅' },
}

function DaySection({ theme, label, events, members, rsvpMap, onToggle, onToggleDay, lang, t }) {
  const [busy, setBusy] = useState(false)
  const values = events.flatMap(e => members.map(m => (rsvpMap[e.id] ?? {})[m.memberId] ?? null))
  const allYes = values.length > 0 && values.every(v => v === true)
  const allNo  = values.length > 0 && values.every(v => v === false)

  async function toggleDay(target, isActive) {
    setBusy(true)
    try { await onToggleDay(isActive ? null : target) }
    finally { setBusy(false) }
  }

  return (
    <section style={{ ...s.daySection, background: theme.tint, borderColor: `${theme.accent}40` }}>
      <h2 style={{ ...s.dayTitle, background: theme.accent }}>
        <span aria-hidden="true">{theme.icon}</span> {label}
      </h2>
      <div style={{ ...s.dayBar, borderColor: `${theme.accent}55` }}>
        <div>
          <p style={s.dayBarLabel}>{t.wholeDay}</p>
          <p style={s.dayBarHint}>{t.wholeDayHint(members.length)}</p>
        </div>
        <div style={{ ...s.toggleGroup, opacity: busy ? 0.6 : 1 }}>
          <button disabled={busy} onClick={() => toggleDay(true, allYes)}
            style={{ ...s.toggleBtn, ...(allYes ? s.toggleYes : {}) }}>
            {t.yes}
          </button>
          <button disabled={busy} onClick={() => toggleDay(false, allNo)}
            style={{ ...s.toggleBtn, ...(allNo ? s.toggleNo : {}) }}>
            {t.no}
          </button>
        </div>
      </div>
      <div style={{ ...s.eventList, padding: '0 0.75rem 0.75rem' }}>
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            members={members}
            attendance={rsvpMap[event.id] ?? {}}
            onToggle={(memberId, val) => onToggle(memberId, event, val)}
            lang={lang}
            t={t}
          />
        ))}
      </div>
    </section>
  )
}

function EventCard({ event, members, attendance, onToggle, lang, t }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{event.title[lang]}</span>
        <span style={s.cardMeta}>{event.timeStart}</span>
      </div>
      <ul style={s.memberList}>
        {members.map(m => {
          const val = attendance[m.memberId] ?? null
          return (
            <li key={m.memberId} style={s.memberRow}>
              <div style={s.memberName}>
                <span>{m.name}</span>
                {m.isYou && (
                  <span style={s.tag}>{t.you}</span>
                )}
                <span style={s.tag}>{m.isAdult ? t.adult : t.child}</span>
              </div>
              <div style={s.toggleGroup}>
                <button
                  onClick={() => onToggle(m.memberId, val === true ? null : true)}
                  style={{
                    ...s.toggleBtn,
                    ...(val === true ? s.toggleYes : {}),
                  }}
                >
                  {t.yes}
                </button>
                <button
                  onClick={() => onToggle(m.memberId, val === false ? null : false)}
                  style={{
                    ...s.toggleBtn,
                    ...(val === false ? s.toggleNo : {}),
                  }}
                >
                  {t.no}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Summary({ events, members, rsvpMap, lang, t }) {
  return (
    <div style={s.summary}>
      <h2 style={s.summaryTitle}>{t.summary}</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th} />
            {members.map(m => (
              <th key={m.memberId} style={s.th}>
                {m.name?.split(' ')[0] ?? '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event.id}>
              <td style={s.tdEvent}>{event.title[lang]}</td>
              {members.map(m => {
                const val = (rsvpMap[event.id] ?? {})[m.memberId] ?? null
                return (
                  <td key={m.memberId} style={s.tdStatus}>
                    <span style={{
                      ...s.dot,
                      ...(val === true ? s.dotYes : val === false ? s.dotNo : s.dotNone),
                    }}>
                      {val === true ? t.attending : val === false ? t.notAttending : t.notAnswered}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    background: 'none', border: 'none', fontSize: '0.9rem',
    cursor: 'pointer', color: '#555', padding: 0,
  },
  langBtn: {
    background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' },
  hint: { color: '#aaa', fontSize: '0.9rem' },
  eventList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  daySection: {
    marginBottom: '2.25rem', borderRadius: '1rem', border: '1.5px solid',
    overflow: 'hidden',
  },
  dayTitle: {
    margin: 0, padding: '0.7rem 1rem', color: '#fff',
    fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  dayBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
    background: '#fff', border: '1.5px solid', borderRadius: '0.75rem',
    padding: '0.75rem 1rem', margin: '0.75rem',
  },
  dayBarLabel: { margin: 0, fontWeight: 700, fontSize: '0.9rem' },
  dayBarHint: { margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#888' },
  card: {
    background: '#fff', borderRadius: '0.75rem', padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: '0.75rem',
  },
  cardTitle: { fontWeight: 700, fontSize: '1rem' },
  cardMeta: { fontSize: '0.8rem', color: '#888' },
  memberList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  memberRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  memberName: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', flex: 1, minWidth: 0 },
  tag: {
    fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.4rem',
    borderRadius: '999px', background: '#e8e8e8', color: '#555', whiteSpace: 'nowrap',
  },
  toggleGroup: { display: 'flex', borderRadius: '0.4rem', overflow: 'hidden', border: '1.5px solid #ddd', flexShrink: 0 },
  toggleBtn: {
    padding: '0.35rem 0.7rem', border: 'none', background: '#fff',
    fontSize: '0.8rem', cursor: 'pointer', color: '#555', fontWeight: 500,
  },
  toggleYes: { background: '#27ae60', color: '#fff' },
  toggleNo:  { background: '#c0392b', color: '#fff' },
  summary: { marginBottom: '2rem' },
  summaryTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#555', fontSize: '0.8rem' },
  tdEvent: { padding: '0.4rem 0.5rem', fontWeight: 500, color: '#333' },
  tdStatus: { padding: '0.4rem 0.5rem', textAlign: 'center' },
  dot: { display: 'inline-block', fontWeight: 700, fontSize: '0.9rem' },
  dotYes:  { color: '#27ae60' },
  dotNo:   { color: '#c0392b' },
  dotNone: { color: '#ccc' },
}
