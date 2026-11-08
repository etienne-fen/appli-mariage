import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

const toEvents = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))

// Public events + invitation-only (Friday) events. Security rules refuse the
// Friday query for non-invited guests; that error just means "none for you".
// Sorting is client-side so no composite index is needed.
export default function useEvents() {
  const { user } = useAuth()
  const [publicEvents, setPublicEvents] = useState(null)
  const [fridayEvents, setFridayEvents] = useState(null)

  useEffect(() => {
    const q = query(collection(firestore, 'events'), where('audience', '==', 'all'))
    return onSnapshot(q, snap => setPublicEvents(toEvents(snap)), () => setPublicEvents([]))
  }, [])

  useEffect(() => {
    if (!user) { setFridayEvents([]); return }
    setFridayEvents(null)
    const q = query(collection(firestore, 'events'), where('audience', '==', 'friday'))
    return onSnapshot(q, snap => setFridayEvents(toEvents(snap)), () => setFridayEvents([]))
  }, [user?.uid])

  const events = [...(publicEvents ?? []), ...(fridayEvents ?? [])]
    .sort((a, b) => a.order - b.order)

  return { events, loading: publicEvents === null || fridayEvents === null }
}
