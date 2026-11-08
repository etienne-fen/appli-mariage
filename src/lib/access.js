import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// access/{audience} = { householdIds: string[], phones: string[] }
// householdIds is the source of truth (who's invited). phones is DERIVED from
// those households' managerPhones, because security rules can only match the
// signed-in phone number. Call this whenever managerPhones may have changed.
// Admin-only (rules). Mirrors `node scripts/firestore.js friday sync`.
export async function syncAudiencePhones(audience) {
  const ref = doc(firestore, 'access', audience)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const householdIds = snap.data().householdIds ?? []
  const households = await Promise.all(householdIds.map(id => getDoc(doc(firestore, 'households', id))))
  const phones = [...new Set(households.flatMap(h => (h.exists() ? h.data().managerPhones ?? [] : [])))]
  await updateDoc(ref, { phones })
  return phones
}
