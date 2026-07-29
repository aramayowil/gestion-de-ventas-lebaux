/**
 * components/auth/RequireAuth.tsx — Guards de ruta.
 *
 * RequireAuth: si no hay sesión, redirige a /login guardando el
 * destino original en location.state.from para volver después.
 *
 * RequireAdmin: si el usuario logueado no es admin, redirige a /
 * (no tiene permiso para ver la ruta).
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAutoRechazoPresupuestos } from '@/hooks/use-auto-rechazo-presupuestos'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()
  useAutoRechazoPresupuestos()

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (currentUser.rol !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
