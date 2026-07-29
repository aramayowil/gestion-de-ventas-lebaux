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
import { Receipt, FileText, ChevronRight, Calendar } from 'lucide-react'
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
  onVolver: () => void
  onVerCliente: (id: string) => void
}

type Tab = 'presupuestos' | 'pagos'

export function RegistrosPage({ onVolver, onVerCliente }: Props) {
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

  return (
    <AppLayout
      title="Registros"
      subtitle="Historial de presupuestos y pagos"
      onBack={onVolver}
      mainClassName="flex-1 min-h-0 overflow-y-auto max-w-5xl w-full mx-auto px-4 py-5 space-y-4 pb-20"
      withBottomBar
    >
        {/* Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-muted/50 border border-border/60 backdrop-blur-sm">
          <button
            onClick={() => setTab('presupuestos')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'presupuestos'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-4" />
            Presupuestos
            <span className="text-[11px] text-muted-foreground">({obras.length})</span>
          </button>
          <button
            onClick={() => setTab('pagos')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'pagos'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Receipt className="size-4" />
            Pagos
            <span className="text-[11px] text-muted-foreground">({pagos.length})</span>
          </button>
        </div>

        {/* Buscador + filtros */}
        <div className="space-y-2">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de cliente…"
            aria-label="Buscar registros por cliente"
            className="h-11"
          />
          {tab === 'presupuestos' && (
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltroEstado(e)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
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
                  onClick={() => onVerCliente(cliente.id)}
                  className="text-left rounded-xl active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:bg-card hover:shadow-md dark:bg-card/50 dark:hover:bg-card/80 transition-all">
                    <ClientAvatar
                      nombre={cliente.nombre}
                      size="md"
                      alert={obra.estadoPresupuesto === 'rechazado' || (diasVenc !== undefined && diasVenc < 0)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate font-display">
                          {cliente.nombre}
                        </span>
                        <EstadoPresupuestoBadge estado={obra.estadoPresupuesto} size="sm" />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" aria-hidden="true" />
                          {formatFechaCorta(obra.fecha)}
                        </span>
                        <span className="money">
                          Total: ${formatMoney(totales.totalConDescuento)}
                        </span>
                        {obra.estadoPresupuesto === 'pendiente' && diasVenc !== undefined && (
                          <span className={cn(
                            'inline-flex items-center gap-1',
                            diasVenc < 0 ? 'text-destructive' : 'text-muted-foreground',
                          )}>
                            {diasVenc > 0
                              ? `Vence en ${diasVenc}d`
                              : diasVenc === 0
                                ? 'Vence hoy'
                                : 'Vencido'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
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
              <div
                key={pago.id}
                className={cn(
                  'flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm dark:bg-card/50',
                  pago.anulado && 'opacity-60',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Receipt className="size-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cliente && (
                      <button
                        onClick={() => onVerCliente(cliente.id)}
                        className="font-semibold truncate font-display hover:text-primary"
                      >
                        {cliente.nombre}
                      </button>
                    )}
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
              </div>
            ))}
          </div>
        )}
    </AppLayout>
  )
}
