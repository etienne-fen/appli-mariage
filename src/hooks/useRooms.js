import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Subscribes to several rooms at once (members of a household can sleep in
// different rooms, e.g. children in a dormitory). Returns { [roomId]: room|null }.
export default function useRooms(roomIds) {
  const key = [...new Set(roomIds.filter(Boolean))].sort().join('|')
  const [rooms, setRooms] = useState({})

  useEffect(() => {
    if (!key) { setRooms({}); return }
    const unsubs = key.split('|').map(id =>
      onSnapshot(doc(firestore, 'rooms', id), snap => {
        setRooms(prev => ({ ...prev, [id]: snap.exists() ? { roomId: id, ...snap.data() } : null }))
      })
    )
    return () => unsubs.forEach(u => u())
  }, [key])

  return rooms
}
