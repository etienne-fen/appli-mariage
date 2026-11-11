#!/usr/bin/env node
// Builds the guest-list spreadsheet to edit in Google Sheets, pre-filled with
// the current Firestore data (wins) + docs/seed-example.json (for anyone not in
// Firestore yet). Re-run any time to get an up-to-date copy of the database.
//
//   node scripts/guests-template.js [output.xlsx]
//   (default: %USERPROFILE%\Downloads\invites-mariage.xlsx — outside the repo,
//    because the file contains phone numbers)
//
// Needs the service-account key (see scripts/firestore.js).

const fs = require('fs')
const os = require('os')
const path = require('path')
const ExcelJS = require('exceljs')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { SHEETS } = require('../src/lib/guestSheet.mjs')

const out = process.argv[2] || path.join(os.homedir(), 'Downloads', 'invites-mariage.xlsx')
const keyPath = process.env.FIREBASE_SA || path.join(os.homedir(), '.secrets', 'appli-mariage-service-account.json')
initializeApp({ credential: cert(require(keyPath)) })
const db = getFirestore()
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'seed-example.json'), 'utf8'))

const MAX_ROWS = 600
const GREEN = 'FF1E4A2E'
const colLetter = n => String.fromCharCode(64 + n)

async function main() {
  const [roomsSnap, householdsSnap, personsSnap, fridaySnap, lodgingSnap] = await Promise.all([
    db.collection('rooms').get(), db.collection('households').get(),
    db.collection('persons').get(), db.doc('access/friday').get(), db.doc('access/lodging').get(),
  ])
  const friday = new Set(fridaySnap.exists ? fridaySnap.data().householdIds ?? [] : [])
  // "Logé au Domaine": from the saved list if any, else households with a room.
  const lodging = lodgingSnap.exists ? new Set(lodgingSnap.data().householdIds ?? []) : null

  // Merge: seed first, Firestore overrides by ID.
  const rooms = new Map(seed.chambres.map(r => [r.roomId, r]))
  roomsSnap.docs.forEach(d => rooms.set(d.id, { roomId: d.id, ...d.data() }))

  const persons = new Map(seed.personnes.map(p => [p.personId, p]))
  personsSnap.docs.forEach(d => persons.set(d.id, { personId: d.id, ...d.data() }))

  const inFirestore = new Set(householdsSnap.docs.map(d => d.id))
  const households = new Map(seed.foyers.map(h => [h.householdId, h]))
  householdsSnap.docs.forEach(d => households.set(d.id, { householdId: d.id, ...d.data() }))
  // Auto-created single-adult households stay implicit (blank "Foyer" column).
  for (const [id, h] of households) {
    const members = [...persons.values()].filter(p => p.householdId === id)
    if (id === `hh-${h.primaryContactId}` && members.length <= 1) {
      households.delete(id)
      members.forEach(m => { m.householdId = '' })
    }
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Appli mariage'
  addReadme(wb)

  fill(wb, 'persons', [...persons.values()].sort(byId('personId')).map(p => ({
    personId: p.personId, prenom: p.prenom, nom: p.nom,
    kind: p.kind === 'child' ? 'Enfant' : 'Adulte',
    phone: p.phone ? p.phone.replace(/^\+33(\d)(\d\d)(\d\d)(\d\d)(\d\d)$/, '0$1 $2 $3 $4 $5') : '',
    householdId: p.householdId || '', partnerId: p.partnerId || '', roomId: p.roomId || '',
  })))
  fill(wb, 'households', [...households.values()].sort(byId('householdId')).map(h => ({
    householdId: h.householdId, displayName: h.displayName || '', primaryContactId: h.primaryContactId || '',
    fridayInvited: friday.has(h.householdId) ? 'Oui' : 'Non',
    // Saved choice for households already in Firestore; otherwise "has a room".
    lodgedOnSite: (lodging && inFirestore.has(h.householdId)
      ? lodging.has(h.householdId)
      : [...persons.values()].some(p => p.householdId === h.householdId && p.roomId)) ? 'Oui' : 'Non',
  })))
  fill(wb, 'rooms', [...rooms.values()].map(r => ({
    roomId: r.roomId, batiment: r.batiment, niveau: r.niveau, chambre: r.chambre, type: r.type, capacite: r.capacite,
  })))

  fs.mkdirSync(path.dirname(out), { recursive: true })
  await wb.xlsx.writeFile(out)
  console.log(`${out}\n${persons.size} invités · ${households.size} foyers · ${rooms.size} chambres`)
}

const byId = k => (a, b) => String(a[k]).localeCompare(String(b[k]), 'fr', { numeric: true })

// Where each sheet's ID column lives, for the drop-down lists.
const refRange = kind => `'${SHEETS[kind].name}'!$A$2:$A$${MAX_ROWS}`

function fill(wb, kind, rows) {
  const def = SHEETS[kind]
  const ws = wb.addWorksheet(def.name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
  ws.columns = def.columns.map(c => ({ header: c.header, key: c.key, width: c.width }))
  rows.forEach(r => ws.addRow(r))

  const header = ws.getRow(1)
  header.height = 22
  header.eachCell((cell, i) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { vertical: 'middle' }
    const help = def.columns[i - 1].help
    if (help) cell.note = help
  })

  def.columns.forEach((c, i) => {
    const col = colLetter(i + 1)
    const range = `${col}2:${col}${MAX_ROWS}`
    if (c.text) ws.getColumn(i + 1).numFmt = '@' // keep the leading 0 of phone numbers
    if (c.list) {
      ws.dataValidations.add(range, {
        type: 'list', allowBlank: true, formulae: [`"${c.list.join(',')}"`],
        showErrorMessage: true, errorStyle: 'stop', error: `Valeurs possibles : ${c.list.join(', ')}`,
      })
    } else if (c.ref) {
      ws.dataValidations.add(range, {
        type: 'list', allowBlank: true, formulae: [refRange(c.ref)],
        showErrorMessage: true, errorStyle: 'warning', error: `Cet ID n’existe pas dans l’onglet ${SHEETS[c.ref].name}.`,
      })
    }
  })
  // ID column stands out: it must never change.
  ws.getColumn(1).font = { bold: true }
  ws.autoFilter = { from: 'A1', to: `${colLetter(def.columns.length)}1` }
}

function addReadme(wb) {
  const ws = wb.addWorksheet('Lisez-moi')
  ws.getColumn(1).width = 110
  const lines = [
    ['Liste des invités — mode d’emploi', { bold: true, size: 16, color: { argb: GREEN } }],
    [''],
    ['1. Importer ce fichier dans Google Drive, puis « Ouvrir avec Google Sheets ».'],
    ['2. Modifier les onglets Invités, Foyers et Chambres (survolez un titre de colonne pour son aide).'],
    ['3. Une fois prêt : Fichier → Télécharger → Microsoft Excel (.xlsx).'],
    ['4. Dans l’appli, page /admin/seed : choisir le fichier, lire le contrôle, puis cliquer sur « Importer ».'],
    [''],
    ['Règles importantes', { bold: true, size: 13 }],
    ['• Les colonnes ID (ID invité, ID foyer, ID chambre) ne doivent jamais être modifiées : elles relient les réponses déjà saisies.'],
    ['• Nouvel invité : ajouter une ligne avec un nouvel ID (ex : p123). Ne jamais réutiliser l’ID d’une personne supprimée.'],
    ['• Supprimer une ligne ne supprime pas la personne de l’appli : demander à l’admin.'],
    ['• Un téléphone = une seule personne. Seuls les adultes ont un téléphone ; c’est leur identifiant de connexion.'],
    ['• Foyer = les personnes qui gèrent leurs réponses ensemble (couple + enfants). Des amis qui partagent une chambre sont des foyers distincts.'],
    ['• Adulte seul : laisser « Foyer » vide, un foyer est créé automatiquement. Un enfant doit toujours avoir un foyer.'],
    ['• « Invité vendredi » = Oui : le foyer voit et répond au dîner du vendredi soir (les autres ne le voient pas).'],
    ['• « Logé au Domaine » = Oui : le foyer dort au Domaine et répond aux questions « Dodo » (celle du vendredi seulement s’il est aussi invité vendredi). Non = hôtel à proximité.'],
    ['• Adulte seul (Foyer vide) : considéré logé au Domaine s’il a une chambre attribuée.'],
    ['• Réimporter le fichier ne touche jamais aux menus ni aux réponses déjà saisis par les invités.'],
  ]
  lines.forEach(([text, font]) => {
    const row = ws.addRow([text])
    if (font) row.font = font
    row.alignment = { wrapText: true }
  })
}

main().catch(e => { console.error(e); process.exit(1) })
