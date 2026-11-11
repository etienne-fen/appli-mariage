// Guest-list spreadsheet format — single source of truth for both
//   • scripts/guests-template.js  (builds the .xlsx to edit in Google Sheets)
//   • pages/admin/seed.js         (reads it back and imports it)
// Pure JS (no Firebase / no DOM) so it runs in Node and in the browser.
// Kept as .mjs so Node's require() can load it from the CommonJS script.

export const BUILDINGS = ['Escoubet', 'Escoubas', 'Yourtes']
export const LEVELS = ['Rez de chaussée', 'Étage', 'Extérieur']
export const ROOM_TYPES = ['chambre', 'dortoir']
const YES_NO = ['Oui', 'Non']

export const SHEETS = {
  persons: {
    name: 'Invités',
    columns: [
      { key: 'personId', header: 'ID invité', width: 11, help: 'Identifiant unique (p001…). Ne jamais le changer ni le réutiliser.' },
      { key: 'prenom', header: 'Prénom', width: 14, help: 'Obligatoire.' },
      { key: 'nom', header: 'Nom', width: 16, help: 'Recommandé : distingue les homonymes.' },
      { key: 'kind', header: 'Adulte / Enfant', width: 14, list: ['Adulte', 'Enfant'], help: 'Obligatoire.' },
      { key: 'phone', header: 'Téléphone', width: 16, text: true, help: 'Adultes seulement : c’est le numéro de connexion. 06… ou +33…' },
      { key: 'householdId', header: 'Foyer (ID)', width: 18, ref: 'households', help: 'ID de l’onglet Foyers. Vide pour un adulte seul → foyer créé automatiquement. Obligatoire pour un enfant.' },
      { key: 'partnerId', header: 'Conjoint (ID)', width: 13, ref: 'persons', help: 'ID invité du conjoint (à renseigner des deux côtés).' },
      { key: 'roomId', header: 'Chambre (ID)', width: 30, ref: 'rooms', help: 'ID de l’onglet Chambres. Vide = pas encore attribuée.' },
    ],
  },
  households: {
    name: 'Foyers',
    columns: [
      { key: 'householdId', header: 'ID foyer', width: 20, help: 'Identifiant unique (hh-…). Ne jamais le changer.' },
      { key: 'displayName', header: 'Nom affiché', width: 26, help: 'Ex : « Louis & Lucy ». Vide → prénoms des membres.' },
      { key: 'primaryContactId', header: 'Contact principal (ID)', width: 20, ref: 'persons', help: 'ID invité du référent du foyer. Vide → premier adulte.' },
      { key: 'fridayInvited', header: 'Invité vendredi', width: 15, list: YES_NO, help: 'Oui = voit et répond au dîner du vendredi soir.' },
      { key: 'lodgedOnSite', header: 'Logé au Domaine', width: 16, list: YES_NO, help: 'Oui = dort au Domaine (questions « Nuit au Domaine » ; vendredi seulement si aussi invité vendredi). Non = hôtel à proximité.' },
    ],
  },
  rooms: {
    name: 'Chambres',
    columns: [
      { key: 'roomId', header: 'ID chambre', width: 30, help: 'batiment-niveau-chambre, ex : escoubet-rdc-muguet. Ne jamais le changer (lié au plan).' },
      { key: 'batiment', header: 'Bâtiment', width: 12, list: BUILDINGS },
      { key: 'niveau', header: 'Niveau', width: 16, list: LEVELS },
      { key: 'chambre', header: 'Nom de la chambre', width: 20 },
      { key: 'type', header: 'Type', width: 10, list: ROOM_TYPES },
      { key: 'capacite', header: 'Capacité', width: 10 },
    ],
  },
}

// ── value helpers ────────────────────────────────────────────────────────────

const clean = v => (v === null || v === undefined ? '' : String(v).trim())
const norm = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const yes = v => ['oui', 'yes', 'true', 'vrai', 'x', '1'].includes(norm(v))

export function normalizePhone(raw) {
  const s = clean(raw).replace(/[\s\-().]/g, '')
  if (!s) return null
  if (s.startsWith('+')) return s
  if (s.startsWith('00')) return '+' + s.slice(2)
  if (s.startsWith('0')) return '+33' + s.slice(1)
  return '+33' + s // a leading 0 eaten by the spreadsheet (06… typed as a number)
}

