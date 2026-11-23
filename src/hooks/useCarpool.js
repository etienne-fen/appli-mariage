import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'
import { compareAds } from '../lib/carpool'

// Active ads of everyone + all of the signed-in guest's own ads (including
// deactivated ones, so they can be turned back on). Two listeners because the
// rules only let guests list active ads or their own.
export default function useCarpool() {
  const { user } = useAuth()
  const [active, setActive] = useState(null)
  const [mine, setMine] = useState(null)

  useEffect(() => {
    if (!user) return
    const col = collection(firestore, 'carpool')
    const toList = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const offA = onSnapshot(query(col, where('active', '==', true)), s => setActive(toList(s)), () => setActive([]))
    const offB = onSnapshot(query(col, where('authorUid', '==', user.uid)), s => setMine(toList(s)), () => setMine([]))
    return () => { offA(); offB() }
  }, [user])

  const byId = new Map()
  for (const ad of [...(active ?? []), ...(mine ?? [])]) byId.set(ad.id, ad)
  const ads = [...byId.values()].sort(compareAds)

  return { ads, loading: active === null || mine === null }
}
