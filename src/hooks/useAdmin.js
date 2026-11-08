import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

export default function useAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setIsAdmin(false); setLoading(false); return }
    getDoc(doc(firestore, 'admins', user.uid))
      .then(snap => setIsAdmin(snap.exists()))
      .catch(() => setIsAdmin(false))
      .finally(() => setLoading(false))
  }, [user, authLoading])

  return { isAdmin, loading }
}
