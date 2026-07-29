/**
 * lib/stores/auth-store.ts — Sesión con Supabase Auth.
 *
 * Usa supabase.auth.signInWithPassword / signOut.
 * La sesión persiste automáticamente (Supabase guarda el token).
 *
 * El objeto User de negocio (con rol, nombre) se carga desde
 * public.users después del login.
 */
import { create } from 'zustand'
import { supabase } from '../supabase-client'
import type { User } from '../types'

interface AuthStoreState {
  /** Sesión de Supabase Auth (token JWT). */
  session: { user: { id: string; email?: string } } | null
  /** Usuario de negocio (public.users). */
  currentUser: User | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  /** Carga el usuario de negocio desde public.users. */
  fetchCurrentUser: () => Promise<void>
  /** Inicializa: escucha cambios de sesión de Supabase. */
  init: () => Promise<void>
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  session: null,
  currentUser: null,
  loading: true,
  error: null,

  init: async () => {
    // Escuchar cambios de sesión
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session })
      if (session) {
        await get().fetchCurrentUser()
      } else {
        set({ currentUser: null, loading: false })
      }
    })

    // Verificar sesión existente al arrancar
    const { data: { session } } = await supabase.auth.getSession()
    set({ session })
    if (session) {
      await get().fetchCurrentUser()
    } else {
      set({ loading: false })
    }
  },

  fetchCurrentUser: async () => {
    const session = get().session
    if (!session) {
      set({ currentUser: null, loading: false })
      return
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (error || !data) {
      set({ currentUser: null, loading: false, error: 'No se encontró el usuario en la base de datos.' })
      return
    }
    // Mapear de snake_case a camelCase
    const user: User = {
      id: data.id,
      username: data.username,
      passwordHash: '', // No se expone
      rol: data.rol,
      nombre: data.nombre,
      creadoEn: data.creado_en,
      creadoPor: data.creado_por ?? null,
    }
    set({ currentUser: user, loading: false, error: null })
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      set({ loading: false, error: error.message })
      return { ok: false, error: error.message }
    }
    set({ session: { user: data.user } })
    await get().fetchCurrentUser()
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ session: null, currentUser: null })
  },
}))

/** Hook: true si hay sesión. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.session)
}

/** Hook: true si el usuario es admin. */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.currentUser?.rol === 'admin')
}
