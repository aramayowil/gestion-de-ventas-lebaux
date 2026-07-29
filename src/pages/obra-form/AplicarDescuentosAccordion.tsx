/**
 * pages/obra-form/AplicarDescuentosAccordion.tsx
 *
 * Acordeón (móvil) / Card (desktop) ÚNICO que agrupa TODA la configuración
 * de la obra que no son aberturas:
 *   · Forma de pago (default 'A convenir').
 *   · Switch + input de "Aplicar descuento (%)".
 *   · Switch + input de "Incluir IVA (%)".
 *   · Checkbox + monto + forma de pago de "Pago inicial" (solo si la obra
 *     permite pago inicial: ventas y presupuestos aceptados).
 *   · Resumen de totales (bruto, descuento, IVA, total).
 *
 * Al editar una venta que ya tiene pagos, el checkbox se carga tildado
 * con el monto del PRIMER pago registrado (editable).
 */
import * as React from 'react'
import { Percent, Receipt, Wallet } from 'lucide-react'
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
  const ivaPctSistema = useAjustes(null).data?.sistema.ivaPct ?? AJUSTES_DEFAULT.sistema.ivaPct
  const totales = React.useMemo(() => calcularTotalesObra(obra, []), [obra])

  const tieneDescuento = obra.descuentoPct > 0
  const tieneIva = !!obra.incluyeIva

  function toggleDescuento(activar: boolean) {
    setObra((o) => ({ ...o, descuentoPct: activar ? 0.1 : 0 }))
  }
  function cambiarDescuentoPct(pct: number) {
    setObra((o) => ({ ...o, descuentoPct: Math.max(0, Math.min(100, pct)) / 100 }))
  }
  function toggleIva(activar: boolean) {
    setObra((o) => ({
      ...o,
      incluyeIva: activar,
      ivaPct: activar ? (o.ivaPct && o.ivaPct > 0 ? o.ivaPct : ivaPctSistema) : o.ivaPct,
    }))
  }
  function cambiarIvaPct(pct: number) {
    setObra((o) => ({
      ...o,
      incluyeIva: true,
      ivaPct: Math.max(0, Math.min(100, pct)) / 100,
    }))
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
          <div className="grid gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
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
        )}
      </div>

      {/* ── IVA ── */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="switch-iva" className="text-sm font-medium flex items-center gap-2">
            <Receipt className="size-3.5 text-primary" />
            Incluir IVA
          </Label>
          <Switch
            id="switch-iva"
            checked={tieneIva}
            onCheckedChange={toggleIva}
            aria-label="Incluir IVA"
          />
        </div>
        {tieneIva && (
          <div className="grid gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label htmlFor="iva-pct" className="text-xs text-muted-foreground">
              Alícuota de IVA (%)
            </Label>
            <NumericInput
              id="iva-pct"
              allowDecimals
              min={0}
              max={100}
              className="h-11"
              value={Math.round((obra.ivaPct ?? ivaPctSistema) * 1000) / 10}
              onChange={cambiarIvaPct}
              placeholder="10.5"
            />
            <p className="text-[11px] text-muted-foreground">
              Default desde Ajustes: {Math.round(ivaPctSistema * 1000) / 10}%
            </p>
          </div>
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
        <FilaResumen label="Total bruto" value={totales.totalBruto} />
        {totales.descuentoMonto > 0 && (
          <FilaResumen
            label={`Descuento (${Math.round(totales.descuentoPct * 100)}%)`}
            value={-totales.descuentoMonto}
            tone="danger"
          />
        )}
        {totales.incluyeIva && (
          <FilaResumen
            label={`IVA (${Math.round(totales.ivaPct * 1000) / 10}%)`}
            value={totales.ivaMonto}
            tone="success"
          />
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
          ? `${tieneDescuento ? `−${Math.round(obra.descuentoPct * 100)}%` : ''}${tieneDescuento && tieneIva ? ' · ' : ''}${tieneIva ? `IVA ${Math.round((obra.ivaPct ?? ivaPctSistema) * 1000) / 10}%` : ''}${(tieneDescuento || tieneIva) && pagoInicialActivo ? ' · ' : ''}${pagoInicialActivo && permitePagoInicial ? 'Con pago inicial' : ''}`
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
