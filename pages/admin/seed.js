import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../src/components/ProtectedRoute'
import { seedEvents, EVENT_SEEDS } from '../../src/lib/seedEvents'
import { seedInfo, SECTIONS } from '../../src/lib/seedInfo'
import { importAccommodation, reconcileInvitedGuests } from '../../src/lib/seedAccommodation'

export default function SeedPage() {
  return <ProtectedRoute><Seed /></ProtectedRoute>
}

function SeedBlock({ title, description, items, onSeed, busy, status }) {
  return (
    <section style={s.block}>
      <h2 style={s.h2}>{title}</h2>
      <p style={s.desc}>{description}</p>
      <ul style={s.list}>
        {items.map((item, i) => <li key={i} style={s.li}>{item}</li>)}
      </ul>
      <button onClick={onSeed} disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Seeding…' : `Seed ${title.toLowerCase()}`}
      </button>
      {status === 'success' && <p style={s.ok}>✓ Seeded successfully.</p>}
      {status?.startsWith('error') && <p style={s.err}>{status}</p>}
    </section>
  )
}

function Seed() {
  const router = useRouter()
  const [eventsStatus, setEventsStatus] = useState(null)
  const [infoStatus,   setInfoStatus]   = useState(null)
  const [eventsBusy,   setEventsBusy]   = useState(false)
  const [infoBusy,     setInfoBusy]     = useState(false)

  const fileInputRef = useRef(null)
  const [accData,   setAccData]   = useState(null) // parsed { chambres, personnes, foyers }
  const [accError,  setAccError]  = useState(null)
  const [unmatched, setUnmatched] = useState(null) // reconciliation report, once loaded
  const [accBusy,   setAccBusy]   = useState(false)
  const [accResult, setAccResult] = useState(null) // import summary, once imported

  async function handleSeedEvents() {
    setEventsBusy(true); setEventsStatus(null)
    try { await seedEvents(); setEventsStatus('success') }
    catch (e) { setEventsStatus('error: ' + e.message) }
    finally { setEventsBusy(false) }
  }

  async function handleSeedInfo() {
    setInfoBusy(true); setInfoStatus(null)
    try { await seedInfo(); setInfoStatus('success') }
    catch (e) { setInfoStatus('error: ' + e.message) }
    finally { setInfoBusy(false) }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAccError(null); setAccData(null); setUnmatched(null); setAccResult(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setAccData(parsed)
      setUnmatched(await reconcileInvitedGuests(parsed.personnes))
    } catch (e) {
      setAccError('error: ' + e.message)
    }
  }

  async function handleImport() {
    if (!accData) return
    setAccBusy(true); setAccError(null)
    try { setAccResult(await importAccommodation(accData)) }
    catch (e) { setAccError('error: ' + e.message) }
    finally { setAccBusy(false) }
  }

  return (
    <main style={s.main}>
      <button onClick={() => router.push('/dashboard')} style={s.back}>← Back</button>
      <h1 style={s.h1}>Seed data</h1>
      <p style={s.intro}>Dev utility — safe to re-run. Delete this page before sharing with guests.</p>

      <SeedBlock
        title="Events"
        description="The 5 RSVP segments (ceremony → brunch)."
        items={EVENT_SEEDS.map(e => `${e.title.FR} / ${e.title.EN} — ${e.day.FR} ${e.timeStart}`)}
        onSeed={handleSeedEvents}
        busy={eventsBusy}
        status={eventsStatus}
      />

      <SeedBlock
        title="Info pages"
        description="Schedule, dress code, accommodation, FAQ, and contact — all editable in Firestore."
        items={SECTIONS.map(sec => `${sec.icon} ${sec.labelFR} / ${sec.labelEN}`)}
        onSeed={handleSeedInfo}
        busy={infoBusy}
        status={infoStatus}
      />

      <section style={s.block}>
        <h2 style={s.h2}>Accommodation (rooms / persons / households)</h2>
        <p style={s.desc}>
          Upload a JSON export matching the shape in docs/data-model.md (see
          docs/seed-example.json). Safe to re-run — existing meal/RSVP answers are
          never overwritten.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFile}
          style={s.fileInput}
        />

        {accData && (
          <p style={s.desc}>
            Loaded: {accData.chambres?.length ?? 0} rooms, {accData.personnes?.length ?? 0} persons,{' '}
            {accData.foyers?.length ?? 0} households.
          </p>
        )}

        {unmatched && (
          unmatched.length === 0 ? (
            <p style={s.ok}>✓ Every existing invitedGuests phone matches an imported person.</p>
          ) : (
            <div>
              <p style={s.err}>{unmatched.length} existing invitedGuests phone(s) with no match — needs manual follow-up:</p>
              <ul style={s.list}>
                {unmatched.map(phone => <li key={phone} style={s.li}>{phone}</li>)}
              </ul>
            </div>
          )
        )}

        <button
          onClick={handleImport}
          disabled={!accData || accBusy}
          style={{ ...s.btn, opacity: !accData || accBusy ? 0.5 : 1 }}
        >
          {accBusy ? 'Importing…' : 'Import'}
        </button>

        {accResult && (
          <p style={s.ok}>
            ✓ {accResult.rooms} rooms, {accResult.households} households,{' '}
            {accResult.personsCreated} persons created, {accResult.personsUpdated} persons updated.
          </p>
        )}
        {accError && <p style={s.err}>{accError}</p>}
      </section>
    </main>
  )
}

const s = {
  main:  { maxWidth: 480, margin: '2rem auto', padding: '1.5rem', fontFamily: 'system-ui' },
  back:  { background: 'none', border: 'none', cursor: 'pointer', color: '#555', marginBottom: '1.5rem', padding: 0 },
  h1:    { fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' },
  intro: { fontSize: '0.875rem', color: '#888', marginBottom: '2rem' },
  block: { marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #eee' },
  h2:    { fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' },
  desc:  { fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem' },
  list:  { fontSize: '0.875rem', color: '#555', marginBottom: '1rem', paddingLeft: '1.25rem' },
  li:    { marginBottom: '0.2rem' },
  btn:   { padding: '0.75rem 1.5rem', borderRadius: '0.5rem', background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' },
  fileInput: { display: 'block', marginBottom: '1rem', fontSize: '0.875rem' },
  ok:    { marginTop: '0.75rem', color: '#27ae60', fontSize: '0.875rem' },
  err:   { marginTop: '0.75rem', color: '#c0392b', fontSize: '0.875rem' },
}
