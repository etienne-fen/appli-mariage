import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Imports a { chambres, personnes, foyers } export (see docs/data-model.md and
// docs/seed-example.json for the expected shape) into the rooms/persons/households
// collections. Idempotent: re-running with the same file is safe.
//
// - Existing persons are merged on structural fields only — mealPreferences and
//   attendance already saved by a guest are never touched.
// - New persons are initialized with empty mealPreferences/attendance.
// - managerPhones on each household is (re)computed from its adult members' phones.

function normalizeBool(v) {
  return v === true || v === 'true'
}

function normalizePhone(v) {
  return v && v.trim() ? v.trim() : null
}

export async function importAccommodation({ chambres = [], personnes = [], foyers = [] }) {
  const summary = { rooms: 0, households: 0, personsCreated: 0, personsUpdated: 0 }

  // Rooms: straight upsert, no derived fields.
  await Promise.all(chambres.map(({ roomId, ...data }) => {
    summary.rooms++
    return setDoc(doc(firestore, 'rooms', roomId), data)
  }))

  // managerPhones per household = phones of that household's adult members.
  const managerPhonesByHousehold = {}
  personnes.forEach(p => {
    if (!p.householdId || p.kind !== 'adult') return
    const phone = normalizePhone(p.phone)
    if (!phone) return
    if (!managerPhonesByHousehold[p.householdId]) managerPhonesByHousehold[p.householdId] = []
    managerPhonesByHousehold[p.householdId].push(phone)
  })

  await Promise.all(foyers.map(({ householdId, ...data }) => {
    summary.households++
    return setDoc(doc(firestore, 'households', householdId), {
      ...data,
      managerPhones: managerPhonesByHousehold[householdId] ?? [],
    })
  }))

  // Persons: preserve mealPreferences/attendance on existing docs.
  await Promise.all(personnes.map(async ({ personId, ...raw }) => {
    const structural = {
      prenom: raw.prenom ?? '',
      nom: raw.nom ?? '',
      kind: raw.kind,
      phone: normalizePhone(raw.phone),
      householdId: raw.householdId || null,
      isPrimaryContact: normalizeBool(raw.isPrimaryContact),
      partnerId: raw.partnerId || null,
      roomId: raw.roomId || null,
    }
    const ref = doc(firestore, 'persons', personId)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      summary.personsUpdated++
      await setDoc(ref, structural, { merge: true })
    } else {
      summary.personsCreated++
      await setDoc(ref, {
        ...structural,
        mealPreferences: { regime: null, allergies: [], notes: '' },
        attendance: {},
      })
    }
  }))

  return summary
}

// Diffs the old invitedGuests collection's phone keys against the imported
// persons' phones — anyone in invitedGuests with no matching person needs
// manual follow-up rather than being guessed at.
export async function reconcileInvitedGuests(personnes = []) {
  const importedPhones = new Set(personnes.map(p => normalizePhone(p.phone)).filter(Boolean))
  const snap = await getDocs(collection(firestore, 'invitedGuests'))
  return snap.docs.map(d => d.id).filter(phone => !importedPhones.has(phone))
}
