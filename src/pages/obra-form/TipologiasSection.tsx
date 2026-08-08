/**
 * pages/obra-form/TipologiasSection.tsx
 *
 * Sub-sección "Detalle de aberturas" del form de obra.
 *
 * Cada abertura se presenta como una ficha con tres zonas claras: encabezado
 * y acciones, campos editables, y subtotal. En móvil, línea y color quedan
 * detrás de una fila-resumen táctil; en desktop permanecen visibles. Esta
 * jerarquía deja la descripción con todo el ancho y evita que las acciones
 * secundarias compitan con los campos que el vendedor completa en obra.
 *
 * Mejoras de esta iteración:
 *   · Duplicar ítem: para aberturas repetidas con alguna variante, evita
 *     recargar todo desde cero (vive junto a eliminar en el menú contextual).
 *   · Confirmación al eliminar: solo si el ítem ya tiene contenido
 *     cargado (descripción o precio) — un ítem recién agregado y vacío
 *     se borra directo, sin fricción.
 *   · Autocompletado de descripción: sugiere descripciones ya tipeadas
 *     por este vendedor en este dispositivo (descripciones-store), para
 *     no re-escribir textos largos que se repiten seguido.
 *   · Aviso de campo incompleto: si al usuario se le olvida descripción o
 *     precio habiendo cargado el otro, el campo se marca y aparece una ayuda
 *     breve. Un ítem totalmente vacío queda neutro para no generar ruido.
 *   · Desktop: línea y color quedan visibles por defecto (hay espacio
 *     de sobra), en vez del disclosure colapsado que sí tiene sentido
 *     en móvil.
 */

import * as React from 'react'
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  ChevronDown,
  MoreVertical,
  Check,
  Pencil,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMoney, totalTipologia, desglosarIvaItem } from '@/lib/obra-totales'
import type { LineaAbertura, Obra } from '@/lib/types'
import { COLORES, LINEAS } from '@/lib/constants'
import { useDescripcionesStore } from '@/lib/stores/descripciones-store'
import { cn } from '@/lib/utils'

export function TipologiasContent({
  tipologias,
  actualizarTipologia,
  eliminarTipologia,
  duplicarTipologia,
  isDesktop = false,
  ivaInfo,
}: {
  tipologias: Obra['tipologias']
  actualizarTipologia: (id: string, patch: Partial<Obra['tipologias'][0]>) => void
  eliminarTipologia: (id: string) => void
  duplicarTipologia: (id: string) => void
  /** En desktop, línea y color se muestran siempre destapados (hay
   * espacio de sobra); en móvil quedan detrás del disclosure. */
  isDesktop?: boolean
  /** Si la obra tiene "Discriminar IVA" activo, cada ítem muestra su
   * precio unitario ya ajustado (completado al IVA base) en vez del
   * precio tal cual lo tipeó el vendedor — el input no se toca, solo
   * cambia lo que se muestra. */
  ivaInfo?: {
    incluyeIva: boolean
    ivaBasePct: number
    ivaPorLinea: Record<LineaAbertura, number>
  }
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
          isDesktop={isDesktop}
          ivaInfo={ivaInfo}
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

/** Falta descripción y/o precio en este ítem. */
function camposFaltantes(t: Obra['tipologias'][0]) {
  return {
    faltaDescripcion: t.descripcion.trim().length === 0,
    faltaPrecio: !(t.precioUnitario > 0),
  }
}

function PrecioUnitarioInput({
  value,
  onChange,
  error,
}: {
  value: number
  onChange: (v: number) => void
  error?: boolean
}) {
  return (
    <MoneyInput
      allowDecimals
      className={cn(
        'h-11',
        error && 'border-red-500/50 focus-visible:ring-red-500/30',
      )}
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
  isDesktop = false,
  ivaInfo,
}: {
  index: number
  tipologia: Obra['tipologias'][0]
  onChange: (patch: Partial<Obra['tipologias'][0]>) => void
  onRemove: () => void
  onDuplicate: () => void
  isDesktop?: boolean
  ivaInfo?: {
    incluyeIva: boolean
    ivaBasePct: number
    ivaPorLinea: Record<LineaAbertura, number>
  }
}) {
  // Colapsado por defecto en móvil: línea y color ya vienen con un valor
  // por default razonable (ver `nuevaTipologia()`), así que no hace falta
  // mostrarlos abiertos para completar el ítem rápido. En desktop hay
  // espacio de sobra, así que quedan siempre visibles.
  const [detalleAbierto, setDetalleAbierto] = React.useState(false)
  const subtotal = totalTipologia(tipologia)

  // Con "Discriminar IVA" activo, el precio unitario que tipeó el
  // vendedor no cambia en el input — pero el chip de subtotal muestra
  // el precio ya "completado" al IVA base de la línea (ver
  // `desglosarIvaItem`), que es el que va a figurar en el presupuesto.
  const desglose =
    ivaInfo?.incluyeIva && subtotal > 0
      ? desglosarIvaItem(tipologia, ivaInfo.ivaBasePct, ivaInfo.ivaPorLinea)
      : null
  const subtotalAjustado = desglose?.totalAjustado ?? subtotal

  // Un ítem "vacío" (recién agregado, sin tocar) se borra directo sin
  // confirmar. Uno con descripción o precio ya cargado sí confirma, para
  // no perder trabajo por un toque accidental en la papelera.
  const tieneContenido = tipologia.descripcion.trim().length > 0 || tipologia.precioUnitario > 0
  const [confirmarEliminar, setConfirmarEliminar] = React.useState(false)

  // Estado de completitud, siempre visible y pasivo (sin texto ni
  // toasts): cada input que falta se marca en rojo sutil directamente
  // sobre ese campo. Un ítem 100% nuevo (los dos campos vacíos) queda
  // neutro — recién se marca en rojo el campo vacío una vez que el otro
  // ya tiene contenido, que es cuando de verdad "se olvidó algo".
  const { faltaDescripcion, faltaPrecio } = camposFaltantes(tipologia)
  const mostrarErrorDescripcion = faltaDescripcion && !faltaPrecio
  const mostrarErrorPrecio = faltaPrecio && !faltaDescripcion
  const itemCompleto = !faltaDescripcion && !faltaPrecio

  function pedirEliminar() {
    if (tieneContenido) {
      setConfirmarEliminar(true)
    } else {
      onRemove()
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
      <div className="flex min-h-12 items-center justify-between border-b border-border/50 px-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Abertura {String(index + 1).padStart(2, '0')}
          </span>
          {itemCompleto && (
            <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success" title="Ítem completo">
              <Check className="size-3" aria-hidden="true" />
              <span className="sr-only">Ítem completo</span>
            </span>
          )}
        </div>
        {/* modal={false} + event.preventDefault() en el ítem que abre el
            AlertDialog: evita el bug de Radix donde el DropdownMenu (modal)
            y el AlertDialog compiten por el pointer-events del <body> al
            abrirse uno desde el onSelect del otro, dejando la pantalla
            congelada (no se puede tocar nada). Mismo patrón ya usado en
            ClienteDetalle.tsx para "Eliminar cliente" — ver ese archivo. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 text-muted-foreground" type="button" aria-label={`Acciones de abertura ${index + 1}`}>
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {/* Duplicar no abre ningún modal, así que no le hace falta
                preventDefault: el onSelect normal cierra el menú y listo. */}
            <DropdownMenuItem className="min-h-11" onSelect={onDuplicate}>
              <Copy />
              Duplicar abertura
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11 text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault()
                pedirEliminar()
              }}
            >
              <Trash2 />
              Quitar abertura
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid gap-1">
          <Label className="text-xs">Descripción</Label>
          <DescripcionInput
            value={tipologia.descripcion}
            onChange={(v) => onChange({ descripcion: v })}
            error={mostrarErrorDescripcion}
          />
        </div>

      {/* Solo lo esencial para completar el ítem: cantidad y precio */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
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
          <Label className="text-xs">Precio unitario</Label>
          <PrecioUnitarioInput
            value={tipologia.precioUnitario}
            onChange={(v) => onChange({ precioUnitario: v })}
            error={mostrarErrorPrecio}
          />
        </div>
      </div>

      {(mostrarErrorDescripcion || mostrarErrorPrecio) && (
        <p className="text-xs text-destructive">
          Completá {mostrarErrorDescripcion ? 'la descripción' : 'el precio unitario'} para terminar esta abertura.
        </p>
      )}

      {/* Desktop: línea y color siempre visibles (hay espacio de sobra).
          Móvil: disclosure colapsado por defecto + subtotal chip. */}
      {isDesktop ? (
        <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Línea</Label>
              <Select
                value={tipologia.linea}
                onValueChange={(v) => onChange({ linea: v as Obra['tipologias'][0]['linea'] })}
              >
                <SelectTrigger className="h-9">
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
                <SelectTrigger className="h-9">
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
      ) : (
        <>
          <button
            type="button"
            onClick={() => setDetalleAbierto((v) => !v)}
            aria-expanded={detalleAbierto}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/25 px-3 text-left transition-colors hover:bg-elevated/60"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Línea y color
              </span>
              <span className="block truncate text-sm font-medium">
                {tipologia.linea} · {tipologia.color}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
              <Pencil className="size-3.5" aria-hidden="true" />
              Editar
              <ChevronDown
                className={cn('size-4 transition-transform', detalleAbierto && 'rotate-180')}
                aria-hidden="true"
              />
            </span>
          </button>

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
        </>
      )}
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Subtotal</p>
          {desglose && tipologia.cantidad > 0 && (
            <p className="truncate text-[11px] text-muted-foreground">
              Incluye ajuste de IVA · ${formatMoney(desglose.totalAjustado / tipologia.cantidad)} c/u
            </p>
          )}
        </div>
        <span
          className="shrink-0 text-base font-bold tabular-nums money text-foreground"
          title={desglose ? `Con IVA discriminado (${Math.round(ivaInfo!.ivaBasePct * 1000) / 10}%)` : undefined}
        >
          ${formatMoney(subtotalAjustado)}
        </span>
      </div>

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
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: boolean
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
        className={cn(
          'min-h-11 resize-y',
          error && 'border-red-500/50 focus-visible:ring-red-500/30',
        )}
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
