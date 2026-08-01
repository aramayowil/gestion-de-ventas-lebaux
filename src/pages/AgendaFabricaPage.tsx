/**
 * pages/AgendaFabricaPage.tsx — Agenda de fábrica.
 *
 * Dos vistas alternables:
 *   · Calendario semanal: columnas = días (Lun-Sáb), filas = horas (8-17).
 *     Cada celda es un turno. Click en celda libre con remito pendiente →
 *     asignar. Click en celda ocupada → ver detalle / cambiar estado /
 *     mover / eliminar.
 *   · Lista: próximos turnos ordenados por fecha+hora, con acciones
 *     rápidas (cambiar estado, mover, eliminar).
 *
 * Sección superior: remitos sin turno asignado (lista de "pendientes
 * de agendar"), con CTA para asignarles un turno.
 *
 * Estados de turno: pendiente / en-fabrica / listo / entregado / cancelado.
 */
import * as React from 'react'
import { toast } from 'sonner'
import {
  CalendarDays,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Truck,
  Trash2,
  ArrowRightLeft,
  Clock3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AppLayout } from '@/components/layout/AppLayout'
import { useIsDesktop } from '@/hooks/use-is-desktop'
import {
  useRemitos,
  useTurnos,
  useCreateTurno,
  useUpdateTurno,
  useDeleteTurno,
  useTurnoOcupado,
  useClientes,
  useObras,
} from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import {
  HORAS_TURNO,
  DIAS_LABORABLES,
  DIA_SEMANA_CORTO,
  ESTADO_TURNO_LABEL,
} from '@/lib/constants'
import type { EstadoTurno, Remito, Turno } from '@/lib/types'
import { nuevoTurno } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  onVerCliente: (clienteId: string) => void
}

type Vista = 'calendario' | 'lista'

