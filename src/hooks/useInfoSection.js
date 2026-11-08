import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

export default function useInfoSection(sectionId) {
  const [data, setData] = useState(undefined) // undefined = loading, null = not found

  useEffect(() => {
    if (!sectionId) return
    return onSnapshot(doc(firestore, 'info', sectionId), snap => {
      setData(snap.exists() ? snap.data() : null)
    })
  }, [sectionId])

  return { data, loading: data === undefined }
}
