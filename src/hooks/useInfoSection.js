import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// undefined = loading, null = not found OR not allowed (invitation-only sections
// are refused by the security rules for non-invited guests).
// Pass `authKey` (e.g. the user's uid) to re-subscribe when the user changes.
export default function useInfoSection(sectionId, authKey = null) {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    if (!sectionId) return
    setData(undefined)
    return onSnapshot(
      doc(firestore, 'info', sectionId),
      snap => setData(snap.exists() ? snap.data() : null),
      () => setData(null),
    )
  }, [sectionId, authKey])

  return { data, loading: data === undefined }
}
