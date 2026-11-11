import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'
import { RESTRICTED_AUDIENCES } from '../lib/audiences'

const toEvents = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))

// Public events + the invitation-only ones this guest may see. Security rules
// refuse a restricted query for non-invited guests; that error just means
// "none for you". Sorting is client-side so no composite index is needed.
export default function useEvents() {
  const { user } = useAuth()
  const [publicEvents, setPublicEvents] = useState(null)
  const [restricted, setRestricted] = useState({}) // { [audience]: events[] }

  useEffect(() => {
    const q = query(collection(firestore, 'events'), where('audience', '==', 'all'))
    return onSnapshot(q, snap => setPublicEvents(toEvents(snap)), () => setPublicEvents([]))
  }, [])

  useEffect(() => {
    if (!user) {
      setRestricted(Object.fromEntries(RESTRICTED_AUDIENCES.map(a => [a, []])))
      return
    }
    setRestricted({})
    const unsubs = RESTRICTED_AUDIENCES.map(audience => {
      const q = query(collection(firestore, 'events'), where('audience', '==', audience))
      const set = list => setRestricted(prev => ({ ...prev, [audience]: list }))
      return onSnapshot(q, snap => set(toEvents(snap)), () => set([]))
    })
    return () => unsubs.forEach(u => u())
  }, [user?.uid])

  const events = [...(publicEvents ?? []), ...Object.values(restricted).flat()]
    .sort((a, b) => a.order - b.order)
  const loading = publicEvents === null || RESTRICTED_AUDIENCES.some(a => !restricted[a])

  return { events, loading }
}
