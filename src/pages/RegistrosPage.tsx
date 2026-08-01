/**
 * pages/RegistrosPage.tsx — Historial de presupuestos y pagos.
 *
 * Estructura:
 *   1. Header con volver
 *   2. Tabs: Presupuestos | Pagos
 *   3. Lista filtrada por estado (presupuestos) o por fecha (pagos)
 */
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Receipt,
  FileText,
  ChevronRight,
  Calendar,
  Search,
  Clock3,
  CircleDollarSign,
  Ban,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/input'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { ClientAvatar } from '@/components/shared/ClientAvatar'
import { useClientes, useObras, usePagos } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaCorta,
  normalizarTexto,
  diasHastaVencimiento,
} from '@/lib/obra-totales'
import type { EstadoPresupuesto } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  onVerCliente: (id: string) => void
}

type Tab = 'presupuestos' | 'pagos'

export function RegistrosPage({ onVerCliente }: Props) {
  // TanStack Query
  const { data: clientes = [], isLoading: cargandoClientes } = useClientes()
  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [], isLoading: cargandoObras } = useObras(clienteIds)
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [], isLoading: cargandoPagos } = usePagos(obraIds)
  const cargandoRegistros = cargandoClientes || cargandoObras || cargandoPagos
  const diasAutoRechazo = useAjustes(null).data?.sistema.diasAutoRechazo ?? AJUSTES_DEFAULT.sistema.diasAutoRechazo

  const [searchParams, setSearchParams] = useSearchParams()
  const [busqueda, setBusqueda] = React.useState('')

  const ESTADOS_VALIDOS: EstadoPresupuesto[] = ['borrador', 'pendiente', 'aceptado', 'rechazado']

  // Estado derivado de la URL en vez de useState propio: así los KPIs del
  // Dashboard pueden linkear directo a /registros?tab=pagos o
  // /registros?estado=pendiente, ya filtrado, sin duplicar lógica de filtros.
  const tab: Tab = searchParams.get('tab') === 'pagos' ? 'pagos' : 'presupuestos'
  const estadoParam = searchParams.get('estado')
  const filtroEstado: EstadoPresupuesto | 'todos' =
    estadoParam && (ESTADOS_VALIDOS as string[]).includes(estadoParam)
      ? (estadoParam as EstadoPresupuesto)
      : 'todos'

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams)
    if (next === 'presupuestos') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  function setFiltroEstado(next: EstadoPresupuesto | 'todos') {
    const params = new URLSearchParams(searchParams)
    if (next === 'todos') params.delete('estado')
    else params.set('estado', next)
    setSearchParams(params, { replace: true })
  }

  /* Filtrado de presupuestos */
  const presupuestosFiltrados = React.useMemo(() => {
    const q = normalizarTexto(busqueda)
    return obras
      .filter((o) => {
        const cliente = clientes.find((c) => c.id === o.clienteId)
        if (!cliente) return false
        if (filtroEstado !== 'todos' && o.estadoPresupuesto !== filtroEstado) {
          return false
        }
        if (q && !normalizarTexto(cliente.nombre).includes(q)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
      )
      .map((o) => ({
        obra: o,
        cliente: clientes.find((c) => c.id === o.clienteId)!,
        totales: calcularTotalesObra(o, pagos.filter((p) => p.obraId === o.id)),
        diasVenc: diasHastaVencimiento(o, diasAutoRechazo),
      }))
  }, [obras, clientes, pagos, filtroEstado, busqueda, diasAutoRechazo])

  /* Pagos ordenados por fecha desc (incluye anulados para auditoría) */
  const pagosListado = React.useMemo(() => {
    const q = normalizarTexto(busqueda)
    return pagos
      .filter((p) => {
        const obra = obras.find((o) => o.id === p.obraId)
        const cliente = obra ? clientes.find((c) => c.id === obra.clienteId) : null
        if (!cliente) return false
        if (q && !normalizarTexto(cliente.nombre).includes(q)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      )
      .slice(0, 100)
      .map((p) => ({
        pago: p,
        cliente: (() => {
          const o = obras.find((x) => x.id === p.obraId)
          return o ? clientes.find((c) => c.id === o.clienteId) : null
        })(),
      }))
  }, [pagos, obras, clientes, busqueda])

  const ESTADOS: (EstadoPresupuesto | 'todos')[] = ['todos', 'borrador', 'pendiente', 'aceptado', 'rechazado']

  const resumenPresupuestos = React.useMemo(() => {
    let pendientes = 0
    let aceptados = 0
    let valorAceptado = 0

    for (const obra of obras) {
      if (obra.estadoPresupuesto === 'pendiente') pendientes++
      if (obra.estadoPresupuesto === 'aceptado') {
        aceptados++
        const totales = calcularTotalesObra(
          obra,
          pagos.filter((pago) => pago.obraId === obra.id),
        )
        valorAceptado += totales.incluyeIva
          ? totales.totalConIva
          : totales.totalConDescuento
      }
    }

    return { pendientes, aceptados, valorAceptado }
  }, [obras, pagos])

  const resumenPagos = React.useMemo(() => {
    let cobrados = 0
    let vigentes = 0
    let anulados = 0

    for (const pago of pagos) {
      if (pago.anulado) {
        anulados++
      } else {
        vigentes++
        cobrados += pago.monto
      }
    }

    return { cobrados, vigentes, anulados }
  }, [pagos])

  return (
    <AppLayout
      mainClassName="flex-1 min-h-0 overflow-y-auto max-w-5xl w-full mx-auto px-4 py-5 space-y-4 pb-20"
      withBottomBar
    >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Historial comercial
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">Registros</h2>
          <p className="text-sm text-muted-foreground">
            Consultá presupuestos, ventas y movimientos de dinero.
          </p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 rounded-xl border border-border/60 bg-muted/40 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setTab('presupuestos')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              tab === 'presupuestos'
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/40'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-4" />
            Presupuestos
            <span className="text-[11px] text-muted-foreground">({obras.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pagos')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              tab === 'pagos'
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/40'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Receipt className="size-4" />
            Pagos
            <span className="text-[11px] text-muted-foreground">({pagos.length})</span>
          </button>
        </div>

        {/* Resumen contextual: solo las cifras que ayudan a decidir qué revisar. */}
        {tab === 'presupuestos' ? (
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-card/45">
            <ResumenDato label="Pendientes" value={String(resumenPresupuestos.pendientes)} icon={<Clock3 />} tone="warning" />
            <ResumenDato label="Aceptados" value={String(resumenPresupuestos.aceptados)} icon={<FileText />} />
            <ResumenDato label="Valor ventas" value={`$${formatMoney(resumenPresupuestos.valorAceptado)}`} icon={<CircleDollarSign />} tone="success" />
          </div>
        ) : (
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-card/45">
            <ResumenDato label="Cobrado" value={`$${formatMoney(resumenPagos.cobrados)}`} icon={<CircleDollarSign />} tone="success" />
            <ResumenDato label="Recibos" value={String(resumenPagos.vigentes)} icon={<Receipt />} />
            <ResumenDato label="Anulados" value={String(resumenPagos.anulados)} icon={<Ban />} tone="danger" />
          </div>
        )}

        {/* Buscador + filtros */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar registros por cliente"
              className="h-11 pl-9"
              autoComplete="off"
            />
          </div>
          {tab === 'presupuestos' && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setFiltroEstado(e)}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                    filtroEstado === e
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card/60 text-muted-foreground border-border/60 hover:bg-elevated hover:text-foreground',
                  )}
                >
                  {e === 'todos' ? 'Todos' : <EstadoPresupuestoBadge estado={e} size="sm" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Listado */}
        {cargandoRegistros ? (
          <div className="grid gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : tab === 'presupuestos' ? (
          presupuestosFiltrados.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No hay presupuestos que coincidan con la búsqueda.
            </p>
          ) : (
            <div className="grid gap-2">
              {presupuestosFiltrados.map(({ obra, cliente, totales, diasVenc }) => (
                <button
                  key={obra.id}
                  type="button"
                  onClick={() => onVerCliente(cliente.id)}
                  className="rounded-xl text-left transition-transform active:scale-[0.99]"
                >
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md dark:bg-card/50 dark:hover:bg-card/80">
                    <div className="flex items-start gap-3 p-3 sm:p-4">
                      <ClientAvatar
                        nombre={cliente.nombre}
                        size="md"
                        alert={obra.estadoPresupuesto === 'rechazado' || (diasVenc !== undefined && diasVenc < 0)}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-display font-semibold">
                          {cliente.nombre}
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <EstadoPresupuestoBadge estado={obra.estadoPresupuesto} size="sm" />
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3" aria-hidden="true" />
                            {formatFechaCorta(obra.fecha)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="money text-base font-bold">
                          ${formatMoney(totales.incluyeIva ? totales.totalConIva : totales.totalConDescuento)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>

                    {(obra.estadoPresupuesto === 'aceptado' || obra.estadoPresupuesto === 'pendiente') && (
                      <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border/40 bg-muted/15 px-3 text-xs">
                        {obra.estadoPresupuesto === 'aceptado' ? (
                          <>
                            <span className="text-muted-foreground">Saldo pendiente</span>
                            <span className={cn('money font-semibold', totales.saldoPendiente > 0 ? 'text-destructive' : 'text-success')}>
                              {totales.saldoPendiente > 0 ? `$${formatMoney(totales.saldoPendiente)}` : 'Pagado'}
                            </span>
                          </>
                        ) : diasVenc !== undefined ? (
                          <>
                            <span className="text-muted-foreground">Vigencia</span>
                            <span className={cn('font-semibold', diasVenc <= 0 ? 'text-destructive' : 'text-foreground')}>
                              {diasVenc > 0 ? `Vence en ${diasVenc} días` : diasVenc === 0 ? 'Vence hoy' : 'Vencido'}
                            </span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : pagosListado.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No hay pagos registrados.
          </p>
        ) : (
          <div className="grid gap-2">
            {pagosListado.map(({ pago, cliente }) => (
              <button
                key={pago.id}
                type="button"
                onClick={() => cliente && onVerCliente(cliente.id)}
                className={cn(
                  'flex min-h-20 w-full items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 text-left backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-card sm:p-4 dark:bg-card/50',
                  pago.anulado && 'opacity-60',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Receipt className="size-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cliente && <span className="truncate font-display font-semibold">{cliente.nombre}</span>}
                    <span className="text-xs text-muted-foreground">
                      Recibo N° {String(pago.numeroRecibo).padStart(4, '0')}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" aria-hidden="true" />
                      {formatFechaCorta(pago.fecha)}
                    </span>
                    {pago.formaPago && <span>· {pago.formaPago}</span>}
                    {pago.anulado && (
                      <span className="text-destructive">· Anulado</span>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    'money text-base font-semibold shrink-0',
                    pago.anulado ? 'text-muted-foreground line-through' : 'text-success',
                  )}
                >
                  ${formatMoney(pago.monto)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
    </AppLayout>
  )
}

function ResumenDato({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="min-w-0 border-l border-border/50 px-2 py-3 first:border-l-0 sm:px-4">
      <div
        className={cn(
          'mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-amber-700 dark:text-amber-400',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="money truncate text-sm font-bold sm:text-base" title={value}>
        {value}
      </p>
    </div>
  )
}
