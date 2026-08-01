/**
 * pages/DashboardPage.tsx — Dashboard con KPIs y visualizaciones.
 *
 * Estructura:
 *   1. Header con botón volver
 *   2. Hero: título + fecha
 *   3. Banda de 4 KPIs (clientes, obras activas, saldo, cobrado mes)
 *   4. Grid 2-col: cobranza (donut + bars) + alertas de deuda
 *   5. Presupuestos por estado (contadores rápidos)
 *
 * Importante: todos los totales financieros (facturado, cobrado, saldo,
 * deudores, ranking de vendedores) se calculan SOLO sobre ventas
 * confirmadas (`esVenta()`, es decir `estadoPresupuesto === 'aceptado'`).
 * Un presupuesto todavía no aceptado es una venta posible, no una venta
 * real, y no debe inflar estos números — aunque su campo `tipo` siga
 * siendo 'presupuesto' en la base. La única sección que sí cuenta todos
 * los estados es "Presupuestos por estado", que es puramente informativa
 * sobre el embudo de ventas.
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  PackageCheck,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  CalendarRange,
  ShoppingCart,
  Banknote,
  Calculator,
  CircleDollarSign,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { KpiCard } from '@/components/ui/kpi-card'
import {
  DebtAlerts,
  type Deudor,
} from '@/components/lebaux/dashboard/DebtAlerts'
import {
  BarsChart,
  DonutProgress,
  type BarDatum,
} from '@/components/ui/mini-chart'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import {
  AJUSTES_DEFAULT,
  useAjustes,
  useClientes,
  useObras,
  usePagos,
  useUsers,
} from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'
import type { Cliente, User } from '@/lib/types'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaLarga,
  esVenta,
} from '@/lib/obra-totales'
import type { EstadoPresupuesto } from '@/lib/types'

type PeriodoAnalitica = 'hoy' | 'semana' | 'mes' | 'personalizado'

const PERIODOS_ANALITICA: { value: PeriodoAnalitica; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'personalizado', label: 'Rango' },
]

function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function inicioDelMesActual(): string {
  const hoy = new Date()
  return fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
}

function formatearFechaRango(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-')
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fechaISO
}

interface Props {
  onVerCliente: (id: string) => void
}

export function DashboardPage({ onVerCliente }: Props) {
  const navigate = useNavigate()
  const [periodoAnalitica, setPeriodoAnalitica] =
    React.useState<PeriodoAnalitica>('mes')
  const [fechaDesde, setFechaDesde] = React.useState(inicioDelMesActual)
  const [fechaHasta, setFechaHasta] = React.useState(() =>
    fechaLocalISO(new Date()),
  )
  const { data: todosClientes = [], isLoading: cargandoClientes } =
    useClientes()
  const currentUser = useAuthStore((s) => s.currentUser)
  const { data: allUsers = [], isLoading: cargandoUsers } = useUsers()
  const vendedores = React.useMemo(
    () => allUsers.filter((u: User) => u.rol === 'vendedor'),
    [allUsers],
  )

  // Filtrar clientes según rol
  const clientes = React.useMemo(() => {
    if (!currentUser) return []
    if (currentUser.rol === 'admin') return todosClientes
    return todosClientes.filter(
      (c: Cliente) =>
        c.vendedorId === currentUser.id ||
        (c.compartidoCon && c.compartidoCon.includes(currentUser.id)),
    )
  }, [todosClientes, currentUser])

  const clienteIds = React.useMemo(
    () => clientes.map((c: Cliente) => c.id),
    [clientes],
  )
  const { data: todasObras = [], isLoading: cargandoObras } =
    useObras(clienteIds)
  const obras = React.useMemo(
    () => todasObras.filter((o) => clienteIds.includes(o.clienteId)),
    [todasObras, clienteIds],
  )
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [], isLoading: cargandoPagos } = usePagos(obraIds)
  const { data: ajustes = AJUSTES_DEFAULT, isLoading: cargandoAjustes } =
    useAjustes(null)
  const ivaConfig = React.useMemo(
    () => ({
      ivaBasePct: ajustes.sistema.ivaBasePct,
      ivaPorLinea: ajustes.sistema.ivaPorLinea,
    }),
    [ajustes.sistema.ivaBasePct, ajustes.sistema.ivaPorLinea],
  )

  // Un solo flag: mientras falte cualquiera de los 4 datasets, mostramos
  // skeletons en vez de calcular KPIs con datos parciales.
  const cargandoDashboard =
    cargandoClientes ||
    cargandoUsers ||
    cargandoObras ||
    cargandoPagos ||
    cargandoAjustes

  /* Obras que ya son ventas confirmadas (presupuesto aceptado, o venta
   * directa aceptada). Los presupuestos que todavía no se aceptaron son
   * posibles ventas, no ventas reales: no deben sumar en los totales
   * financieros del Dashboard. */
  const ventas = React.useMemo(() => obras.filter(esVenta), [obras])

  /* KPIs — solo sobre ventas, nunca sobre presupuestos sin aceptar. */
  const kpis = React.useMemo(() => {
    let totalFacturado = 0
    let totalAbonado = 0
    let totalSaldo = 0
    let obrasActivas = 0

    for (const o of ventas) {
      const pagosObra = pagos.filter((p) => p.obraId === o.id)
      const t = calcularTotalesObra(o, pagosObra, ivaConfig)
      totalFacturado += t.incluyeIva ? t.totalConIva : t.totalConDescuento
      totalAbonado += t.totalAbonado
      totalSaldo += t.saldoPendiente
      if (t.saldoPendiente > 0) obrasActivas++
    }

    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const cobradoEsteMes = pagos
      .filter(
        (p) =>
          !p.anulado &&
          new Date(p.fecha) >= inicioMes &&
          new Date(p.fecha) <= ahora,
      )
      .reduce((acc, p) => acc + (p.monto || 0), 0)

    return {
      totalFacturado,
      totalAbonado,
      totalSaldo,
      cobradoEsteMes,
      obrasActivas,
    }
  }, [ventas, pagos, ivaConfig])

  const rangoAnalitica = React.useMemo(() => {
    if (periodoAnalitica === 'personalizado') {
      return { desde: fechaDesde, hasta: fechaHasta }
    }

    const hoy = new Date()
    const hasta = fechaLocalISO(hoy)

    if (periodoAnalitica === 'hoy') return { desde: hasta, hasta }

    if (periodoAnalitica === 'semana') {
      const inicioSemana = new Date(hoy)
      const dia = inicioSemana.getDay()
      inicioSemana.setDate(inicioSemana.getDate() - (dia === 0 ? 6 : dia - 1))
      return { desde: fechaLocalISO(inicioSemana), hasta }
    }

    return {
      desde: fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta,
    }
  }, [periodoAnalitica, fechaDesde, fechaHasta])

  const analiticaPeriodo = React.useMemo(() => {
    const rangoValido = rangoAnalitica.desde <= rangoAnalitica.hasta
    if (!rangoValido) {
      return {
        ventas: 0,
        vendido: 0,
        cobrado: 0,
        ticketPromedio: 0,
        rangoValido,
      }
    }

    function estaDentro(fecha: string): boolean {
      const dia = fecha.slice(0, 10)
      return dia >= rangoAnalitica.desde && dia <= rangoAnalitica.hasta
    }

    const ventasDelPeriodo = ventas.filter((obra) =>
      estaDentro(obra.aceptadoEn ?? obra.fecha),
    )

    let vendido = 0
    for (const obra of ventasDelPeriodo) {
      const pagosObra = pagos.filter((pago) => pago.obraId === obra.id)
      const totales = calcularTotalesObra(obra, pagosObra, ivaConfig)
      vendido += totales.incluyeIva
        ? totales.totalConIva
        : totales.totalConDescuento
    }

    const cobrado = pagos
      .filter((pago) => !pago.anulado && estaDentro(pago.fecha))
      .reduce((total, pago) => total + pago.monto, 0)

    return {
      ventas: ventasDelPeriodo.length,
      vendido,
      cobrado,
      ticketPromedio:
        ventasDelPeriodo.length > 0 ? vendido / ventasDelPeriodo.length : 0,
      rangoValido,
    }
  }, [ventas, pagos, ivaConfig, rangoAnalitica])

  /* Deudores — saldo pendiente solo de ventas confirmadas. */
  const deudores = React.useMemo<Deudor[]>(() => {
    const map = new Map<string, number>()
    for (const o of ventas) {
      const pagosObra = pagos.filter((p) => p.obraId === o.id)
      const t = calcularTotalesObra(o, pagosObra, ivaConfig)
      if (t.saldoPendiente > 0) {
        map.set(o.clienteId, (map.get(o.clienteId) ?? 0) + t.saldoPendiente)
      }
    }
    return clientes
      .map((c) => ({ cliente: c, saldo: map.get(c.id) ?? 0 }))
      .filter((d) => d.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
  }, [clientes, ventas, pagos, ivaConfig])

  /* Pagos por mes (últimos 6) */
  const pagosPorMes = React.useMemo<BarDatum[]>(() => {
    const nombresMes = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ]
    const ahora = new Date()
    const out: BarDatum[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const mes = d.getMonth()
      const anio = d.getFullYear()
      const total = pagos
        .filter((p) => {
          if (p.anulado) return false
          const fp = new Date(p.fecha)
          return fp.getMonth() === mes && fp.getFullYear() === anio
        })
        .reduce((acc, p) => acc + (p.monto || 0), 0)
      out.push({ label: nombresMes[mes], value: Math.round(total) })
    }
    return out
  }, [pagos])

  /* Progreso de cobranza */
  const progresoCobranza = React.useMemo(() => {
    if (kpis.totalFacturado <= 0) return 0
    return kpis.totalAbonado / kpis.totalFacturado
  }, [kpis])

  /* Presupuestos por estado */
  const presupuestosPorEstado = React.useMemo(() => {
    const counts: Record<EstadoPresupuesto, number> = {
      borrador: 0,
      pendiente: 0,
      aceptado: 0,
      rechazado: 0,
    }
    for (const o of obras) counts[o.estadoPresupuesto]++
    return counts
  }, [obras])

  return (
    <AppLayout withBottomBar>
      {/* Encabezado: contexto breve antes de los números. */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Resumen comercial
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Panel de gestión
        </h2>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">
          {formatFechaLarga(new Date().toISOString())}
        </p>
      </section>

      {cargandoDashboard ? (
        <div className="space-y-5">
          {/* Skeleton de los 4 KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          {/* Skeleton de cobranza + alertas */}
          <Skeleton className="h-56 w-full rounded-2xl" />
          {/* Skeleton de presupuestos por estado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section
            aria-label="Indicadores principales"
            className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
          >
            <KpiCard
              label="Cobrado este mes"
              value={`$${formatMoney(kpis.cobradoEsteMes)}`}
              subtexto="Ingresos registrados"
              icon={TrendingUp}
              tone="success"
              className="col-span-2 sm:col-span-1"
              onClick={() => navigate('/registros?tab=pagos')}
            />
            <KpiCard
              label="Saldo pendiente"
              value={`$${formatMoney(kpis.totalSaldo)}`}
              subtexto={
                deudores.length > 0
                  ? `${deudores.length} deudores`
                  : 'Todo al día'
              }
              icon={Wallet}
              tone={kpis.totalSaldo > 0 ? 'danger' : 'success'}
              className="col-span-2 sm:col-span-1"
              onClick={
                deudores.length > 0
                  ? () => navigate('/clientes?filtro=deuda')
                  : undefined
              }
            />
            <KpiCard
              label="Clientes"
              value={String(clientes.length)}
              subtexto={`${deudores.length} con saldo`}
              icon={Users}
              tone="gold"
              onClick={() => navigate('/clientes')}
            />
            <KpiCard
              label="Ventas con saldo"
              value={String(kpis.obrasActivas)}
              subtexto={`${ventas.length} ventas confirmadas`}
              icon={PackageCheck}
              tone="muted"
              onClick={() => navigate('/registros?estado=aceptado')}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/55 backdrop-blur-sm">
            <div className="border-b border-border/50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <CalendarRange className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">
                    Analítica por período
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ventas y cobranzas entre fechas específicas
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 rounded-xl border border-border/60 bg-muted/35 p-1">
                {PERIODOS_ANALITICA.map((periodo) => (
                  <button
                    key={periodo.value}
                    type="button"
                    onClick={() => setPeriodoAnalitica(periodo.value)}
                    className={cn(
                      'min-h-11 rounded-lg px-2 text-xs font-medium transition-colors sm:text-sm',
                      periodoAnalitica === periodo.value
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-border/40'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {periodo.label}
                  </button>
                ))}
              </div>

              {periodoAnalitica === 'personalizado' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="analitica-desde" className="text-xs">
                      Desde
                    </Label>
                    <Input
                      id="analitica-desde"
                      type="date"
                      value={fechaDesde}
                      max={fechaHasta}
                      onChange={(event) => setFechaDesde(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="analitica-hasta" className="text-xs">
                      Hasta
                    </Label>
                    <Input
                      id="analitica-hasta"
                      type="date"
                      value={fechaHasta}
                      min={fechaDesde}
                      onChange={(event) => setFechaHasta(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 bg-muted/15 px-4 py-2 text-xs text-muted-foreground">
              <span>Período analizado</span>
              <span className="font-medium text-foreground">
                {formatearFechaRango(rangoAnalitica.desde)} –{' '}
                {formatearFechaRango(rangoAnalitica.hasta)}
              </span>
            </div>

            {!analiticaPeriodo.rangoValido ? (
              <p className="border-t border-border/50 px-4 py-6 text-center text-sm text-destructive">
                La fecha desde debe ser anterior a la fecha hasta.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-px border-t border-border/50 bg-border/50 sm:grid-cols-4">
                <MetricaPeriodo
                  icon={ShoppingCart}
                  label="Ventas"
                  value={String(analiticaPeriodo.ventas)}
                />
                <MetricaPeriodo
                  icon={CircleDollarSign}
                  label="Valor vendido"
                  value={`$${formatMoney(analiticaPeriodo.vendido)}`}
                  tone="gold"
                />
                <MetricaPeriodo
                  icon={Banknote}
                  label="Cobrado"
                  value={`$${formatMoney(analiticaPeriodo.cobrado)}`}
                  tone="success"
                />
                <MetricaPeriodo
                  icon={Calculator}
                  label="Ticket promedio"
                  value={`$${formatMoney(analiticaPeriodo.ticketPromedio)}`}
                />
              </div>
            )}
          </section>

          {/* Cobranza + Alertas */}
          {clientes.length > 0 && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Donut + bars */}
              <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 sm:p-4 dark:bg-linear-to-b dark:from-card/90 dark:to-card/60">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">
                      Situación de cobranza
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Ventas confirmadas y pagos registrados
                    </p>
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {Math.round(progresoCobranza * 100)}% cobrado
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <DonutProgress
                      progress={progresoCobranza}
                      size={112}
                      label={`${Math.round(progresoCobranza * 100)}%`}
                      sublabel="Cobrado"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-muted-foreground">Cobrado</span>
                      </div>
                      <div className="money text-foreground/80">
                        ${formatMoney(kpis.totalAbonado)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-muted-foreground/40" />
                        <span className="text-muted-foreground">Saldo</span>
                      </div>
                      <div className="money text-destructive">
                        ${formatMoney(kpis.totalSaldo)}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ingresos · últimos 6 meses
                    </p>
                    <BarsChart
                      data={pagosPorMes}
                      formatValue={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Alertas de deuda */}
              {deudores.length > 0 ? (
                <DebtAlerts
                  deudores={deudores}
                  onVerCliente={onVerCliente}
                  max={4}
                />
              ) : (
                <div className="rounded-2xl border border-success/30 bg-success/6 dark:bg-success/8 dark:border-success/40 p-5 flex flex-col items-center justify-center text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30 mb-2">
                    <PackageCheck className="size-5" aria-hidden="true" />
                  </span>
                  <p className="font-display text-base font-semibold">
                    Todo al día
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[16rem]">
                    Ningún cliente tiene saldo pendiente.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Presupuestos por estado */}
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Estado comercial</h3>
              <p className="text-xs text-muted-foreground">
                Presupuestos y ventas en cada etapa
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-4">
              <EstadoPresupuestoCard
                icon={Edit3}
                estado="borrador"
                count={presupuestosPorEstado.borrador}
                onClick={() => navigate('/registros?estado=borrador')}
              />
              <EstadoPresupuestoCard
                icon={Clock}
                estado="pendiente"
                count={presupuestosPorEstado.pendiente}
                onClick={() => navigate('/registros?estado=pendiente')}
              />
              <EstadoPresupuestoCard
                icon={CheckCircle2}
                estado="aceptado"
                count={presupuestosPorEstado.aceptado}
                onClick={() => navigate('/registros?estado=aceptado')}
              />
              <EstadoPresupuestoCard
                icon={XCircle}
                estado="rechazado"
                count={presupuestosPorEstado.rechazado}
                onClick={() => navigate('/registros?estado=rechazado')}
              />
            </div>
          </section>

          {/* Ranking de vendedores (solo admin) */}
          {currentUser?.rol === 'admin' && vendedores.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-base font-semibold">
                  Rendimiento del equipo
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ventas confirmadas por vendedor
                </p>
              </div>
              <div className="grid gap-2">
                {vendedores
                  .map((v) => {
                    const clientesV = todosClientes.filter(
                      (c) => c.vendedorId === v.id,
                    )
                    const clienteIdsV = new Set(clientesV.map((c) => c.id))
                    const obrasV = todasObras.filter(
                      (o) => clienteIdsV.has(o.clienteId) && esVenta(o),
                    )
                    let facturadoV = 0
                    let saldoV = 0
                    for (const obra of obrasV) {
                      const pagosObra = pagos.filter(
                        (pago) => pago.obraId === obra.id,
                      )
                      const totales = calcularTotalesObra(
                        obra,
                        pagosObra,
                        ivaConfig,
                      )
                      facturadoV += totales.incluyeIva
                        ? totales.totalConIva
                        : totales.totalConDescuento
                      saldoV += totales.saldoPendiente
                    }
                    return {
                      vendedor: v,
                      clientes: clientesV.length,
                      facturado: facturadoV,
                      saldo: saldoV,
                    }
                  })
                  .sort(
                    (a: { facturado: number }, b: { facturado: number }) =>
                      b.facturado - a.facturado,
                  )
                  .map(
                    ({
                      vendedor,
                      clientes,
                      facturado,
                      saldo,
                    }: {
                      vendedor: (typeof vendedores)[0]
                      clientes: number
                      facturado: number
                      saldo: number
                    }) => (
                      <div
                        key={vendedor.id}
                        className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 flex items-center gap-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 text-xs font-bold">
                          {vendedor.nombre.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {vendedor.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {clientes} cliente(s) · @{vendedor.username}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold money">
                            ${formatMoney(facturado)}
                          </p>
                          <p className="text-xs text-muted-foreground money">
                            {saldo > 0
                              ? `Saldo: $${formatMoney(saldo)}`
                              : 'Cobrado'}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
              </div>
            </section>
          )}
        </>
      )}
    </AppLayout>
  )
}

function MetricaPeriodo({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: 'default' | 'gold' | 'success'
}) {
  return (
    <div className="min-w-0 bg-card/85 p-3 sm:p-4">
      <div
        className={cn(
          'mb-2 flex size-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50',
          tone === 'gold' && 'bg-primary/15 text-primary ring-primary/25',
          tone === 'success' && 'bg-success/15 text-success ring-success/25',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className="money mt-1 truncate font-display text-lg font-bold"
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function EstadoPresupuestoCard({
  icon: Icon,
  estado,
  count,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  estado: EstadoPresupuesto
  count: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-20 w-full bg-card/80 p-3 text-left transition-colors hover:bg-elevated/70 active:bg-elevated sm:p-4 dark:bg-card/70"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-muted/40 ring-1 ring-border/60">
          <Icon className="size-3.5 text-muted-foreground" />
        </span>
        <EstadoPresupuestoBadge estado={estado} size="sm" />
      </div>
      <p className="font-display text-2xl font-semibold tracking-tight leading-none">
        {count}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">obras</p>
    </button>
  )
}
