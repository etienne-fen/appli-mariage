import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

export default function usePhotos(adminMode = false) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const col = collection(firestore, 'photos')
    const q = adminMode
      ? query(col, orderBy('createdAt', 'desc'))
      : query(col, where('status', '==', 'approved'), orderBy('createdAt', 'desc'))

    return onSnapshot(q, snap => {
      setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [user, adminMode])

  return { photos, loading }
}
