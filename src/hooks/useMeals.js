import { doc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// members passed in from caller (useHousehold already owns that subscription).
// Meal preferences live directly on each person doc, so there's no separate
// collection or array to reconcile — each save only touches its own person.
export default function useMeals(members) {
  function getMealMap() {
    const map = {}
    members.forEach(m => {
      map[m.personId] = m.mealPreferences ?? { regime: null, allergies: [], notes: '' }
    })
    return map
  }

  async function saveMeal(personId, patch) {
    const fields = {}
    if ('regime' in patch) fields['mealPreferences.regime'] = patch.regime
    if ('notes' in patch) fields['mealPreferences.notes'] = patch.notes
    await updateDoc(doc(firestore, 'persons', personId), fields)
  }

  return { mealMap: getMealMap(), saveMeal }
}
