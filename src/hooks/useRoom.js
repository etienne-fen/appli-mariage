import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Given a roomId, returns the room doc plus everyone assigned to it
// (potentially spanning several households — see data-model.md invariant 4).
export default function useRoom(roomId) {
  const [room, setRoom] = useState(undefined)
  const [occupants, setOccupants] = useState([])

  useEffect(() => {
    if (!roomId) { setRoom(null); return }
    return onSnapshot(doc(firestore, 'rooms', roomId), snap => {
      setRoom(snap.exists() ? { roomId: snap.id, ...snap.data() } : null)
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId) { setOccupants([]); return }
    const q = query(collection(firestore, 'persons'), where('roomId', '==', roomId))
    return onSnapshot(q, snap => {
      setOccupants(snap.docs.map(d => ({ personId: d.id, ...d.data() })))
    })
  }, [roomId])

  return { room, occupants, loading: room === undefined }
}
