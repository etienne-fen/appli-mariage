import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'
import { useAuth } from '../context/AuthContext'

export const PAGE_SIZE = 48

const toPhoto = d => ({ id: d.id, ...d.data() })
const time = p => p.createdAt?.toMillis?.() ?? Date.now() // pending server timestamp = just now

// One page of photos, newest first. Single-field order → no composite index;
// status is filtered client-side.
function readPage(after) {
  const c = [orderBy('createdAt', 'desc')]
  if (after) c.push(startAfter(after))
  c.push(limit(PAGE_SIZE))
  return getDocs(query(collection(firestore, 'photos'), ...c))
}

// Gallery loaded by pages, so it opens just as fast with 5 000 photos as with 50:
//  - pages: getDocs with a cursor, the next one requested by the page on scroll;
//  - live: one listener for photos created AFTER the newest one of the first
//    page, so new uploads appear without re-reading everything.
// Older pages are not live: a photo hidden by the admin disappears for guests
// on their next visit (the admin's own actions go through `patchLocal`).
export default function usePhotos(adminMode = false) {
  const { user } = useAuth()
  const [pages, setPages] = useState([])      // photos from paginated reads
  const [fresh, setFresh] = useState([])      // photos from the live listener
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [since, setSince] = useState(null)    // createdAt of the newest photo at first load
  const cursor = useRef(null)                 // last DocumentSnapshot read
  const busy = useRef(false)

  const absorb = useCallback(snap => {
    if (snap.docs.length) cursor.current = snap.docs[snap.docs.length - 1]
    setHasMore(snap.docs.length === PAGE_SIZE)
    setPages(prev => [...prev, ...snap.docs.map(toPhoto)])
  }, [])

  // First page
  useEffect(() => {
    if (!user) return
    let cancelled = false
    cursor.current = null
    setPages([]); setFresh([]); setHasMore(false); setSince(null); setLoading(true)
    readPage(null)
      .then(snap => {
        if (cancelled) return
        absorb(snap)
        setSince(snap.docs[0]?.data().createdAt ?? new Date(0))
      })
      .catch(err => console.error('photos: first page failed', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user, absorb])

  // New uploads after the first load (range + orderBy on the same field: no index).
  useEffect(() => {
    if (!user || !since) return
    const q = query(collection(firestore, 'photos'), where('createdAt', '>', since), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setFresh(snap.docs.map(toPhoto)),
      err => console.error('photos: live listener failed', err))
  }, [user, since])

  const loadMore = useCallback(async () => {
    if (!hasMore || busy.current || !cursor.current) return
    busy.current = true
    setLoadingMore(true)
    try { absorb(await readPage(cursor.current)) }
    catch (err) { console.error('photos: next page failed', err); setHasMore(false) }
    finally { busy.current = false; setLoadingMore(false) }
  }, [hasMore, absorb])

  // Admin hide (patch) / delete (null) on a photo, wherever it was loaded from.
  const patchLocal = useCallback((id, patch) => {
    const apply = list => patch === null
      ? list.filter(p => p.id !== id)
      : list.map(p => p.id === id ? { ...p, ...patch } : p)
    setPages(apply); setFresh(apply)
  }, [])

  const byId = new Map()
  for (const p of [...pages, ...fresh]) byId.set(p.id, p) // live version wins
  const photos = [...byId.values()]
    .filter(p => adminMode || p.status === 'approved')
    .sort((a, b) => time(b) - time(a))

  return { photos, loading, loadingMore, hasMore, loadMore, patchLocal }
}
