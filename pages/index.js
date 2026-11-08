import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(user ? '/dashboard' : '/login')
  }, [user, loading, router])

  return null
}
