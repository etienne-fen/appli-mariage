import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { downloadWorkbook, exportedOn, newWorkbook, styleHeader } from './xlsx'
import { RESTRICTED_AUDIENCES, rsvpCollection } from './audiences'

const AUDIENCE_NOTE = {
  friday: ' (invités du vendredi)',
  lodging: ' (logés au Domaine)',
  fridayLodging: ' (vendredi + logés au Domaine)',
}

// Admin export of every "Mes réponses" answer as .xlsx.
//   Sheet "Réponses"      one row per guest, one column per event (all events,
//                         restricted ones included; "—" when not in that audience).
//   Sheet "Récapitulatif" per event: yes (adults / children), no, no answer.
//   Sheet "À relancer"    households that still have unanswered questions.
// Admin-only: the security rules let admins read every event, access/* and
// the restricted answer collections.

const DAYS = { friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' }
const NOT_INVITED = '—'
const answer = v => (v === true ? 'Oui' : v === false ? 'Non' : 'Sans réponse')
const COLORS = { Oui: 'FF27AE60', Non: 'FFC0392B', 'Sans réponse': 'FFB0B0B0' }

export async function exportRsvpXlsx() {
  const [personsSnap, householdsSnap, eventsSnap, ...perAudience] = await Promise.all([
    getDocs(collection(firestore, 'persons')),
    getDocs(collection(firestore, 'households')),
    getDocs(collection(firestore, 'events')),
    ...RESTRICTED_AUDIENCES.map(a => Promise.all([
      getDoc(doc(firestore, 'access', a)),
      getDocs(collection(firestore, rsvpCollection(a))),
    ])),
  ])

  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order)
  const householdName = Object.fromEntries(householdsSnap.docs.map(d => [d.id, d.data().displayName || d.id]))
  // { [audience]: { households: Set, answers: { [personId]: { [eventId]: val } } } }
  const audiences = Object.fromEntries(RESTRICTED_AUDIENCES.map((a, i) => {
    const [accessSnap, rsvpsSnap] = perAudience[i]
    return [a, {
      households: new Set(accessSnap.exists() ? accessSnap.data().householdIds ?? [] : []),
      answers: Object.fromEntries(rsvpsSnap.docs.map(d => [d.id, d.data().attendance ?? {}])),
    }]
  }))

  const guests = personsSnap.docs.map(d => {
    const p = d.data()
    const answers = {}
    events.forEach(e => {
      const aud = audiences[e.audience]
      if (aud) {
        answers[e.id] = aud.households.has(p.householdId) ? answer(aud.answers[d.id]?.[e.id]) : NOT_INVITED
      } else {
        answers[e.id] = answer(p.attendance?.[e.id])
      }
    })
    return {
      nom: p.nom ?? '',
      prenom: p.prenom ?? '',
      type: p.kind === 'child' ? 'Enfant' : 'Adulte',
      foyer: householdName[p.householdId] ?? '',
      vendredi: audiences.friday.households.has(p.householdId) ? 'Oui' : 'Non',
      logement: audiences.lodging.households.has(p.householdId) ? 'Oui' : 'Non',
      answers,
    }
  }).sort((a, b) => a.foyer.localeCompare(b.foyer) || a.prenom.localeCompare(b.prenom))

  const eventHeader = e => `${DAYS[e.dayKey] ?? ''} ${e.timeStart ?? ''}`.trim() + `\n${e.title?.FR ?? e.id}`
  const wb = await newWorkbook()

  // ── Sheet 1: one row per guest ──
  const ws = wb.addWorksheet('Réponses', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] })
  ws.columns = [
    { header: 'Nom', key: 'nom', width: 16 },
    { header: 'Prénom', key: 'prenom', width: 14 },
    { header: 'Adulte / Enfant', key: 'type', width: 12 },
    { header: 'Foyer', key: 'foyer', width: 22 },
    { header: 'Invité vendredi', key: 'vendredi', width: 11 },
    { header: 'Logé au Domaine', key: 'logement', width: 11 },
    ...events.map(e => ({ header: eventHeader(e), key: e.id, width: 15 })),
  ]
  guests.forEach(g => ws.addRow({ ...g, ...g.answers }))
  const header = ws.getRow(1)
  header.height = 34
  styleHeader(header)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } }
  ws.eachRow((row, i) => {
    if (i === 1) return
    events.forEach(e => {
      const cell = row.getCell(e.id)
      cell.alignment = { horizontal: 'center' }
      if (COLORS[cell.value]) cell.font = { bold: cell.value !== 'Sans réponse', color: { argb: COLORS[cell.value] } }
      else cell.font = { color: { argb: 'FFCCCCCC' } }
    })
  })

  // ── Sheet 2: counts per event ──
  const sum = wb.addWorksheet('Récapitulatif', { views: [{ state: 'frozen', ySplit: 1 }] })
  sum.columns = [
    { header: 'Jour', width: 11 }, { header: 'Heure', width: 8 }, { header: 'Événement', width: 22 },
    { header: 'Oui · adultes', width: 12 }, { header: 'Oui · enfants', width: 12 }, { header: 'Oui · total', width: 11 },
    { header: 'Non', width: 8 }, { header: 'Sans réponse', width: 13 }, { header: 'Invités concernés', width: 15 },
  ]
  styleHeader(sum.getRow(1))
  events.forEach(e => {
    const concerned = guests.filter(g => g.answers[e.id] !== NOT_INVITED)
    const yes = concerned.filter(g => g.answers[e.id] === 'Oui')
    const yesAdults = yes.filter(g => g.type === 'Adulte').length
    const row = sum.addRow([
      DAYS[e.dayKey] ?? '', e.timeStart ?? '',
      `${e.title?.FR ?? e.id}${AUDIENCE_NOTE[e.audience] ?? ''}`,
      yesAdults, yes.length - yesAdults, yes.length,
      concerned.filter(g => g.answers[e.id] === 'Non').length,
      concerned.filter(g => g.answers[e.id] === 'Sans réponse').length,
      concerned.length,
    ])
    row.getCell(6).font = { bold: true }
  })
  sum.addRow([])
  sum.addRow([exportedOn()]).font = { italic: true, color: { argb: 'FF888888' } }

  // ── Sheet 3: households to chase ──
  const chase = wb.addWorksheet('À relancer')
  chase.columns = [{ header: 'Foyer', width: 24 }, { header: 'Réponses manquantes', width: 20 }, { header: 'Qui', width: 60 }]
  styleHeader(chase.getRow(1))
  const byHousehold = {}
  guests.forEach(g => {
    const missing = events.filter(e => g.answers[e.id] === 'Sans réponse').length
    if (!missing) return
    const h = (byHousehold[g.foyer] ??= { count: 0, who: [] })
    h.count += missing
    h.who.push(`${g.prenom} (${missing})`)
  })
  Object.entries(byHousehold)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([foyer, h]) => chase.addRow([foyer, h.count, h.who.join(', ')]))

  await downloadWorkbook(wb, 'reponses-invites')
  return guests.length
}
