/**
 * pages/ClientesHome.tsx — Lista simple de clientes.
 *
 * Estructura:
 *   1. Header con botón Nuevo cliente
 *   2. Buscador por nombre o WhatsApp
 *   3. Lista de clientes en cards con avatar + WhatsApp + saldo total
 *
 * El dashboard con KPIs vive en DashboardPage, no acá.
 */
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  MessageCircle,
  ChevronRight,
  PackageOpen,
  UserPlus,
  Users,
  Wallet,
  Receipt,
  FileClock,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClientes, useObras, usePagos } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { useNuevoClienteModal } from '@/hooks/use-nuevo-cliente-modal'
import {
  calcularTotalesObra,
  estadoDeSaldo,
  formatMoney,
  formatWhatsApp,
  normalizarTexto,
} from '@/lib/obra-totales'
import type { Cliente, EstadoPago } from '@/lib/types'
import { EstadoBadge } from '@/components/lebaux/clientes/EstadoBadge'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClientAvatar } from '@/components/shared/ClientAvatar'
import { cn } from '@/lib/utils'

interface Props {
  onVerCliente: (clienteId: string) => void
  onVolver: () => void
}

interface ResumenCliente {
  cliente: Cliente
  cantidadObras: number
  saldoTotal: number
  estadoPeor: EstadoPago
  /** Tiene al menos una obra tipo 'venta' (presupuesto aceptado o venta directa). */
  tieneVenta: boolean
  /** Tiene al menos un presupuesto pendiente de respuesta. */
  tienePresupuestoPendiente: boolean
}

/** Tabs estilo WhatsApp para filtrar la lista de clientes. */
type FiltroTab = 'todos' | 'deuda' | 'ventas' | 'presupuestos' | 'saldados'

const TABS: { id: FiltroTab; label: string; icon: React.ElementType }[] = [
  { id: 'todos', label: 'Todos', icon: Users },
  { id: 'deuda', label: 'Con deuda', icon: Wallet },
  { id: 'ventas', label: 'Ventas', icon: Receipt },
  { id: 'presupuestos', label: 'Presupuestos', icon: FileClock },
  { id: 'saldados', label: 'Saldados', icon: CheckCircle2 },
]

export function ClientesHome({ onVerCliente, onVolver }: Props) {
  // TanStack Query: datos del servidor
  const { data: clientes = [], isLoading: loadingClientes } = useClientes()
  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [] } = useObras(clienteIds)
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [] } = usePagos(obraIds)

  const prefijoWhatsApp =
    useAjustes(null).data?.sistema.prefijoWhatsApp ??
    AJUSTES_DEFAULT.sistema.prefijoWhatsApp
  const [busqueda, setBusqueda] = React.useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab activa, derivada de la URL (?tab=deuda) para poder linkear desde
  // afuera (ej. el KPI "Saldo" del Dashboard) ya filtrado. Compatibilidad:
  // el link viejo del Dashboard usa ?filtro=deuda, lo seguimos soportando.
  const tabParam =
    searchParams.get('tab') ??
    (searchParams.get('filtro') === 'deuda' ? 'deuda' : null)
  const tab: FiltroTab = (
    TABS.some((t) => t.id === tabParam) ? tabParam : 'todos'
  ) as FiltroTab

  const setTab = (next: FiltroTab) => {
    const params = new URLSearchParams(searchParams)
    params.delete('filtro')
    if (next === 'todos') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    setSearchParams(params, { replace: true })
  }

  /* ─── Resumen por cliente ─── */
  const resumenClientes = React.useMemo<ResumenCliente[]>(() => {
    const ordenEstado: Record<EstadoPago, number> = {
      debe: 0,
      pagado: 1,
      'sin-datos': 2,
    }
    return clientes
      .map((cliente) => {
        const obrasCliente = obras.filter((o) => o.clienteId === cliente.id)
        let saldoTotal = 0
        let estadoPeor: EstadoPago = 'sin-datos'
        let tieneVenta = false
        let tienePresupuestoPendiente = false
        for (const o of obrasCliente) {
          const pagosObra = pagos.filter((p) => p.obraId === o.id)
          const totales = calcularTotalesObra(o, pagosObra)
          saldoTotal += totales.saldoPendiente
          const est = estadoDeSaldo(
            totales.saldoPendiente,
            totales.totalConDescuento,
          )
          if (ordenEstado[est] < ordenEstado[estadoPeor]) {
            estadoPeor = est
          }
          // "Venta": obra tipo venta directa, o presupuesto ya aceptado.
          if (
            (o.tipo ?? 'venta') === 'venta' ||
            o.estadoPresupuesto === 'aceptado'
          ) {
            tieneVenta = true
          }
          // "Presupuesto": cotización todavía esperando respuesta del cliente.
          if (o.tipo === 'presupuesto' && o.estadoPresupuesto === 'pendiente') {
            tienePresupuestoPendiente = true
          }
        }
        return {
          cliente,
          cantidadObras: obrasCliente.length,
          saldoTotal,
          estadoPeor,
          tieneVenta,
          tienePresupuestoPendiente,
        }
      })
      .sort((a, b) => {
        const ea = ordenEstado[a.estadoPeor]
        const eb = ordenEstado[b.estadoPeor]
        if (ea !== eb) return ea - eb
        return a.cliente.nombre.localeCompare(b.cliente.nombre)
      })
  }, [clientes, obras, pagos])

  /** Un resumen de cliente pasa (o no) una tab, independiente de la búsqueda. */
  const pasaTab = React.useCallback((r: ResumenCliente, t: FiltroTab) => {
    switch (t) {
      case 'deuda':
        return r.estadoPeor === 'debe'
      case 'ventas':
        return r.tieneVenta
      case 'presupuestos':
        return r.tienePresupuestoPendiente
      case 'saldados':
        return r.estadoPeor === 'pagado'
      case 'todos':
      default:
        return true
    }
  }, [])

  /* ─── Conteo por tab (para el numerito, como "no leídos" de WhatsApp) ─── */
  const conteos = React.useMemo(() => {
    const base: Record<FiltroTab, number> = {
      todos: resumenClientes.length,
      deuda: 0,
      ventas: 0,
      presupuestos: 0,
      saldados: 0,
    }
    for (const r of resumenClientes) {
      if (pasaTab(r, 'deuda')) base.deuda++
      if (pasaTab(r, 'ventas')) base.ventas++
      if (pasaTab(r, 'presupuestos')) base.presupuestos++
      if (pasaTab(r, 'saldados')) base.saldados++
    }
    return base
  }, [resumenClientes, pasaTab])

  /* ─── Búsqueda por nombre o WhatsApp + tab activa ─── */
  const filtrados = React.useMemo(() => {
    const q = normalizarTexto(busqueda)
    return resumenClientes.filter((r) => {
      if (!pasaTab(r, tab)) return false
      if (!q) return true
      if (normalizarTexto(r.cliente.nombre).includes(q)) return true
      // Búsqueda por WhatsApp también
      const digits = busqueda.replace(/\D/g, '')
      if (digits && r.cliente.telefonoWhatsApp.includes(digits)) return true
      return false
    })
  }, [resumenClientes, busqueda, tab, pasaTab])

  const { abrirNuevoCliente, modalNuevoCliente } = useNuevoClienteModal(
    (cliente) => onVerCliente(cliente.id),
  )

  return (
    <AppLayout
      title="Clientes"
      subtitle={`${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`}
      onBack={onVolver}
      onNuevoCliente={abrirNuevoCliente}
      mainClassName="flex-1 min-h-0 overflow-y-auto max-w-5xl w-full mx-auto px-4 py-5 space-y-4 pb-20"
      withBottomBar
    >
      {/* Buscador + tabs: sticky arriba del main scrolleable, estilo WhatsApp */}
      <div className="sticky -top-5 z-10 -mx-4 px-4 pt-5 -mb-1 bg-background space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o WhatsApp…"
            aria-label="Buscar clientes por nombre o WhatsApp"
            className="h-11 pl-10 text-base sm:text-sm"
            autoComplete="off"
          />
        </div>

        {/* Tabs estilo WhatsApp: Todos / Con deuda / Ventas / Presupuestos / Saldados */}
        <div
          className="flex gap-2 overflow-x-auto pb-3 scrollbar-none"
          role="tablist"
          aria-label="Filtrar clientes"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const activo = tab === id
            const count = conteos[id]
            return (
              <button
                key={id}
                role="tab"
                aria-selected={activo}
                onClick={() => setTab(id)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                  activo
                    ? id === 'deuda'
                      ? 'bg-destructive/15 border-destructive/40 text-destructive'
                      : 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card/60 border-border/60 text-muted-foreground hover:bg-elevated hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold money',
                      activo ? 'bg-black/15' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Clientes
          </h2>
          <span className="text-xs text-muted-foreground money">
            {filtrados.length} de {clientes.length}
          </span>
        </div>

        {loadingClientes ? (
          <div className="grid gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState onNuevo={abrirNuevoCliente} />
        ) : filtrados.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            {tab !== 'todos'
              ? `Ningún cliente en "${TABS.find((t) => t.id === tab)?.label}" coincide con la búsqueda.`
              : 'No se encontraron clientes con esa búsqueda.'}
          </p>
        ) : (
          <div className="grid gap-2">
            {filtrados.map(
              ({ cliente, cantidadObras, saldoTotal, estadoPeor }) => (
                <button
                  key={cliente.id}
                  onClick={() => onVerCliente(cliente.id)}
                  className="text-left rounded-xl active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:bg-card hover:shadow-md dark:bg-card/50 dark:hover:bg-card/80 transition-all">
                    <ClientAvatar
                      nombre={cliente.nombre}
                      size="md"
                      alert={estadoPeor === 'debe'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate font-display">
                          {cliente.nombre}
                        </span>
                        <EstadoBadge
                          estado={estadoPeor}
                          saldoPendiente={saldoTotal}
                          size="sm"
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MessageCircle
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {formatWhatsApp(
                              cliente.telefonoWhatsApp,
                              prefijoWhatsApp,
                            ) || '—'}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <PackageOpen className="size-3" aria-hidden="true" />
                          {cantidadObras}{' '}
                          {cantidadObras === 1 ? 'obra' : 'obras'}
                        </span>
                      </div>
                      {saldoTotal > 0 && (
                        <p className="mt-1.5 money text-base font-semibold text-destructive">
                          ${formatMoney(saldoTotal)}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground uppercase tracking-wider">
                            saldo
                          </span>
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              ),
            )}
          </div>
        )}
      </section>
      {modalNuevoCliente}
    </AppLayout>
  )
}

function EmptyState({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto size-20 rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center mb-5">
        <UserPlus className="size-9 text-primary" aria-hidden="true" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">
        Sin clientes todavía
      </h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
        Creá tu primer cliente para empezar a cargar obras, generar presupuestos
        y registrar pagos.
      </p>
      <Button onClick={onNuevo} size="lg" className="px-6">
        <Plus className="size-4" />
        Registrar primer cliente
      </Button>
    </div>
  )
}
