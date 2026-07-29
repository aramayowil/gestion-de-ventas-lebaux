/**
 * hooks/use-hide-on-scroll.ts
 *
 * Devuelve `true` cuando la barra debería estar visible: al tope de la
 * página, al escrolear hacia arriba, o cuando el movimiento es
 * imperceptible (evita parpadeo por scrolls de 1-2px). Se oculta al
 * escrolear hacia abajo pasado el umbral inicial. Pensado para navbars
 * fijas tipo mobile-app (la tab bar inferior la usa).
 */
import * as React from 'react'

export function useHideOnScroll(threshold = 8) {
  const [visible, setVisible] = React.useState(true)
  const lastY = React.useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const ticking = React.useRef(false)

  React.useEffect(() => {
    function onScroll() {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current

        if (y < threshold) {
          setVisible(true)
        } else if (delta > 4) {
          setVisible(false) // bajando → ocultar
        } else if (delta < -4) {
          setVisible(true) // subiendo → mostrar
        }

        lastY.current = y
        ticking.current = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return visible
}