function kindOf(v) {
  const n = norm(v)
  if (['adulte', 'adult'].includes(n)) return 'adult'
  if (['enfant', 'child'].includes(n)) return 'child'
  return null
}

// ── parse + validate ─────────────────────────────────────────────────────────
// `sheets` = { persons: [{ header: value }], households: [...], rooms: [...] }
// (rows keyed by the header text of row 1). Returns the importer payload plus
// blocking `errors` and non-blocking `warnings` — all in French for the admin.

export function parseGuestSheets(sheets) {
  const errors = []
  const warnings = []
  const rowsOf = kind => (sheets[kind] ?? []).map((raw, i) => {
    const row = { _line: i + 2 }
    SHEETS[kind].columns.forEach(c => { row[c.key] = clean(raw[c.header]) })
    return row
  }).filter(r => SHEETS[kind].columns.some(c => r[c.key])) // skip empty lines

  const where = (kind, r) => `${SHEETS[kind].name} ligne ${r._line}`

  // Rooms
  const rooms = rowsOf('rooms')
  const roomIds = new Set()
  rooms.forEach(r => {
    if (!r.roomId) return errors.push(`${where('rooms', r)} : ID chambre manquant.`)
    if (roomIds.has(r.roomId)) errors.push(`${where('rooms', r)} : ID chambre « ${r.roomId} » en double.`)
    roomIds.add(r.roomId)
    if (!BUILDINGS.includes(r.batiment)) warnings.push(`${where('rooms', r)} : bâtiment « ${r.batiment} » inconnu (attendu : ${BUILDINGS.join(', ')}) — il ne sera pas mis en évidence sur le plan.`)
    if (!(Number(r.capacite) > 0)) warnings.push(`${where('rooms', r)} : capacité manquante.`)
  })

  // Persons
  const persons = rowsOf('persons')
  const personIds = new Set()
  const phones = new Map()
  persons.forEach(p => {
    if (!p.personId) return errors.push(`${where('persons', p)} : ID invité manquant.`)
    if (personIds.has(p.personId)) errors.push(`${where('persons', p)} : ID invité « ${p.personId} » en double.`)
    personIds.add(p.personId)
    if (!p.prenom) errors.push(`${where('persons', p)} : prénom manquant.`)
    p.kind = kindOf(p.kind)
    if (!p.kind) errors.push(`${where('persons', p)} : « Adulte / Enfant » doit valoir Adulte ou Enfant.`)
    p.phone = normalizePhone(p.phone)
    if (p.phone && p.kind === 'child') {
      warnings.push(`${where('persons', p)} : ${p.prenom} est un enfant — son téléphone est ignoré.`)
      p.phone = null
    }
    if (p.phone) {
      if (!/^\+\d{8,15}$/.test(p.phone)) errors.push(`${where('persons', p)} : téléphone « ${p.phone} » invalide.`)
      if (phones.has(p.phone)) errors.push(`${where('persons', p)} : téléphone déjà utilisé par ${phones.get(p.phone)} (un numéro = une personne).`)
      phones.set(p.phone, p.personId)
    }
  })
  const byId = Object.fromEntries(persons.map(p => [p.personId, p]))
  const label = id => (byId[id] ? `${byId[id].prenom} ${byId[id].nom}`.trim() : id)

  // Households
  const households = rowsOf('households')
  const householdIds = new Set()
  households.forEach(h => {
    if (!h.householdId) return errors.push(`${where('households', h)} : ID foyer manquant.`)
    if (householdIds.has(h.householdId)) errors.push(`${where('households', h)} : ID foyer « ${h.householdId} » en double.`)
    householdIds.add(h.householdId)
  })

  // Person → household / partner / room links
  persons.forEach(p => {
    if (p.householdId && !householdIds.has(p.householdId)) {
      errors.push(`${where('persons', p)} : foyer « ${p.householdId} » absent de l’onglet Foyers.`)
    }
    if (!p.householdId) {
      if (p.kind === 'child') {
        errors.push(`${where('persons', p)} : ${label(p.personId)} est un enfant sans foyer — rattachez-le au foyer de ses parents.`)
      } else {
        p.householdId = `hh-${p.personId}` // adult on their own
        // Auto household for an adult on their own: lodged on site if they have a room.
        households.push({ householdId: p.householdId, displayName: '', primaryContactId: p.personId, fridayInvited: '', lodgedOnSite: p.roomId ? 'Oui' : 'Non', _auto: true })
        householdIds.add(p.householdId)
      }
    }
    if (p.partnerId) {
      if (!byId[p.partnerId]) errors.push(`${where('persons', p)} : conjoint « ${p.partnerId} » introuvable.`)
      else if (byId[p.partnerId].partnerId !== p.personId) warnings.push(`${where('persons', p)} : ${label(p.personId)} → ${label(p.partnerId)}, mais pas l’inverse.`)
    }
    if (p.roomId && !roomIds.has(p.roomId)) errors.push(`${where('persons', p)} : chambre « ${p.roomId} » absente de l’onglet Chambres.`)
  })

  // Household checks + derived fields
  households.forEach(h => {
    const members = persons.filter(p => p.householdId === h.householdId)
    if (!members.length) return warnings.push(`Foyer « ${h.householdId} » sans aucun membre — ignoré.`)
    const adults = members.filter(m => m.kind === 'adult')
    if (h.primaryContactId && !members.some(m => m.personId === h.primaryContactId)) {
      errors.push(`${where('households', h)} : le contact principal ${label(h.primaryContactId)} n’est pas membre du foyer.`)
    }
    h.primaryContactId ||= (adults[0] ?? members[0]).personId
    h.displayName ||= members.map(m => m.prenom).join(' & ')
    if (!h._auto && !adults.some(m => m.phone)) warnings.push(`Foyer « ${h.displayName} » : aucun adulte avec téléphone — personne ne pourra se connecter pour ce foyer.`)
    const withRoom = members.filter(m => m.roomId)
    if (!yes(h.lodgedOnSite) && withRoom.length) {
      warnings.push(`Foyer « ${h.displayName} » : « Logé au Domaine » = Non mais ${withRoom.map(m => m.prenom).join(', ')} a/ont une chambre attribuée.`)
    }
  })
  const liveHouseholds = households.filter(h => persons.some(p => p.householdId === h.householdId))

  // Room capacity
  rooms.forEach(r => {
    const n = persons.filter(p => p.roomId === r.roomId).length
    if (Number(r.capacite) > 0 && n > Number(r.capacite)) warnings.push(`Chambre ${r.chambre || r.roomId} : ${n} personnes pour ${r.capacite} places.`)
  })
  const lodgedIds = new Set(liveHouseholds.filter(h => yes(h.lodgedOnSite)).map(h => h.householdId))
  const roomless = persons.filter(p => !p.roomId && lodgedIds.has(p.householdId)).length
  if (roomless) warnings.push(`${roomless} invité(s) logé(s) au Domaine sans chambre attribuée.`)

  return {
    errors,
    warnings,
    data: {
      chambres: rooms.map(r => ({
        roomId: r.roomId, batiment: r.batiment, niveau: r.niveau, chambre: r.chambre,
        type: r.type || 'chambre', capacite: Number(r.capacite) || 0,
      })),
      foyers: liveHouseholds.map(h => ({
        householdId: h.householdId, displayName: h.displayName, primaryContactId: h.primaryContactId,
        lodgedOnSite: yes(h.lodgedOnSite),
      })),
      personnes: persons.map(p => ({
        personId: p.personId, prenom: p.prenom, nom: p.nom, kind: p.kind, phone: p.phone ?? '',
        householdId: p.householdId,
        isPrimaryContact: liveHouseholds.some(h => h.primaryContactId === p.personId),
        partnerId: p.partnerId, roomId: p.roomId,
      })),
      fridayHouseholdIds: liveHouseholds.filter(h => yes(h.fridayInvited)).map(h => h.householdId),
      lodgingHouseholdIds: [...lodgedIds],
    },
  }
}

// Reads an exceljs Workbook into { persons, households, rooms } rows keyed by header.
export function workbookToSheets(wb) {
  const out = {}
  Object.entries(SHEETS).forEach(([kind, def]) => {
    const ws = wb.getWorksheet(def.name)
    if (!ws) throw new Error(`Onglet « ${def.name} » introuvable dans le fichier.`)
    const headers = []
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = clean(cell.text) })
    const rows = []
    ws.eachRow((row, i) => {
      if (i === 1) return
      const obj = {}
      headers.forEach((h, col) => { if (h) obj[h] = row.getCell(col).text })
      rows.push(obj)
    })
    out[kind] = rows
  })
  return out
}
