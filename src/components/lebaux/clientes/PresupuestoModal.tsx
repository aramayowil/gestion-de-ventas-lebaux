/**
 * components/lebaux/clientes/PresupuestoModal.tsx — Modal para VER, imprimir o
 * enviar por WhatsApp el presupuesto/venta de una obra (sin entrar al
 * formulario de edición).
 *
 * Muestra el detalle de ítems (aberturas) tal cual quedaron cargados —
 * descripción, cantidad, línea, color y precio — seguido del resumen de
 * totales. Es de solo lectura: no permite modificar nada acá.
 *
 * Acciones:
 *   · Imprimir PDF: descarga un PDF del presupuesto (layout PresupuestoPdfLayout).
 *   · Enviar por WhatsApp: abre wa.me/<numero>?text=<mensaje>.
 *   · Cerrar (modo normal) / Volver al cliente (modo alFinalizar).
 *
 * Si la obra está en 'borrador' o 'rechazado', al enviar se marca como
 * 'pendiente' (con timestamp). Si ya está 'pendiente' o 'aceptado', se
 * mantiene igual pero se puede reenviar/reimprimir.
 *
 * NOTA: el cambio de estado (aceptar/rechazar/volver a pendiente) NO se
 * hace desde este modal. Se hace desde el botón "Cambiar estado" de la
 * card de obra en ClienteDetalle, o desde el menú ⋮.
 *
 * Modo `alFinalizar`: se usa como paso 2 del flujo "Finalizar presupuesto"
 * (después de confirmar el resumen). En este modo el modal no se puede
 * cerrar con Escape/click afuera/X — solo con el botón "Volver al
 * cliente", que además navega hacia adelante sin dejar volver atrás al
 * formulario.
 */
import * as React from 'react'
import { toast } from 'sonner'
import { Send, ArrowRight, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAjustes, AJUSTES_DEFAULT, useMarcarPendientePresupuesto } from '@/hooks/queries'
import {
  calcularTotalesObra,
  calcularPrecioFinalConIva,
  construirMensajePresupuesto,
  formatMoney,
  formatWhatsApp,
  normalizarWhatsApp,
} from '@/lib/obra-totales'
import { generarYSubirPdfPresupuesto } from '@/lib/pdf-generate'
import type { Cliente, Obra } from '@/lib/types'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { PresupuestoPdfButton } from '@/components/pdf/PresupuestoPdfButton'
interface Props {
  open: boolean
  onClose: () => void
  obra: Obra
  cliente: Cliente
  /** Paso 2 del flujo "Finalizar presupuesto": oculta cambios de estado,
   * bloquea el cierre y agrega el botón "Volver al cliente". */
  alFinalizar?: boolean
  onVolverCliente?: () => void
}

