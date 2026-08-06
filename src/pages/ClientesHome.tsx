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
  PackageOpen,
  UserPlus,
  Users,
  Wallet,
  Receipt,
  FileClock,
  CheckCircle2,
  ArrowUpDown,
  Clock,
  AlertTriangle,
  Share2,
  UserCog,
  Store,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useClientes, useObras, usePagos, useUsers } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { useNuevoClienteModal } from '@/hooks/use-nuevo-cliente-modal'
import {
  calcularTotalesObra,
  estadoDeSaldo,
  formatWhatsApp,
  normalizarTexto,
  normalizarWhatsApp,
  diasHastaVencimiento,
  esVenta,
} from '@/lib/obra-totales'
import type { Cliente, EstadoPago, Obra, Pago, User } from '@/lib/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'
import { RegistrarPagoModal } from '@/components/lebaux/obras/RegistrarPagoModal'
import { WhatsAppIcon } from '@/components/ui/icons/WhatsAppIcon'

interface Props {
  onVerCliente: (clienteId: string) => void
}

interface ResumenCliente {
  cliente: Cliente
  cantidadObras: number
  /** Suma de saldoPendiente solo de ventas confirmadas (ver `esVenta()`
   * en obra-totales). Los presupuestos sin aceptar no cuentan acá: son
   * ventas posibles, no deuda real. */
  saldoTotal: number
  estadoPeor: EstadoPago
  /** Tiene al menos una venta confirmada (estadoPresupuesto='aceptado'). */
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
type FiltroTab =
  | 'todos'
  | 'deuda'
  | 'ventas'
  | 'presupuestos'
  | 'saldados'
  | 'mayoristas'

const TABS: { id: FiltroTab; label: string; icon: React.ElementType }[] = [
  { id: 'todos', label: 'Todos', icon: Users },
  { id: 'deuda', label: 'Con deuda', icon: Wallet },
  { id: 'ventas', label: 'Ventas', icon: Receipt },
  { id: 'presupuestos', label: 'Presupuestos', icon: FileClock },
  { id: 'saldados', label: 'Saldados', icon: CheckCircle2 },
  { id: 'mayoristas', label: 'Mayoristas', icon: Store },
]

/**
 * Filtro de vendedor (solo admin): permite ver todos los clientes, solo
 * los propios del admin, los de un vendedor puntual, o los que no tienen
 * propietario asignado (legacy). Se filtra siempre por PROPIETARIO
 * (vendedorId), no por compartidoCon — si un cliente fue compartido con
 * otro vendedor, eso se indica aparte con una etiqueta "Compartido con…"
 * en la card, pero no mueve al cliente de "dueño" para este filtro.
 */
type FiltroVendedorId = 'todos' | 'sin-asignar' | string // string = user id

const FILTRO_VENDEDOR_TODOS: FiltroVendedorId = 'todos'
const FILTRO_VENDEDOR_SIN_ASIGNAR: FiltroVendedorId = 'sin-asignar'

/** Orden configurable de la lista. */
type OrdenTab = 'estado' | 'nombre' | 'deuda' | 'reciente'

const ORDENES: { id: OrdenTab; label: string }[] = [
  { id: 'estado', label: 'Estado (deuda primero)' },
  { id: 'nombre', label: 'Nombre (A-Z)' },
  { id: 'deuda', label: 'Mayor deuda' },
  { id: 'reciente', label: 'Más reciente' },
]

export function ClientesHome({ onVerCliente }: Props) {
  // TanStack Query: datos del servidor
  const { data: clientes = [], isLoading: loadingClientes } = useClientes()
  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [] } = useObras(clienteIds)
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [] } = usePagos(obraIds)

  const currentUser = useAuthStore((s) => s.currentUser)
  const esAdmin = currentUser?.rol === 'admin'
  // La lista de usuarios solo se pide si es admin: es lo único que la
  // necesita (para armar el selector "Vendedor"); un vendedor normal no
  // gana nada con este fetch extra.
  const { data: allUsers = [] } = useUsers()
  const vendedores = React.useMemo(
    () => allUsers.filter((u: User) => u.rol === 'vendedor'),
    [allUsers],
  )

  const ajustesSistema =
    useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
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

  // Orden de la lista, también en la URL (?orden=deuda) por si se quiere
  // compartir o volver con el mismo orden aplicado.
  const ordenParam = searchParams.get('orden')
  const ordenTab: OrdenTab = (
    ORDENES.some((o) => o.id === ordenParam) ? ordenParam : 'estado'
  ) as OrdenTab

  const setOrdenTab = (next: OrdenTab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'estado') {
      params.delete('orden')
    } else {
      params.set('orden', next)
    }
    setSearchParams(params, { replace: true })
  }

  // Filtro de vendedor (solo admin), también en la URL (?vend=<id-de-un-
  // vendedor-o-del-admin>, o ?vend=sin-asignar). No aplica para un
  // vendedor normal: su propia lista ya viene recortada por RLS.
  const vendParam = searchParams.get('vend')
  const filtroVendedor: FiltroVendedorId = !esAdmin
    ? FILTRO_VENDEDOR_TODOS
    : vendParam === FILTRO_VENDEDOR_SIN_ASIGNAR
      ? FILTRO_VENDEDOR_SIN_ASIGNAR
      : vendParam &&
          (vendParam === currentUser?.id ||
            vendedores.some((v) => v.id === vendParam))
        ? vendParam
        : FILTRO_VENDEDOR_TODOS

  const setFiltroVendedor = (next: FiltroVendedorId) => {
    const params = new URLSearchParams(searchParams)
    if (next === FILTRO_VENDEDOR_TODOS) {
      params.delete('vend')
    } else {
      params.set('vend', next)
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
        // Saldo y estado de deuda: solo sobre ventas confirmadas
        // (estadoPresupuesto='aceptado'). Un presupuesto todavía no
        // aceptado es una venta posible, no una deuda real — no debe
        // sumar acá aunque matemáticamente "calcularTotalesObra" le
        // devuelva un saldoPendiente igual a su total (nunca tuvo pagos).
        if (esVenta(o)) {
          saldoTotal += totales.saldoPendiente
          const est = estadoDeSaldo(
            totales.saldoPendiente,
            totales.totalConDescuento,
          )
          if (ordenEstado[est] < ordenEstado[estadoPeor]) {
            estadoPeor = est
          }
          if (totales.saldoPendiente > 0) {
            obrasConSaldo.push({ obra: o, pagosObra })
          }
          tieneVenta = true
        }
        // "Presupuesto": cotización todavía esperando respuesta del cliente.
        if (o.tipo === 'presupuesto' && o.estadoPresupuesto === 'pendiente') {
          tienePresupuestoPendiente = true
          const dias = diasHastaVencimiento(o, diasAutoRechazo)
          if (
            dias !== undefined &&
            (diasVencimientoMin === undefined || dias < diasVencimientoMin)
          ) {
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
      const obraParaPago =
        obrasConSaldo.length === 1 ? obrasConSaldo[0].obra : undefined
      const pagosObraParaPago =
        obrasConSaldo.length === 1 ? obrasConSaldo[0].pagosObra : []

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
      case 'mayoristas':
        return r.cliente.isMayorista
      case 'todos':
      default:
        return true
    }
  }, [])

  /** Un resumen de cliente pasa (o no) el filtro de vendedor propietario.
   * Siempre filtra por PROPIETARIO (vendedorId), nunca por compartidoCon —
   * ver comentario en el tipo FiltroVendedorId más arriba. */
  const pasaFiltroVendedor = React.useCallback(
    (r: ResumenCliente) => {
      if (!esAdmin || filtroVendedor === FILTRO_VENDEDOR_TODOS) return true
      if (filtroVendedor === FILTRO_VENDEDOR_SIN_ASIGNAR)
        return !r.cliente.vendedorId
      return r.cliente.vendedorId === filtroVendedor
    },
    [esAdmin, filtroVendedor],
  )

  /* ─── Conteo por tab (para el numerito, como "no leídos" de WhatsApp) ───
   * Respeta el filtro de vendedor activo, para que los números tengan
   * sentido cuando el admin está viendo la lista de un vendedor puntual. */
  const conteos = React.useMemo(() => {
    const base: Record<FiltroTab, number> = {
      todos: 0,
      deuda: 0,
      ventas: 0,
      presupuestos: 0,
      saldados: 0,
      mayoristas: 0,
    }
    for (const r of resumenClientes) {
      if (!pasaFiltroVendedor(r)) continue
      base.todos++
      if (pasaTab(r, 'deuda')) base.deuda++
      if (pasaTab(r, 'ventas')) base.ventas++
      if (pasaTab(r, 'presupuestos')) base.presupuestos++
      if (pasaTab(r, 'saldados')) base.saldados++
      if (pasaTab(r, 'mayoristas')) base.mayoristas++
    }
    return base
  }, [resumenClientes, pasaTab, pasaFiltroVendedor])

  /** Conteo de clientes por vendedor (propietario), para mostrar el
   * numerito al lado de cada nombre en el selector. Ignora la tab de
   * estado activa (siempre cuenta el total de esa cartera). */
  const conteosPorVendedor = React.useMemo(() => {
    const mapa = new Map<string, number>()
    let sinAsignar = 0
    for (const c of clientes) {
      if (!c.vendedorId) {
        sinAsignar++
        continue
      }
      mapa.set(c.vendedorId, (mapa.get(c.vendedorId) ?? 0) + 1)
    }
    return { porId: mapa, sinAsignar, total: clientes.length }
  }, [clientes])

  /** Texto mostrado en el botón del selector de vendedor. */
  const filtroVendedorLabel = React.useMemo(() => {
    if (filtroVendedor === FILTRO_VENDEDOR_TODOS) return 'Todos los vendedores'
    if (filtroVendedor === FILTRO_VENDEDOR_SIN_ASIGNAR) return 'Sin asignar'
    if (filtroVendedor === currentUser?.id) return 'Mis clientes'
    return (
      vendedores.find((v) => v.id === filtroVendedor)?.nombre ??
      'Todos los vendedores'
    )
  }, [filtroVendedor, currentUser, vendedores])

  const comparador = React.useCallback(
    (a: ResumenCliente, b: ResumenCliente): number => {
      const ordenEstado: Record<EstadoPago, number> = {
        debe: 0,
        pagado: 1,
        'sin-datos': 2,
      }
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
    },
    [ordenTab],
  )

  /* ─── Búsqueda por nombre o WhatsApp + tab activa + vendedor + orden ─── */
  const filtrados = React.useMemo(() => {
    const q = normalizarTexto(busqueda)
    return resumenClientes
      .filter((r) => {
        if (!pasaFiltroVendedor(r)) return false
        if (!pasaTab(r, tab)) return false
        if (!q) return true
        if (normalizarTexto(r.cliente.nombre).includes(q)) return true
        // Búsqueda por WhatsApp también
        const digits = busqueda.replace(/\D/g, '')
        if (digits && r.cliente.telefonoWhatsApp.includes(digits)) return true
        return false
      })
      .sort(comparador)
  }, [resumenClientes, busqueda, tab, pasaTab, pasaFiltroVendedor, comparador])

  const { abrirNuevoCliente, modalNuevoCliente } = useNuevoClienteModal(
    (cliente) => onVerCliente(cliente.id),
  )

  // Modal de "Registrar pago" disparado desde el swipe de una card.
  const [pagoRapido, setPagoRapido] = React.useState<{
    obra: Obra
    pagos: Pago[]
  } | null>(null)

  return (
    <AppLayout
      onNuevoCliente={abrirNuevoCliente}
      mainClassName="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-4 py-2"
      withBottomBar
      reserveBottomSpace={false}
    >
      <div className="min-w-0 shrink-0 pb-3">
        <div>
          <div className="min-h-0 overflow-hidden">
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
              Clientes
            </h2>
          </div>
        </div>

        {/* Los controles quedan fuera del área desplazable. Solo la lista
          inferior hace scroll, así ninguna card puede atravesarlos. */}
        <div className="mt-3 space-y-2">
          <div className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border/70 bg-card/85 px-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="size-4" aria-hidden="true" />
            </span>
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o número de WhatsApp"
              aria-label="Buscar clientes por nombre o WhatsApp"
              className="h-10 flex-1 border-0 bg-transparent px-1 text-base shadow-none hover:border-0 focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0 sm:text-sm"
              autoComplete="off"
            />
            <span
              className="shrink-0 rounded-full bg-muted/70 px-2 py-1 text-[11px] font-semibold text-muted-foreground"
              aria-live="polite"
              aria-label={`${filtrados.length} resultados`}
            >
              {filtrados.length}
            </span>
            {busqueda && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 text-muted-foreground"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          {esAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 w-full justify-start gap-2 px-3 text-xs sm:text-sm"
                  aria-label="Filtrar clientes por vendedor"
                >
                  <UserCog
                    className="size-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 text-left truncate">
                    {filtroVendedorLabel}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem
                  onClick={() => setFiltroVendedor(FILTRO_VENDEDOR_TODOS)}
                  className={cn(
                    filtroVendedor === FILTRO_VENDEDOR_TODOS &&
                      'text-primary font-medium',
                  )}
                >
                  Todos
                  <span className="ml-auto text-xs text-muted-foreground money">
                    {conteosPorVendedor.total}
                  </span>
                </DropdownMenuItem>
                {currentUser && (
                  <DropdownMenuItem
                    onClick={() => setFiltroVendedor(currentUser.id)}
                    className={cn(
                      filtroVendedor === currentUser.id &&
                        'text-primary font-medium',
                    )}
                  >
                    Mis clientes
                    <span className="ml-auto text-xs text-muted-foreground money">
                      {conteosPorVendedor.porId.get(currentUser.id) ?? 0}
                    </span>
                  </DropdownMenuItem>
                )}
                {vendedores
                  .filter((v) => v.id !== currentUser?.id)
                  .map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => setFiltroVendedor(v.id)}
                      className={cn(
                        filtroVendedor === v.id && 'text-primary font-medium',
                      )}
                    >
                      <span className="truncate">{v.nombre}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground money">
                        {conteosPorVendedor.porId.get(v.id) ?? 0}
                      </span>
                    </DropdownMenuItem>
                  ))}
                {conteosPorVendedor.sinAsignar > 0 && (
                  <DropdownMenuItem
                    onClick={() =>
                      setFiltroVendedor(FILTRO_VENDEDOR_SIN_ASIGNAR)
                    }
                    className={cn(
                      filtroVendedor === FILTRO_VENDEDOR_SIN_ASIGNAR &&
                        'text-primary font-medium',
                    )}
                  >
                    Sin asignar
                    <span className="ml-auto text-xs text-muted-foreground money">
                      {conteosPorVendedor.sinAsignar}
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div
            className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none"
            role="tablist"
            aria-label="Filtrar clientes"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const activo = tab === id
              const count = conteos[id]
              return (
                <Button
                  key={id}
                  variant={activo ? 'default' : 'outline'}
                  size="sm"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setTab(id)}
                  className={cn(
                    'h-11 shrink-0 rounded-full px-3.5 py-2 text-xs font-medium whitespace-nowrap',
                    activo
                      ? id === 'deuda'
                        ? 'bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/20 hover:text-destructive'
                        : ''
                      : 'bg-card/60 text-muted-foreground hover:bg-elevated hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold money',
                        activo
                          ? 'bg-black/15'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Lista */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-1 sm:px-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
              Clientes
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {filtrados.length} de {clientes.length}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ordenar clientes"
                  className="h-11 gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground sm:w-auto sm:px-3"
                >
                  <ArrowUpDown className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {ORDENES.find((o) => o.id === ordenTab)?.label}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ORDENES.map((o) => (
                  <DropdownMenuItem
                    key={o.id}
                    onClick={() => setOrdenTab(o.id)}
                    className={cn(
                      ordenTab === o.id && 'text-primary font-medium',
                    )}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {loadingClientes ? (
            <div className="grid gap-2">
              <ClienteCardSkeleton />
              <ClienteCardSkeleton />
              <ClienteCardSkeleton />
            </div>
          ) : clientes.length === 0 ? (
            <EmptyState onNuevo={abrirNuevoCliente} />
          ) : filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm leading-6 text-muted-foreground">
              {tab !== 'todos' || filtroVendedor !== FILTRO_VENDEDOR_TODOS
                ? `Ningún cliente en "${TABS.find((t) => t.id === tab)?.label}"${
                    filtroVendedor !== FILTRO_VENDEDOR_TODOS
                      ? ` (${filtroVendedorLabel})`
                      : ''
                  } coincide con la búsqueda.`
                : 'No se encontraron clientes con esa búsqueda.'}
            </p>
          ) : (
            <div className="grid gap-2">
              {filtrados.map((resumen) => (
                <ClienteCard
                  key={resumen.cliente.id}
                  resumen={resumen}
                  prefijoWhatsApp={prefijoWhatsApp}
                  esAdmin={esAdmin}
                  onVerCliente={onVerCliente}
                />
              ))}
            </div>
          )}
        </div>
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
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-40 rounded" />
      </div>
      <Skeleton className="size-4 shrink-0 rounded" />
    </div>
  )
}

/**
 * ClienteCard — tarjeta compacta para la lista de clientes.
 *
 * Mantiene el acceso directo al detalle del cliente y, cuando aplica,
 * refleja visualmente si tiene deuda o presupuesto pendiente.
 */
function ClienteCard({
  resumen,
  prefijoWhatsApp,
  esAdmin,
  onVerCliente,
}: {
  resumen: ResumenCliente
  prefijoWhatsApp: string
  esAdmin: boolean
  onVerCliente: (clienteId: string) => void
}) {
  const {
    cliente,
    cantidadObras,
    estadoPeor,
    tienePresupuestoPendiente,
    diasVencimientoMin,
  } = resumen

  const tieneWhatsApp = normalizarWhatsApp(cliente.telefonoWhatsApp).length > 0
  const iniciales =
    cliente.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0]?.toUpperCase() ?? '')
      .join('') || 'C'

  const tonoAccento =
    estadoPeor === 'debe'
      ? 'bg-destructive'
      : estadoPeor === 'pagado'
        ? 'bg-emerald-500'
        : 'bg-amber-500'

  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-px shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <Button
        variant="ghost"
        onClick={() => onVerCliente(cliente.id)}
        className="group flex h-auto w-full min-w-0 items-start justify-start overflow-hidden whitespace-normal rounded-[calc(0.75rem-1px)] bg-background/90 p-0 text-left transition-all hover:bg-card/90"
      >
        <div
          className={cn(
            'ml-3 h-10 w-1 shrink-0 rounded-full self-center',
            tonoAccento,
          )}
        />
        <div className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4">
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/70 text-sm font-semibold text-foreground',
              estadoPeor === 'debe' &&
                'border-destructive/70 ring-2 ring-destructive/20',
            )}
          >
            <span
              className={cn(
                'flex size-full items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground',
              )}
            >
              {iniciales}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold leading-5 text-foreground sm:text-[15px]">
                    {cliente.nombre}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[13px] leading-5 text-muted-foreground">
                  {tieneWhatsApp ? (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <WhatsAppIcon className="size-4 shrink-0" />
                      <span className="truncate">
                        {formatWhatsApp(
                          cliente.telefonoWhatsApp,
                          prefijoWhatsApp,
                        ) || '—'}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">Sin número</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <PackageOpen className="size-3.5" aria-hidden="true" />
                    {cantidadObras} {cantidadObras === 1 ? 'obra' : 'obras'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {cliente.isMayorista && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Store className="size-3" aria-hidden="true" />
                  Mayorista
                </span>
              )}
              {tienePresupuestoPendiente &&
                diasVencimientoMin !== undefined && (
                  <VencimientoBadge dias={diasVencimientoMin} />
                )}
              {esAdmin && cliente.compartidoCon.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Share2 className="size-3 shrink-0" aria-hidden="true" />
                  Compartido
                </span>
              )}
            </div>
          </div>
        </div>
      </Button>
    </div>
  )
}

/** Chip de aviso cuando un presupuesto pendiente está por vencer (auto-
 * rechazo). Solo se muestra si vence pronto o ya venció, para no sumar
 * ruido visual a presupuestos con margen todavía. */
function VencimientoBadge({ dias }: { dias: number }) {
  if (dias > 3) return null
  const vencido = dias < 0
  const label = vencido
    ? 'Vencido'
    : dias === 0
      ? 'Vence hoy'
      : `Vence en ${dias}d`
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
      <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
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
