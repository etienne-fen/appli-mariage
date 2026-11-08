import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// audience: 'all'    → every guest
//           'friday' → only households listed in access/friday (see firestore.rules).
// An event without `audience` is invisible to guests — always set it.
// dayKey: friday | saturday | sunday — groups events by day in "Mes réponses".
// Times/locations of the Friday events are placeholders to confirm.
export const EVENT_SEEDS = [
  {
    id: 'friday-dinner',
    audience: 'friday',
    dayKey: 'friday',
    title: { FR: 'Dîner du vendredi', EN: 'Friday dinner' },
    day:   { FR: 'Vendredi soir',     EN: 'Friday evening' },
    timeStart: '20:00',
    location: 'À définir / TBC',
    order: 0.1,
  },
  {
    id: 'saturday-breakfast',
    audience: 'friday',
    dayKey: 'saturday',
    title: { FR: 'Petit-déjeuner', EN: 'Breakfast' },
    day:   { FR: 'Samedi matin',   EN: 'Saturday morning' },
    timeStart: '09:00',
    location: 'À définir / TBC',
    order: 0.2,
  },
  {
    id: 'ceremony',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Cérémonie', EN: 'Ceremony' },
    day:   { FR: 'Samedi',    EN: 'Saturday' },
    timeStart: '11:00',
    location: 'À définir / TBC',
    order: 1,
  },
  {
    id: 'saturday-lunch',
    audience: 'friday',
    dayKey: 'saturday',
    title: { FR: 'Déjeuner',  EN: 'Lunch' },
    day:   { FR: 'Samedi midi', EN: 'Saturday noon' },
    timeStart: '12:30',
    location: 'À définir / TBC',
    order: 1.5,
  },
  {
    id: 'cocktail',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Cocktail', EN: 'Cocktail' },
    day:   { FR: 'Samedi',   EN: 'Saturday' },
    timeStart: '13:00',
    location: 'À définir / TBC',
    order: 2,
  },
  {
    id: 'dinner',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Dîner',    EN: 'Dinner' },
    day:   { FR: 'Samedi soir', EN: 'Saturday evening' },
    timeStart: '19:00',
    location: 'À définir / TBC',
    order: 3,
  },
  {
    id: 'party',
    audience: 'all',
    dayKey: 'saturday',
    title: { FR: 'Soirée',   EN: 'Party' },
    day:   { FR: 'Samedi soir', EN: 'Saturday night' },
    timeStart: '22:00',
    location: 'À définir / TBC',
    order: 4,
  },
  {
    id: 'brunch',
    audience: 'all',
    dayKey: 'sunday',
    title: { FR: 'Brunch',   EN: 'Brunch' },
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
