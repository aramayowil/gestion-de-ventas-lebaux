/**
 * pages/obra-form/ObraForm.tsx
 *
 * Pantalla de creación/edición de obra (presupuesto o venta).
 *
 * Estructura simplificada (2 secciones):
 *   Paso 1 · "Aberturas a cotizar" — cargar cada abertura.
 *   Paso 2 · "Forma de pago, descuentos, IVA y pago inicial" — todo en un
 *            solo acordeón: forma de pago (default 'A convenir'), switches
 *            de descuento e IVA, checkbox de pago inicial (monto + forma),
 *            y resumen de totales.
 *
 * Barra inferior fija con UN botón cuya acción depende del estado:
 *   · borrador + presupuesto → "Finalizar Presupuesto"
 *   · borrador + venta       → "Finalizar Venta"
 *   · pendiente/rechazado    → "Actualizar Presupuesto"
 *   · aceptado (= venta)     → "Actualizar Venta"
 *
 * RESPONSIVE: acordeón 2-pasos en móvil, cards en desktop.
 */
import {
  Plus,
  Trash2,
  FileText,
  PackageOpen,
  ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AccordionSection } from '@/components/ui/accordion-section'
import { useIsDesktop } from '@/hooks/use-is-desktop'
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
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { AppLayout } from '@/components/layout/AppLayout'
import { PresupuestoModal } from '@/components/lebaux/clientes/PresupuestoModal'
import { Skeleton } from '@/components/ui/skeleton'
import { useObraForm } from './useObraForm'
import { TipologiasContent } from './TipologiasSection'
import { AplicarDescuentosAccordion } from './AplicarDescuentosAccordion'
import { ConfirmarPresupuestoModal } from './ConfirmarPresupuestoModal'
import { FinalizarVentaModal } from './FinalizarVentaModal'
import type { TipoObra } from '@/lib/types'

interface Props {
  clienteId: string
  obraId?: string
  onVolver: () => void
  onIrAInicio?: () => void
  /** Navegación "punto sin retorno" al terminar un presupuesto/venta. */
  onFinalizado: () => void
  /** Tipo elegido en TipoObraModal (solo aplica a obras nuevas). */
  tipoInicial?: TipoObra
}

