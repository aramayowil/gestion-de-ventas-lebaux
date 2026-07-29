/**
 * hooks/use-is-desktop.ts
 *
 * true si el viewport es >= 640px (breakpoint `sm` de Tailwind).
 * Se usa para alternar entre el layout de formulario "todo visible"
 * (desktop, con Cards abiertas) y el layout de acordeón por pasos
 * (móvil, donde el uso principal de la app ocurre en la práctica).
 */
import { useEffect, useState } from 'react'

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 640px)').matches
      : true,
  )

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
