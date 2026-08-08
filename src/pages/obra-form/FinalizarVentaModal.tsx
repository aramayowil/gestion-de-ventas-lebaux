/**
 * pages/obra-form/FinalizarVentaModal.tsx
 *
 * Se abre automáticamente al tocar "Finalizar Venta" / "Actualizar Venta"
 * — la venta ya se guardó (estadoPresupuesto: 'aceptado') antes de que
 * este modal aparezca, no hay paso de confirmación previo.
 *
 * No se puede cerrar con Escape/click afuera/X: la única salida es
 * "Volver al cliente", que navega reemplazando el historial (no se puede
 * volver atrás al formulario con el botón "atrás" del navegador).
 *
 * OJO — BUG "2 MODALES" AL IMPRIMIR (ya resuelto):
 *   ComprobantePdfButton y ReciboPagoPdfButton abren cada uno su propio
 *   ImprimirDialog (un Dialog centrado) para elegir qué comprobante
 *   generar. Como este modal se queda abierto de fondo (no se puede
 *   cerrar), si no hacíamos nada, al tocar "Imprimir..." se veían ESTE
 *   modal Y el ImprimirDialog superpuestos al mismo tiempo. Por eso
 *   `imprimirAbierto` apaga el `open` de este Dialog mientras el hijo
 *   está abierto — se restaura solo al cerrar el ImprimirDialog.
 */
import * as React from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ComprobantePdfButton } from '@/components/pdf/ComprobantePdfButton'
import { ReciboPagoPdfButton } from '@/components/pdf/ReciboPagoPdfButton'
import { Skeleton } from '@/components/ui/skeleton'
import { usePagos, useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { calcularTotalesObra, formatMoney } from '@/lib/obra-totales'
import type { Cliente, Obra, Pago } from '@/lib/types'

interface Props {
  open: boolean
  obra: Obra
  cliente: Cliente
  pagoInicial: Pago | null
  onVolverCliente: () => void
}

export function FinalizarVentaModal({ open, obra, cliente, pagoInicial, onVolverCliente }: Props) {
  // Ver comentario de archivo: apaga este Dialog mientras el
  // ImprimirDialog (hijo, abierto por alguno de los 2 botones de abajo)
  // esté abierto, para no mostrar 2 modales superpuestos.
  const [imprimirAbierto, setImprimirAbierto] = React.useState(false)

  // OJO: los totales se calculan con TODOS los pagos de la obra (no solo
  // `pagoInicial`). Esto importa porque "Actualizar Venta" reutiliza este
  // mismo modal: si la obra ya tenía otros pagos registrados desde antes
  // (por ejemplo, cuotas cargadas después desde "Pagos" en la ficha del
  // cliente), el saldo mostrado acá y en los PDFs debe reflejarlos a
  // todos, no solo al último pago que se acaba de guardar.
  const { data: todosLosPagosDeEstaObra = [], isLoading: cargandoPagos } = usePagos([obra.id])
  const sistema = useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const totales = calcularTotalesObra(obra, todosLosPagosDeEstaObra, {
    ivaBasePct: sistema.ivaBasePct,
    ivaPorLinea: sistema.ivaPorLinea,
  })

  return (
    <Dialog open={open && !imprimirAbierto} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            Venta guardada
          </DialogTitle>
          <DialogDescription>
            {pagoInicial
              ? `Pago de $${formatMoney(pagoInicial.monto)} registrado como Recibo N° ${String(pagoInicial.numeroRecibo).padStart(4, '0')}.`
              : `Total de la venta: $${formatMoney(totales.totalConIva)}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Mientras no sepamos el saldo real (con TODOS los pagos ya
            cargados), no mostramos los botones de impresión: preferimos
            esperar un instante antes que arriesgarnos a imprimir un saldo
            calculado con datos incompletos. */}
        {cargandoPagos ? (
          <div className="grid gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
        <div className="grid gap-2">
          {pagoInicial ? (
            <>
              <ComprobantePdfButton
                cliente={cliente}
                obra={obra}
                pago={pagoInicial}
                totales={totales}
                label="Imprimir formato de entrega"
                variant="default"
                size="lg"
                className="w-full"
                permitirCombinado
                onAbrirImprimirChange={setImprimirAbierto}
              />
              <ReciboPagoPdfButton
                cliente={cliente}
                obra={obra}
                pago={pagoInicial}
                totales={totales}
                label="Recibo de pago"
                variant="outline"
                size="lg"
                className="w-full"
                onAbrirImprimirChange={setImprimirAbierto}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-3">
              No se registró pago inicial, así que todavía no hay un recibo
              para imprimir. Podés registrar un pago más tarde desde
              "Pagos" en la ficha del cliente.
            </p>
          )}
          <Button variant="secondary" size="lg" className="w-full" onClick={onVolverCliente}>
            Volver al cliente
            <ArrowRight className="size-4" />
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default FinalizarVentaModal
