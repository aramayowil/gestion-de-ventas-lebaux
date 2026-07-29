/**
 * pages/HomePage.tsx — "Agenda de hoy".
 *
 * El bottom bar ya da acceso rápido a las 5 secciones principales
 * (Dashboard, Clientes, Agenda, Registros, Ajustes), así que la Home ya no
 * duplica esos accesos. En su lugar, muestra una agenda accionable:
 *
 *   · KPIs rápidos del día: cobrado hoy, presupuestos pendientes, deudores.
 *   · Presupuestos pendientes por vencer (con CTA a la ficha del cliente).
 *   · Clientes con saldo (con CTA a registrar pago).
 *   · Ventas recientes (últimas 3 obras aceptadas).
 *   · Accesos rápidos flotantes: Nuevo cliente / Nuevo presupuesto (CTAs
 *     principales que sí conviene tener visibles en la Home).
 */
import * as React from 'react'
import {
  Plus,
  FileText,
  Wallet,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShoppingCart,
  Factory,
  Settings,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { useClientes, useObras, usePagos } from '@/hooks/queries'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useNuevoClienteModal } from '@/hooks/use-nuevo-cliente-modal'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaCorta,
  diasHastaVencimiento,
} from '@/lib/obra-totales'
import type { Cliente } from '@/lib/types'
import { cn } from '@/lib/utils'

type Destino = 'dashboard' | 'clientes' | 'registros' | 'ajustes' | 'agenda'

interface Props {
  onIr: (destino: Destino) => void
  onVerCliente: (clienteId: string) => void
}

