/**
 * components/pdf/ComprobantePdfButton.tsx
 *
 * Botón que abre el diálogo de elección: el usuario decide si generar
 * "Recibo y Condiciones de Entrega" (1 página, combinado) o
 * "Comprobante de Pago" (1 página, solo el pago).
 *
 * ACCESIBILIDAD:
 *   · aria-label descriptivo (menciona al cliente) para lectores de pantalla.
 *   · aria-haspopup="dialog" + aria-expanded para indicar que abre un modal.
 *   · El botón deshabilitado en estado "cargando" mantiene aria-busy.
 */

import * as React from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImprimirDialog } from './ImprimirDialog'
import type { Cliente, Obra, Pago, TotalesObra } from '@/lib/types'
import { toast } from 'sonner'

interface Props {
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  /** Si es false, oculta la opción "Recibo y Condiciones de Entrega" del diálogo. */
  permitirCombinado?: boolean
  /** Avisa al padre cuando el ImprimirDialog se abre/cierra, para que un
   * modal padre ya abierto pueda ocultarse mientras tanto (evita el bug
   * de "2 modales" cuando este botón vive dentro de otro modal — ver
   * ReciboPagoPdfButton para la explicación completa). */
  onAbrirImprimirChange?: (abierto: boolean) => void
}

export function ComprobantePdfButton({
  cliente,
  obra,
  pago,
  totales,
  label = 'Imprimir',
  variant = 'default',
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

  function handleClick() {
    if (
      !obra.tipologias.length ||
      obra.tipologias.some((t) => !t.descripcion.trim() || t.cantidad <= 0)
    ) {
      toast.error(
        'Completá la descripción y cantidad de todas las aberturas antes de imprimir.',
      )
      return
    }
    if (pago.monto <= 0) {
      toast.error('El monto del pago debe ser mayor a cero.')
      return
    }
    cambiarOpen(true)
  }

  // Etiqueta accesible: combina la acción + el cliente, para que un lector
  // de pantalla anuncie "Imprimir comprobante de la obra de Juan Pérez"
  // en lugar del genérico "Imprimir".
  const ariaLabel = `Imprimir comprobante de la obra de ${cliente.nombre || 'cliente'}`

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <FileText className="size-4" aria-hidden="true" />
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
