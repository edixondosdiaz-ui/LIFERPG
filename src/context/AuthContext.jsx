import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../services/api'
import { supabase } from '../services/supabase'
import { claimRewards } from '../services/economy'
import { syncPremium } from '../services/social'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [equipped, setEquipped] = useState([]) // objetos de tienda equipados (data{} de cada uno)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); setEquipped([]); setStreak(0) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Perfil + extras. Los extras son tolerantes: si la migración aún no se corrió, la app sigue abriendo.
  const refreshProfile = useCallback(async () => {
    // Es idempotente en el servidor. La ausencia de la migración no bloquea auth.
    await claimRewards().catch(() => {})
    await syncPremium().catch(() => {})
    const p = await api.getProfile().catch(() => null)
    setProfile(p)
    if (p?.onboarding_completed) {
      const [eq, st] = await Promise.all([api.getMyEquipped().catch(() => []), api.getStreak().catch(() => 0)])
      setEquipped(eq)
      setStreak(st)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const session = await api.getSession()
        if (session) {
          setUser(session)
          await refreshProfile()
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshProfile])

  // Devuelve el usuario, o null si falta confirmar el correo
  const signUp = async (data) => {
    const u = await api.signUp(data)
    setUser(u)
    if (u) await refreshProfile()
    return u
  }
  const signIn = async (data) => {
    setUser(await api.signIn(data))
    await refreshProfile()
  }
  const signOut = async () => {
    await api.signOut()
    setUser(null)
    setProfile(null)
    setEquipped([])
    setStreak(0)
  }

  return (
    <AuthContext.Provider value={{ user, profile, equipped, streak, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
