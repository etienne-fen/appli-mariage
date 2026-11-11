// Invitation-only audiences. An event with one of these `audience` values is
// readable only by households listed in access/{audience} (see firestore.rules),
// and its answers live in `${audience}Rsvps/{personId}` instead of
// persons.attendance (persons are readable by every guest).
//
//   friday        — "Invité vendredi" = Oui                 (Vendredi soir - Dîner)
//   lodging       — "Logé au Domaine" = Oui                 (Samedi - Nuit au Domaine)
//   fridayLodging — both, DERIVED: friday ∩ lodging          (Vendredi soir - Nuit au Domaine)
//
// The lists are set at each guest-list import (src/lib/seedAccommodation.js) or
// with `node scripts/firestore.js friday …` / `lodging sync`.
// Adding an audience = add it here + a matching block in firestore.rules.
export const RESTRICTED_AUDIENCES = ['friday', 'lodging', 'fridayLodging']

export const isRestricted = audience => RESTRICTED_AUDIENCES.includes(audience)
export const rsvpCollection = audience => `${audience}Rsvps`

export const intersect = (a, b) => {
  const set = new Set(b)
  return a.filter(x => set.has(x))
}
