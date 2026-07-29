/**
 * hooks/use-visual-viewport-top.ts
 *
 * Devuelve un valor CSS para `top` que mantiene al elemento centrado en el
 * área visible del viewport. En móvil, cuando aparece el teclado virtual,
 * `window.visualViewport` se achica (su `height` baja y su `offsetTop`
 * sube). Si el modal sigue centrado respecto al layout viewport, el input
 * que el usuario está editando queda tapado por el teclado.
 *
 * Este hook detecta ese cambio y devuelve un `top` en píxeles que reposiciona
 * el modal al centro del área visible (arriba del teclado). Cuando el teclado
 * se cierra, vuelve a `'50%'` (centro del layout viewport).
 *
 * En desktop, `window.innerHeight - visualViewport.height` es ~0, así que
 * siempre devuelve `'50%'` — no hay cambio visible.
 *
 * Se usa en `DialogContent` y `AlertDialogContent` para que TODOS los
 * modales del sistema (cliente, pago, presupuesto, imprimir PDF) ganen
 * este comportamiento automáticamente.
 *
 * Umbral: 100px. Por debajo de eso consideramos que son solo barras del
 * navegador / safe areas, no un teclado real.
 */
import * as React from 'react'

export function useVisualViewportTop(): string {
  const [top, setTop] = React.useState<string>('50%')

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    function update() {
      const vv = window.visualViewport
      if (!vv) return
      const keyboardHeight = window.innerHeight - vv.height
      if (keyboardHeight > 100) {
        // Centrar el modal en el área visible (arriba del teclado).
        setTop(`${vv.offsetTop + vv.height / 2}px`)
      } else {
        setTop('50%')
      }
    }

    update()
    window.visualViewport.addEventListener('resize', update)
    window.visualViewport.addEventListener('scroll', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])

  return top
}
