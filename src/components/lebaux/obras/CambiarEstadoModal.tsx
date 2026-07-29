/**
 * components/lebaux/obras/CambiarEstadoModal.tsx
 *
 * Modal de 2 pasos para cambiar el estado de un presupuesto:
 *
 *   Paso 1 (selección): muestra 2 botones grandes para elegir el nuevo
 *   estado (Aceptar / Rechazar). El botón del estado actual queda
 *   deshabilitado.
 *
 *   Paso 2 (confirmación): muestra un mensaje de confirmación específico
 *   para el estado elegido, con botones [Confirmar] / [Cancelar].
 *
 * Pensado para usarse desde:
 *   · El botón "Cambiar estado" de la card de obra en ClienteDetalle.
 *   · El menú ⋮ de la card (acción "Cambiar estado").
 */
import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { EstadoPresupuesto, Obra } from '@/lib/types'

type Accion = 'aceptar' | 'rechazar' | null

interface Props {
  open: boolean
  obra: Obra | null
  onClose: () => void
  onAceptar: () => void
  onRechazar: () => void
}

export function CambiarEstadoModal({ open, obra, onClose, onAceptar, onRechazar }: Props) {
  const [accion, setAccion] = React.useState<Accion>(null)

  // Reset al abrir/cerrar
  React.useEffect(() => {
    if (open) setAccion(null)
  }, [open])

  const estadoActual: EstadoPresupuesto | undefined = obra?.estadoPresupuesto

  function handleConfirmar() {
    if (accion === 'aceptar') onAceptar()
    else if (accion === 'rechazar') onRechazar()
    setAccion(null)
  }

  function handleCancelarPaso2() {
    setAccion(null)
  }

  /* ──────────── Paso 2: confirmación ──────────── */
  if (accion !== null) {
    const esAceptar = accion === 'aceptar'
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <AlertTriangle
                className={esAceptar ? 'size-5 text-success' : 'size-5 text-destructive'}
                aria-hidden="true"
              />
              {esAceptar ? '¿Aceptar presupuesto?' : '¿Rechazar presupuesto?'}
            </DialogTitle>
            <DialogDescription>
              {esAceptar ? (
                <>
                  Al confirmar, el presupuesto pasará a estado{' '}
                  <strong className="text-foreground">aceptado</strong> y la obra
                  empezará a operar como <strong className="text-foreground">venta</strong>.
                  Se habilitará la opción de registrar pagos.
                </>
              ) : (
                <>
                  Al confirmar, el presupuesto pasará a estado{' '}
                  <strong className="text-foreground">rechazado</strong>. La obra
                  no se elimina, pero no se podrán registrar pagos hasta que se
                  reabra.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={handleCancelarPaso2}
              className="sm:flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="lg"
              onClick={handleConfirmar}
              className={
                esAceptar
                  ? 'sm:flex-1 bg-success text-white hover:bg-success/90'
                  : 'sm:flex-1 bg-destructive text-white hover:bg-destructive/90'
              }
            >
              {esAceptar ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Sí, aceptar
                </>
              ) : (
                <>
                  <XCircle className="size-4" />
                  Sí, rechazar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  /* ──────────── Paso 1: selección ──────────── */
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Cambiar estado del presupuesto
          </DialogTitle>
          <DialogDescription>
            {estadoActual === 'pendiente'
              ? 'El presupuesto está pendiente. Elegí el nuevo estado:'
              : estadoActual === 'rechazado'
                ? 'El presupuesto está rechazado. Elegí el nuevo estado:'
                : estadoActual === 'aceptado'
                  ? 'El presupuesto está aceptado. Elegí el nuevo estado:'
                  : 'Elegí el nuevo estado del presupuesto:'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Button
            variant="outline"
            size="lg"
            className="h-14 justify-start border-success/40 text-success hover:bg-success/10 hover:text-success"
            onClick={() => setAccion('aceptar')}
            disabled={estadoActual === 'aceptado'}
          >
            <CheckCircle2 className="size-5" />
            <span className="flex-1 text-left">
              <span className="block font-semibold">Aceptar presupuesto</span>
              <span className="block text-xs font-normal text-muted-foreground">
                La obra pasa a operar como venta
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setAccion('rechazar')}
            disabled={estadoActual === 'rechazado'}
          >
            <XCircle className="size-5" />
            <span className="flex-1 text-left">
              <span className="block font-semibold">Rechazar presupuesto</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Se marca como rechazado (no se elimina)
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CambiarEstadoModal
