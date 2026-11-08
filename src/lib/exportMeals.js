import { collection, getDocs } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import MEAL_OPTIONS from './mealOptions'
import { downloadWorkbook, exportedOn, newWorkbook, styleHeader } from './xlsx'

// Admin export for the restaurant: every guest's Saturday-dinner menu as .xlsx.
// Sheet 1 "Menus" = one row per guest (confirmed first); sheet 2 "Récapitulatif"
// = dish counts for confirmed guests, then for guests who haven't answered yet.

const DINNER = 'dinner'
const dishLabel = id => MEAL_OPTIONS.find(o => o.id === id)?.label.FR ?? 'Non renseigné'
const presence = v => (v === true ? 'Oui' : v === false ? 'Non' : 'Sans réponse')
const PRESENCE_ORDER = { Oui: 0, 'Sans réponse': 1, Non: 2 }

export async function exportMealsXlsx() {
  const [personsSnap, householdsSnap] = await Promise.all([
    getDocs(collection(firestore, 'persons')),
    getDocs(collection(firestore, 'households')),
  ])
  const householdName = Object.fromEntries(
    householdsSnap.docs.map(d => [d.id, d.data().displayName || d.id]),
  )

  const rows = personsSnap.docs.map(d => {
    const p = d.data()
    const meal = p.mealPreferences ?? {}
    const diet = [...(meal.allergies ?? []), meal.notes].filter(Boolean).join(' · ')
    return {
      nom: p.nom ?? '',
      prenom: p.prenom ?? '',
      type: p.kind === 'child' ? 'Enfant' : 'Adulte',
      foyer: householdName[p.householdId] ?? '',
      presence: presence(p.attendance?.[DINNER]),
      plat: dishLabel(meal.regime),
      regime: diet,
    }
  }).sort((a, b) =>
    PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence]
    || a.foyer.localeCompare(b.foyer) || a.prenom.localeCompare(b.prenom),
  )

  const wb = await newWorkbook()

  // ── Sheet 1: one row per guest ──
  const ws = wb.addWorksheet('Menus', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Nom', key: 'nom', width: 18 },
    { header: 'Prénom', key: 'prenom', width: 16 },
    { header: 'Adulte / Enfant', key: 'type', width: 14 },
    { header: 'Foyer', key: 'foyer', width: 24 },
    { header: 'Présent au dîner', key: 'presence', width: 16 },
    { header: 'Plat principal', key: 'plat', width: 16 },
    { header: 'Allergies / régime', key: 'regime', width: 40 },
  ]
  rows.forEach(r => ws.addRow(r))
  styleHeader(ws.getRow(1))
  ws.autoFilter = { from: 'A1', to: 'G1' }
  ws.eachRow((row, i) => {
    if (i === 1) return
    row.getCell('regime').alignment = { wrapText: true, vertical: 'top' }
    if (row.getCell('regime').value) row.getCell('regime').font = { bold: true, color: { argb: 'FFC0392B' } }
    if (row.getCell('presence').value === 'Non') row.font = { color: { argb: 'FF999999' } }
  })

  // ── Sheet 2: counts ──
  const sum = wb.addWorksheet('Récapitulatif')
  sum.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 12 }]
  const dishes = [...MEAL_OPTIONS.map(o => o.label.FR), 'Non renseigné']
  const block = (title, filter) => {
    const t = sum.addRow([title]); t.font = { bold: true, size: 13 }
    styleHeader(sum.addRow(['Plat principal', 'Adultes', 'Enfants', 'Total']))
    const subset = rows.filter(filter)
    dishes.forEach(dish => {
      const a = subset.filter(r => r.plat === dish && r.type === 'Adulte').length
      const c = subset.filter(r => r.plat === dish && r.type === 'Enfant').length
      sum.addRow([dish, a, c, a + c])
    })
    const a = subset.filter(r => r.type === 'Adulte').length
    const c = subset.length - a
    sum.addRow(['Total', a, c, a + c]).font = { bold: true }
    sum.addRow([`Dont allergies / régime : ${subset.filter(r => r.regime).length}`]).font = { italic: true }
    sum.addRow([])
  }
  block('Présents confirmés au dîner du samedi', r => r.presence === 'Oui')
  block('Sans réponse pour le dîner (à relancer)', r => r.presence === 'Sans réponse')
  sum.addRow([exportedOn()]).font = { italic: true, color: { argb: 'FF888888' } }

  await downloadWorkbook(wb, 'menus-diner-samedi')
  return rows.length
}
