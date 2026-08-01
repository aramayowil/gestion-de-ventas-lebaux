/**
 * pages/obra-form/AplicarDescuentosAccordion.tsx
 *
 * Acordeón (móvil) / Card (desktop) ÚNICO que agrupa TODA la configuración
 * de la obra que no son aberturas:
 *   · Forma de pago (default 'A convenir').
 *   · Switch + input de "Aplicar descuento (%)" + selector de sobre qué
 *     base aplicarlo (precio final con IVA vs. precio neto — ver
 *     explicación inline, matemáticamente da el mismo total final).
 *   · Switch de "Discriminar IVA": ya no permite tipear una alícuota a
 *     mano — el IVA de cada ítem sale de la línea (Modena/Herrero/A30)
 *     configurada en Ajustes, y el sistema descompone cada ítem a su
 *     precio base (neto) automáticamente. El IVA final que se muestra
 *     es siempre el IVA "base"/tope del sistema (ej. 21%).
 *   · Checkbox + monto + forma de pago de "Pago inicial" (solo si la obra
 *     permite pago inicial: ventas y presupuestos aceptados).
 *   · Resumen de totales: si se discrimina IVA, se listan los precios
 *     base por ítem antes del total (bruto, descuento, IVA, total).
 *
 * Al editar una venta que ya tiene pagos, el checkbox se carga tildado
 * con el monto del PRIMER pago registrado (editable).
 */
import * as React from 'react'
import { Percent, Receipt, Wallet, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { MoneyInput } from '@/components/ui/money-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { AccordionSection } from '@/components/ui/accordion-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { calcularTotalesObra, formatMoney } from '@/lib/obra-totales'
import type { FormaPago, Obra } from '@/lib/types'
import { FORMAS_PAGO } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  obra: Obra
  setObra: React.Dispatch<React.SetStateAction<Obra>>
  /** 'mobile' usa AccordionSection colapsable; 'desktop' usa Card siempre abierta. */
  variant: 'mobile' | 'desktop'
  /** Para móvil: estado abierto/controlado. */
  open?: boolean
  onToggle?: () => void
  /** Step number para mobile. */
  step?: number
  /** Si la obra permite pago inicial (ventas y presupuestos aceptados). */
  permitePagoInicial: boolean
  /** Monto del pago inicial cargado en el form. */
  pagoInicialMonto: number
  setPagoInicialMonto: (v: number) => void
  /** Forma de pago del pago inicial. */
  pagoInicialForma: FormaPago | ''
  setPagoInicialForma: (v: FormaPago) => void
  /** True si el checkbox de pago inicial está tildado (ya sea por carga
   * existente o por el usuario activándolo). */
  pagoInicialActivo: boolean
  setPagoInicialActivo: (v: boolean) => void
}