export function AgendaFabricaPage({ onVerCliente }: Props) {
  const isDesktop = useIsDesktop()
  // TanStack Query
  const { data: remitos = [], isLoading: cargandoRemitos } = useRemitos()
  const { data: turnos = [], isLoading: cargandoTurnos } = useTurnos()
  const createTurnoMut = useCreateTurno()
  const updateTurnoMut = useUpdateTurno()
  const deleteTurnoMut = useDeleteTurno()
  const turnoOcupadoFn = useTurnoOcupado()
  const { data: clientes = [], isLoading: cargandoClientes } = useClientes()
  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [], isLoading: cargandoObras } = useObras(clienteIds)
  const cargandoAgendaFabrica =
    cargandoRemitos || cargandoTurnos || cargandoClientes || cargandoObras

  const [vista, setVista] = React.useState<Vista>('calendario')
  const [semanaOffset, setSemanaOffset] = React.useState(0)
  const [diaSeleccionado, setDiaSeleccionado] = React.useState(() => {
    const dia = new Date().getDay()
    return dia >= 1 && dia <= 6 ? dia - 1 : 0
  })
  const [turnoDetalle, setTurnoDetalle] = React.useState<Turno | null>(null)
  const [remitoParaAsignar, setRemitoParaAsignar] =
    React.useState<Remito | null>(null)
  const [asignarFecha, setAsignarFecha] = React.useState('')
  const [asignarHora, setAsignarHora] = React.useState<number>(8)

  // Mapa de clientes
  const clienteMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clientes) m.set(c.id, c.nombre)
    return m
  }, [clientes])

  // Mapa de obras
  const obraMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const o of obras) {
      const desc = o.tipologias[0]?.descripcion ?? 'Sin descripción'
      m.set(
        o.id,
        `${o.tipologias.length} ítem${o.tipologias.length === 1 ? '' : 's'} · ${desc}`,
      )
    }
    return m
  }, [obras])

  // Remitos sin turno (pendientes de agendar)
  const remitosSinTurno = React.useMemo(
    () => remitos.filter((r) => !r.turnoId),
    [remitos],
  )

  // Turnos ordenados por fecha+hora (para vista de lista)
  const turnosOrdenados = React.useMemo(() => {
    return [...turnos]
      .filter((t) => t.estado !== 'cancelado')
      .sort((a, b) => {
        const fa = new Date(
          a.fecha + 'T' + String(a.hora).padStart(2, '0') + ':00:00',
        ).getTime()
        const fb = new Date(
          b.fecha + 'T' + String(b.hora).padStart(2, '0') + ':00:00',
        ).getTime()
        return fa - fb
      })
  }, [turnos])

  /* ─── Helpers de calendario ─── */
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Lunes de la semana actual + offset
  const lunesSemana = React.useMemo(() => {
    const d = new Date(hoy)
    const diaSemana = d.getDay() // 0=Dom, 1=Lun
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana // llegar al lunes
    d.setDate(d.getDate() + diff + semanaOffset * 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [semanaOffset, hoy])

  const diasSemana = React.useMemo(() => {
    return DIAS_LABORABLES.map((_, idx) => {
      const d = new Date(lunesSemana)
      d.setDate(d.getDate() + idx)
      return d
    })
  }, [lunesSemana])

  function formatFechaCorta(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function toISODate(d: Date): string {
    return d.toISOString().slice(0, 10)
  }

  function getTurno(fecha: string, hora: number): Turno | undefined {
    return turnos.find(
      (t) => t.fecha === fecha && t.hora === hora && t.estado !== 'cancelado',
    )
  }

  /* ─── Handlers ─── */
  function handleAsignarRemito(remito: Remito) {
    setRemitoParaAsignar(remito)
    // Default: fecha de entrega del remito, primer hora libre
    setAsignarFecha(remito.fechaEntrega)
    setAsignarHora(
      HORAS_TURNO.find((h) => !turnoOcupadoFn(remito.fechaEntrega, h)) ?? 8,
    )
  }

  function handleConfirmarAsignar() {
    if (!remitoParaAsignar) return
    if (!asignarFecha) {
      toast.error('Elegí una fecha.')
      return
    }
    if (turnoOcupadoFn(asignarFecha, asignarHora)) {
      toast.error('Ese turno ya está ocupado. Elegí otro horario.')
      return
    }
    const turno = nuevoTurno(
      remitoParaAsignar.id,
      remitoParaAsignar.obraId,
      remitoParaAsignar.clienteId,
      asignarFecha,
      asignarHora,
    )
    createTurnoMut.mutate(turno, {
      onSuccess: () => {
        toast.success('Turno asignado correctamente.')
        setRemitoParaAsignar(null)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  function handleMoverTurno(turno: Turno, fecha: string, hora: number) {
    if (turnoOcupadoFn(fecha, hora, turno.id)) {
      toast.error('Ese turno ya está ocupado.')
      return
    }
    updateTurnoMut.mutate(
      { ...turno, fecha, hora },
      {
        onSuccess: () => {
          toast.success('Turno movido.')
          setTurnoDetalle({ ...turno, fecha, hora })
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  function handleEliminarTurno(turno: Turno) {
    deleteTurnoMut.mutate(turno.id, {
      onSuccess: () => {
        toast.success('Turno eliminado.')
        setTurnoDetalle(null)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  function handleCambiarEstado(turno: Turno, estado: EstadoTurno) {
    const ahora = new Date().toISOString()
    const patch: Partial<Turno> = { estado }
    if (estado === 'en-fabrica') patch.enFabricaEn = ahora
    if (estado === 'listo') patch.listoEn = ahora
    if (estado === 'entregado') patch.entregadoEn = ahora
    if (estado === 'cancelado') patch.canceladoEn = ahora
    updateTurnoMut.mutate(
      { ...turno, ...patch },
      {
        onSuccess: () => {
          setTurnoDetalle({ ...turno, ...patch })
          toast.success(`Turno marcado como "${ESTADO_TURNO_LABEL[estado]}".`)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  /* ─── Render ─── */
  return (
    <AppLayout maxWidth="max-w-6xl" withBottomBar>
      {/* ─── Encabezado y switch de vista ─── */}
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Producción y entregas
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Agenda de fábrica
              </h2>
              <p className="text-sm text-muted-foreground">
                {turnosOrdenados.length} turnos activos ·{' '}
                {remitosSinTurno.length} por agendar
              </p>
            </div>
            <span className="hidden rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success sm:inline-flex">
              {
                turnosOrdenados.filter((turno) => turno.estado === 'listo')
                  .length
              }{' '}
              listos
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-border/60 bg-card/40 p-1">
          <button
            type="button"
            onClick={() => setVista('calendario')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              vista === 'calendario'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarDays className="size-4" />
            Calendario
          </button>
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              vista === 'lista'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListIcon className="size-4" />
            Lista
          </button>
        </div>
      </div>

      {/* ─── Remitos sin turno (pendientes de agendar) ─── */}
      {cargandoAgendaFabrica ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {remitosSinTurno.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-primary/30 bg-primary/6 ring-1 ring-primary/15 dark:bg-primary/10">
              <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <AlertCircle className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">
                      Pendientes de agendar
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Asignales día y horario de fábrica
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                  {remitosSinTurno.length}
                </span>
              </div>
              <div className="space-y-2 p-3">
                {remitosSinTurno.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/70 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {clienteMap.get(r.clienteId) ?? 'Cliente desconocido'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Entrega deseada:{' '}
                        {formatFechaCorta(
                          new Date(r.fechaEntrega + 'T12:00:00'),
                        )}{' '}
                        · {obraMap.get(r.obraId) ?? 'Obra'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-11 shrink-0"
                      onClick={() => handleAsignarRemito(r)}
                    >
                      <Plus className="size-3.5" />
                      <span className="hidden sm:inline">Asignar turno</span>
                      <span className="sm:hidden">Turno</span>
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── Vista calendario ─── */}
          {vista === 'calendario' && (
            <section className="space-y-3">
              {/* Navegación de semana */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSemanaOffset((v) => v - 1)
                    setDiaSeleccionado(0)
                  }}
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    {formatFechaCorta(diasSemana[0])} –{' '}
                    {formatFechaCorta(diasSemana[5])}
                  </p>
                  {semanaOffset === 0 ? (
                    <p className="text-[11px] text-primary">Esta semana</p>
                  ) : (
                    <button
                      type="button"
                      className="min-h-6 text-[11px] font-medium text-primary hover:underline"
                      onClick={() => {
                        setSemanaOffset(0)
                        const dia = new Date().getDay()
                        setDiaSeleccionado(dia >= 1 && dia <= 6 ? dia - 1 : 0)
                      }}
                    >
                      Volver a esta semana
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSemanaOffset((v) => v + 1)
                    setDiaSeleccionado(0)
                  }}
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* En mobile se prioriza un solo día legible; la grilla semanal
                completa queda para desktop, donde entra sin scroll lateral. */}
              {!isDesktop && (
                <>
                  <div className="grid grid-cols-6 gap-1.5">
                    {diasSemana.map((dia, index) => {
                      const seleccionado = diaSeleccionado === index
                      const esHoy = dia.getTime() === hoy.getTime()
                      const fecha = toISODate(dia)
                      const cantidad = HORAS_TURNO.filter((hora) =>
                        getTurno(fecha, hora),
                      ).length
                      return (
                        <button
                          key={fecha}
                          type="button"
                          onClick={() => setDiaSeleccionado(index)}
                          className={cn(
                            'flex min-h-16 flex-col items-center justify-center rounded-xl border text-center transition-colors',
                            seleccionado
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border/60 bg-card/50 text-muted-foreground hover:border-primary/40',
                          )}
                        >
                          <span className="text-[10px] font-semibold uppercase">
                            {DIA_SEMANA_CORTO[dia.getDay()]}
                          </span>
                          <span className="text-base font-bold tabular-nums">
                            {dia.getDate()}
                          </span>
                          <span
                            className={cn(
                              'text-[9px]',
                              seleccionado
                                ? 'text-primary-foreground/75'
                                : esHoy
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {esHoy
                              ? 'Hoy'
                              : `${cantidad} turno${cantidad === 1 ? '' : 's'}`}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <AgendaDiaria
                    dia={diasSemana[diaSeleccionado]}
                    turnos={turnos}
                    clienteMap={clienteMap}
                    onVerTurno={setTurnoDetalle}
                  />
                </>
              )}

              {isDesktop && (
                <div className="overflow-x-auto -mx-4 px-4">
                  <div className="min-w-160 grid grid-cols-[auto_repeat(6,1fr)] gap-1">
                    {/* Header fila */}
                    <div className="text-[10px] text-muted-foreground text-right pr-1 pt-1">
                      hs
                    </div>
                    {diasSemana.map((d) => {
                      const esHoy = d.getTime() === hoy.getTime()
                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            'text-center py-1.5 rounded-md text-xs',
                            esHoy
                              ? 'bg-primary/15 text-primary font-bold'
                              : 'text-muted-foreground',
                          )}
                        >
                          <div className="font-semibold">
                            {DIA_SEMANA_CORTO[d.getDay()]}
                          </div>
                          <div className="text-[10px] tabular-nums">
                            {formatFechaCorta(d)}
                          </div>
                        </div>
                      )
                    })}

                    {/* Filas por hora */}
                    {HORAS_TURNO.map((hora) => (
                      <React.Fragment key={hora}>
                        <div className="text-[10px] text-muted-foreground text-right pr-1 py-1 tabular-nums">
                          {hora}:00
                        </div>
                        {diasSemana.map((d) => {
                          const fecha = toISODate(d)
                          const turno = getTurno(fecha, hora)
                          const esPasado = d.getTime() < hoy.getTime()
                          return (
                            <CeldaTurno
                              key={fecha + '-' + hora}
                              turno={turno}
                              esPasado={esPasado}
                              clienteNombre={
                                turno
                                  ? (clienteMap.get(turno.clienteId) ?? '?')
                                  : ''
                              }
                              onClick={() => turno && setTurnoDetalle(turno)}
                            />
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ─── Vista lista ─── */}
          {vista === 'lista' && (
            <section className="space-y-2">
              {turnosOrdenados.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl">
                  <CalendarDays
                    className="size-8 mx-auto text-muted-foreground mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground">
                    No hay turnos activos. Asigná turnos desde la sección
                    "Remitos sin turno".
                  </p>
                </div>
              ) : (
                turnosOrdenados.map((t) => (
                  <TurnoRow
                    key={t.id}
                    turno={t}
                    clienteNombre={
                      clienteMap.get(t.clienteId) ?? 'Cliente desconocido'
                    }
                    obraDesc={obraMap.get(t.obraId) ?? 'Obra'}
                    onVerDetalle={() => setTurnoDetalle(t)}
                    onCambiarEstado={(estado) => handleCambiarEstado(t, estado)}
                    onVerCliente={() => onVerCliente(t.clienteId)}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}

      {/* ─── Modal asignar turno (remito sin turno) ─── */}
      <Dialog
        open={!!remitoParaAsignar}
        onOpenChange={(v) => !v && setRemitoParaAsignar(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              Asignar turno
            </DialogTitle>
            <DialogDescription>
              Elegí fecha y hora para el remito de{' '}
              <strong className="text-foreground">
                {remitoParaAsignar
                  ? clienteMap.get(remitoParaAsignar.clienteId)
                  : ''}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="asignar-fecha">Fecha</Label>
              <Input
                id="asignar-fecha"
                type="date"
                value={asignarFecha}
                onChange={(e) => setAsignarFecha(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Select
                value={String(asignarHora)}
                onValueChange={(v) => setAsignarHora(Number(v))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORAS_TURNO.map((h) => {
                    const ocupado = remitoParaAsignar
                      ? turnoOcupadoFn(asignarFecha, h)
                      : false
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemitoParaAsignar(null)}
              className="sm:flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmarAsignar} className="sm:flex-1">
              <Plus className="size-4" />
              Asignar turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal detalle de turno ─── */}
      <TurnoDetalleModal
        turno={turnoDetalle}
        clienteNombre={
          turnoDetalle ? (clienteMap.get(turnoDetalle.clienteId) ?? '?') : ''
        }
        obraDesc={
          turnoDetalle ? (obraMap.get(turnoDetalle.obraId) ?? 'Obra') : ''
        }
        onClose={() => setTurnoDetalle(null)}
        onCambiarEstado={(estado) =>
          turnoDetalle && handleCambiarEstado(turnoDetalle, estado)
        }
        onMover={(fecha, hora) =>
          turnoDetalle && handleMoverTurno(turnoDetalle, fecha, hora)
        }
        onEliminar={() => turnoDetalle && handleEliminarTurno(turnoDetalle)}
        onVerCliente={() => {
          if (turnoDetalle) onVerCliente(turnoDetalle.clienteId)
          setTurnoDetalle(null)
        }}
        turnoOcupado={turnoOcupadoFn}
      />
    </AppLayout>
  )
}

/* ────────────── Sub-componentes ────────────── */

function AgendaDiaria({
  dia,
  turnos,
  clienteMap,
  onVerTurno,
}: {
  dia: Date
  turnos: Turno[]
  clienteMap: Map<string, string>
  onVerTurno: (turno: Turno) => void
}) {
  const fecha = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
  const turnosDelDia = turnos.filter(
    (turno) => turno.fecha === fecha && turno.estado !== 'cancelado',
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/35">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold capitalize">
            {dia.toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {turnosDelDia.length === 0
              ? 'Sin turnos asignados'
              : `${turnosDelDia.length} turno${turnosDelDia.length === 1 ? '' : 's'} asignado${turnosDelDia.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Clock3 className="size-5 text-primary" aria-hidden="true" />
      </div>

      <div className="divide-y divide-border/40">
        {HORAS_TURNO.map((hora) => {
          const turno = turnosDelDia.find((item) => item.hora === hora)
          return (
            <div
              key={hora}
              className="grid grid-cols-[3.5rem_1fr] items-stretch"
            >
              <div className="flex items-center justify-center border-r border-border/40 bg-muted/15 px-2 py-3 text-xs font-semibold tabular-nums text-muted-foreground">
                {hora}:00
              </div>
              {turno ? (
                <button
                  type="button"
                  onClick={() => onVerTurno(turno)}
                  className="flex min-h-16 items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-elevated/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {clienteMap.get(turno.clienteId) ?? 'Cliente desconocido'}
                    </span>
                    <span className="mt-1 block">
                      <EstadoTurnoBadge estado={turno.estado} />
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <div className="flex min-h-14 items-center px-3 text-xs text-muted-foreground/65">
                  Horario disponible
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EstadoTurnoBadge({ estado }: { estado: EstadoTurno }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        ESTADO_TURNO_COLOR[estado],
      )}
    >
      {ESTADO_TURNO_LABEL[estado]}
    </span>
  )
}

function CeldaTurno({
  turno,
  esPasado,
  clienteNombre,
  onClick,
}: {
  turno: Turno | undefined
  esPasado: boolean
  clienteNombre: string
  onClick: () => void
}) {
  if (!turno) {
    return (
      <div
        className={cn(
          'min-h-12 rounded-md border border-border/30 bg-card/20',
          esPasado && 'opacity-40',
        )}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-12 rounded-md border p-1.5 text-left transition-all hover:brightness-110',
        'flex flex-col gap-0.5 overflow-hidden',
        ESTADO_TURNO_COLOR[turno.estado],
        esPasado && 'opacity-60',
      )}
    >
      <span className="text-[10px] font-bold truncate">{clienteNombre}</span>
      <span className="text-[9px] opacity-80 truncate">
        {ESTADO_TURNO_LABEL[turno.estado]}
      </span>
    </button>
  )
}

const ESTADO_TURNO_COLOR: Record<EstadoTurno, string> = {
  pendiente: 'bg-primary/15 border-primary/40 text-primary',
  'en-fabrica':
    'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400',
  listo: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400',
  entregado: 'bg-success/15 border-success/40 text-success',
  cancelado:
    'bg-destructive/10 border-destructive/30 text-destructive line-through',
}

function TurnoRow({
  turno,
  clienteNombre,
  obraDesc,
  onVerDetalle,
  onCambiarEstado,
  onVerCliente,
}: {
  turno: Turno
  clienteNombre: string
  obraDesc: string
  onVerDetalle: () => void
  onCambiarEstado: (estado: EstadoTurno) => void
  onVerCliente: () => void
}) {
  const fecha = new Date(turno.fecha + 'T12:00:00')
  const fechaStr = `${DIA_SEMANA_CORTO[fecha.getDay()]} ${fecha.getDate()}/${fecha.getMonth() + 1}`

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset text-xs font-bold',
            ESTADO_TURNO_COLOR[turno.estado],
          )}
        >
          {turno.hora}:00
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onVerCliente}
              className="min-h-11 max-w-full truncate text-left text-sm font-semibold hover:underline"
            >
              {clienteNombre}
            </button>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                ESTADO_TURNO_COLOR[turno.estado],
              )}
            >
              {ESTADO_TURNO_LABEL[turno.estado]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {fechaStr} · {obraDesc}
          </p>
        </div>
        <Button
          variant="ghost"
          size="default"
          className="shrink-0"
          onClick={onVerDetalle}
        >
          Ver
        </Button>
      </div>

      {/* Acciones rápidas de estado */}
      {turno.estado !== 'entregado' && turno.estado !== 'cancelado' && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/30 pt-2">
          <span className="text-[10px] text-muted-foreground mr-1">
            Cambiar a:
          </span>
          {turno.estado === 'pendiente' && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 text-xs"
              onClick={() => onCambiarEstado('en-fabrica')}
            >
              <PlayCircle className="size-3" />
              En fábrica
            </Button>
          )}
          {turno.estado === 'en-fabrica' && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 text-xs"
              onClick={() => onCambiarEstado('listo')}
            >
              <CheckCircle2 className="size-3" />
              Listo
            </Button>
          )}
          {turno.estado === 'listo' && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 text-xs"
              onClick={() => onCambiarEstado('entregado')}
            >
              <Truck className="size-3" />
              Entregado
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-11 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onCambiarEstado('cancelado')}
          >
            <XCircle className="size-3" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}

function TurnoDetalleModal({
  turno,
  clienteNombre,
  obraDesc,
  onClose,
  onCambiarEstado,
  onMover,
  onEliminar,
  onVerCliente,
  turnoOcupado,
}: {
  turno: Turno | null
  clienteNombre: string
  obraDesc: string
  onClose: () => void
  onCambiarEstado: (estado: EstadoTurno) => void
  onMover: (fecha: string, hora: number) => void
  onEliminar: () => void
  onVerCliente: () => void
  turnoOcupado: (fecha: string, hora: number, excluirId?: string) => boolean
}) {
  const [editando, setEditando] = React.useState(false)
  const [nuevaFecha, setNuevaFecha] = React.useState('')
  const [nuevaHora, setNuevaHora] = React.useState(8)

  React.useEffect(() => {
    if (turno) {
      setEditando(false)
      setNuevaFecha(turno.fecha)
      setNuevaHora(turno.hora)
    }
  }, [turno])

  if (!turno) return null

  function handleGuardarMovimiento() {
    if (turnoOcupado(nuevaFecha, nuevaHora, turno!.id)) {
      toast.error('Ese turno ya está ocupado.')
      return
    }
    onMover(nuevaFecha, nuevaHora)
    setEditando(false)
  }

  return (
    <Dialog open={!!turno} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            Detalle del turno
          </DialogTitle>
          <DialogDescription>
            {turno.hora}:00 hs · {turno.fecha.split('-').reverse().join('/')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <button
                onClick={onVerCliente}
                className="font-medium hover:underline"
              >
                {clienteNombre}
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Obra</span>
              <span className="font-medium truncate ml-2 max-w-[60%] text-right">
                {obraDesc}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span
                className={cn('font-medium', ESTADO_TURNO_COLOR[turno.estado])}
              >
                {ESTADO_TURNO_LABEL[turno.estado]}
              </span>
            </div>
          </div>

          {/* Cambiar fecha/hora */}
          {editando ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="nueva-fecha" className="text-xs">
                    Nueva fecha
                  </Label>
                  <Input
                    id="nueva-fecha"
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Nueva hora</Label>
                  <Select
                    value={String(nuevaHora)}
                    onValueChange={(v) => setNuevaHora(Number(v))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HORAS_TURNO.map((h) => {
                        const ocupado = turnoOcupado(nuevaFecha, h, turno.id)
                        return (
                          <SelectItem
                            key={h}
                            value={String(h)}
                            disabled={ocupado}
                          >
                            {h}:00 {ocupado && '(ocupado)'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleGuardarMovimiento}
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setEditando(true)}
              disabled={
                turno.estado === 'entregado' || turno.estado === 'cancelado'
              }
            >
              <ArrowRightLeft className="size-3.5" />
              Mover turno
            </Button>
          )}

          {/* Cambiar estado */}
          {turno.estado !== 'entregado' && turno.estado !== 'cancelado' && (
            <div className="grid grid-cols-2 gap-2">
              {turno.estado === 'pendiente' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCambiarEstado('en-fabrica')}
                >
                  <PlayCircle className="size-3.5" />
                  En fábrica
                </Button>
              )}
              {turno.estado === 'en-fabrica' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCambiarEstado('listo')}
                >
                  <CheckCircle2 className="size-3.5" />
                  Listo
                </Button>
              )}
              {turno.estado === 'listo' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCambiarEstado('entregado')}
                >
                  <Truck className="size-3.5" />
                  Entregado
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => onCambiarEstado('cancelado')}
              >
                <XCircle className="size-3.5" />
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onEliminar}
          >
            <Trash2 className="size-3.5" />
            Eliminar turno
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AgendaFabricaPage
