/**
 * pages/DashboardPage.tsx — Dashboard con KPIs y visualizaciones.
 *
 * Estructura:
 *   1. Header con botón volver
 *   2. Hero: título + fecha
 *   3. Banda de 4 KPIs (clientes, obras activas, saldo, cobrado mes)
 *   4. Grid 2-col: cobranza (donut + bars) + alertas de deuda
 *   5. Presupuestos por estado (contadores rápidos)
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
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { KpiCard } from '@/components/ui/kpi-card'
import { DebtAlerts, type Deudor } from '@/components/lebaux/dashboard/DebtAlerts'
import { BarsChart, DonutProgress, type BarDatum } from '@/components/ui/mini-chart'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { useClientes, useObras, usePagos, useUsers } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/stores/auth-store'
import type { Cliente, User } from '@/lib/types'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaLarga,
} from '@/lib/obra-totales'
import type { EstadoPresupuesto } from '@/lib/types'

interface Props {
  onVolver: () => void
  onVerCliente: (id: string) => void
}

export function DashboardPage({ onVolver, onVerCliente }: Props) {
  const navigate = useNavigate()
  const { data: todosClientes = [], isLoading: cargandoClientes } = useClientes()
  const currentUser = useAuthStore((s) => s.currentUser)
  const { data: allUsers = [], isLoading: cargandoUsers } = useUsers()
  const vendedores = React.useMemo(() => allUsers.filter((u: User) => u.rol === 'vendedor'), [allUsers])

  // Filtrar clientes según rol
  const clientes = React.useMemo(() => {
    if (!currentUser) return []
    if (currentUser.rol === 'admin') return todosClientes
    return todosClientes.filter(
      (c: Cliente) => c.vendedorId === currentUser.id || (c.compartidoCon && c.compartidoCon.includes(currentUser.id)),
    )
  }, [todosClientes, currentUser])

  const clienteIds = React.useMemo(() => clientes.map((c: Cliente) => c.id), [clientes])
  const { data: todasObras = [], isLoading: cargandoObras } = useObras(clienteIds)
  const obras = React.useMemo(() => todasObras.filter((o) => clienteIds.includes(o.clienteId)), [todasObras, clienteIds])
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [], isLoading: cargandoPagos } = usePagos(obraIds)

  // Un solo flag: mientras falte cualquiera de los 4 datasets, mostramos
  // skeletons en vez de calcular KPIs con datos parciales.
  const cargandoDashboard = cargandoClientes || cargandoUsers || cargandoObras || cargandoPagos

  /* KPIs */
  const kpis = React.useMemo(() => {
    let totalFacturado = 0
    let totalAbonado = 0
    let totalSaldo = 0
    let obrasActivas = 0

    for (const o of obras) {
      const pagosObra = pagos.filter((p) => p.obraId === o.id)
      const t = calcularTotalesObra(o, pagosObra)
      totalFacturado += t.totalConDescuento
      totalAbonado += t.totalAbonado
      totalSaldo += t.saldoPendiente
      if (t.saldoPendiente > 0) obrasActivas++
    }

    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const cobradoEsteMes = pagos
      .filter(
        (p) =>
          !p.anulado && new Date(p.fecha) >= inicioMes && new Date(p.fecha) <= ahora,
      )
      .reduce((acc, p) => acc + (p.monto || 0), 0)

    return { totalFacturado, totalAbonado, totalSaldo, cobradoEsteMes, obrasActivas }
  }, [obras, pagos])

  /* Deudores */
  const deudores = React.useMemo<Deudor[]>(() => {
    const map = new Map<string, number>()
    for (const o of obras) {
      const pagosObra = pagos.filter((p) => p.obraId === o.id)
      const t = calcularTotalesObra(o, pagosObra)
      if (t.saldoPendiente > 0) {
        map.set(o.clienteId, (map.get(o.clienteId) ?? 0) + t.saldoPendiente)
      }
    }
    return clientes
      .map((c) => ({ cliente: c, saldo: map.get(c.id) ?? 0 }))
      .filter((d) => d.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
  }, [clientes, obras, pagos])

  /* Pagos por mes (últimos 6) */
  const pagosPorMes = React.useMemo<BarDatum[]>(() => {
    const nombresMes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
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
    <AppLayout title="Dashboard" subtitle="Indicadores financieros" onBack={onVolver} withBottomBar>
        {/* Hero */}
        <section className="space-y-1">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Panel de gestión
          </h2>
          <p className="text-sm text-muted-foreground capitalize">
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
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <KpiCard
                label="Clientes"
                value={String(clientes.length)}
                subtexto={`${deudores.length} con saldo`}
                icon={Users}
                tone="gold"
                onClick={() => navigate('/clientes')}
              />
              <KpiCard
                label="Obras activas"
                value={String(kpis.obrasActivas)}
                subtexto={`${obras.length} en total`}
                icon={PackageCheck}
                tone="muted"
                onClick={() => navigate('/registros')}
              />
              <KpiCard
                label="Saldo"
                value={`$${formatMoney(kpis.totalSaldo)}`}
                subtexto={deudores.length > 0 ? `${deudores.length} deudores` : 'Todo al día'}
                icon={Wallet}
                tone={kpis.totalSaldo > 0 ? 'danger' : 'success'}
                onClick={
                  deudores.length > 0 ? () => navigate('/clientes?filtro=deuda') : undefined
                }
              />
              <KpiCard
                label="Cobrado (mes)"
                value={`$${formatMoney(kpis.cobradoEsteMes)}`}
                subtexto="Acumulado del mes"
                icon={TrendingUp}
                tone="success"
                onClick={() => navigate('/registros?tab=pagos')}
              />
            </section>

            {/* Cobranza + Alertas */}
            {clientes.length > 0 && (
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Donut + bars */}
                <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 sm:p-4 dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold tracking-tight">Cobranza</h3>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Últimos 6 meses
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
                  <div className="rounded-2xl border border-success/30 bg-success/[0.06] dark:bg-success/[0.08] dark:border-success/40 p-5 flex flex-col items-center justify-center text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30 mb-2">
                      <PackageCheck className="size-5" aria-hidden="true" />
                    </span>
                    <p className="font-display text-base font-semibold">Todo al día</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[16rem]">
                      Ningún cliente tiene saldo pendiente.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Presupuestos por estado */}
            <section>
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-3">
                Presupuestos por estado
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
              <section>
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-3">
                  Ranking de vendedores
                </h3>
                <div className="grid gap-2">
                  {vendedores
                    .map((v) => {
                      const clientesV = todosClientes.filter((c) => c.vendedorId === v.id)
                      const clienteIdsV = new Set(clientesV.map((c) => c.id))
                      const obrasV = todasObras.filter((o) => clienteIdsV.has(o.clienteId))
                      const pagosV = pagos.filter((p) => {
                        const obra = todasObras.find((o) => o.id === p.obraId)
                        return obra && clienteIdsV.has(obra.clienteId) && !p.anulado
                      })
                      const facturadoV = obrasV.reduce((acc, o) => acc + calcularTotalesObra(o, []).totalConDescuento, 0)
                      const cobradoV = pagosV.reduce((acc, p) => acc + p.monto, 0)
                      const saldoV = Math.max(0, facturadoV - cobradoV)
                      return { vendedor: v, clientes: clientesV.length, facturado: facturadoV, saldo: saldoV }
                    })
                    .sort((a: { facturado: number }, b: { facturado: number }) => b.facturado - a.facturado)
                    .map(({ vendedor, clientes, facturado, saldo }: { vendedor: typeof vendedores[0]; clientes: number; facturado: number; saldo: number }) => (
                      <div
                        key={vendedor.id}
                        className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 flex items-center gap-3"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 text-xs font-bold">
                          {vendedor.nombre.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{vendedor.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {clientes} cliente(s) · @{vendedor.username}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold money">${formatMoney(facturado)}</p>
                          <p className="text-xs text-muted-foreground money">
                            {saldo > 0 ? `Saldo: $${formatMoney(saldo)}` : 'Cobrado'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </>
        )}
    </AppLayout>
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
      className="text-left w-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 sm:p-4 dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60 transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
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
