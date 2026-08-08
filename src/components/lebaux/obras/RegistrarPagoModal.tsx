/**
 * components/lebaux/obras/RegistrarPagoModal.tsx — Modal para registrar un pago
 * adicional sobre una obra existente.
 *
 * OJO — BUG "2 MODALES" AL IMPRIMIR (ya resuelto):
 *   Una vez confirmado el pago, se muestra ReciboPagoPdfButton, que abre
 *   su propio ImprimirDialog (Dialog centrado) para elegir el tipo de
 *   comprobante. Como este Sheet se queda abierto detrás, sin apagarlo
 *   se veían las 2 cajas a la vez (el Sheet anclado abajo en mobile +
 *   el Dialog centrado del ImprimirDialog). `imprimirAbierto` apaga el
 *   `open` de este Sheet mientras el ImprimirDialog está abierto.
 */

import * as React from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCreatePago,
  useSiguienteNumeroRecibo,
  useClientes,
  useAjustes,
  AJUSTES_DEFAULT,
} from '@/hooks/queries'
import {
  calcularTotalesObra,
  calcularMontoConRecargoTarjeta,
  calcularMontoConRecargoCheque,
  formatMoney,
  redondearMoneda,
} from '@/lib/obra-totales'
import { nuevoPago, type Obra, type Pago, type FormaPago } from '@/lib/types'
import { FORMAS_PAGO_VENTA } from '@/lib/constants'
import { ReciboPagoPdfButton } from '@/components/pdf/ReciboPagoPdfButton'

interface Props {
  open: boolean
  onClose: () => void
  obra: Obra
  pagos: Pago[]
}

