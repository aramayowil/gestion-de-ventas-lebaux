/**
 * hooks/use-auto-rechazo-presupuestos.ts
 *
 * Al montar la app, revisa todos los presupuestos en estado 'pendiente'
 * que superaron el plazo de días configurado y los marca como 'rechazado'.
 *
 * Se ejecuta UNA sola vez por sesión. Si se cambia la configuración de
 * días, igual solo se reevalúa al recargar la página (suficiente para
 * el caso de uso: un vendedor que abre la app cada mañana).
 */
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useClientes, useObras, useAjustes, AJUSTES_DEFAULT, useRechazarPresupuesto } from '@/hooks/queries'
import { presupuestoVencido } from '@/lib/obra-totales'

export function useAutoRechazoPresupuestos() {
  const dias = useAjustes(null).data?.sistema.diasAutoRechazo ?? AJUSTES_DEFAULT.sistema.diasAutoRechazo
  const { data: clientes = [] } = useClientes()
  const clienteIds = clientes.map((c) => c.id)
  const { data: obras = [] } = useObras(clienteIds)
  const rechazarPresupuesto = useRechazarPresupuesto()
  const ejecutado = useRef(false)

  useEffect(() => {
    if (ejecutado.current) return
    if (clienteIds.length === 0) return // esperar a que carguen los clientes
    ejecutado.current = true

    const vencidas = obras.filter((o) => presupuestoVencido(o, dias))
    if (vencidas.length === 0) return

    Promise.all(
      vencidas.map((o) =>
        rechazarPresupuesto.mutateAsync(o, `Vencido automáticamente tras ${dias} días sin aceptar.`),
      ),
    )
      .then(() => {
        toast.info(
          `${vencidas.length} presupuesto${vencidas.length === 1 ? '' : 's'} vencido${vencidas.length === 1 ? '' : 's'} automáticamente tras ${dias} días sin aceptar.`,
        )
      })
      .catch((e) => {
        // Silencioso: no rompemos la app si el auto-rechazo falla
        console.error('Auto-rechazo falló:', e)
      })
  }, [clienteIds.length, obras, dias, rechazarPresupuesto])
}
