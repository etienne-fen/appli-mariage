import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

// members passed in from caller (useHousehold already owns that subscription).
//
// Public events: attendance lives on each person doc as { [eventId]: true|false|null }.
// Invitation-only (Friday) events: attendance lives in fridayRsvps/{personId},
// readable only by invited households — persons docs are visible to every guest,
// so storing Friday answers there would reveal who's invited.
export default function useRsvp(members) {
  const { householdId } = useAuth()
  const [fridayDocs, setFridayDocs] = useState({}) // { [personId]: { [eventId]: val } }

  useEffect(() => {
    if (!householdId) return
    const q = query(collection(firestore, 'fridayRsvps'), where('householdId', '==', householdId))
    return onSnapshot(
      q,
      snap => {
        const map = {}
        snap.docs.forEach(d => { map[d.id] = d.data().attendance ?? {} })
        setFridayDocs(map)
      },
      () => setFridayDocs({}), // not invited → permission denied → nothing to show
    )
  }, [householdId])

  // { [eventId]: { [personId]: true|false|null } }
  const rsvpMap = {}
  const add = (personId, attendance) => {
    Object.entries(attendance ?? {}).forEach(([eventId, val]) => {
      if (!rsvpMap[eventId]) rsvpMap[eventId] = {}
      rsvpMap[eventId][personId] = val
    })
  }
  members.forEach(m => {
    add(m.personId, m.attendance)
    add(m.personId, fridayDocs[m.personId])
  })

  async function setAttendance(personId, event, attending) {
    if (event.audience === 'friday') {
      await setDoc(
        doc(firestore, 'fridayRsvps', personId),
        { householdId, attendance: { [event.id]: attending } },
        { merge: true },
      )
    } else {
      await updateDoc(doc(firestore, 'persons', personId), {
        [`attendance.${event.id}`]: attending,
      })
    }
  }

  // Sets `attending` for every (person × event) pair in one atomic batch —
  // used by the "whole day" toggle. One write per doc, whatever the count.
  async function setAttendanceMany(personIds, events, attending) {
    const batch = writeBatch(firestore)
    const publicEvents = events.filter(e => e.audience !== 'friday')
    const fridayEvents = events.filter(e => e.audience === 'friday')
    personIds.forEach(personId => {
      if (publicEvents.length) {
        const fields = {}
        publicEvents.forEach(e => { fields[`attendance.${e.id}`] = attending })
        batch.update(doc(firestore, 'persons', personId), fields)
      }
      if (fridayEvents.length) {
        const attendance = {}
        fridayEvents.forEach(e => { attendance[e.id] = attending })
        batch.set(doc(firestore, 'fridayRsvps', personId), { householdId, attendance }, { merge: true })
      }
    })
    await batch.commit()
  }

  return { rsvpMap, setAttendance, setAttendanceMany }
}
