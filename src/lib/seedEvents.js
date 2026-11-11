import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// The questions asked in "Mes réponses".
// audience: 'all'           → every guest
//           'friday'        → "Invité vendredi" = Oui
//           'lodging'       → "Logé au Domaine" = Oui
//           'fridayLodging' → both
//           (see src/lib/audiences.js + firestore.rules)
// An event without `audience` is invisible to guests — always set it.
// dayKey: friday | saturday | sunday — groups events by day in "Mes réponses".
// timeStart may be '' (e.g. the "Nuit au Domaine" nights).
// 'dinner' (Dîner & Soirée) is also the event the Menu and the menu export rely on.
export const EVENT_SEEDS = [
  {
    id: 'friday-dinner',
    audience: 'friday',
    dayKey: 'friday',
    title: { FR: 'Dîner', EN: 'Dinner' },
    day:   { FR: 'Vendredi soir', EN: 'Friday evening' },
    timeStart: '20:00',
    location: 'À définir / TBC',
    order: 0.1,
  },
  {
    id: 'friday-night',
    audience: 'fridayLodging',
    dayKey: 'friday',
    title: { FR: 'Nuit au Domaine', EN: 'Night at the Domaine' },
    day:   { FR: 'Vendredi soir', EN: 'Friday night' },
    timeStart: '',
    location: 'Domaine du Possible',
    order: 0.2,
  },
  {
    id: 'ceremony',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Cérémonie', EN: 'Ceremony' },
    day:   { FR: 'Samedi', EN: 'Saturday' },
    timeStart: '11:00',
    location: 'À définir / TBC',
    order: 1,
  },
  {
    id: 'dinner',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Dîner & Soirée', EN: 'Dinner & Party' },
    day:   { FR: 'Samedi soir', EN: 'Saturday evening' },
    timeStart: '19:00',
    location: 'Domaine du Possible',
    order: 3,
  },
  {
    id: 'saturday-night',
    audience: 'lodging',
    dayKey: 'saturday',
    title: { FR: 'Nuit au Domaine', EN: 'Night at the Domaine' },
    day:   { FR: 'Samedi soir', EN: 'Saturday night' },
    timeStart: '',
    location: 'Domaine du Possible',
    order: 4,
  },
  {
    id: 'brunch',
    audience: 'all',
    dayKey: 'sunday',
    title: { FR: 'Brunch', EN: 'Brunch' },
    day:   { FR: 'Dimanche', EN: 'Sunday' },
    timeStart: '11:00',
    location: 'À définir / TBC',
    order: 5,
  },
]

export async function seedEvents() {
  await Promise.all(
    EVENT_SEEDS.map(({ id, ...data }) =>
      setDoc(doc(firestore, 'events', id), data)
    )
  )
}