export function AplicarDescuentosAccordion({
  obra,
  setObra,
  variant,
  open,
  onToggle,
  step,
  permitePagoInicial,
  pagoInicialMonto,
  setPagoInicialMonto,
  pagoInicialForma,
  setPagoInicialForma,
  pagoInicialActivo,
  setPagoInicialActivo,
}: Props) {
  const sistema = useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const ivaConfig = React.useMemo(
    () => ({ ivaBasePct: sistema.ivaBasePct, ivaPorLinea: sistema.ivaPorLinea }),
    [sistema],
  )
  const totales = React.useMemo(
    () => calcularTotalesObra(obra, [], ivaConfig),
    [obra, ivaConfig],
  )

  const tieneDescuento = obra.descuentoPct > 0
  const tieneIva = !!obra.incluyeIva
  const descuentoBase = obra.descuentoBase ?? 'final'

  function toggleDescuento(activar: boolean) {
    setObra((o) => ({
      ...o,
      descuentoPct: activar ? 0.1 : 0,
      descuentoBase: o.descuentoBase ?? 'final',
    }))
  }
  function cambiarDescuentoPct(pct: number) {
    setObra((o) => ({ ...o, descuentoPct: Math.max(0, Math.min(100, pct)) / 100 }))
  }
  function cambiarDescuentoBase(base: 'final' | 'neto') {
    setObra((o) => ({ ...o, descuentoBase: base }))
  }
  function toggleIva(activar: boolean) {
    setObra((o) => ({ ...o, incluyeIva: activar }))
  }

  const inner = (
    <div className="space-y-4">
      {/* ── Forma de pago ── */}
      <div className="grid gap-2">
        <Label>Forma de pago</Label>
        <Select
          value={obra.formaPago ?? ''}
          onValueChange={(v) =>
            setObra((o) => ({
              ...o,
              formaPago: (v || undefined) as FormaPago | undefined,
            }))
          }
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="A convenir" />
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

      {/* ── Descuento ── */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="switch-descuento" className="text-sm font-medium flex items-center gap-2">
            <Percent className="size-3.5 text-primary" />
            Aplicar descuento
          </Label>
          <Switch
            id="switch-descuento"
            checked={tieneDescuento}
            onCheckedChange={toggleDescuento}
            aria-label="Aplicar descuento"
          />
        </div>
        {tieneDescuento && (
          <div className="grid gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid gap-1.5">
              <Label htmlFor="descuento-pct" className="text-xs text-muted-foreground">
                Porcentaje de descuento (%)
              </Label>
              <NumericInput
                id="descuento-pct"
                allowDecimals
                min={0}
                max={100}
                className="h-11"
                value={Math.round(obra.descuentoPct * 1000) / 10}
                onChange={cambiarDescuentoPct}
                placeholder="10"
              />
            </div>

            {/* Sobre qué base se aplica: solo importa el número mostrado
                en el desglose si además se discrimina IVA — el total
                final da igual en ambos casos. */}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                ¿Sobre qué aplicar el descuento?
              </Label>
              <Select value={descuentoBase} onValueChange={(v) => cambiarDescuentoBase(v as 'final' | 'neto')}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="final">Precio final (con IVA incluido)</SelectItem>
                  <SelectItem value="neto">Precio neto (sin IVA)</SelectItem>
                </SelectContent>
              </Select>
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Info className="size-3.5 shrink-0 mt-px" aria-hidden="true" />
                {descuentoBase === 'final'
                  ? 'Estándar en venta al público: el descuento se calcula sobre el precio final que ve el cliente (el IVA se reduce proporcionalmente). El total a cobrar es el mismo que descontando sobre el neto.'
                  : 'Estándar B2B/mayorista: el descuento se calcula sobre el precio neto (sin IVA) y luego se suma el IVA sobre ese valor ya descontado. El total a cobrar es el mismo que descontando sobre el final.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── IVA ── */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="switch-iva" className="text-sm font-medium flex items-center gap-2">
            <Receipt className="size-3.5 text-primary" />
            Discriminar IVA
          </Label>
          <Switch
            id="switch-iva"
            checked={tieneIva}
            onCheckedChange={toggleIva}
            aria-label="Discriminar IVA"
          />
        </div>
        {tieneIva && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
            <Info className="size-3.5 shrink-0 mt-px" aria-hidden="true" />
            Cada ítem se descompone a su precio base según el IVA que ya
            trae su línea (configurado en Ajustes) y el total se
            expresa al {Math.round(ivaConfig.ivaBasePct * 1000) / 10}% de IVA.
          </p>
        )}
      </div>

      {/* ── Pago inicial (solo si la obra lo permite) ── */}
      {permitePagoInicial && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.06] dark:bg-primary/[0.1] ring-1 ring-primary/20 p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="check-pago-inicial"
              checked={pagoInicialActivo}
              onCheckedChange={(v) => setPagoInicialActivo(v === true)}
            />
            <Label htmlFor="check-pago-inicial" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <Wallet className="size-3.5 text-primary" />
              {pagoInicialMonto > 0 && pagoInicialActivo ? 'Pago inicial registrado' : 'Agregar pago inicial'}
            </Label>
          </div>
          {pagoInicialActivo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid gap-2">
                <Label htmlFor="pago-ini-monto" className="text-xs text-muted-foreground">
                  Monto
                </Label>
                <MoneyInput
                  id="pago-ini-monto"
                  allowDecimals
                  className="h-11"
                  value={pagoInicialMonto}
                  onChange={setPagoInicialMonto}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">Forma de pago</Label>
                <Select
                  value={pagoInicialForma}
                  onValueChange={(v) => setPagoInicialForma(v as FormaPago)}
                >
                  <SelectTrigger className="h-11">
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
          )}
          {pagoInicialActivo && pagoInicialMonto > totales.totalConIva && (
            <p className="text-xs text-destructive">
              El pago inicial supera el total de la obra.
            </p>
          )}
        </div>
      )}

      {/* ── Resumen ── */}
      <div className="rounded-xl border border-border/60 divide-y divide-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
        <FilaResumen
          label="Total bruto"
          value={totales.incluyeIva ? totales.totalAjustadoIva : totales.totalBruto}
        />
        {totales.descuentoMonto > 0 && (
          <FilaResumen
            label={`Descuento (${Math.round(totales.descuentoPct * 100)}%)`}
            value={-totales.descuentoMonto}
            tone="danger"
          />
        )}
        {totales.incluyeIva && (
          <>
            <FilaResumen label="Precio base (neto)" value={totales.totalBaseConDescuento} />
            <FilaResumen
              label={`IVA (${Math.round(totales.ivaPct * 1000) / 10}%)`}
              value={totales.ivaMonto}
              tone="success"
            />
          </>
        )}
        <FilaResumen
          label="Total"
          value={totales.totalConIva}
          strong
        />
      </div>
    </div>
  )

  const complete = tieneDescuento || tieneIva || (permitePagoInicial && pagoInicialActivo)

  if (variant === 'desktop') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            Forma de pago, descuentos, IVA y pago inicial
          </CardTitle>
        </CardHeader>
        <CardContent>{inner}</CardContent>
      </Card>
    )
  }

  return (
    <AccordionSection
      title="Forma de pago, descuentos, IVA y pago inicial"
      subtitle={
        complete
          ? `${tieneDescuento ? `−${Math.round(obra.descuentoPct * 100)}%` : ''}${tieneDescuento && tieneIva ? ' · ' : ''}${tieneIva ? `IVA ${Math.round(ivaConfig.ivaBasePct * 1000) / 10}%` : ''}${(tieneDescuento || tieneIva) && pagoInicialActivo ? ' · ' : ''}${pagoInicialActivo && permitePagoInicial ? 'Con pago inicial' : ''}`
          : 'Sin descuento ni IVA'
      }
      icon={<Wallet className="size-4" />}
      step={step}
      open={open}
      onToggle={onToggle}
      complete={complete}
    >
      {inner}
    </AccordionSection>
  )
}

function FilaResumen({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: number
  tone?: 'danger' | 'success'
  strong?: boolean
}) {
  const colorClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'success'
        ? 'text-success'
        : ''
  const sign = value > 0 && tone ? '+' : ''
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span
        className={cn(
          'text-sm',
          strong ? 'font-semibold font-display' : 'font-medium',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-sm tabular-nums money',
          strong ? 'font-bold font-display text-base' : 'font-medium',
          colorClass,
        )}
      >
        {sign}${formatMoney(value)}
      </span>
    </div>
  )
}

export default AplicarDescuentosAccordion
