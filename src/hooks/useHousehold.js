import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

export default function useHousehold() {
  const { householdId } = useAuth()
  // undefined = still loading, null = no household resolved yet
  const [household, setHousehold] = useState(undefined)
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (!householdId) return
    return onSnapshot(doc(firestore, 'households', householdId), snap => {
      setHousehold(snap.exists() ? { householdId: snap.id, ...snap.data() } : null)
    })
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    const q = query(collection(firestore, 'persons'), where('householdId', '==', householdId))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ personId: d.id, ...d.data() }))
      // Primary contact first, then alphabetical — avoids needing a composite index.
      list.sort((a, b) => (b.isPrimaryContact === true) - (a.isPrimaryContact === true) || a.prenom.localeCompare(b.prenom))
      setMembers(list)
    })
  }, [householdId])

  return {
    household,
    members,
    loading: household === undefined,
  }
}
