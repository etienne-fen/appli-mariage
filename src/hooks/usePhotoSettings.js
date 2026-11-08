import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

export default function usePhotoSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      doc(firestore, 'settings', 'photos'),
      snap => { setSettings(snap.exists() ? snap.data() : {}); setLoading(false) },
      ()   => setLoading(false)
    )
  }, [])

  return { settings, loading }
}
