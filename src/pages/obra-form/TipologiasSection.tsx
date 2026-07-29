/**
 * pages/obra-form/TipologiasSection.tsx
 *
 * Sub-sección "Detalle de aberturas" del form de obra.
 *
 * Rediseño: al cargar una abertura, lo único que importa completar rápido
 * es la descripción, la cantidad y el precio unitario. Línea y color son
 * datos reales pero secundarios en el momento de tipear — antes se
 * mostraban los 4 campos + el subtotal siempre abiertos, lo que hacía que
 * cada ítem ocupara mucho espacio y compitiera por atención. Ahora línea
 * y color quedan colapsados detrás de un disclosure chico (con su valor
 * actual visible como preview), y el subtotal se muestra como un chip
 * discreto en esa misma línea en vez de un renglón propio.
 */
import * as React from 'react'
import { Plus, Minus, Trash2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { formatMoney, totalTipologia } from '@/lib/obra-totales'
import type { Obra } from '@/lib/types'
import { COLORES, LINEAS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function TipologiasContent({
  tipologias,
  actualizarTipologia,
  eliminarTipologia,
}: {
  tipologias: Obra['tipologias']
  actualizarTipologia: (id: string, patch: Partial<Obra['tipologias'][0]>) => void
  eliminarTipologia: (id: string) => void
}) {
  return (
    <>
      {tipologias.map((t, idx) => (
        <TipologiaRow
          key={t.id}
          index={idx}
          tipologia={t}
          onChange={(patch) => actualizarTipologia(t.id, patch)}
          onRemove={() => eliminarTipologia(t.id)}
        />
      ))}
      {tipologias.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Agregá al menos una abertura para empezar.
        </p>
      )}
    </>
  )
}

function PrecioUnitarioInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <MoneyInput
      allowDecimals
      className="h-11"
      placeholder="0"
      value={value}
      onChange={(v) => onChange(Math.max(0, v))}
    />
  )
}

function TipologiaRow({
  index,
  tipologia,
  onChange,
  onRemove,
}: {
  index: number
  tipologia: Obra['tipologias'][0]
  onChange: (patch: Partial<Obra['tipologias'][0]>) => void
  onRemove: () => void
}) {
  // Colapsado por defecto: línea y color ya vienen con un valor por
  // default razonable (ver `nuevaTipologia()`), así que no hace falta
  // mostrarlos abiertos para completar el ítem rápido.
  const [detalleAbierto, setDetalleAbierto] = React.useState(false)
  const subtotal = totalTipologia(tipologia)

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2.5 bg-card/60 backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 text-xs font-bold mt-1">
          {index + 1}
        </span>
        <Textarea
          value={tipologia.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Ej: Ventana corrediza 2 hojas — 1,20 x 1,10 m"
          className="flex-1 min-h-11 resize-y"
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 size-11"
          onClick={onRemove}
          type="button"
          aria-label={`Quitar ítem #${index + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Solo lo esencial para completar el ítem: cantidad y precio */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Cantidad</Label>
          <div className="flex h-11 items-stretch overflow-hidden rounded-lg border border-input bg-card/60">
            <button
              type="button"
              onClick={() => onChange({ cantidad: Math.max(1, (tipologia.cantidad || 1) - 1) })}
              disabled={tipologia.cantidad <= 1}
              aria-label="Restar cantidad"
              className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span
              className="flex flex-1 items-center justify-center border-x border-input text-sm font-semibold tabular-nums money"
              aria-live="polite"
            >
              {tipologia.cantidad || 1}
            </span>
            <button
              type="button"
              onClick={() => onChange({ cantidad: (tipologia.cantidad || 1) + 1 })}
              aria-label="Sumar cantidad"
              className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">P. unitario</Label>
          <PrecioUnitarioInput
            value={tipologia.precioUnitario}
            onChange={(v) => onChange({ precioUnitario: v })}
          />
        </div>
      </div>

      {/* Disclosure: línea y color, colapsado por defecto + subtotal chip */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setDetalleAbierto((v) => !v)}
          className="flex min-w-0 items-center gap-1 rounded-md py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', detalleAbierto && 'rotate-180')}
            aria-hidden="true"
          />
          <span className="shrink-0">Línea y color</span>
          {!detalleAbierto && (
            <span className="truncate text-muted-foreground/70">
              · {tipologia.linea} / {tipologia.color}
            </span>
          )}
        </button>

        {subtotal > 0 && (
          <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium tabular-nums money text-foreground/80">
            ${formatMoney(subtotal)}
          </span>
        )}
      </div>

      {detalleAbierto && (
        <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid gap-1">
            <Label className="text-xs">Línea</Label>
            <Select
              value={tipologia.linea}
              onValueChange={(v) => onChange({ linea: v as Obra['tipologias'][0]['linea'] })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINEAS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Color</Label>
            <Select
              value={tipologia.color}
              onValueChange={(v) => onChange({ color: v as Obra['tipologias'][0]['color'] })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLORES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
