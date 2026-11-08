import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Resolves the signed-in person for a phone number. Returns null if the
// number isn't in the guest list.
export async function findPersonByPhone(phone) {
  const q = query(collection(firestore, 'persons'), where('phone', '==', phone), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { personId: docSnap.id, ...docSnap.data() }
}
