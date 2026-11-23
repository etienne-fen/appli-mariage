// Carpooling ads ("Comment venir" → Covoiturage). Firestore: carpool/{adId}.
// Field limits are mirrored in firestore.rules — keep both in sync.

export const AD_TYPES = ['offer', 'request'] // offer = "Place dispo", request = "Recherche une place"

export const DIRECTIONS = ['to', 'back'] // to = "Aller" (place → Domaine), back = "Retour" (Domaine → place)

export const MAX_PLACE   = 80
export const MAX_DETAILS = 1000
export const MAX_SEATS   = 8

// Days a guest can pick for the trip (wedding weekend, Saturday 3 July 2027).
export const TRIP_DAYS = [
  { date: '2027-07-01', FR: 'Jeu. 1 juil.', EN: 'Thu 1 Jul' },
  { date: '2027-07-02', FR: 'Ven. 2 juil.', EN: 'Fri 2 Jul' },
  { date: '2027-07-03', FR: 'Sam. 3 juil.', EN: 'Sat 3 Jul' },
  { date: '2027-07-04', FR: 'Dim. 4 juil.', EN: 'Sun 4 Jul' },
  { date: '2027-07-05', FR: 'Lun. 5 juil.', EN: 'Mon 5 Jul' },
]
export const DEFAULT_DAY  = { to: '2027-07-03', back: '2027-07-04' }
export const DEFAULT_TIME = { to: '14:00', back: '11:00' }

export function dayLabel(date, lang) {
  const d = TRIP_DAYS.find(x => x.date === date)
  return d ? d[lang] : date
}

// Chronological order; date/time are "YYYY-MM-DD" / "HH:MM" strings so they sort as text.
export function compareAds(a, b) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
}
