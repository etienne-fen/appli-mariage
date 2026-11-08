import { doc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// members passed in from caller (useHousehold already owns that subscription).
// Attendance lives directly on each person doc as { [eventId]: true|false|null },
// so there's no separate collection to keep in sync.
export default function useRsvp(members) {
  // { [eventId]: { [personId]: true|false|null } }
  const rsvpMap = {}
  members.forEach(m => {
    Object.entries(m.attendance ?? {}).forEach(([eventId, val]) => {
      if (!rsvpMap[eventId]) rsvpMap[eventId] = {}
      rsvpMap[eventId][m.personId] = val
    })
  })

  async function setAttendance(personId, eventId, attending) {
    await updateDoc(doc(firestore, 'persons', personId), {
      [`attendance.${eventId}`]: attending,
    })
  }

  return { rsvpMap, setAttendance }
}
