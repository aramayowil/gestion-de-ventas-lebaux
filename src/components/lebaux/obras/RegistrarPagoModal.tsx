/**
 * components/lebaux/obras/RegistrarPagoModal.tsx — Modal para registrar un pago
 * adicional sobre una obra existente.
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
import { useCreatePago, useSiguienteNumeroRecibo, useClientes } from '@/hooks/queries'
import {
  calcularTotalesObra,
  formatMoney,
  redondearMoneda,
} from '@/lib/obra-totales'
import { nuevoPago, type Obra, type Pago, type FormaPago } from '@/lib/types'
import { FORMAS_PAGO } from '@/lib/constants'
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

  const totalesActuales = React.useMemo(
    () => calcularTotalesObra(obra, pagos),
    [obra, pagos],
  )
  const saldo = totalesActuales.saldoPendiente

  const [monto, setMonto] = React.useState(0)
  const [fecha, setFecha] = React.useState(
    new Date().toISOString().slice(0, 10),
  )
  const [formaPago, setFormaPago] = React.useState<FormaPago | ''>('')
  const [nota, setNota] = React.useState('')
  const [pagoConfirmado, setPagoConfirmado] = React.useState<Pago | null>(null)

  React.useEffect(() => {
    if (open) {
      setMonto(0)
      setFecha(new Date().toISOString().slice(0, 10))
      setFormaPago(obra.formaPago ?? '')
      setNota('')
      setPagoConfirmado(null)
    }
  }, [open, obra.formaPago])

  const montoNum = redondearMoneda(monto || 0)
  const montoValido = montoNum > 0 && montoNum <= saldo + 0.01

  async function handleConfirmar() {
    if (!montoValido) {
      toast.error(
        montoNum <= 0
          ? 'Ingresá un monto mayor a cero.'
          : `El monto no puede superar el saldo ($${formatMoney(saldo)}).`,
      )
      return
    }
    const pagoBase = nuevoPago(obra.id, siguienteNumero)
    pagoBase.monto = montoNum
    pagoBase.fecha = new Date(fecha + 'T12:00:00').toISOString()
    pagoBase.formaPago = (formaPago || undefined) as FormaPago | undefined
    pagoBase.nota = nota.trim() || undefined
    try {
      const pagoCreado = await crearPagoMutation.mutateAsync(pagoBase)
      setPagoConfirmado(pagoCreado ?? pagoBase)
      toast.success(`Pago de $${formatMoney(montoNum)} registrado.`)
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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
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
                <Label htmlFor="pago-monto">Monto</Label>
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
                {montoNum > saldo && (
                  <p className="text-xs text-destructive">
                    Supera el saldo pendiente.
                  </p>
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
                      {FORMAS_PAGO.map((f) => (
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
