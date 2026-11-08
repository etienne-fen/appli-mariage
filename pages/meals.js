import { useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../src/components/ProtectedRoute'
import { useAuth } from '../src/context/AuthContext'
import useHousehold from '../src/hooks/useHousehold'
import useMeals from '../src/hooks/useMeals'
import useAdmin from '../src/hooks/useAdmin'
import AdminExportButton from '../src/components/AdminExportButton'
import MEAL_OPTIONS from '../src/lib/mealOptions'
import strings from '../src/i18n/meals'

export default function MealsPage() {
  return <ProtectedRoute><Meals /></ProtectedRoute>
}

function Meals() {
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const t = strings[lang]

  const { personId } = useAuth()
  const { members: rawMembers, loading } = useHousehold()
  const { mealMap, saveMeal } = useMeals(rawMembers)

  const { isAdmin } = useAdmin()

  // The signed-in guest first, then the rest of the tribe.
  const members = rawMembers
    .map(m => ({
      memberId: m.personId,
      name: [m.prenom, m.nom].filter(Boolean).join(' '),
      isAdult: m.kind === 'adult',
      isYou: m.personId === personId,
      declinedDinner: m.attendance?.dinner === false,
    }))
    .sort((a, b) => b.isYou - a.isYou)
  const me = members.filter(m => m.isYou)
  const tribe = members.filter(m => !m.isYou)

  const renderCard = m => (
    <MemberCard
      key={m.memberId}
      member={m}
      meal={mealMap[m.memberId] ?? { regime: null, notes: '' }}
      onChoiceChange={choice => saveMeal(m.memberId, { regime: choice })}
      onNotesBlur={notes => saveMeal(m.memberId, { notes })}
      lang={lang}
      t={t}
    />
  )

  return (
    <main style={s.main}>
      <nav style={s.nav}>
        <button onClick={() => router.push('/dashboard')} style={s.backBtn}>← {t.back}</button>
        <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
          {lang === 'FR' ? 'EN' : 'FR'}
        </button>
      </nav>

      <h1 style={s.title}>{t.title}</h1>

      <div style={s.banner}>
        <span style={s.bannerIcon} aria-hidden="true">🍽️</span>
        <div>
          <p style={s.bannerTitle}>{t.dinnerOnlyTitle}</p>
          <p style={s.bannerText}>{t.dinnerOnlyText}</p>
        </div>
      </div>

      {isAdmin && (
        <AdminExportButton
          label={t.exportAll}
          busyLabel={t.exporting}
          doneLabel={t.exportDone}
          run={() => import('../src/lib/exportMeals').then(m => m.exportMealsXlsx())}
        />
      )}

      <p style={s.hint}>{t.savedHint}</p>

      {loading ? (
        <p style={s.muted}>{t.loading}</p>
      ) : (
        <>
          <div style={s.cards}>{me.map(renderCard)}</div>

          {tribe.length > 0 && (
            <>
              <h2 style={s.sectionTitle}>{t.tribeTitle}</h2>
              <div style={s.cards}>{tribe.map(renderCard)}</div>
            </>
          )}

          {members.length > 0 && (
            <Summary members={members} mealMap={mealMap} lang={lang} t={t} />
          )}
        </>
      )}
    </main>
  )
}

function MemberCard({ member, meal, onChoiceChange, onNotesBlur, lang, t }) {
  const [notes, setNotes] = useState(meal.notes)

  // keep local notes in sync when mealMap updates from Firestore
  // (e.g. on another device)
  const firestoreNotes = meal.notes
  if (notes !== firestoreNotes && document.activeElement?.dataset?.memberId !== member.memberId) {
    setNotes(firestoreNotes)
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.memberName}>{member.name}</span>
        <div style={s.tags}>
          {member.isYou && <span style={s.tag}>{t.you}</span>}
          <span style={s.tag}>{member.isAdult ? t.adult : t.child}</span>
        </div>
      </div>

      {member.declinedDinner && <p style={s.declined}>{t.declinedDinner}</p>}

      <p style={s.label}>{t.mainCourse}</p>
      <div style={s.optionGroup}>
        {MEAL_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onChoiceChange(meal.regime === opt.id ? null : opt.id)}
            style={{
              ...s.optionBtn,
              ...(meal.regime === opt.id ? s.optionActive : {}),
            }}
          >
            {opt.label[lang]}
          </button>
        ))}
      </div>

      <p style={s.label}>{t.dietaryNotes}</p>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={e => onNotesBlur(e.target.value)}
        data-member-id={member.memberId}
        placeholder={t.dietaryPlaceholder}
        rows={2}
        style={s.textarea}
      />
    </div>
  )
}