export function HomePage({ onIr, onVerCliente }: Props) {
  const navigate = useNavigate()
  const ajustesData = useAjustes(null).data ?? AJUSTES_DEFAULT
  const nombreEmpresa = ajustesData.empresa.nombre
  const diasAutoRechazo = ajustesData.sistema.diasAutoRechazo

  // TanStack Query: datos del servidor
  const { data: clientes = [], isLoading: cargandoClientes } = useClientes()
  const currentUser = useAuthStore((s) => s.currentUser)

  const clienteIds = React.useMemo(() => clientes.map((c) => c.id), [clientes])
  const { data: obras = [], isLoading: cargandoObras } = useObras(clienteIds)
  const obraIds = React.useMemo(() => obras.map((o) => o.id), [obras])
  const { data: pagos = [], isLoading: cargandoPagos } = usePagos(obraIds)
  const { abrirNuevoCliente, modalNuevoCliente } = useNuevoClienteModal(
    (cliente) => onVerCliente(cliente.id),
  )

  // Mientras no tengamos clientes, obras y pagos, no podemos calcular
  // ningún KPI ni lista de la agenda: mostramos un skeleton en su lugar.
  const cargandoAgenda = cargandoClientes || cargandoObras || cargandoPagos

  // Mapa de clientes por id para lookup rápido
  const clienteMap = React.useMemo(() => {
    const m = new Map<string, Cliente>()
    for (const c of clientes) m.set(c.id, c)
    return m
  }, [clientes])

  /* ───────── KPIs del día ───────── */
  const hoy = new Date().toISOString().slice(0, 10)
  const kpis = React.useMemo(() => {
    let cobradoHoy = 0
    let pendientes = 0
    let deudores = 0
    const clientesConSaldo = new Set<string>()

    for (const p of pagos) {
      if (p.anulado) continue
      if (p.fecha.slice(0, 10) === hoy) cobradoHoy += p.monto
    }

    for (const o of obras) {
      if (o.estadoPresupuesto === 'pendiente') pendientes++
      const pagosObra = pagos.filter((p) => p.obraId === o.id && !p.anulado)
      const totales = calcularTotalesObra(o, pagosObra)
      if (totales.saldoPendiente > 0) clientesConSaldo.add(o.clienteId)
    }

    deudores = clientesConSaldo.size

    return { cobradoHoy, pendientes, deudores }
  }, [pagos, obras, hoy])

  /* ───────── Presupuestos pendientes (ordenados por vencimiento) ───────── */
  const presupuestosPendientes = React.useMemo(() => {
    return obras
      .filter((o) => o.estadoPresupuesto === 'pendiente')
      .map((o) => ({
        obra: o,
        cliente: clienteMap.get(o.clienteId),
        diasVenc: diasHastaVencimiento(o, diasAutoRechazo),
      }))
      .sort((a, b) => (a.diasVenc ?? 999) - (b.diasVenc ?? 999))
      .slice(0, 5) // top 5 más urgentes
  }, [obras, clienteMap, diasAutoRechazo])

  /* ───────── Clientes con saldo (top 5) ───────── */
  const deudores = React.useMemo(() => {
    const saldoPorCliente = new Map<string, number>()
    for (const o of obras) {
      const pagosObra = pagos.filter((p) => p.obraId === o.id && !p.anulado)
      const totales = calcularTotalesObra(o, pagosObra)
      if (totales.saldoPendiente > 0) {
        saldoPorCliente.set(
          o.clienteId,
          (saldoPorCliente.get(o.clienteId) ?? 0) + totales.saldoPendiente,
        )
      }
    }
    return Array.from(saldoPorCliente.entries())
      .map(([clienteId, saldo]) => ({
        cliente: clienteMap.get(clienteId),
        saldo,
      }))
      .filter((d) => d.cliente)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5)
  }, [obras, pagos, clienteMap])

  /* ───────── Ventas recientes (últimas 3 aceptadas) ───────── */
  const ventasRecientes = React.useMemo(() => {
    return obras
      .filter((o) => o.estadoPresupuesto === 'aceptado')
      .sort(
        (a, b) =>
          new Date(b.aceptadoEn ?? b.creadoEn).getTime() -
          new Date(a.aceptadoEn ?? a.creadoEn).getTime(),
      )
      .slice(0, 3)
      .map((o) => ({
        obra: o,
        cliente: clienteMap.get(o.clienteId),
      }))
      .filter((v) => v.cliente)
  }, [obras, clienteMap])

  return (
    <AppLayout onNuevoCliente={abrirNuevoCliente} withBottomBar>
      {/* ─── Hero compacto ─── */}
      <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-5 dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
              {saludoSegunHora()},{' '}
              {currentUser?.nombre?.split(' ')[0] ??
                nombreEmpresa.split(' ')[0]}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {formatFechaLarga(new Date().toISOString())}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => onIr('agenda')}
            >
              <Factory className="size-4" />
              <span className="hidden sm:inline">Agenda fábrica</span>
              <span className="sm:hidden">Agenda</span>
            </Button>
            <Button size="sm" className="h-9" onClick={() => onIr('clientes')}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo presupuesto</span>
              <span className="sm:hidden">Presup.</span>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        {cargandoAgenda ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <KpiCard
              icon={<Wallet className="size-4" />}
              label="Cobrado hoy"
              value={`$${formatMoney(kpis.cobradoHoy)}`}
              tone="success"
            />
            <KpiCard
              icon={<Clock className="size-4" />}
              label="Pendientes"
              value={String(kpis.pendientes)}
              tone="gold"
              onClick={() => onIr('registros')}
            />
            <KpiCard
              icon={<AlertCircle className="size-4" />}
              label="Deudores"
              value={String(kpis.deudores)}
              tone={kpis.deudores > 0 ? 'danger' : 'muted'}
              onClick={() => onIr('dashboard')}
            />
          </div>
        )}
      </section>

      {/* ─── Listas de la agenda: skeleton mientras cargan los datos ─── */}
      {cargandoAgenda ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* ─── Presupuestos por vencer ─── */}
          <AgendaSection
            title="Presupuestos pendientes"
            icon={<FileText className="size-4" />}
            emptyText="No hay presupuestos pendientes. ¡Buen trabajo!"
            verTodoAction={() => onIr('registros')}
          >
            {presupuestosPendientes.map(({ obra, cliente, diasVenc }) => (
              <AgendaItem
                key={obra.id}
                title={cliente?.nombre ?? 'Cliente desconocido'}
                subtitle={`${obra.tipologias.length} ítem${obra.tipologias.length === 1 ? '' : 's'} · $${formatMoney(calcularTotalesObra(obra, []).totalConIva)}`}
                badge={
                  diasVenc !== undefined ? (
                    <VencimientoBadge diasVenc={diasVenc} />
                  ) : null
                }
                onClick={() => cliente && onVerCliente(cliente.id)}
              />
            ))}
          </AgendaSection>

          {/* ─── Clientes con saldo ─── */}
          <AgendaSection
            title="Clientes con saldo pendiente"
            icon={<TrendingUp className="size-4" />}
            emptyText="Ningún cliente debe dinero. ¡Todo al día!"
            verTodoAction={() => onIr('dashboard')}
          >
            {deudores.map(({ cliente, saldo }) => (
              <AgendaItem
                key={cliente!.id}
                title={cliente!.nombre}
                subtitle={`Saldo: $${formatMoney(saldo)}`}
                badge={
                  <span className="text-xs font-semibold text-destructive money">
                    ${formatMoney(saldo)}
                  </span>
                }
                onClick={() => onVerCliente(cliente!.id)}
              />
            ))}
          </AgendaSection>

          {/* ─── Ventas recientes ─── */}
          <AgendaSection
            title="Ventas recientes"
            icon={<ShoppingCart className="size-4" />}
            emptyText="Todavía no hay ventas registradas."
            verTodoAction={() => onIr('registros')}
          >
            {ventasRecientes.map(({ obra, cliente }) => {
              const pagosObra = pagos.filter(
                (p) => p.obraId === obra.id && !p.anulado,
              )
              const totales = calcularTotalesObra(obra, pagosObra)
              return (
                <AgendaItem
                  key={obra.id}
                  title={cliente!.nombre}
                  subtitle={`$${formatMoney(totales.totalConIva)} · ${formatFechaCorta(obra.aceptadoEn ?? obra.creadoEn)}`}
                  badge={
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3" />
                      {totales.saldoPendiente > 0 ? 'Saldo' : 'Pagado'}
                    </span>
                  }
                  onClick={() => onVerCliente(cliente!.id)}
                />
              )
            })}
          </AgendaSection>
        </>
      )}

      {modalNuevoCliente}
    </AppLayout>
  )
}

