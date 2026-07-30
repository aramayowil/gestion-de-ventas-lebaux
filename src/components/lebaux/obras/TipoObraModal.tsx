/**
 * components/lebaux/obras/TipoObraModal.tsx
 *
 * Modal que aparece ANTES de entrar al formulario de obra, cuando el
 * usuario toca "Nueva obra". Pregunta si lo que va a cargar es un
 * Presupuesto (cotización, con resumen fijo abajo + IVA discriminable) o
 * una Venta (flujo normal, sin cambios).
 *
 * Mismo estilo que PresupuestoModal / RegistrarPagoModal: Sheet (bottom
 * sheet en mobile, dialog centrado en desktop) + botones grandes en
 * columna, pensado para mobile.
 */
import { FileText, ShoppingCart } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet'
import type { TipoObra } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onElegir: (tipo: TipoObra) => void
}

export function TipoObraModal({ open, onClose, onElegir }: Props) {
  function elegir(tipo: TipoObra) {
    onElegir(tipo)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">¿Qué querés cargar?</SheetTitle>
          <SheetDescription>
            Elegí si esta obra es un presupuesto para el cliente o una venta directa.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="grid gap-3">
          <button
            type="button"
            onClick={() => elegir('presupuesto')}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 text-left transition-colors hover:border-primary/40 hover:bg-elevated/60"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold">Presupuesto</span>
              <span className="block text-sm text-muted-foreground mt-0.5">
                Cotización para el cliente. Podés aplicar descuento e incluir
                IVA, con un resumen fijo abajo mientras cargás las aberturas.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => elegir('venta')}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 text-left transition-colors hover:border-primary/40 hover:bg-elevated/60"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/20">
              <ShoppingCart className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold">Venta</span>
              <span className="block text-sm text-muted-foreground mt-0.5">
                Flujo normal: cargá aberturas, descuento y pago inicial como
                hasta ahora.
              </span>
            </span>
          </button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

export default TipoObraModal
