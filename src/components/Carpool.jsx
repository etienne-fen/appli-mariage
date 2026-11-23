import { useState } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'
import useAdmin from '../hooks/useAdmin'
import useCarpool from '../hooks/useCarpool'
import useHousehold from '../hooks/useHousehold'
import { formatPhone } from '../lib/phone'
import { DEFAULT_DAY, DEFAULT_TIME, MAX_DETAILS, MAX_PLACE, MAX_SEATS, TRIP_DAYS, dayLabel } from '../lib/carpool'
import { GREEN, PINK, SEA, SUN } from '../theme'
import strings from '../i18n/carpool'

export default function Carpool({ lang }) {
  const t = strings[lang]
  const { user, person } = useAuth()
  const { isAdmin } = useAdmin()
  const { ads, loading } = useCarpool()
  const [filter, setFilter] = useState('all')
  const [dir, setDir] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const shown = ads.filter(ad => (filter === 'all' || ad.type === filter) && (dir === 'all' || ad.direction === dir))

  return (
    <div>
      <p style={s.intro}>{t.intro}</p>

      {showForm ? (
        <AdForm t={t} lang={lang} person={person} user={user} onDone={() => setShowForm(false)} />
      ) : person ? (
        <button onClick={() => setShowForm(true)} style={s.primaryBtn}>{t.newAd}</button>
      ) : (
        <p style={s.muted}>{t.noPerson}</p>
      )}

      <div style={s.tabs} role="tablist">
        {[['all', t.filterAll], ['offer', t.filterOffer], ['request', t.filterReq]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
            style={{ ...s.tab, ...(filter === key ? s.tabActive : {}) }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ ...s.chips, marginBottom: '1rem' }}>
        {[['all', t.dirAll], ['to', `➡️ ${t.dirTo}`], ['back', `⬅️ ${t.dirBack}`]].map(([key, label]) => (
          <button key={key} onClick={() => setDir(key)} aria-pressed={dir === key}
            style={{ ...s.chip, ...(dir === key ? s.chipOn : {}) }}>{label}</button>
        ))}
      </div>

      {loading ? <p style={s.muted}>{t.loading}</p>
        : shown.length === 0 ? <p style={s.muted}>{t.empty}</p>
        : (
          <div style={s.list}>
            {shown.map(ad => (
              <AdCard key={ad.id} ad={ad} t={t} lang={lang}
                isMine={ad.authorUid === user?.uid} isAdmin={isAdmin} />
            ))}
          </div>
        )}
    </div>
  )
}

// ── One ad: compact summary, tap to expand ────────────────────────────────────

function AdCard({ ad, t, lang, isMine, isAdmin }) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const isOffer = ad.type === 'offer'
  const accent = isOffer ? GREEN : SEA

  async function setActive(active) {
    if (!active && !confirm(t.confirmOff)) return
    setBusy(true)
    try {
      await updateDoc(doc(firestore, 'carpool', ad.id), { active, updatedAt: serverTimestamp() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...s.card, borderLeft: `5px solid ${accent}`, opacity: ad.active ? 1 : 0.6 }}>
      <button onClick={() => setOpen(o => !o)} style={s.cardHead} aria-expanded={open}>
        <div style={s.badges}>
          <span style={{ ...s.badge, background: accent }}>{isOffer ? '🚗' : '🙋'} {isOffer ? t.offer : t.request}</span>
          {isMine && <span style={{ ...s.badge, background: SUN }}>{t.mine}</span>}
          {!ad.active && <span style={{ ...s.badge, background: '#888' }}>{t.inactive}</span>}
        </div>
        <p style={s.from}>
          {ad.direction === 'back' ? `⬅️ ${t.domaine} → ${ad.place}` : `➡️ ${ad.place} → ${t.domaine}`}
        </p>
        <p style={s.meta}>
          🗓️ {dayLabel(ad.date, lang)} · {ad.time}
          <span style={s.dot}>·</span>
          {isOffer ? t.seatsOffer(ad.seats) : t.seatsReq(ad.seats)}
          <span style={s.chevron}>{open ? '▲' : '▼'}</span>
        </p>
      </button>

      {open && (
        <div style={s.body}>
          {!isOffer && ad.passengerNames?.length > 0 && (
            <p style={s.line}><strong>{t.passengers} :</strong> {ad.passengerNames.join(', ')}</p>
          )}
          <p style={s.details}>{ad.details || <em style={s.mutedInline}>{t.noDetails}</em>}</p>

          {!isMine && (revealed ? (
            <div style={s.contact}>
              <p style={s.contactHint}>{t.contactHint}</p>
              <p style={s.contactName}>{ad.authorName}</p>
              <p style={s.contactPhone}>{formatPhone(ad.authorPhone)}</p>
              <div style={s.contactBtns}>
                <a href={`tel:${ad.authorPhone}`} style={{ ...s.smallBtn, background: GREEN }}>📞 {t.call}</a>
                <a href={`sms:${ad.authorPhone}`} style={{ ...s.smallBtn, background: SEA }}>💬 {t.sms}</a>
              </div>
            </div>
          ) : ad.active && (
            <button onClick={() => setRevealed(true)} style={{ ...s.primaryBtn, background: PINK, marginBottom: 0 }}>
              {t.interested}
            </button>
          ))}

          {(isMine || isAdmin) && (
            <button disabled={busy} onClick={() => setActive(!ad.active)} style={s.secondaryBtn}>
              {ad.active ? t.deactivate : t.reactivate}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Creation form ─────────────────────────────────────────────────────────────

function AdForm({ t, lang, person, user, onDone }) {
  const { members } = useHousehold()
  const [direction, setDirection] = useState('to')
  const [type, setType] = useState('request')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(DEFAULT_DAY.to)
  const [time, setTime] = useState(DEFAULT_TIME.to)
  const [seats, setSeats] = useState(1)
  const [who, setWho] = useState([person.personId])
  const [details, setDetails] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isOffer = type === 'offer'
  const isBack = direction === 'back'

  function chooseDirection(d) {
    setDirection(d)
    setDate(DEFAULT_DAY[d])
    setTime(DEFAULT_TIME[d])
  }

  // Household members (falls back to just me while the household loads).
  const people = members.length ? members : [person]

  function toggleWho(id) {
    setWho(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id])
  }

  async function submit(e) {
    e.preventDefault()
    if (!place.trim()) return setError(t.errFrom)
    if (!isOffer && who.length === 0) return setError(t.errWho)
    if (!consent) return setError(t.errConsent)
    setError('')
    setSaving(true)
    const passengers = isOffer ? [] : people.filter(p => who.includes(p.personId))
    try {
      await addDoc(collection(firestore, 'carpool'), {
        direction,
        type,
        place: place.trim(),
        date,
        time,
        seats: isOffer ? Number(seats) : passengers.length,
        passengers: passengers.map(p => p.personId),
        passengerNames: passengers.map(p => p.prenom),
        details: details.trim(),
        phoneConsent: true,
        authorUid: user.uid,
        authorPersonId: person.personId,
        authorHouseholdId: person.householdId,
        authorName: `${person.prenom} ${person.nom}`.trim(),
        authorPhone: user.phoneNumber,
        active: true,
        createdAt: serverTimestamp(),
      })
      onDone()
    } catch (err) {
      console.error('carpool: publish failed', err)
      setError(t.errSave)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={s.form}>
      <p style={s.formTitle}>{t.formTitle}</p>

      <label style={s.label}>{t.dirLabel}</label>
      <div style={s.chips}>
        {[['to', t.dirToLong], ['back', t.dirBackLong]].map(([key, label]) => (
          <button type="button" key={key} onClick={() => chooseDirection(key)}
            style={{ ...s.chip, ...(direction === key ? s.chipOn : {}) }}>{label}</button>
        ))}
      </div>

      <label style={s.label}>{t.typeLabel}</label>
      <div style={s.chips}>
        {[['request', t.typeReq], ['offer', t.typeOffer]].map(([key, label]) => (
          <button type="button" key={key} onClick={() => setType(key)}
            style={{ ...s.chip, ...(type === key ? s.chipOn : {}) }}>{label}</button>
        ))}
      </div>

      <label style={s.label} htmlFor="cp-place">
        {isBack ? (isOffer ? t.toOffer : t.toReq) : (isOffer ? t.fromOffer : t.fromReq)}
      </label>
      <input id="cp-place" value={place} onChange={e => setPlace(e.target.value)} maxLength={MAX_PLACE}
        placeholder={isBack ? t.toPh : t.fromPh} style={s.input} />

      <label style={s.label}>{isBack ? t.dateBack : isOffer ? t.dateOffer : t.dateReq}</label>
      <div style={s.chips}>
        {TRIP_DAYS.map(d => (
          <button type="button" key={d.date} onClick={() => setDate(d.date)}
            style={{ ...s.chip, ...(date === d.date ? s.chipOn : {}) }}>{d[lang]}</button>
        ))}
      </div>
      <label style={s.label} htmlFor="cp-time">{t.time}</label>
      <input id="cp-time" type="time" value={time} onChange={e => setTime(e.target.value)} required style={{ ...s.input, width: 'auto' }} />

      {isOffer ? (
        <>
          <label style={s.label} htmlFor="cp-seats">{t.seatsLabel}</label>
          <select id="cp-seats" value={seats} onChange={e => setSeats(e.target.value)} style={{ ...s.input, width: 'auto' }}>
            {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </>
      ) : (
        <>
          <label style={s.label}>{t.whoLabel}</label>
          <div style={s.checks}>
            {people.map(p => (
              <label key={p.personId} style={s.check}>
                <input type="checkbox" checked={who.includes(p.personId)} onChange={() => toggleWho(p.personId)} />
                {p.prenom} {p.personId === person.personId && <span style={s.mutedInline}>{t.me}</span>}
              </label>
            ))}
          </div>
        </>
      )}

      <label style={s.label} htmlFor="cp-details">{t.detailsLabel}</label>
      <textarea id="cp-details" value={details} onChange={e => setDetails(e.target.value)} maxLength={MAX_DETAILS}
        rows={3} placeholder={isOffer ? t.detailsPhOff : t.detailsPhReq} style={{ ...s.input, resize: 'vertical' }} />

      <label style={{ ...s.check, alignItems: 'flex-start', marginTop: '0.75rem' }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: '0.2rem' }} />
        <span style={s.consent}>{isOffer ? t.consentOffer : t.consentReq}</span>
      </label>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.formBtns}>
        <button type="button" onClick={onDone} style={{ ...s.secondaryBtn, marginTop: 0 }}>{t.cancel}</button>
        <button type="submit" disabled={saving || !consent}
          style={{ ...s.primaryBtn, flex: 1, marginBottom: 0, ...(saving || !consent ? s.disabledBtn : {}) }}>
          {saving ? t.publishing : t.publish}
        </button>
      </div>
    </form>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  intro:      { fontSize: '0.9rem', color: '#555', lineHeight: 1.5, margin: '0 0 1rem' },
  muted:      { fontSize: '0.9rem', color: '#888' },
  mutedInline:{ color: '#888', fontWeight: 400 },
  primaryBtn: { width: '100%', padding: '0.8rem 1rem', borderRadius: '0.75rem', border: 'none', background: GREEN, color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem' },
  disabledBtn: { background: '#bbb', cursor: 'not-allowed' },
  secondaryBtn: { padding: '0.6rem 1rem', borderRadius: '0.6rem', border: '1px solid #ccc', background: '#fff', color: '#444', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.75rem' },

  tabs:       { display: 'flex', gap: '0.25rem', background: '#ffffff99', borderRadius: '0.6rem', padding: '0.25rem', marginBottom: '1rem' },
  tab:        { flex: 1, padding: '0.5rem 0.4rem', border: 'none', borderRadius: '0.45rem', background: 'transparent', fontSize: '0.82rem', fontWeight: 600, color: '#666', cursor: 'pointer' },
  tabActive:  { background: '#fff', color: '#1a1a1a', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },

  list:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card:       { background: '#fff', borderRadius: '0.9rem', overflow: 'hidden' },
  cardHead:   { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0.85rem 1rem', cursor: 'pointer', font: 'inherit', color: 'inherit' },
  badges:     { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' },
  badge:      { fontSize: '0.7rem', fontWeight: 700, color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem' },
  from:       { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem', overflowWrap: 'anywhere' },
  meta:       { fontSize: '0.85rem', color: '#555', margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  dot:        { margin: '0 0.35rem' },
  chevron:    { marginLeft: 'auto', fontSize: '0.7rem', color: '#999' },
  body:       { padding: '0 1rem 1rem', borderTop: '1px solid #f0f0f0' },
  line:       { fontSize: '0.88rem', margin: '0.75rem 0 0' },
  details:    { fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0.75rem 0 1rem' },

  contact:    { background: '#f6f8f6', borderRadius: '0.75rem', padding: '0.85rem' },
  contactHint:{ fontSize: '0.8rem', color: '#666', margin: '0 0 0.4rem' },
  contactName:{ fontWeight: 700, margin: '0 0 0.15rem' },
  contactPhone:{ fontSize: '1.05rem', margin: '0 0 0.6rem', letterSpacing: '0.02em' },
  contactBtns:{ display: 'flex', gap: '0.5rem' },
  smallBtn:   { flex: 1, textAlign: 'center', padding: '0.55rem', borderRadius: '0.6rem', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem' },

  form:       { background: '#fff', borderRadius: '1rem', padding: '1rem 1.1rem', marginBottom: '1.25rem' },
  formTitle:  { fontWeight: 700, fontSize: '1.05rem', margin: '0 0 0.5rem' },
  label:      { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', margin: '0.85rem 0 0.35rem' },
  input:      { width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.7rem', borderRadius: '0.55rem', border: '1px solid #ccc', fontSize: '16px', fontFamily: 'inherit', background: '#fff' },
  chips:      { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  chip:       { padding: '0.45rem 0.75rem', borderRadius: '999px', border: '1px solid #ccc', background: '#fff', fontSize: '0.85rem', cursor: 'pointer', color: '#444' },
  chipOn:     { background: GREEN, borderColor: GREEN, color: '#fff', fontWeight: 600 },
  checks:     { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  check:      { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem', cursor: 'pointer' },
  consent:    { fontSize: '0.82rem', color: '#444', lineHeight: 1.45 },
  error:      { color: '#c62828', fontSize: '0.85rem', margin: '0.75rem 0 0' },
  formBtns:   { display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' },
}