/* ────────────── Sub-componentes ────────────── */

function saludoSegunHora(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const MESES_LARGO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

function formatFechaLarga(iso: string): string {
  const d = new Date(iso)
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'success' | 'gold' | 'danger' | 'muted'
  onClick?: () => void
}) {
  const toneClass = {
    success: 'text-success bg-success/10 ring-success/20',
    gold: 'text-primary bg-primary/10 ring-primary/20',
    danger: 'text-destructive bg-destructive/10 ring-destructive/20',
    muted: 'text-muted-foreground bg-muted/40 ring-border/60',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3 text-left',
        'transition-all',
        onClick && 'hover:border-primary/30 hover:bg-card/60 cursor-pointer',
        !onClick && 'cursor-default',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-md ring-1 ring-inset',
            toneClass,
          )}
        >
          {icon}
        </span>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          'font-display text-base sm:text-xl font-semibold tabular-nums money',
          toneClass.split(' ')[0],
        )}
      >
        {value}
      </p>
    </button>
  )
}

function VencimientoBadge({ diasVenc }: { diasVenc: number }) {
  if (diasVenc < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="size-3" />
        Vencido
      </span>
    )
  }
  if (diasVenc === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <Clock className="size-3" />
        Vence hoy
      </span>
    )
  }
  if (diasVenc <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
        <Clock className="size-3" />
        {diasVenc}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="size-3" />
      {diasVenc}d
    </span>
  )
}

function AgendaSection({
  title,
  icon,
  emptyText,
  verTodoAction,
  children,
}: {
  title: string
  icon: React.ReactNode
  emptyText: string
  verTodoAction?: () => void
  children?: React.ReactNode
}) {
  // Si no hay children (lista vacía), mostramos emptyText
  const isEmpty =
    !children || (Array.isArray(children) && children.length === 0)
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/20">
            {icon}
          </span>
          <h3 className="text-sm font-semibold font-display truncate">
            {title}
          </h3>
        </div>
        {verTodoAction && !isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={verTodoAction}
          >
            Ver todos
            <ChevronRight className="size-3" />
          </Button>
        )}
      </div>
      {isEmpty ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">
          {emptyText}
        </p>
      ) : (
        <div className="divide-y divide-border/30">{children}</div>
      )}
    </section>
  )
}

function AgendaItem({
  title,
  subtitle,
  badge,
  onClick,
}: {
  title: string
  subtitle: string
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-elevated/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate money">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  )
}

export default HomePage