export function PresupuestoModal({
  open,
  onClose,
  obra,
  cliente,
  alFinalizar = false,
  onVolverCliente,
}: Props) {
  const marcarPendienteMutation = useMarcarPendientePresupuesto()
  const ajustes = useAjustes(null).data ?? AJUSTES_DEFAULT
  const prefijoWhatsApp = ajustes.sistema.prefijoWhatsApp
  const nombreEmpresa = ajustes.empresa.nombre
  const [enviandoWhatsApp, setEnviandoWhatsApp] = React.useState(false)

  const totales = React.useMemo(
    () =>
      calcularTotalesObra(obra, [], {
        ivaBasePct: ajustes.sistema.ivaBasePct,
        ivaPorLinea: ajustes.sistema.ivaPorLinea,
      }),
    [obra, ajustes.sistema.ivaBasePct, ajustes.sistema.ivaPorLinea],
  )

  const mensaje = React.useMemo(
    () =>
      construirMensajePresupuesto({
        nombreCliente: cliente.nombre,
        items: obra.tipologias,
        totalBruto: totales.totalBruto,
        descuentoPct: totales.descuentoPct,
        descuentoMonto: totales.descuentoMonto,
        totalConDescuento: totales.totalConDescuento,
        nombreEmpresa,
        incluyeIva: totales.incluyeIva,
        ivaPct: totales.ivaPct,
        ivaMonto: totales.ivaMonto,
        totalConIva: totales.totalConIva,
        nota: obra.notaCliente,
        mostrarPrecioConIva: obra.mostrarPrecioConIva,
        ivaBasePctSistema: ajustes.sistema.ivaBasePct,
      }),
    [cliente.nombre, obra.tipologias, totales, nombreEmpresa, obra.notaCliente, obra.mostrarPrecioConIva, ajustes.sistema.ivaBasePct],
  )

  async function handleEnviarWhatsApp() {
    const tel = normalizarWhatsApp(cliente.telefonoWhatsApp)
    if (!tel) {
      toast.error('El cliente no tiene WhatsApp cargado.')
      return
    }
    if (
      !obra.tipologias.length ||
      obra.tipologias.some((t) => !t.descripcion.trim() || t.cantidad <= 0)
    ) {
      toast.error(
        'Completá la descripción y cantidad de todas las aberturas antes de enviar.',
      )
      return
    }

    setEnviandoWhatsApp(true)
    try {
      // Genera el PDF del presupuesto y lo sube al bucket "comprobantes"
      // para conseguir un link (signed URL, 30 días) que va dentro del
      // mensaje de WhatsApp.
      const linkPdf = await generarYSubirPdfPresupuesto({
        cliente,
        obra,
        totales,
        empresa: ajustes.empresa,
        ivaBasePct: ajustes.sistema.ivaBasePct,
      })

      // Si estaba en borrador o rechazado, marcar como pendiente
      if (
        obra.estadoPresupuesto === 'borrador' ||
        obra.estadoPresupuesto === 'rechazado'
      ) {
        try {
          await marcarPendienteMutation.mutateAsync(obra)
          toast.success('Presupuesto marcado como pendiente.')
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Error al actualizar el presupuesto.')
        }
      }

      const mensajeConLink = `${mensaje}\n\n📄 Ver PDF: ${linkPdf}`
      const numeroCompleto = prefijoWhatsApp + tel
      const url = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensajeConLink)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('Error al generar/subir el PDF del presupuesto:', e)
      toast.error(
        e instanceof Error
          ? e.message
          : 'No se pudo generar el link del PDF. Intentá de nuevo.',
      )
    } finally {
      setEnviandoWhatsApp(false)
    }
  }

  const estado = obra.estadoPresupuesto

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (alFinalizar) return // no se puede cerrar: solo "Volver al cliente"
        if (!v) onClose()
      }}
    >
      <SheetContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => alFinalizar && e.preventDefault()}
        onPointerDownOutside={(e) => alFinalizar && e.preventDefault()}
        showCloseButton={!alFinalizar}
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            Presupuesto
            <EstadoPresupuestoBadge estado={estado} size="sm" />
          </SheetTitle>
          <SheetDescription>
            {alFinalizar
              ? '¡Presupuesto guardado como pendiente! Imprimilo o envialo por WhatsApp.'
              : <>
                  Imprimí el presupuesto en PDF o envialo por WhatsApp a{' '}
                  <span className="money">{formatWhatsApp(cliente.telefonoWhatsApp, prefijoWhatsApp)}</span>.
                </>}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {/* Detalle de ítems: ver qué aberturas tiene esta obra, sin
              entrar al formulario de edición. */}
          <div className="rounded-xl border border-border/60 divide-y divide-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
            {obra.tipologias.map((t) => {
              const desglose = totales.desgloseItems.find((d) => d.tipologiaId === t.id)
              const precioUnitarioAMostrar =
                totales.incluyeIva && desglose && t.cantidad > 0
                  ? desglose.totalAjustado / t.cantidad
                  : t.precioUnitario
              const subtotal = (t.cantidad || 0) * (precioUnitarioAMostrar || 0)
              return (
                <div key={t.id} className="px-3 py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {t.descripcion || 'Sin descripción'}
                    </span>
                    <span className="money text-sm font-semibold shrink-0">
                      ${formatMoney(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {t.cantidad} × ${formatMoney(precioUnitarioAMostrar)} · {t.linea} · {t.color}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumen del presupuesto */}
          <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ítems</span>
              <span className="font-medium">{obra.tipologias.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total bruto</span>
              <span className="money">
                ${formatMoney(totales.incluyeIva ? totales.totalAjustadoIva : totales.totalBruto)}
              </span>
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
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Precio base (neto)</span>
                  <span className="money">${formatMoney(totales.totalBaseConDescuento)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    IVA ({Math.round(totales.ivaPct * 1000) / 10}%)
                  </span>
                  <span className="money text-success">
                    +${formatMoney(totales.ivaMonto)}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-base font-semibold">
              <span>Total</span>
              <span className="money font-display">${formatMoney(totales.totalConIva)}</span>
            </div>
            {!totales.incluyeIva && obra.mostrarPrecioConIva && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Precio con IVA</span>
                <span className="money">
                  ${formatMoney(calcularPrecioFinalConIva(totales.totalConIva, ajustes.sistema.ivaBasePct))}
                </span>
              </div>
            )}
          </div>

          {obra.notaCliente && (
            <div className="rounded-xl border border-dashed border-border/60 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Nota para el cliente
              </p>
              <p className="whitespace-pre-wrap">{obra.notaCliente}</p>
            </div>
          )}

          {/* Acciones principales */}
          <div className="grid gap-2">
            <PresupuestoPdfButton
              cliente={cliente}
              obra={obra}
              totales={totales}
              label="Imprimir PDF"
              variant="default"
              size="lg"
              className="w-full"
            />
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleEnviarWhatsApp}
              disabled={enviandoWhatsApp}
              aria-busy={enviandoWhatsApp}
            >
              {enviandoWhatsApp ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generando y enviando…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Enviar por WhatsApp
                </>
              )}
            </Button>
          </div>

          {/* Modo finalizar: única salida posible, navega hacia adelante */}
          {alFinalizar ? (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onVolverCliente}
            >
              Volver al cliente
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={onClose}
            >
              Cerrar
            </Button>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
