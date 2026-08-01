/**
 * components/auth/RequireAuth.tsx — Guards de ruta.
 *
 * RequireAuth: si no hay sesión, redirige a /login. Después de autenticarse,
 * la app siempre comienza en Home para mostrar la bienvenida inicial.
 *
 * RequireAdmin: si el usuario logueado no es admin, redirige a /
 * (no tiene permiso para ver la ruta).
 */
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAutoRechazoPresupuestos } from '@/hooks/use-auto-rechazo-presupuestos'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session)
  useAutoRechazoPresupuestos()

  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  if (currentUser.rol !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