export function ObraForm({ clienteId, obraId, onVolver, onIrAInicio, onFinalizado, tipoInicial }: Props) {
  const isDesktop = useIsDesktop()
  const {
    cargando,
    cliente,
    existente,
    obra,
    setObra,
    pagoInicialMonto,
    setPagoInicialMonto,
    pagoInicialForma,
    setPagoInicialForma,
    pagoInicialActivo,
    setPagoInicialActivo,
    permitePagoInicial,
    pagoRecienCreado,
    seccionAbierta,
    setSeccionAbierta,
    esBorrador,
    esPresupuesto,
    totales,
    tipologiasValidas,
    pagoInicialNum,
    puedeFinalizar,
    aberturasSubtitle,
    actualizarTipologia,
    agregarTipologia,
    eliminarTipologia,
    handleEliminar,
    eliminandoObra,
    guardando,
    accionBoton,

    modalConfirmarPresupuesto,
    handleConfirmarPresupuesto,
    handleCancelarConfirmarPresupuesto,
    modalPresupuesto,
    handleCerrarModalPresupuesto,
    modoFinalizarPresupuesto,
    handleVolverClienteDesdeModal,

    modalFinalizarVenta,
    handleCerrarFinalizarVenta,
  } = useObraForm({ clienteId, obraId, isDesktop, onVolver, onFinalizado, tipoInicial })

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="max-w-4xl w-full mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Cliente no encontrado.</p>
        <Button onClick={onVolver} variant="outline">
          Volver
        </Button>
      </div>
    )
  }

  const cantAberturas = obra.tipologias.reduce((acc, t) => acc + (t.cantidad || 0), 0)

  // Título dinámico:
  //   · Presupuesto borrador/pendiente/rechazado → "Nuevo/Editar presupuesto"
  //   · Presupuesto aceptado → "Actualizar venta" (ya opera como venta)
  //   · Venta nueva → "Nueva venta"
  //   · Venta existente → "Actualizar venta" o "Venta"
  const esVentaOperativa = permitePagoInicial && existente
  const headerTitle = esVentaOperativa
    ? `Actualizar venta · ${cliente.nombre}`
    : esPresupuesto
      ? `${existente ? 'Presupuesto' : 'Nuevo presupuesto'} · ${cliente.nombre}`
      : `${existente ? 'Venta' : 'Nueva venta'} · ${cliente.nombre}`

  const headerSubtitle = esBorrador
    ? 'Borrador autoguardado — cargá las aberturas cuando quieras'
    : 'Modificá los ítems y actualizá'

  return (
    <AppLayout
      title={headerTitle}
      subtitle={headerSubtitle}
      onBack={onVolver}
      onIrAInicio={onIrAInicio}
      maxWidth="max-w-4xl"
      headerActions={<EstadoPresupuestoBadge estado={obra.estadoPresupuesto} size="sm" />}
      mainClassName="flex-1 min-h-0 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 space-y-5 pb-28"
    >
        {/* ── Contenido principal ── */}
        {isDesktop ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between font-display">
                  <span>Aberturas a cotizar</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={agregarTipologia}
                    type="button"
                  >
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Agregar abertura</span>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TipologiasContent
                  tipologias={obra.tipologias}
                  actualizarTipologia={actualizarTipologia}
                  eliminarTipologia={eliminarTipologia}
                />
              </CardContent>
            </Card>

            <AplicarDescuentosAccordion
              obra={obra}
              setObra={setObra}
              variant="desktop"
              permitePagoInicial={permitePagoInicial}
              pagoInicialMonto={pagoInicialMonto}
              setPagoInicialMonto={setPagoInicialMonto}
              pagoInicialForma={pagoInicialForma}
              setPagoInicialForma={setPagoInicialForma}
              pagoInicialActivo={pagoInicialActivo}
              setPagoInicialActivo={setPagoInicialActivo}
            />
          </>
        ) : (
          <div className="space-y-3">
            <AccordionSection
              title="Aberturas a cotizar"
              subtitle={aberturasSubtitle}
              icon={<PackageOpen className="size-4" />}
              step={1}
              open={seccionAbierta === 'aberturas'}
              onToggle={() =>
                setSeccionAbierta(seccionAbierta === 'aberturas' ? '' : 'aberturas')
              }
              complete={tipologiasValidas}
            >
              <div className="space-y-3">
                <TipologiasContent
                  tipologias={obra.tipologias}
                  actualizarTipologia={actualizarTipologia}
                  eliminarTipologia={eliminarTipologia}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-dashed hover:bg-elevated/60"
                  onClick={agregarTipologia}
                >
                  <Plus className="size-4" />
                  Agregar abertura
                </Button>
              </div>
            </AccordionSection>

            <AplicarDescuentosAccordion
              obra={obra}
              setObra={setObra}
              variant="mobile"
              step={2}
              open={seccionAbierta === 'descuentos'}
              onToggle={() =>
                setSeccionAbierta(seccionAbierta === 'descuentos' ? '' : 'descuentos')
              }
              permitePagoInicial={permitePagoInicial}
              pagoInicialMonto={pagoInicialMonto}
              setPagoInicialMonto={setPagoInicialMonto}
              pagoInicialForma={pagoInicialForma}
              setPagoInicialForma={setPagoInicialForma}
              pagoInicialActivo={pagoInicialActivo}
              setPagoInicialActivo={setPagoInicialActivo}
            />
          </div>
        )}

        {/* ── Eliminar obra (solo existente) ── */}
        {existente && (
          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                  Eliminar obra
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar esta obra?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrarán también todos los pagos registrados. Esta
                    acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEliminar}
                    disabled={eliminandoObra}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {eliminandoObra ? 'Eliminando...' : 'Sí, eliminar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

      {/* ── Barra inferior fija: único botón de acción ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-md px-4 py-3 pb-safe">
        <div className="max-w-4xl mx-auto">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={accionBoton.onClick}
            disabled={!puedeFinalizar || guardando}
          >
            {esPresupuesto ? <FileText className="size-4" /> : <ShoppingCart className="size-4" />}
            {guardando ? 'Guardando...' : accionBoton.label}
          </Button>
        </div>
      </div>

      {/* ── Modales ── */}

      {/* Paso 1 del cierre de presupuesto: resumen + confirmar/cancelar */}
      <ConfirmarPresupuestoModal
        open={modalConfirmarPresupuesto}
        obra={obra}
        totales={totales}
        cantAberturas={cantAberturas}
        pagoInicialNum={pagoInicialNum}
        onConfirmar={handleConfirmarPresupuesto}
        onCancelar={handleCancelarConfirmarPresupuesto}
      />

      {/* Paso 2 del cierre de presupuesto (imprimir/enviar/volver) y,
          fuera del flujo de finalizar, el visor de "ver presupuesto".
          Cuando modoFinalizarPresupuesto es true, el modal bloquea el cierre
          y el botón "Volver al cliente" dispara onFinalizado (replace). */}
      <PresupuestoModal
        open={modalPresupuesto}
        onClose={handleCerrarModalPresupuesto}
        obra={obra}
        cliente={cliente}
        alFinalizar={modoFinalizarPresupuesto}
        onVolverCliente={handleVolverClienteDesdeModal}
      />

      {/* Cierre de venta: guardado automático, imprimir + volver (sin retorno). */}
      <FinalizarVentaModal
        open={modalFinalizarVenta}
        obra={obra}
        cliente={cliente}
        pagoInicial={pagoRecienCreado}
        onVolverCliente={handleCerrarFinalizarVenta}
      />
    </AppLayout>
  )
}
