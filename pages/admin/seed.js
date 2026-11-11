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
  const [check,     setCheck]     = useState(null) // { errors, warnings } for a spreadsheet
  const blocked = Boolean(check?.errors.length)

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

  // Accepts the guest spreadsheet (.xlsx, downloaded from Google Sheets) or a
  // legacy JSON export. The spreadsheet is checked before anything is written.
  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAccError(null); setAccData(null); setUnmatched(null); setAccResult(null); setCheck(null)
    try {
      let parsed
      if (/\.xlsx$/i.test(file.name)) {
        const [{ default: ExcelJS }, { parseGuestSheets, workbookToSheets }] = await Promise.all([
          import('exceljs'), import('../../src/lib/guestSheet.mjs'),
        ])
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await file.arrayBuffer())
        const result = parseGuestSheets(workbookToSheets(wb))
        setCheck({ errors: result.errors, warnings: result.warnings })
        parsed = result.data
      } else {
        parsed = JSON.parse(await file.text())
      }
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
        description="Questions de « Mes réponses ». 🔒 = invités du vendredi · 🛏️ = logés au Domaine. Re-seeder écrase les horaires/lieux modifiés dans Firestore."
        items={EVENT_SEEDS.map(e => `${{ friday: '🔒 ', lodging: '🛏️ ', fridayLodging: '🔒🛏️ ' }[e.audience] ?? ''}${e.day.FR} — ${e.title.FR}${e.timeStart ? ` (${e.timeStart})` : ''}`)}
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
        <h2 style={s.h2}>Liste des invités (Google Sheets / Excel)</h2>
        <p style={s.desc}>
          Dans Google Sheets : Fichier → Télécharger → Microsoft Excel (.xlsx), puis
          choisissez le fichier ici. Il est contrôlé avant tout import. Réimporter
          ne touche jamais aux menus ni aux réponses déjà saisis.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/json"
          onChange={handleFile}
          style={s.fileInput}
        />

        {accData && (
          <p style={s.desc}>
            Lu : {accData.personnes?.length ?? 0} invités, {accData.foyers?.length ?? 0} foyers,{' '}
            {accData.chambres?.length ?? 0} chambres
            {accData.fridayHouseholdIds && `, ${accData.fridayHouseholdIds.length} foyer(s) invité(s) vendredi`}
            {accData.lodgingHouseholdIds && `, ${accData.lodgingHouseholdIds.length} foyer(s) logé(s) au Domaine`}.
          </p>
        )}

        {check && (
          check.errors.length === 0
            ? <p style={s.ok}>✓ Aucune erreur bloquante.</p>
            : (
              <div>
                <p style={s.err}>✗ {check.errors.length} erreur(s) à corriger dans le fichier avant import :</p>
                <ul style={s.list}>{check.errors.map((m, i) => <li key={i} style={s.li}>{m}</li>)}</ul>
              </div>
            )
        )}
        {check?.warnings.length > 0 && (
          <details style={s.details}>
            <summary style={s.warnSummary}>⚠ {check.warnings.length} avertissement(s) (import possible)</summary>
            <ul style={s.list}>{check.warnings.map((m, i) => <li key={i} style={s.li}>{m}</li>)}</ul>
          </details>
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
          disabled={!accData || accBusy || blocked}
          style={{ ...s.btn, opacity: !accData || accBusy || blocked ? 0.5 : 1 }}
        >
          {accBusy ? 'Import en cours…' : 'Importer'}
        </button>

        {accResult && (
          <p style={s.ok}>
            ✓ {accResult.rooms} chambres, {accResult.households} foyers,{' '}
            {accResult.personsCreated} invités créés, {accResult.personsUpdated} mis à jour
            {accResult.fridayHouseholds !== undefined && `, ${accResult.fridayHouseholds} foyer(s) invité(s) vendredi`}
            {`, ${accResult.lodgingHouseholds} foyer(s) logé(s) au Domaine`}.
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
  details: { marginBottom: '1rem' },
  warnSummary: { cursor: 'pointer', color: '#856404', fontSize: '0.875rem', marginBottom: '0.5rem' },
}
