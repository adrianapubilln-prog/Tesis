import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Business, BusinessUser, Role, ModuleKey } from './supabase'
import { canAccess as canAccessFn, canEdit as canEditFn } from './permissions'

type AuthState = {
  session: Session | null
  user: User | null
  business: Business | null
  membership: BusinessUser | null
  role: Role | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  canAccess: (module: ModuleKey) => boolean
  canEdit: (module: ModuleKey) => boolean
}

const Ctx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [membership, setMembership] = useState<BusinessUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (uid: string) => {
    const { data: member } = await supabase
      .from('business_users')
      .select('*')
      .eq('auth_user_id', uid)
      .maybeSingle()
    setMembership(member as BusinessUser | null)
    if (member) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', (member as BusinessUser).business_id)
        .maybeSingle()
      setBusiness(biz as Business | null)
    } else {
      // maybe the user is an owner without a business_users row yet
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', uid)
        .maybeSingle()
      setBusiness(biz as Business | null)
    }
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => mounted && setLoading(false))
      } else {
        setLoading(false)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          await loadProfile(sess.user.id)
        } else {
          setBusiness(null)
          setMembership(null)
        }
        setLoading(false)
      })()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? translateError(error.message) : null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? translateError(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setBusiness(null)
    setMembership(null)
  }

  const refresh = async () => {
    if (user) await loadProfile(user.id)
  }

  const role = (membership?.role ?? null) as Role | null

  const canAccess = (module: ModuleKey) =>
    role != null && canAccessFn(role, module, membership?.permissions)
  const canEdit = (module: ModuleKey) =>
    role != null && canEditFn(role, module, membership?.permissions)

  return (
    <Ctx.Provider value={{ session, user, business, membership, role, loading, signUp, signIn, signOut, refresh, canAccess, canEdit }}>
      {children}
    </Ctx.Provider>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con este correo.'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  return msg
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
