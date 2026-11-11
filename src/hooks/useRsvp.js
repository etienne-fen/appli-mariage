import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'
import { RESTRICTED_AUDIENCES, isRestricted, rsvpCollection } from '../lib/audiences'

// members passed in from caller (useHousehold already owns that subscription).
//
// Public events: attendance lives on each person doc as { [eventId]: true|false|null }.
// Invitation-only events: attendance lives in `${audience}Rsvps/{personId}`,
// readable only by that audience — persons docs are visible to every guest, so
// storing those answers there would reveal who's invited.
export default function useRsvp(members) {
  const { householdId } = useAuth()
  const [restrictedDocs, setRestrictedDocs] = useState({}) // { [audience]: { [personId]: { [eventId]: val } } }

  useEffect(() => {
    if (!householdId) return
    const unsubs = RESTRICTED_AUDIENCES.map(audience => {
      const q = query(collection(firestore, rsvpCollection(audience)), where('householdId', '==', householdId))
      const set = map => setRestrictedDocs(prev => ({ ...prev, [audience]: map }))
      return onSnapshot(
        q,
        snap => {
          const map = {}
          snap.docs.forEach(d => { map[d.id] = d.data().attendance ?? {} })
          set(map)
        },
        () => set({}), // not in this audience → permission denied → nothing to show
      )
    })
    return () => unsubs.forEach(u => u())
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
    RESTRICTED_AUDIENCES.forEach(a => add(m.personId, restrictedDocs[a]?.[m.personId]))
  })

  async function setAttendance(personId, event, attending) {
    if (isRestricted(event.audience)) {
      await setDoc(
        doc(firestore, rsvpCollection(event.audience), personId),
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
    const byAudience = {}
    events.forEach(e => {
      const key = isRestricted(e.audience) ? e.audience : 'all'
      ;(byAudience[key] ??= []).push(e)
    })
    personIds.forEach(personId => {
      Object.entries(byAudience).forEach(([audience, evs]) => {
        if (audience === 'all') {
          const fields = {}
          evs.forEach(e => { fields[`attendance.${e.id}`] = attending })
          batch.update(doc(firestore, 'persons', personId), fields)
        } else {
          const attendance = {}
          evs.forEach(e => { attendance[e.id] = attending })
          batch.set(doc(firestore, rsvpCollection(audience), personId), { householdId, attendance }, { merge: true })
        }
      })
    })
    await batch.commit()
  }

  return { rsvpMap, setAttendance, setAttendanceMany }
}
