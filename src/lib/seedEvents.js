import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

export const EVENT_SEEDS = [
  {
    id: 'ceremony',
    title: { FR: 'Cérémonie', EN: 'Ceremony' },
    day:   { FR: 'Samedi',    EN: 'Saturday' },
    timeStart: '11:00',
    location: 'À définir / TBC',
    order: 1,
  },
  {
    id: 'cocktail',
    title: { FR: 'Cocktail', EN: 'Cocktail' },
    day:   { FR: 'Samedi',   EN: 'Saturday' },
    timeStart: '13:00',
    location: 'À définir / TBC',
    order: 2,
  },
  {
    id: 'dinner',
    title: { FR: 'Dîner',    EN: 'Dinner' },
    day:   { FR: 'Samedi soir', EN: 'Saturday evening' },
    timeStart: '19:00',
    location: 'À définir / TBC',
    order: 3,
  },
  {
    id: 'party',
    title: { FR: 'Soirée',   EN: 'Party' },
    day:   { FR: 'Samedi soir', EN: 'Saturday night' },
    timeStart: '22:00',
    location: 'À définir / TBC',
    order: 4,
  },
  {
    id: 'brunch',
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
