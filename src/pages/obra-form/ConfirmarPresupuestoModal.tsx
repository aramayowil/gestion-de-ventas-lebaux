/**
 * pages/obra-form/ConfirmarPresupuestoModal.tsx
 *
 * Paso 1 (solo presupuesto): resumen final antes de guardar el
 * presupuesto como 'pendiente' — muestra cantidad de aberturas, forma
 * de pago, descuento/IVA si corresponde, pago inicial (si lo hay) y el
 * total. Botones [Cancelar] / [Confirmar].
 *
 * Al confirmar, `onConfirmar` (handleConfirmarPresupuesto en useObraForm)
 * persiste la obra y, si corresponde, el pago inicial — recién ahí se
 * cierra este modal y se abre el Paso 2 (PresupuestoModal, imprimir/enviar).
 */
import * as React from 'react'
import { FileText, Wallet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/obra-totales'
import type { Obra, TotalesObra } from '@/lib/types'

interface Props {
  open: boolean
  obra: Obra
  totales: TotalesObra
  cantAberturas: number
  pagoInicialNum: number
  onConfirmar: () => void | Promise<void>
  onCancelar: () => void
}

export function ConfirmarPresupuestoModal({
  open,
  obra,
  totales,
  cantAberturas,
  pagoInicialNum,
  onConfirmar,
  onCancelar,
}: Props) {
  const [enviando, setEnviando] = React.useState(false)

  React.useEffect(() => {
    if (open) setEnviando(false)
  }, [open])

  async function handleConfirmar() {
    setEnviando(true)
    try {
      await onConfirmar()
    } finally {
      setEnviando(false)
    }
  }

  const hayDescuento = (obra.descuentoPct || 0) > 0
  const hayPagoInicial = pagoInicialNum > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !enviando && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <FileText className="size-5 text-primary" aria-hidden="true" />
            Confirmar presupuesto
          </DialogTitle>
          <DialogDescription>
            Revisá el resumen antes de guardarlo. Vas a poder editarlo o
            reenviarlo después.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-lg border border-border/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ítems</span>
            <span className="font-medium">
              {obra.tipologias.length}{' '}
              {obra.tipologias.length === 1 ? 'ítem' : 'ítems'} · {cantAberturas}{' '}
              {cantAberturas === 1 ? 'abertura' : 'aberturas'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Forma de pago</span>
            <span className="font-medium">{obra.formaPago || '—'}</span>
          </div>
          {hayDescuento && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Descuento ({Math.round((obra.descuentoPct || 0) * 100)}%)
              </span>
              <span className="font-medium">
                −${formatMoney(totales.descuentoMonto)}
              </span>
            </div>
          )}
          {totales.incluyeIva && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                IVA ({Math.round((totales.ivaPct || 0) * 1000) / 10}%)
              </span>
              <span className="font-medium">
                +${formatMoney(totales.ivaMonto)}
              </span>
            </div>
          )}
          {hayPagoInicial && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="size-3.5" aria-hidden="true" />
                Pago inicial
              </span>
              <span className="font-medium">${formatMoney(pagoInicialNum)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-1">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-base money">
              ${formatMoney(totales.totalConIva)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={onCancelar}
            disabled={enviando}
            className="sm:flex-1"
          >
            Cancelar
          </Button>
          <Button
            size="lg"
            onClick={handleConfirmar}
            disabled={enviando}
            className="sm:flex-1"
          >
            {enviando ? 'Guardando...' : 'Confirmar presupuesto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmarPresupuestoModal
