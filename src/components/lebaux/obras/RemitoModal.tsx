/**
 * components/lebaux/obras/RemitoModal.tsx
 *
 * Modal unificado para crear, ver y editar el remito de fábrica de una
 * obra. Se abre desde el menú ⋮ de la card de obra en ClienteDetalle
 * (solo si la obra es una venta aceptada).
 *
 * Modos:
 *   · crear   — no hay remito para la obra. Muestra form completo
 *               (items + fecha + hora + nota). El sistema auto-sugiere
 *               el primer turno libre como fecha+hora inicial.
 *   · ver     — ya hay remito. Muestra info + estado del turno + acciones
 *               (editar items, mover fecha/hora, eliminar remito).
 *
 * El remito se guarda con un turno asignado automáticamente (fecha+hora
 * elegidos por el usuario). Si el usuario quiere cambiar fecha/hora más
 * adelante, puede hacerlo desde la página Agenda o desde este mismo
 * modal en modo "ver" (editar).
 */
import * as React from 'react'
import { toast } from 'sonner'
import {
  Factory,
  CheckCircle2,
  Trash2,
  Pencil,
  AlertTriangle,
  Clock,
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  useRemitos,
  useCreateRemito,
  useUpdateRemito,
  useDeleteRemito,
  useTurnos,
  useCreateTurno,
  useDeleteTurno,
  useUpdateTurno,
  useTurnoOcupado,
  usePrimerTurnoLibre,
} from '@/hooks/queries'
import { HORAS_TURNO, ESTADO_TURNO_LABEL } from '@/lib/constants'
import { formatMoney } from '@/lib/obra-totales'
import { nuevoRemito, nuevoTurno, type Obra, type Remito } from '@/lib/types'
import { CalendarDisponibilidad } from '@/components/ui/calendar-disponibilidad'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  obra: Obra | null
  onClose: () => void
}

export function RemitoModal({ open, obra, onClose }: Props) {
  const { data: remitosData } = useRemitos()
  const remitos = React.useMemo(() => remitosData ?? [], [remitosData])
  const crearRemitoMutation = useCreateRemito()
  const actualizarRemitoMutation = useUpdateRemito()
  const eliminarRemitoMutation = useDeleteRemito()
  const { data: turnosData } = useTurnos()
  const turnos = React.useMemo(() => turnosData ?? [], [turnosData])
  const crearTurnoMutation = useCreateTurno()
  const eliminarTurnoMutation = useDeleteTurno()
  const actualizarTurnoMutation = useUpdateTurno()
  const turnoOcupado = useTurnoOcupado()
  const primerTurnoLibre = usePrimerTurnoLibre()

  // Buscar remito existente para esta obra
  const remitoExistente = React.useMemo<Remito | null>(() => {
    if (!obra) return null
    return remitos.find((r) => r.obraId === obra.id) ?? null
  }, [remitos, obra])

  // Buscar turno asociado al remito
  const turnoAsignado = React.useMemo(() => {
    if (!remitoExistente?.turnoId) return null
    return turnos.find((t) => t.id === remitoExistente.turnoId) ?? null
  }, [turnos, remitoExistente])

  // Estado del form
  const [todaLaObra, setTodaLaObra] = React.useState(true)
  const [tipologiaIds, setTipologiaIds] = React.useState<string[]>([])
  const [fecha, setFecha] = React.useState('')
  const [hora, setHora] = React.useState<number>(8)
  const [nota, setNota] = React.useState('')
  const [editando, setEditando] = React.useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = React.useState(false)
  const [calendarioAbierto, setCalendarioAbierto] = React.useState(false)

  // Init al abrir
  React.useEffect(() => {
    if (!open || !obra) return
    setCalendarioAbierto(false)

    if (remitoExistente) {
      // Modo ver/editar: cargar datos del remito existente
      const todasLasTipologias = remitoExistente.tipologiaIds.length === obra.tipologias.length
      setTodaLaObra(todasLasTipologias)
      setTipologiaIds(remitoExistente.tipologiaIds)
      setNota(remitoExistente.nota ?? '')
      if (turnoAsignado) {
        setFecha(turnoAsignado.fecha)
        setHora(turnoAsignado.hora)
      } else {
        const libre = primerTurnoLibre()
        if (libre) {
          setFecha(libre.fecha)
          setHora(libre.hora)
        }
      }
      setEditando(false)
    } else {
      // Modo crear: auto-sugerir primer turno libre
      setTodaLaObra(true)
      setTipologiaIds([])
      setNota('')
      const libre = primerTurnoLibre()
      if (libre) {
        setFecha(libre.fecha)
        setHora(libre.hora)
      } else {
        // fallback: hoy + 7 días, 8:00
        const d = new Date()
        d.setDate(d.getDate() + 7)
        setFecha(d.toISOString().slice(0, 10))
        setHora(8)
      }
      setEditando(true)
    }
  }, [open, obra, remitoExistente, turnoAsignado, primerTurnoLibre])

  if (!obra) return null

  const esModoCrear = !remitoExistente
  const esModoVer = !!remitoExistente && !editando
  const esModoEditar = !!remitoExistente && editando

  function toggleTipologia(id: string) {
    setTipologiaIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  async function handleGuardarCrear() {
    if (!obra) return
    if (!fecha) {
      toast.error('Elegí una fecha.')
      return
    }
    const ids = todaLaObra ? obra.tipologias.map((t) => t.id) : tipologiaIds
    if (ids.length === 0) {
      toast.error('Seleccioná al menos un ítem para el remito.')
      return
    }
    if (turnoOcupado(fecha, hora)) {
      toast.error('Ese turno ya está ocupado. Elegí otro horario.')
      return
    }

    try {
      // 1) Crear remito (esperamos el id real que asigna la DB)
      const remitoBase = nuevoRemito(obra.id, obra.clienteId, ids, fecha, nota.trim() || undefined)
      const remitoCreado = await crearRemitoMutation.mutateAsync(remitoBase)
      const remitoId = remitoCreado?.id ?? remitoBase.id

      // 2) Crear turno asignado al remito
      const turno = nuevoTurno(remitoId, obra.id, obra.clienteId, fecha, hora)
      await crearTurnoMutation.mutateAsync(turno)

      toast.success('Remito creado y turno asignado.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear el remito.')
    }
  }

  async function handleGuardarEditar() {
    if (!obra || !remitoExistente || !turnoAsignado) return
    if (!fecha) {
      toast.error('Elegí una fecha.')
      return
    }
    const ids = todaLaObra ? obra.tipologias.map((t) => t.id) : tipologiaIds
    if (ids.length === 0) {
      toast.error('Seleccioná al menos un ítem para el remito.')
      return
    }

    try {
      // 1) Actualizar remito (items + nota)
      const remitoActualizado: Remito = {
        ...remitoExistente,
        tipologiaIds: ids,
        nota: nota.trim() || undefined,
      }
      await actualizarRemitoMutation.mutateAsync(remitoActualizado)

      // 2) Mover turno si cambió fecha/hora
      if (fecha !== turnoAsignado.fecha || hora !== turnoAsignado.hora) {
        if (turnoOcupado(fecha, hora, turnoAsignado.id)) {
          toast.error('Ese turno ya está ocupado. Elegí otro horario.')
          return
        }
        await actualizarTurnoMutation.mutateAsync({ ...turnoAsignado, fecha, hora })
      }

      toast.success('Remito actualizado.')
      setEditando(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar el remito.')
    }
  }

  async function handleEliminarRemito() {
    if (!remitoExistente) return
    try {
      // Eliminar turno asociado primero (si lo hay)
      if (turnoAsignado) {
        await eliminarTurnoMutation.mutateAsync(turnoAsignado.id)
      }
      await eliminarRemitoMutation.mutateAsync(remitoExistente.id)
      toast.success('Remito eliminado.')
      setConfirmandoEliminar(false)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el remito.')
    }
  }

  /* ──────────── Render según modo ──────────── */

  // Modo VER (remito existente, no editando)
  if (esModoVer) {
    return (
      <>
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <Factory className="size-5 text-primary" />
                Remito de fábrica
              </DialogTitle>
              <DialogDescription>
                Información del remito y turno asignado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Items */}
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Items a fabricar
                </p>
                <p className="text-sm font-medium">
                  {remitoExistente!.tipologiaIds.length === obra.tipologias.length
                    ? 'Toda la obra'
                    : `${remitoExistente!.tipologiaIds.length} de ${obra.tipologias.length} ítems`}
                </p>
              </div>

              {/* Turno asignado */}
              <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">{formatFechaLarga(turnoAsignado!.fecha)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">{turnoAsignado!.hora}:00 hs</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estado</span>
                  <span className={cn('font-medium', ESTADO_TURNO_COLOR[turnoAsignado!.estado])}>
                    {ESTADO_TURNO_LABEL[turnoAsignado!.estado]}
                  </span>
                </div>
              </div>

              {/* Nota */}
              {remitoExistente!.nota && (
                <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Nota
                  </p>
                  <p className="text-sm">{remitoExistente!.nota}</p>
                </div>
              )}

              {/* CTA a Agenda */}
              <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-3 flex items-start gap-2.5">
                <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80">
                  Para cambios avanzados (mover turno, cambiar estado del
                  proceso, etc.) usá la página{' '}
                  <strong>Agenda</strong>.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:flex-1"
                onClick={() => setConfirmandoEliminar(true)}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="sm:flex-1"
                onClick={() => setEditando(true)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
              <Button
                size="sm"
                className="sm:flex-1"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmar eliminar */}
        <AlertDialog open={confirmandoEliminar} onOpenChange={setConfirmandoEliminar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                ¿Eliminar remito de fábrica?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará el remito y su turno asignado. La venta no se
                ve afectada. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEliminarRemito}
                disabled={eliminarRemitoMutation.isPending || eliminarTurnoMutation.isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {eliminarRemitoMutation.isPending || eliminarTurnoMutation.isPending
                  ? 'Eliminando...'
                  : 'Sí, eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // Modo CREAR o EDITAR (form)
  const tituloModal = esModoCrear ? 'Generar remito de fábrica' : 'Editar remito'
  const descModal = esModoCrear
    ? 'Elegí qué aberturas van a fábrica y la fecha+hora del turno. El sistema sugiere el primer turno libre.'
    : 'Modificá los items y/o la fecha+hora del turno.'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Factory className="size-5 text-primary" />
            {tituloModal}
          </DialogTitle>
          <DialogDescription>{descModal}</DialogDescription>
        </DialogHeader>

        {/* Selector: toda la obra / algunos ítems */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTodaLaObra(true)}
            className={cn(
              'rounded-lg border-2 p-3 text-left transition-all',
              todaLaObra
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/40',
            )}
          >
            <span className="block text-sm font-semibold">Toda la obra</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              {obra.tipologias.length} ítem{obra.tipologias.length === 1 ? '' : 's'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTodaLaObra(false)}
            className={cn(
              'rounded-lg border-2 p-3 text-left transition-all',
              !todaLaObra
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/40',
            )}
          >
            <span className="block text-sm font-semibold">Algunos ítems</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Elegir individualmente
            </span>
          </button>
        </div>

        {/* Lista de ítems (solo si no es "toda la obra") */}
        {!todaLaObra && (
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
            {obra.tipologias.map((t, i) => {
              const checked = tipologiaIds.includes(t.id)
              return (
                <label
                  key={t.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-border/30 last:border-b-0 transition-colors',
                    checked ? 'bg-primary/5' : 'hover:bg-elevated/40',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTipologia(t.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {i + 1}. {t.descripcion || <span className="text-muted-foreground italic">Sin descripción</span>}
                    </p>
                    <p className="text-xs text-muted-foreground money">
                      {t.cantidad} × ${formatMoney(t.precioUnitario)}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {/* Fecha + hora del turno */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.06] dark:bg-primary/[0.1] ring-1 ring-primary/20 p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <p className="text-sm font-semibold">Turno de fábrica</p>
            {esModoCrear && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-primary font-medium">
                Sugerido
              </span>
            )}
          </div>

          {/* Calendario de disponibilidad (colapsable, no popover) */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">
              Fecha — seleccioná un día disponible
            </Label>
            <button
              type="button"
              onClick={() => setCalendarioAbierto((v) => !v)}
              className={cn(
                'flex h-11 w-full items-center justify-between rounded-md border border-input bg-card/60 px-3 py-2 text-left text-sm ring-offset-background transition-colors',
                'hover:border-primary/40 hover:bg-elevated/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                !fecha && 'text-muted-foreground',
                calendarioAbierto && 'border-primary/60 ring-1 ring-primary/20',
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-primary" />
                {fecha ? formatFechaLarga(fecha) : 'Elegir fecha...'}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  calendarioAbierto && 'rotate-180',
                )}
              />
            </button>
            {calendarioAbierto && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <CalendarDisponibilidad
                  value={fecha}
                  onChange={(nuevaFecha) => {
                    setFecha(nuevaFecha)
                    setCalendarioAbierto(false)
                  }}
                  turnoOcupado={(f, h) =>
                    esModoEditar && turnoAsignado
                      ? turnoOcupado(f, h, turnoAsignado.id)
                      : turnoOcupado(f, h)
                  }
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}
          </div>

          {/* Hora */}
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Hora</Label>
            <Select
              value={String(hora)}
              onValueChange={(v) => setHora(Number(v))}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HORAS_TURNO.map((h) => {
                  const ocupado = esModoEditar && turnoAsignado
                    ? turnoOcupado(fecha, h, turnoAsignado.id)
                    : turnoOcupado(fecha, h)
                  return (
                    <SelectItem key={h} value={String(h)} disabled={ocupado}>
                      {h}:00 {ocupado && '(ocupado)'}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Nota opcional */}
        <div className="grid gap-2">
          <Label htmlFor="nota-remito">Nota para fábrica (opcional)</Label>
          <Textarea
            id="nota-remito"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: llevar perfil reforzado, color especial, etc."
            className="min-h-[60px]"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {esModoEditar ? (
            <>
              <Button variant="outline" onClick={() => setEditando(false)} className="sm:flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleGuardarEditar}
                disabled={actualizarRemitoMutation.isPending || actualizarTurnoMutation.isPending}
                className="sm:flex-1"
              >
                <CheckCircle2 className="size-4" />
                {actualizarRemitoMutation.isPending || actualizarTurnoMutation.isPending
                  ? 'Guardando...'
                  : 'Guardar cambios'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="sm:flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleGuardarCrear}
                disabled={crearRemitoMutation.isPending || crearTurnoMutation.isPending}
                className="sm:flex-1"
              >
                <CheckCircle2 className="size-4" />
                {crearRemitoMutation.isPending || crearTurnoMutation.isPending ? 'Creando...' : 'Crear remito'}
                <ArrowRight className="size-4" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ────────────── Helpers ────────────── */

const ESTADO_TURNO_COLOR: Record<string, string> = {
  pendiente: 'text-primary',
  'en-fabrica': 'text-amber-600 dark:text-amber-400',
  listo: 'text-blue-600 dark:text-blue-400',
  entregado: 'text-success',
  cancelado: 'text-destructive',
}

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS_SEMANA_LARGO = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

function formatFechaLarga(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00')
    return `${DIAS_SEMANA_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
  } catch {
    return isoDate
  }
}

export default RemitoModal
