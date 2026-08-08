/**
 * components/pdf/ReciboPagoPdfButton.tsx
 *
 * Botón que abre el diálogo de elección de impresión.
 * Por defecto solo permite "Comprobante de Pago" (para pagos adicionales),
 * pero se puede habilitar "Recibo y Condiciones de Entrega" con
 * permitirCombinado=true.
 *
 * ACCESIBILIDAD:
 *   · aria-label descriptivo (menciona al cliente y n° de recibo).
 *   · aria-haspopup="dialog" + aria-expanded.
 *
 * OJO — MODALES ANIDADOS:
 *   Este botón se usa a veces DENTRO de otro modal ya abierto (ej:
 *   RegistrarPagoModal, un Sheet). Si ese modal padre se queda montado
 *   y abierto mientras este ImprimirDialog también se abre encima,
 *   quedan 2 cajas visibles al mismo tiempo (bug reportado: "aparecen 2
 *   modales" al querer imprimir). `onAbrirImprimirChange` avisa al
 *   padre cuándo el ImprimirDialog está abierto para que el padre se
 *   pueda ocultar mientras tanto (ver FinalizarVentaModal /
 *   RegistrarPagoModal para el uso).
 */

import * as React from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImprimirDialog } from './ImprimirDialog'
import type { Cliente, Obra, Pago, TotalesObra } from '@/lib/types'

interface Props {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  /** Si es true, también ofrece la opción "Recibo y Condiciones de Entrega". */
  permitirCombinado?: boolean
  /** Avisa al padre cuando el ImprimirDialog se abre/cierra, para que un
   * modal padre ya abierto pueda ocultarse mientras tanto (evita el bug
   * de "2 modales" cuando este botón vive dentro de otro modal). */
  onAbrirImprimirChange?: (abierto: boolean) => void
}

export function ReciboPagoPdfButton({
  cliente,
  obra,
  pago,
  totales,
  label = 'Descargar comprobante',
  variant = 'outline',
  size = 'default',
  className,
  permitirCombinado = true,
  onAbrirImprimirChange,
}: Props) {
  const [open, setOpen] = React.useState(false)

  function cambiarOpen(v: boolean) {
    setOpen(v)
    onAbrirImprimirChange?.(v)
  }

  const nroRecibo = String(pago.numeroRecibo).padStart(4, '0')
  const ariaLabel = `Descargar comprobante N° ${nroRecibo} de ${cliente.nombre || 'cliente'}`

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => cambiarOpen(true)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Download className="size-4" aria-hidden="true" />
        {label && <span>{label}</span>}
      </Button>
      <ImprimirDialog
        open={open}
        onClose={() => cambiarOpen(false)}
        cliente={cliente}
        obra={obra}
        pago={pago}
        totales={totales}
        permitirCombinado={permitirCombinado}
      />
    </>
  )
}
