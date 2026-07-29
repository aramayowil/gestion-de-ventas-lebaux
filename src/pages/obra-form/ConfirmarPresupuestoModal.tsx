/**
 * pages/obra-form/ConfirmarPresupuestoModal.tsx
 *
 * Paso 1 del flujo "Finalizar Presupuesto" (y su equivalente al editar un
 * presupuesto pendiente/rechazado: "Actualizar Presupuesto"). Muestra el
 * resumen (ítems, totales, descuento, IVA, pago inicial si hay) y pide
 * Confirmar o Cancelar. Si el usuario confirma, el caller persiste la obra
 * como 'pendiente' y abre el PresupuestoModal en modo `alFinalizar`.
 */
import { CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { calcularTotalesObra, formatMoney } from '@/lib/obra-totales'
import type { Obra } from '@/lib/types'

interface Props {
  open: boolean
  obra: Obra
  totales: ReturnType<typeof calcularTotalesObra>
  cantAberturas: number
  pagoInicialNum: number
  onConfirmar: () => void
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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            ¿Finalizar este presupuesto?
          </DialogTitle>
          <DialogDescription>
            Revisá el resumen. Al confirmar, el presupuesto queda guardado
            como <strong className="text-foreground">pendiente</strong> a
            la espera de la decisión del cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de ítems */}
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Ítems
            </span>
            <span className="text-xs font-medium">
              {obra.tipologias.length} · {cantAberturas} abertura{cantAberturas === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="divide-y divide-border/30 max-h-40 overflow-y-auto">
            {obra.tipologias.map((t, i) => (
              <li key={t.id} className="px-3 py-2 flex items-start gap-2 text-sm">
                <span className="shrink-0 size-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {t.descripcion || <span className="text-muted-foreground italic">Sin descripción</span>}
                  </p>
                  <p className="text-xs text-muted-foreground money">
                    {t.cantidad} × ${formatMoney(t.precioUnitario)} = ${formatMoney(t.cantidad * t.precioUnitario)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Totales */}
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total bruto</span>
            <span className="money font-medium">${formatMoney(totales.totalBruto)}</span>
          </div>
          {totales.descuentoMonto > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Descuento ({Math.round(totales.descuentoPct * 100)}%)
              </span>
              <span className="money text-destructive">
                −${formatMoney(totales.descuentoMonto)}
              </span>
            </div>
          )}
          {totales.incluyeIva && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                IVA ({Math.round(totales.ivaPct * 1000) / 10}%)
              </span>
              <span className="money text-success">
                +${formatMoney(totales.ivaMonto)}
              </span>
            </div>
          )}
          {pagoInicialNum > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pago inicial</span>
              <span className="money text-success">
                ${formatMoney(pagoInicialNum)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-base font-semibold">
            <span>Total {pagoInicialNum > 0 && '· saldo'}</span>
            <span className="money font-display">
              ${formatMoney(pagoInicialNum > 0 ? Math.max(0, totales.totalConIva - pagoInicialNum) : totales.totalConIva)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancelar} className="sm:flex-1">
            Cancelar
          </Button>
          <Button size="lg" onClick={onConfirmar} className="sm:flex-1">
            <CheckCircle2 className="size-4" />
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmarPresupuestoModal
