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
  ArrowUpDown,
  Clock,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  normalizarWhatsApp,
  diasHastaVencimiento,
} from '@/lib/obra-totales'
import type { Cliente, EstadoPago, Obra, Pago } from '@/lib/types'
import { EstadoBadge } from '@/components/lebaux/clientes/EstadoBadge'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClientAvatar } from '@/components/shared/ClientAvatar'
import { cn } from '@/lib/utils'
import { RegistrarPagoModal } from '@/components/lebaux/obras/RegistrarPagoModal'

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
  /** Días hasta que venza el presupuesto pendiente más urgente (undefined si no hay). */
  diasVencimientoMin?: number
  /** Última fecha de actividad (alta de obra más reciente), para ordenar por "recientes". */
  ultimaActividad: number
  /**
   * Única obra con saldo pendiente, si existe una sola. Habilita el swipe
   * "Registrar pago" directo desde la lista sin pasar por el detalle —
   * si el cliente tiene más de una obra con saldo, queda undefined y el
   * swipe lleva al detalle en su lugar (evita adivinar cuál cobrar).
   */
  obraParaPago?: Obra
  pagosObraParaPago: Pago[]
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

/** Orden configurable de la lista. */
type OrdenTab = 'estado' | 'nombre' | 'deuda' | 'reciente'

const ORDENES: { id: OrdenTab; label: string }[] = [
  { id: 'estado', label: 'Estado (deuda primero)' },
  { id: 'nombre', label: 'Nombre (A-Z)' },
  { id: 'deuda', label: 'Mayor deuda' },
  { id: 'reciente', label: 'Más reciente' },
]

export function ClientesHome({ onVerCliente, onVolver }: Props) {
  // TanStack Query: datos del servidor
  const { data: clientes = [], isLoading: loadingClientes } = useClientes()
  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [] } = useObras(clienteIds)
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [] } = usePagos(obraIds)

  const ajustesSistema = useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const prefijoWhatsApp = ajustesSistema.prefijoWhatsApp
  const diasAutoRechazo = ajustesSistema.diasAutoRechazo

  // Búsqueda persistida en sessionStorage: si el vendedor entra al detalle
  // de un cliente desde una búsqueda filtrada y vuelve, no quiere perder
  // lo que había tipeado (React state se resetea al desmontar la página).
  const [busqueda, setBusqueda] = React.useState(
    () => sessionStorage.getItem('clientes-home:busqueda') ?? '',
  )
  React.useEffect(() => {
    if (busqueda) {
      sessionStorage.setItem('clientes-home:busqueda', busqueda)
    } else {
      sessionStorage.removeItem('clientes-home:busqueda')
    }
  }, [busqueda])

  const [searchParams, setSearchParams] = useSearchParams()

  // Tab activa, derivada de la URL (?tab=deuda) para poder linkear desde
  // afuera (ej. el KPI "Saldo" del Dashboard) ya filtrado. Compatibilidad:
  // el link viejo del Dashboard usa ?filtro=deuda, lo seguimos soportando.
  const tabParam = searchParams.get('tab') ?? (searchParams.get('filtro') === 'deuda' ? 'deuda' : null)
  const tab: FiltroTab = (TABS.some((t) => t.id === tabParam) ? tabParam : 'todos') as FiltroTab

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

  // Orden de la lista, también en la URL (?orden=deuda) por si se quiere
  // compartir o volver con el mismo orden aplicado.
  const ordenParam = searchParams.get('orden')
  const ordenTab: OrdenTab = (ORDENES.some((o) => o.id === ordenParam) ? ordenParam : 'estado') as OrdenTab

  const setOrdenTab = (next: OrdenTab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'estado') {
      params.delete('orden')
    } else {
      params.set('orden', next)
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
    return clientes.map((cliente) => {
      const obrasCliente = obras.filter((o) => o.clienteId === cliente.id)
      let saldoTotal = 0
      let estadoPeor: EstadoPago = 'sin-datos'
      let tieneVenta = false
      let tienePresupuestoPendiente = false
      let diasVencimientoMin: number | undefined
      let ultimaActividad = 0
      const obrasConSaldo: { obra: Obra; pagosObra: Pago[] }[] = []

      for (const o of obrasCliente) {
        const pagosObra = pagos.filter((p) => p.obraId === o.id)
        const totales = calcularTotalesObra(o, pagosObra)
        saldoTotal += totales.saldoPendiente
        const est = estadoDeSaldo(totales.saldoPendiente, totales.totalConDescuento)
        if (ordenEstado[est] < ordenEstado[estadoPeor]) {
          estadoPeor = est
        }
        if (totales.saldoPendiente > 0) {
          obrasConSaldo.push({ obra: o, pagosObra })
        }
        // "Venta": obra tipo venta directa, o presupuesto ya aceptado.
        if ((o.tipo ?? 'venta') === 'venta' || o.estadoPresupuesto === 'aceptado') {
          tieneVenta = true
        }
        // "Presupuesto": cotización todavía esperando respuesta del cliente.
        if (o.tipo === 'presupuesto' && o.estadoPresupuesto === 'pendiente') {
          tienePresupuestoPendiente = true
          const dias = diasHastaVencimiento(o, diasAutoRechazo)
          if (dias !== undefined && (diasVencimientoMin === undefined || dias < diasVencimientoMin)) {
            diasVencimientoMin = dias
          }
        }
        const fechaObra = new Date(o.creadoEn).getTime()
        if (!Number.isNaN(fechaObra) && fechaObra > ultimaActividad) {
          ultimaActividad = fechaObra
        }
      }

      // Swipe "Registrar pago" solo si hay una única obra con saldo —
      // con más de una, no adivinamos cuál cobrar, se va al detalle.
      const obraParaPago = obrasConSaldo.length === 1 ? obrasConSaldo[0].obra : undefined
      const pagosObraParaPago = obrasConSaldo.length === 1 ? obrasConSaldo[0].pagosObra : []

      return {
        cliente,
        cantidadObras: obrasCliente.length,
        saldoTotal,
        estadoPeor,
        tieneVenta,
        tienePresupuestoPendiente,
        diasVencimientoMin,
        ultimaActividad,
        obraParaPago,
        pagosObraParaPago,
      }
    })
  }, [clientes, obras, pagos, diasAutoRechazo])

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

  const comparador = React.useCallback((a: ResumenCliente, b: ResumenCliente): number => {
    const ordenEstado: Record<EstadoPago, number> = { debe: 0, pagado: 1, 'sin-datos': 2 }
    switch (ordenTab) {
      case 'nombre':
        return a.cliente.nombre.localeCompare(b.cliente.nombre)
      case 'deuda':
        if (b.saldoTotal !== a.saldoTotal) return b.saldoTotal - a.saldoTotal
        return a.cliente.nombre.localeCompare(b.cliente.nombre)
      case 'reciente':
        return b.ultimaActividad - a.ultimaActividad
      case 'estado':
      default: {
        const ea = ordenEstado[a.estadoPeor]
        const eb = ordenEstado[b.estadoPeor]
        if (ea !== eb) return ea - eb
        return a.cliente.nombre.localeCompare(b.cliente.nombre)
      }
    }
  }, [ordenTab])

  /* ─── Búsqueda por nombre o WhatsApp + tab activa + orden ─── */
  const filtrados = React.useMemo(() => {
    const q = normalizarTexto(busqueda)
    return resumenClientes
      .filter((r) => {
        if (!pasaTab(r, tab)) return false
        if (!q) return true
        if (normalizarTexto(r.cliente.nombre).includes(q)) return true
        // Búsqueda por WhatsApp también
        const digits = busqueda.replace(/\D/g, '')
        if (digits && r.cliente.telefonoWhatsApp.includes(digits)) return true
        return false
      })
      .sort(comparador)
  }, [resumenClientes, busqueda, tab, pasaTab, comparador])

  const { abrirNuevoCliente, modalNuevoCliente } = useNuevoClienteModal(
    (cliente) => onVerCliente(cliente.id),
  )

  // Modal de "Registrar pago" disparado desde el swipe de una card.
  const [pagoRapido, setPagoRapido] = React.useState<{ obra: Obra; pagos: Pago[] } | null>(null)

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
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase shrink-0">
              Clientes
            </h2>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground money shrink-0">
                {filtrados.length} de {clientes.length}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Ordenar clientes"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors shrink-0"
                  >
                    <ArrowUpDown className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {ORDENES.find((o) => o.id === ordenTab)?.label}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ORDENES.map((o) => (
                    <DropdownMenuItem
                      key={o.id}
                      onClick={() => setOrdenTab(o.id)}
                      className={cn(ordenTab === o.id && 'text-primary font-medium')}
                    >
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {loadingClientes ? (
            <div className="grid gap-2">
              <ClienteCardSkeleton />
              <ClienteCardSkeleton />
              <ClienteCardSkeleton />
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
              {filtrados.map((resumen) => (
                <ClienteCard
                  key={resumen.cliente.id}
                  resumen={resumen}
                  prefijoWhatsApp={prefijoWhatsApp}
                  onVerCliente={onVerCliente}
                  onRegistrarPago={(obra, pagosObra) =>
                    setPagoRapido({ obra, pagos: pagosObra })
                  }
                />
              ))}
            </div>
          )}
        </section>
      {modalNuevoCliente}
      {pagoRapido && (
        <RegistrarPagoModal
          open
          onClose={() => setPagoRapido(null)}
          obra={pagoRapido.obra}
          pagos={pagoRapido.pagos}
        />
      )}
    </AppLayout>
  )
}

/** Skeleton fiel a la silueta real de ClienteCard (avatar + 2 líneas +
 * chevron), para que el salto al terminar de cargar sea menos brusco
 * que con barras genéricas. */
function ClienteCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/60 bg-card/60">
      <Skeleton className="size-12 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-40 rounded" />
      </div>
      <Skeleton className="size-4 rounded shrink-0" />
    </div>
  )
}

/**
 * ClienteCard — card de cliente con swipe-to-action estilo WhatsApp.
 *
 * Deslizar hacia la izquierda revela dos acciones rápidas detrás de la
 * card: WhatsApp (abre el chat directo) y Registrar pago (si el cliente
 * tiene una única obra con saldo pendiente — con más de una no se
 * adivina cuál cobrar, esa acción no aparece y hay que entrar al
 * detalle). Tocar la card sin deslizar sigue llevando al detalle, igual
 * que antes.
 *
 * Implementado con Pointer Events nativos (sin librería de gestos): se
 * seguía el criterio del resto del proyecto de no sumar dependencias
 * para algo que se resuelve con ~40 líneas. El gesto solo se activa si
 * el movimiento es predominantemente horizontal, para no robarle el
 * scroll vertical a la lista.
 */
const SWIPE_ACTION_WIDTH = 72 // px por acción revelada
const SWIPE_OPEN_THRESHOLD = 56 // px arrastrados para quedar "abierto"

function ClienteCard({
  resumen,
  prefijoWhatsApp,
  onVerCliente,
  onRegistrarPago,
}: {
  resumen: ResumenCliente
  prefijoWhatsApp: string
  onVerCliente: (clienteId: string) => void
  onRegistrarPago: (obra: Obra, pagosObra: Pago[]) => void
}) {
  const {
    cliente,
    cantidadObras,
    saldoTotal,
    estadoPeor,
    tienePresupuestoPendiente,
    diasVencimientoMin,
    obraParaPago,
    pagosObraParaPago,
  } = resumen

  const tieneWhatsApp = normalizarWhatsApp(cliente.telefonoWhatsApp).length > 0
  const accionesDisponibles = (tieneWhatsApp ? 1 : 0) + (obraParaPago ? 1 : 0)
  const maxOffset = SWIPE_ACTION_WIDTH * accionesDisponibles

  const [offset, setOffset] = React.useState(0)
  const drag = React.useRef<{
    startX: number
    startY: number
    startOffset: number
    axis: 'none' | 'x' | 'y'
  } | null>(null)

  const cerrar = React.useCallback(() => setOffset(0), [])

  function handlePointerDown(e: React.PointerEvent) {
    if (accionesDisponibles === 0) return
    drag.current = { startX: e.clientX, startY: e.clientY, startOffset: offset, axis: 'none' }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY

    if (drag.current.axis === 'none') {
      // Recién determinamos el eje del gesto cuando se movió lo suficiente,
      // para no confundir un tap con un swipe.
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      drag.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (drag.current.axis !== 'x') return

    e.currentTarget.setPointerCapture(e.pointerId)
    const next = drag.current.startOffset - dx
    setOffset(Math.min(maxOffset, Math.max(0, next)))
  }

  function handlePointerUp() {
    if (!drag.current) return
    if (drag.current.axis === 'x') {
      setOffset((current) => (current > SWIPE_OPEN_THRESHOLD ? maxOffset : 0))
    }
    drag.current = null
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Acciones reveladas detrás de la card */}
      {accionesDisponibles > 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {obraParaPago && (
            <button
              type="button"
              onClick={() => {
                cerrar()
                onRegistrarPago(obraParaPago, pagosObraParaPago)
              }}
              aria-label={`Registrar pago de ${cliente.nombre}`}
              className="flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground transition-colors hover:brightness-110"
              style={{ width: SWIPE_ACTION_WIDTH }}
            >
              <DollarSign className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">Cobrar</span>
            </button>
          )}
          {tieneWhatsApp && (
            <button
              type="button"
              onClick={() => {
                cerrar()
                const numero = prefijoWhatsApp + normalizarWhatsApp(cliente.telefonoWhatsApp)
                window.open(`https://wa.me/${numero}`, '_blank', 'noopener,noreferrer')
              }}
              aria-label={`Abrir WhatsApp de ${cliente.nombre}`}
              className="flex flex-col items-center justify-center gap-1 bg-[#25D366] text-white transition-colors hover:brightness-110"
              style={{ width: SWIPE_ACTION_WIDTH }}
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">WhatsApp</span>
            </button>
          )}
        </div>
      )}

      {/* Card, desplazada por el swipe */}
      <button
        onClick={() => (offset > 0 ? cerrar() : onVerCliente(cliente.id))}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative text-left w-full rounded-xl active:scale-[0.99] transition-transform touch-pan-y"
        style={{
          transform: `translateX(${-offset}px)`,
          transition: drag.current ? 'none' : 'transform 200ms ease-out',
        }}
      >
        <div
          className={cn(
            'flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all',
            offset > 0
              ? 'shadow-none'
              : 'hover:border-primary/40 hover:bg-card hover:shadow-md dark:bg-card/50 dark:hover:bg-card/80',
          )}
        >
          <ClientAvatar nombre={cliente.nombre} size="md" alert={estadoPeor === 'debe'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate font-display">{cliente.nombre}</span>
              <EstadoBadge estado={estadoPeor} saldoPendiente={saldoTotal} size="sm" />
              {tienePresupuestoPendiente && diasVencimientoMin !== undefined && (
                <VencimientoBadge dias={diasVencimientoMin} />
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1 min-w-0">
                <MessageCircle className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {formatWhatsApp(cliente.telefonoWhatsApp, prefijoWhatsApp) || '—'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <PackageOpen className="size-3" aria-hidden="true" />
                {cantidadObras} {cantidadObras === 1 ? 'obra' : 'obras'}
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
          <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        </div>
      </button>
    </div>
  )
}

/** Chip de aviso cuando un presupuesto pendiente está por vencer (auto-
 * rechazo). Solo se muestra si vence pronto o ya venció, para no sumar
 * ruido visual a presupuestos con margen todavía. */
function VencimientoBadge({ dias }: { dias: number }) {
  if (dias > 3) return null
  const vencido = dias < 0
  const label = vencido ? 'Vencido' : dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        vencido
          ? 'bg-destructive/15 text-destructive'
          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      )}
    >
      <Clock className="size-2.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function EmptyState({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto size-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center mb-5">
        <UserPlus className="size-9 text-primary" aria-hidden="true" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">Sin clientes todavía</h3>
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