export function RegistrarPagoModal({ open, onClose, obra, pagos }: Props) {
  const { data: siguienteNumero = 1 } = useSiguienteNumeroRecibo()
  const crearPagoMutation = useCreatePago()
  const { data: clientes = [] } = useClientes()
  const cliente = clientes.find((c) => c.id === obra.clienteId)
  const { data: ajustes } = useAjustes(null)
  const recargoTarjetaPct = ajustes?.sistema.recargoTarjetaPct ?? AJUSTES_DEFAULT.sistema.recargoTarjetaPct
  const recargoChequePct = ajustes?.sistema.recargoChequePct ?? AJUSTES_DEFAULT.sistema.recargoChequePct

  const totalesActuales = React.useMemo(
    () => calcularTotalesObra(obra, pagos),
    [obra, pagos],
  )
  const saldo = totalesActuales.saldoPendiente

  // `monto` es el monto BASE que el vendedor quiere cubrir del saldo
  // (equivalente efectivo/transferencia). Si la forma de pago es
  // Tarjeta o Cheque, el monto REAL a cobrarle al cliente se calcula
  // aparte (ver `montoConRecargo` más abajo) y es ESE el que se registra.
  const [monto, setMonto] = React.useState(0)
  const [fecha, setFecha] = React.useState(
    new Date().toISOString().slice(0, 10),
  )
  const [formaPago, setFormaPago] = React.useState<FormaPago>('Efectivo')
  const [nota, setNota] = React.useState('')
  const [pagoConfirmado, setPagoConfirmado] = React.useState<Pago | null>(null)
  // Ver comentario de archivo: apaga este Sheet mientras el
  // ImprimirDialog (hijo, abierto por ReciboPagoPdfButton) esté abierto,
  // para no mostrar 2 modales superpuestos.
  const [imprimirAbierto, setImprimirAbierto] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setMonto(0)
      setFecha(new Date().toISOString().slice(0, 10))
      setFormaPago('Efectivo')
      setNota('')
      setPagoConfirmado(null)
      setImprimirAbierto(false)
    }
  }, [open])

  const montoBaseNum = redondearMoneda(monto || 0)
  const esTarjeta = formaPago === 'Tarjeta'
  const esCheque = formaPago === 'Cheque'
  // Monto REAL a cobrarle al cliente si paga con tarjeta (con recargo) o
  // con cheque (con el IVA sumado).
  const montoConRecargo = esCheque
    ? calcularMontoConRecargoCheque(montoBaseNum, recargoChequePct)
    : calcularMontoConRecargoTarjeta(montoBaseNum, recargoTarjetaPct)
  // El monto que se registra como pago real: con recargo si es tarjeta o
  // cheque, igual al base para cualquier otra forma de pago.
  const montoARegistrar = esTarjeta || esCheque ? montoConRecargo : montoBaseNum
  // La validación es siempre contra el monto BASE (lo que cancela saldo),
  // nunca contra el monto con recargo.
  const montoValido = montoBaseNum > 0 && montoBaseNum <= saldo + 0.01

  async function handleConfirmar() {
    if (!montoValido) {
      toast.error(
        montoBaseNum <= 0
          ? 'Ingresá un monto mayor a cero.'
          : `El monto no puede superar el saldo ($${formatMoney(saldo)}).`,
      )
      return
    }
    const pagoBase = nuevoPago(obra.id, siguienteNumero)
    pagoBase.monto = montoARegistrar
    pagoBase.montoBase = montoBaseNum
    pagoBase.fecha = new Date(fecha + 'T12:00:00').toISOString()
    pagoBase.formaPago = formaPago
    pagoBase.nota = nota.trim() || undefined
    try {
      const pagoCreado = await crearPagoMutation.mutateAsync(pagoBase)
      setPagoConfirmado(pagoCreado ?? pagoBase)
      toast.success(`Pago de $${formatMoney(montoARegistrar)} registrado.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar el pago.')
    }
  }

  // OJO: `pagos` (la lista del padre) puede actualizarse sola mientras el
  // modal sigue abierto, porque crear el pago invalida la cache de
  // TanStack Query y el padre vuelve a pedir los datos. Si no filtramos
  // acá, en cuanto esa lista se refresque va a incluir el mismo pago que
  // ya tenemos en `pagoConfirmado`, y quedaría contado DOS VECES en el
  // saldo. Por eso sacamos cualquier pago con el mismo id antes de sumarlo.
  const totalesLuegoDePago = pagoConfirmado
    ? calcularTotalesObra(obra, [
        ...pagos.filter((p) => p.id !== pagoConfirmado.id),
        pagoConfirmado,
      ])
    : null

  return (
    <Sheet open={open && !imprimirAbierto} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {pagoConfirmado ? 'Pago registrado' : 'Registrar pago'}
          </SheetTitle>
          <SheetDescription>
            {pagoConfirmado
              ? 'Generá el recibo de este pago.'
              : `Saldo pendiente: $${formatMoney(saldo)}`}
          </SheetDescription>
        </SheetHeader>

        {pagoConfirmado && cliente && totalesLuegoDePago ? (
          <SheetBody>
            <div className="rounded-lg border border-success/40 bg-success/10 p-4 flex items-start gap-3 ring-1 ring-success/20">
              <CheckCircle2
                className="size-5 text-success shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm text-success font-semibold">
                  Pago de ${formatMoney(pagoConfirmado.monto)} registrado
                </p>
                <p className="text-xs text-foreground/70 mt-1">
                  Recibo N°{' '}
                  {String(pagoConfirmado.numeroRecibo).padStart(4, '0')} · Nuevo
                  saldo: ${formatMoney(totalesLuegoDePago.saldoPendiente)}
                </p>
                {(pagoConfirmado.formaPago === 'Tarjeta' ||
                  pagoConfirmado.formaPago === 'Cheque') &&
                  pagoConfirmado.montoBase != null &&
                  pagoConfirmado.montoBase < pagoConfirmado.monto && (
                    <p className="text-xs text-foreground/70 mt-1">
                      Incluye recargo por{' '}
                      {pagoConfirmado.formaPago === 'Tarjeta' ? 'tarjeta' : 'cheque (IVA)'} —
                      del saldo se descuentan ${formatMoney(pagoConfirmado.montoBase)}.
                    </p>
                  )}
              </div>
            </div>
            <ReciboPagoPdfButton
              cliente={cliente}
              obra={obra}
              pago={pagoConfirmado}
              totales={totalesLuegoDePago}
              label="Descargar recibo"
              variant="default"
              size="lg"
              className="w-full"
              onAbrirImprimirChange={setImprimirAbierto}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPagoConfirmado(null)
                onClose()
              }}
            >
              Cerrar
            </Button>
          </SheetBody>
        ) : (
          <>
            <SheetBody>
              <div className="grid gap-2">
                <Label htmlFor="pago-monto">
                  {esTarjeta || esCheque ? 'Monto a cubrir del saldo' : 'Monto'}
                </Label>
                <div className="flex gap-2">
                  <MoneyInput
                    id="pago-monto"
                    allowDecimals
                    value={monto}
                    onChange={setMonto}
                    placeholder="0"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    onClick={() => setMonto(redondearMoneda(saldo))}
                    disabled={saldo <= 0}
                  >
                    Saldo completo
                  </Button>
                </div>
                {montoBaseNum > saldo && (
                  <p className="text-xs text-destructive">
                    Supera el saldo pendiente.
                  </p>
                )}
                {(esTarjeta || esCheque) && montoBaseNum > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {esTarjeta
                        ? `Con tarjeta (recargo del ${Math.round(recargoTarjetaPct * 100)}%), a este cliente hay que cobrarle:`
                        : `Con cheque (IVA del ${Math.round(recargoChequePct * 100)}%), a este cliente hay que cobrarle:`}
                    </p>
                    <p className="text-base font-semibold text-primary">
                      ${formatMoney(montoConRecargo)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="pago-fecha">Fecha</Label>
                  <Input
                    id="pago-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Forma de pago</Label>
                  <Select
                    value={formaPago}
                    onValueChange={(v) => setFormaPago(v as FormaPago)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGO_VENTA.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pago-nota">Nota (opcional)</Label>
                <Textarea
                  id="pago-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej: Señal, segunda cuota, etc."
                  className="min-h-[60px]"
                />
              </div>
            </SheetBody>

            <SheetFooter>
              <Button variant="outline" className="h-11" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="h-11"
                onClick={handleConfirmar}
                disabled={!montoValido || crearPagoMutation.isPending}
              >
                {crearPagoMutation.isPending ? 'Registrando...' : 'Confirmar pago'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