function Summary({ members, mealMap, lang, t }) {
  return (
    <div style={s.summary}>
      <h2 style={s.summaryTitle}>{t.summary}</h2>
      <table style={s.table}>
        <tbody>
          {members.map(m => {
            const meal = mealMap[m.memberId]
            const choice = MEAL_OPTIONS.find(o => o.id === meal?.regime)
            return (
              <tr key={m.memberId} style={s.tr}>
                <td style={s.tdName}>{m.name}</td>
                <td style={s.tdChoice}>
                  {choice
                    ? <span style={s.choicePill}>{choice.label[lang]}</span>
                    : <span style={s.muted}>{t.noChoice}</span>
                  }
                </td>
                <td style={s.tdNotes}>
                  {meal?.notes && (
                    <span style={s.noteText}>{meal.notes}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const s = {
  main: {
    maxWidth: '480px', margin: '0 auto', padding: '1.25rem',
    fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh',
  },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  backBtn: { background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', color: '#555', padding: 0 },
  langBtn: {
    background: 'none', border: '1px solid #ddd', borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#666',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' },
  hint: { fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem' },
  banner: {
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    background: '#1E4A2E0d', border: '1.5px solid #1E4A2E55', borderRadius: '0.75rem',
    padding: '0.85rem 1rem', margin: '0.75rem 0 1rem',
  },
  bannerIcon: { fontSize: '1.4rem', lineHeight: 1 },
  bannerTitle: { margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#1E4A2E' },
  bannerText: { margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#555' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: 700, margin: '0.5rem 0 0.75rem' },
  declined: {
    margin: '0 0 0.6rem', fontSize: '0.78rem', color: '#856404',
    background: '#fff3cd', borderRadius: '0.4rem', padding: '0.35rem 0.6rem',
  },
  muted: { color: '#aaa', fontSize: '0.875rem' },
  cards: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' },
  card: { background: '#f9f9f9', borderRadius: '0.75rem', padding: '1rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  memberName: { fontWeight: 600, fontSize: '0.95rem' },
  tags: { display: 'flex', gap: '0.35rem' },
  tag: {
    fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.4rem',
    borderRadius: '999px', background: '#e8e8e8', color: '#555',
  },
  label: { fontSize: '0.8rem', color: '#666', fontWeight: 600, marginBottom: '0.4rem' },
  optionGroup: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' },
  optionBtn: {
    padding: '0.4rem 0.9rem', borderRadius: '999px',
    border: '1.5px solid #ddd', background: '#fff',
    fontSize: '0.85rem', cursor: 'pointer', color: '#444',
  },
  optionActive: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  textarea: {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
    border: '1.5px solid #ddd', fontSize: '0.875rem',
    resize: 'vertical', fontFamily: 'inherit',
  },
  summary: { marginBottom: '2rem' },
  summaryTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  tdName: { padding: '0.5rem 0.5rem 0.5rem 0', fontWeight: 500, color: '#333', width: '35%' },
  tdChoice: { padding: '0.5rem 0.25rem', width: '30%' },
  tdNotes: { padding: '0.5rem 0 0.5rem 0.25rem', color: '#888', fontSize: '0.8rem' },
  choicePill: {
    display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '999px',
    background: '#1a1a1a', color: '#fff', fontSize: '0.78rem', fontWeight: 600,
  },
  noteText: { fontStyle: 'italic' },
}
