/**
 * components/pdf/ImprimirDialog.tsx
 *
 * Diálogo de elección: al hacer clic en "Imprimir" se abre este modal
 * y se le pregunta al usuario qué tipo de comprobante quiere generar:
 *
 *   1. Recibo y Condiciones de Entrega → PDF de 1 página (combinado:
 *      antes eran 2 páginas —Acta + Recibo— fusionadas ahora en una sola).
 *   2. Comprobante de Pago              → PDF de 1 página, solo el pago
 *      (antes llamado "Recibo de pago solo"; se renombró para no
 *      confundirse con el nuevo título del combinado).
 *
 * Esto permite que, en cada pago, el usuario decida si necesita
 * reimprimir también las condiciones de entrega o si le alcanza con el
 * comprobante de pago.
 *
 * ACCESIBILIDAD:
 *   · El contenedor de opciones usa role="radiogroup" con aria-label, y
 *     cada opción es role="radio" con aria-checked — semántica estándar
 *     para "elegí una de estas opciones", que anuncia correctamente el
 *     estado a JAWS / NVDA / VoiceOver.
 *   · El botón "Generar PDF" expone aria-busy="true" durante la generación,
 *     para que el lector de pantalla anuncie el estado de carga.
 *   · Las tarjetas usan un anillo de foco visible (focus-visible:ring-2)
 *     para navegación por teclado, además del borde de "seleccionado".
 *   · El icono decorativo lleva aria-hidden para no ruido en la lectura.
 *   · El badge descriptivo se anuncia como parte del texto de la opción.
 */

import * as React from 'react'
import { FileText, Receipt, Loader2, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Cliente, Obra, Pago, TotalesObra } from '@/lib/types'
import {
  generarPdf,
  type TipoComprobante,
} from '@/lib/pdf-generate'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  cliente: Cliente
  obra: Obra
  pago: Pago
  totales: TotalesObra
  /** Si es false, oculta la opción "Recibo y Condiciones de Entrega" (ej: pagos posteriores al inicial). */
  permitirCombinado?: boolean
}

export function ImprimirDialog({
  open,
  onClose,
  cliente,
  obra,
  pago,
  totales,
  permitirCombinado = true,
}: Props) {
  const [seleccion, setSeleccion] = React.useState<TipoComprobante | null>(
    permitirCombinado ? 'combinado' : 'recibo-solo',
  )
  const [generando, setGenerando] = React.useState(false)
  const ivaBasePct = useAjustes(null).data?.sistema.ivaBasePct ?? AJUSTES_DEFAULT.sistema.ivaBasePct

  React.useEffect(() => {
    if (open) {
      setSeleccion(permitirCombinado ? 'combinado' : 'recibo-solo')
      setGenerando(false)
    }
  }, [open, permitirCombinado])

  // Navegación por teclado dentro del radiogroup: Flecha ↓/→ → siguiente,
  // Flecha ↑/← → anterior, igual que un <input type="radio"> nativo.
  const opcionesRef = React.useRef<Array<HTMLButtonElement | null>>([])

  function moverSeleccion(direccion: 1 | -1) {
    const opciones: TipoComprobante[] = permitirCombinado
      ? ['combinado', 'recibo-solo']
      : ['recibo-solo']
    const idxActual = seleccion ? opciones.indexOf(seleccion) : 0
    const idxNuevo = (idxActual + direccion + opciones.length) % opciones.length
    setSeleccion(opciones[idxNuevo])
    opcionesRef.current[idxNuevo]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent, _idx: number) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      moverSeleccion(1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      moverSeleccion(-1)
    }
  }

  async function handleGenerar() {
    if (!seleccion || generando) return
    setGenerando(true)
    try {
      await generarPdf(seleccion, { cliente, obra, pago, totales, ivaBasePct })
      const etiqueta =
        seleccion === 'combinado'
          ? 'Recibo y Condiciones de Entrega'
          : 'Comprobante de Pago'
      toast.success(`PDF generado: ${etiqueta}`)
      onClose()
    } catch (err) {
      console.error('Error al generar PDF:', err)
      toast.error('No se pudo generar el PDF. Intentá nuevamente.')
    } finally {
      setGenerando(false)
    }
  }

  const opciones: Array<{
    id: TipoComprobante
    icon: React.ComponentType<{ className?: string }>
    titulo: string
    descripcion: string
    badge: string
  }> = []
  if (permitirCombinado) {
    opciones.push({
      id: 'combinado',
      icon: FileText,
      titulo: 'Recibo y Condiciones de Entrega',
      descripcion:
        'PDF de 1 página. Incluye el detalle de aberturas entregadas, las condiciones técnicas y el resumen del pago recibido.',
      badge: 'Completo',
    })
  }
  opciones.push({
    id: 'recibo-solo',
    icon: Receipt,
    titulo: 'Comprobante de Pago',
    descripcion:
      'PDF de 1 página. Solo el comprobante de este pago, con el detalle de la obra y los totales.',
    badge: 'Solo pago',
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué querés imprimir?</DialogTitle>
          <DialogDescription>
            Elegí el tipo de comprobante a generar para este pago.
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid gap-3 py-2"
          role="radiogroup"
          aria-label="Tipo de comprobante a imprimir"
        >
          {opciones.map((op, idx) => {
            const seleccionado = seleccion === op.id
            return (
              <OpcionCard
                key={op.id}
                ref={(el) => {
                  opcionesRef.current[idx] = el
                }}
                icon={op.icon}
                titulo={op.titulo}
                descripcion={op.descripcion}
                badge={op.badge}
                seleccionado={seleccionado}
                onClick={() => setSeleccion(op.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                disabled={generando}
              />
            )
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={generando}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleGenerar}
            disabled={!seleccion || generando}
            aria-busy={generando}
            aria-label={
              generando
                ? 'Generando PDF, por favor esperá'
                : 'Generar el PDF del comprobante seleccionado'
            }
          >
            {generando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Generando…
              </>
            ) : (
              <>
                <FileText className="size-4" aria-hidden="true" />
                Generar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// forwardRef para poder enfocar programáticamente con flechas del teclado.
type OpcionCardProps = {
  icon: React.ComponentType<{ className?: string }>
  titulo: string
  descripcion: string
  seleccionado: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  disabled?: boolean
  badge?: string
}

const OpcionCard = React.forwardRef<HTMLButtonElement, OpcionCardProps>(
  function OpcionCard(
    { icon: Icon, titulo, descripcion, seleccionado, onClick, onKeyDown, disabled, badge },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={seleccionado}
        tabIndex={seleccionado ? 0 : -1}
        onClick={onClick}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label={`${titulo}. ${badge ? `${badge}. ` : ''}${descripcion}`}
        className={cn(
          'group relative w-full text-left rounded-lg border-2 p-4 transition-all',
          'hover:border-primary/40 hover:bg-accent/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          seleccionado
            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
            : 'border-border',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'shrink-0 size-10 rounded-lg flex items-center justify-center transition-colors',
              seleccionado
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{titulo}</span>
              {badge && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {descripcion}
            </p>
          </div>
          <div
            className={cn(
              'shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-all',
              seleccionado
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/30',
            )}
            aria-hidden="true"
          >
            {seleccionado && <Check className="size-3 text-primary-foreground" />}
          </div>
        </div>
      </button>
    )
  },
)
