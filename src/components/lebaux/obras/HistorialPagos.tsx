/**
 * components/lebaux/obras/HistorialPagos.tsx — Lista de pagos de una obra.
 *
 * Rediseñada: cada pago es una fila con chip dorado, monto grande y
 * metadata compacta. Los pagos anulados aparecen atenuados.
 */
import { Receipt, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useUpdatePago, useClientes } from '@/hooks/queries'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaCorta,
} from '@/lib/obra-totales'
import type { Obra, Pago } from '@/lib/types'
import { ReciboPagoPdfButton } from '@/components/pdf/ReciboPagoPdfButton'
import { toast } from 'sonner'

interface Props {
  obra: Obra
  pagos: Pago[]
}

export function HistorialPagos({ obra, pagos }: Props) {
  const anularPagoMutation = useUpdatePago()
  const { data: clientes = [] } = useClientes()
  const cliente = clientes.find((c) => c.id === obra.clienteId)

  if (pagos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Todavía no se registraron pagos en esta obra.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {pagos.map((pago) => {
        if (pago.anulado) {
          return (
            <Card key={pago.id} className="opacity-60 py-0 border-border/40">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0 ring-1 ring-border/40">
                  <Ban className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through money">
                    ${formatMoney(pago.monto)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recibo N° {String(pago.numeroRecibo).padStart(4, '0')} ·{' '}
                    {formatFechaCorta(pago.fecha)}
                    {pago.anuladoMotivo ? ` · Anulado: ${pago.anuladoMotivo}` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        }

        const pagosHastaEste = pagos.filter(
          (p) =>
            !p.anulado &&
            new Date(p.creadoEn).getTime() <=
              new Date(pago.creadoEn).getTime(),
        )
        const totalesHasta = calcularTotalesObra(obra, pagosHastaEste)

        return (
          <Card key={pago.id} className="py-0 border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                <Receipt className="size-4 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm money">
                  ${formatMoney(pago.monto)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Recibo N° {String(pago.numeroRecibo).padStart(4, '0')} ·{' '}
                  {formatFechaCorta(pago.fecha)}
                  {pago.formaPago ? ` · ${pago.formaPago}` : ''}
                  {pago.nota ? ` · ${pago.nota}` : ''}
                </p>
                {(pago.formaPago === 'Tarjeta' || pago.formaPago === 'Cheque') &&
                  pago.montoBase != null &&
                  pago.montoBase < pago.monto && (
                    <p className="text-[11px] text-primary/80 truncate">
                      Incluye recargo · ${formatMoney(pago.montoBase)} al saldo
                    </p>
                  )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {cliente && (
                  <ReciboPagoPdfButton
                    cliente={cliente}
                    obra={obra}
                    pago={pago}
                    totales={totalesHasta}
                    label=""
                    size="icon"
                    variant="ghost"
                  />
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Anular recibo N° ${String(pago.numeroRecibo).padStart(4, '0')}`}
                    >
                      <Ban className="size-4" aria-hidden="true" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Anular recibo N°{' '}
                        {String(pago.numeroRecibo).padStart(4, '0')}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        El pago de ${formatMoney(pago.monto)} se marcará como
                        anulado. El saldo pendiente de la obra se recalculará
                        {(pago.formaPago === 'Tarjeta' || pago.formaPago === 'Cheque') &&
                        pago.montoBase != null &&
                        pago.montoBase < pago.monto
                          ? ` (vuelven a deberse $${formatMoney(pago.montoBase)}).`
                          : '.'}{' '}
                        El recibo quedará en el historial para auditoría.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await anularPagoMutation.mutateAsync({
                              ...pago,
                              anulado: true,
                              anuladoMotivo: 'Anulado por el usuario',
                            })
                            toast.success('Pago anulado. Saldo recalculado.')
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Error al anular el pago.')
                          }
                        }}
                        disabled={anularPagoMutation.isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        {anularPagoMutation.isPending ? 'Anulando...' : 'Anular pago'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
