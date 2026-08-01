/**
 * pages/PagosObraPage.tsx — Página dedicada a los pagos de una obra.
 *
 * Estructura:
 *   1. Header con volver
 *   2. Resumen de la obra (total, abonado, saldo) + estado del presupuesto
 *   3. Botón "Registrar pago" → abre el RegistrarPagoModal
 *   4. Historial de pagos (reutiliza HistorialPagos)
 */
import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppLayout } from '@/components/layout/AppLayout'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { HistorialPagos } from '@/components/lebaux/obras/HistorialPagos'
import { RegistrarPagoModal } from '@/components/lebaux/obras/RegistrarPagoModal'
import { Skeleton } from '@/components/ui/skeleton'
import { useObraById, useClientes, usePagos } from '@/hooks/queries'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaCorta,
} from '@/lib/obra-totales'

interface Props {
  obraId: string
  onVolver: () => void
}

export function PagosObraPage({ obraId, onVolver }: Props) {
  const { data: obra, isLoading: cargandoObra } = useObraById(obraId)
  const { data: clientes = [] } = useClientes()
  const cliente = obra
    ? clientes.find((c) => c.id === obra.clienteId)
    : undefined
  const { data: todosPagos = [] } = usePagos(obra ? [obra.id] : [])
  const [modalPago, setModalPago] = React.useState(false)

  const pagosObra = React.useMemo(
    () =>
      [...todosPagos].sort(
        (a, b) =>
          new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
      ),
    [todosPagos],
  )

  if (cargandoObra) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="max-w-3xl w-full mx-auto px-4 py-5 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!obra || !cliente) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Obra no encontrada.</p>
        <Button onClick={onVolver} variant="outline">
          Volver
        </Button>
      </div>
    )
  }

  const totales = calcularTotalesObra(obra, pagosObra)
  const progreso =
    totales.totalConDescuento > 0
      ? Math.min(1, totales.totalAbonado / totales.totalConDescuento)
      : 0

  return (
    <AppLayout
      title={`Pagos · ${cliente.nombre}`}
      subtitle={`${obra.tipologias.length} ${obra.tipologias.length === 1 ? 'ítem' : 'ítems'} · ${formatFechaCorta(obra.fecha)}`}
      onBack={onVolver}
      headerActions={
        <EstadoPresupuestoBadge estado={obra.estadoPresupuesto} size="sm" />
      }
      maxWidth="max-w-3xl"
    >
        {/* ─── Resumen de la obra ─── */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60">
          <CardContent className="space-y-4">
            {/* Progreso */}
            {totales.totalConDescuento > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Progreso de pago
                  </span>
                  <span className="money text-sm font-semibold tabular-nums">
                    {Math.round(progreso * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-500"
                    style={{ width: `${progreso * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <Stat
                label="Total"
                value={`$${formatMoney(totales.totalConDescuento)}`}
                tone="muted"
              />
              <Stat
                label="Abonado"
                value={`$${formatMoney(totales.totalAbonado)}`}
                tone="success"
              />
              <Stat
                label="Saldo"
                value={`$${formatMoney(totales.saldoPendiente)}`}
                tone={totales.saldoPendiente > 0 ? 'danger' : 'success'}
              />
            </div>

            {/* Botón registrar pago */}
            <Button
              className="w-full h-11"
              onClick={() => setModalPago(true)}
              disabled={totales.saldoPendiente <= 0}
            >
              <Plus className="size-4" />
              {totales.saldoPendiente > 0
                ? 'Registrar pago'
                : 'Obra sin saldo pendiente'}
            </Button>
          </CardContent>
        </Card>

        {/* ─── Historial de pagos ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Historial de pagos
            </h3>
            <span className="text-xs text-muted-foreground money">
              {pagosObra.filter((p) => !p.anulado).length} pago(s) válido(s)
            </span>
          </div>
          <HistorialPagos obra={obra} pagos={pagosObra} />
        </section>

      <RegistrarPagoModal
        open={modalPago}
        onClose={() => setModalPago(false)}
        obra={obra}
        pagos={pagosObra}
      />
    </AppLayout>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'muted' | 'success' | 'danger'
}) {
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 money text-base sm:text-lg font-semibold ${valueColor}`}
      >
        {value}
      </p>
    </div>
  )
}
