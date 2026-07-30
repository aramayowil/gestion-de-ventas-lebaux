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
 *
 * Mejoras de esta iteración:
 *   · Duplicar ítem: para aberturas repetidas con alguna variante, evita
 *     recargar todo desde cero (botón junto al de eliminar).
 *   · Confirmación al eliminar: solo si el ítem ya tiene contenido
 *     cargado (descripción o precio) — un ítem recién agregado y vacío
 *     se borra directo, sin fricción.
 *   · Autocompletado de descripción: sugiere descripciones ya tipeadas
 *     por este vendedor en este dispositivo (descripciones-store), para
 *     no re-escribir textos largos que se repiten seguido.
 */
import * as React from 'react'
import { Plus, Minus, Trash2, Copy, ChevronDown } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatMoney, totalTipologia } from '@/lib/obra-totales'
import type { Obra } from '@/lib/types'
import { COLORES, LINEAS } from '@/lib/constants'
import { useDescripcionesStore } from '@/lib/stores/descripciones-store'
import { cn } from '@/lib/utils'

export function TipologiasContent({
  tipologias,
  actualizarTipologia,
  eliminarTipologia,
  duplicarTipologia,
}: {
  tipologias: Obra['tipologias']
  actualizarTipologia: (id: string, patch: Partial<Obra['tipologias'][0]>) => void
  eliminarTipologia: (id: string) => void
  duplicarTipologia: (id: string) => void
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
          onDuplicate={() => duplicarTipologia(t.id)}
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
  onDuplicate,
}: {
  index: number
  tipologia: Obra['tipologias'][0]
  onChange: (patch: Partial<Obra['tipologias'][0]>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  // Colapsado por defecto: línea y color ya vienen con un valor por
  // default razonable (ver `nuevaTipologia()`), así que no hace falta
  // mostrarlos abiertos para completar el ítem rápido.
  const [detalleAbierto, setDetalleAbierto] = React.useState(false)
  const subtotal = totalTipologia(tipologia)

  // Un ítem "vacío" (recién agregado, sin tocar) se borra directo sin
  // confirmar. Uno con descripción o precio ya cargado sí confirma, para
  // no perder trabajo por un toque accidental en la papelera.
  const tieneContenido = tipologia.descripcion.trim().length > 0 || tipologia.precioUnitario > 0
  const [confirmarEliminar, setConfirmarEliminar] = React.useState(false)

  function pedirEliminar() {
    if (tieneContenido) {
      setConfirmarEliminar(true)
    } else {
      onRemove()
    }
  }

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2.5 bg-card/60 backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 text-xs font-bold mt-1">
          {index + 1}
        </span>
        <DescripcionInput
          value={tipologia.descripcion}
          onChange={(v) => onChange({ descripcion: v })}
        />
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-elevated size-11"
            onClick={onDuplicate}
            type="button"
            aria-label={`Duplicar ítem #${index + 1}`}
            title="Duplicar ítem"
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 size-11"
            onClick={pedirEliminar}
            type="button"
            aria-label={`Quitar ítem #${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
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

      <AlertDialog open={confirmarEliminar} onOpenChange={setConfirmarEliminar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              {tipologia.descripcion.trim()
                ? `Se va a borrar "${tipologia.descripcion.trim().slice(0, 60)}${tipologia.descripcion.trim().length > 60 ? '…' : ''}" de la cotización.`
                : 'Se va a borrar este ítem de la cotización.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Textarea de descripción con autocompletado por historial local
 * (descripciones-store). Las sugerencias aparecen debajo mientras hay
 * foco y coincidencias; elegir una reemplaza el texto completo.
 */
function DescripcionInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const buscar = useDescripcionesStore((s) => s.buscar)
  const [foco, setFoco] = React.useState(false)
  const [sugerencias, setSugerencias] = React.useState<string[]>([])
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  function handleChange(v: string) {
    onChange(v)
    setSugerencias(buscar(v))
  }

  // Cerrar sugerencias al hacer foco afuera (no solo con onBlur del
  // textarea, para permitir el click en una sugerencia sin que el blur
  // la cierre antes de registrar el click).
  React.useEffect(() => {
    if (!foco) return
    function handleClickFuera(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFoco(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [foco])

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          setFoco(true)
          setSugerencias(buscar(value))
        }}
        placeholder="Ej: Ventana corrediza 2 hojas — 1,20 x 1,10 m"
        className="min-h-11 resize-y"
      />
      {foco && sugerencias.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // evita el blur antes del click
              onClick={() => {
                onChange(s)
                setSugerencias([])
                setFoco(false)
              }}
              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-elevated transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
