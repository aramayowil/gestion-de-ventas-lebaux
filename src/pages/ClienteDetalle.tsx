/**
 * pages/ClienteDetalle.tsx — Ficha de cliente.
 *
 * Cada card de obra tiene:
 *   · Menú ⋮ con todas las acciones (Editar obra, Eliminar obra, cambiar estado).
 *   · Botones principales abajo:
 *       - borrador → "Continuar cargando" (un solo botón)
 *       - aceptado/pendiente/rechazado → "Presupuesto" + "Pagos"
 *         (Pagos solo habilitado si está aceptado).
 *
 * Sección "Borradores en curso": muestra drafts disponibles del
 * borrador-store con botones Continuar / Descartar.
 *
 * Cambios de estado (aceptar/rechazar/reabrir) se hacen abriendo el
 * PresupuestoModal desde "Presupuesto" → ahí adentro están los botones.
 *
 * Stats del hero (Cobrado / Saldo pendiente): se calculan SOLO sobre
 * ventas confirmadas (`esVenta()`, o sea `estadoPresupuesto ===
 * 'aceptado'`). No se muestra "Facturado" acá porque mezclaría plata
 * real cobrada con presupuestos que todavía no son ventas. Un
 * presupuesto aceptado se convierte en venta de forma irreversible —
 * aunque su campo `tipo` en la base siga siendo 'presupuesto', para
 * estos cálculos y para el tab "Ventas" se lo trata como venta.
 *
 * Tabs de filtro sobre el listado de obras: Ventas | Presupuestos |
 * Deudas | Borradores | Todos (en ese orden, "Todos" al final).
 *   · Ventas       — estadoPresupuesto === 'aceptado'
 *   · Presupuestos — tipo === 'presupuesto' Y estado en pendiente/rechazado
 *                    (los aceptados ya son ventas, no aparecen acá)
 *   · Deudas       — ventas con saldoPendiente > 0
 *   · Borradores   — estadoPresupuesto === 'borrador'
 *   · Todos        — sin filtrar
 */

import * as React from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  PackageOpen,
  Calendar,
  FileText,
  Wallet,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  ShoppingCart,
  ArrowRightLeft,
  Factory,
  Share2,
  AlertTriangle,
  UserCog,
  LayoutGrid,
  Edit3,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  useClientes,
  useUpdateCliente,
  useDeleteCliente,
  useObras,
  useDeleteObra,
  usePagos,
  useAjustes,
  AJUSTES_DEFAULT,
  useAceptarPresupuesto,
  useRechazarPresupuesto,
  useRemitos,
  useUsers,
} from '@/hooks/queries'
import { useBorradorStore } from '@/lib/stores/borrador-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import {
  calcularTotalesObra,
  formatMoney,
  formatFechaCorta,
  formatWhatsApp,
  diasHastaVencimiento,
  esVenta,
  normalizarWhatsApp,
} from '@/lib/obra-totales'
import type { Obra, TipoObra, User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ClienteFormModal } from '@/components/lebaux/clientes/ClienteFormModal'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { WhatsAppIcon } from '@/components/ui/icons/WhatsAppIcon'
import { EstadoPresupuestoBadge } from '@/components/shared/EstadoPresupuestoBadge'
import { PresupuestoModal } from '@/components/lebaux/clientes/PresupuestoModal'
import { TipoObraModal } from '@/components/lebaux/obras/TipoObraModal'
import { CambiarEstadoModal } from '@/components/lebaux/obras/CambiarEstadoModal'
import { RemitoModal } from '@/components/lebaux/obras/RemitoModal'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  clienteId: string
  onVolver: () => void
  onNuevaObra: (tipo: TipoObra) => void
  onEditarObra: (obraId: string) => void
  onVerPagosObra: (obraId: string) => void
  /** Continúa el draft de un tipo específico (presupuesto o venta). */
  onContinuarBorrador: (tipo: TipoObra) => void
}

/** Filtro del listado de obras. 'todos' siempre va al final en la UI. */
type FiltroObras = 'ventas' | 'presupuestos' | 'deudas' | 'borradores' | 'todos'

export function ClienteDetalle({
  clienteId,
  onVolver,
  onNuevaObra,
  onEditarObra,
  onVerPagosObra,
  onContinuarBorrador,
}: Props) {
  const { data: clientes = [], isLoading: cargandoCliente } = useClientes()
  const cliente = clientes.find((c) => c.id === clienteId)
  const actualizarClienteMutation = useUpdateCliente()
  const eliminarClienteMutation = useDeleteCliente()

  const { data: obrasData = [], isLoading: cargandoObras } = useObras([
    clienteId,
  ])
  const eliminarObraMutation = useDeleteObra()
  const obraIds = React.useMemo(() => obrasData.map((o) => o.id), [obrasData])
  const { data: todosPagos = [] } = usePagos(obraIds)

  const ajustesSistema =
    useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const prefijoWhatsApp = ajustesSistema.prefijoWhatsApp
  const diasAutoRechazo = ajustesSistema.diasAutoRechazo

  // Drafts disponibles para continuar
  const borradores = useBorradorStore((s) => s.borradores)
  const eliminarBorrador = useBorradorStore((s) => s.eliminarBorrador)

  // Cambiar estado (aceptar/rechazar) desde botón o ⋮
  const aceptarPresupuestoMutation = useAceptarPresupuesto()
  const rechazarPresupuestoMutation = useRechazarPresupuesto()

  const [filtro, setFiltro] = React.useState<FiltroObras>('todos')
  const [modalEdit, setModalEdit] = React.useState(false)
  const [modalTipoObra, setModalTipoObra] = React.useState(false)
  const [obraPresupuesto, setObraPresupuesto] = React.useState<Obra | null>(
    null,
  )
  const [obraEliminar, setObraEliminar] = React.useState<Obra | null>(null)
  const [obraCambiarEstado, setObraCambiarEstado] = React.useState<Obra | null>(
    null,
  )
  const [obraRemito, setObraRemito] = React.useState<Obra | null>(null)

  // Remitos (para saber si una obra ya tiene remito en el menú ⋮)
  const { data: remitos = [] } = useRemitos()

  // Auth + compartir clientes
  const currentUser = useAuthStore((s) => s.currentUser)
  const { data: allUsers = [] } = useUsers()
  const vendedores = React.useMemo(
    () => allUsers.filter((u: User) => u.rol === 'vendedor'),
    [allUsers],
  )
  const [modalCompartir, setModalCompartir] = React.useState(false)
  const [modalReasignar, setModalReasignar] = React.useState(false)
  const [modalEliminarCliente, setModalEliminarCliente] = React.useState(false)

  const obras = React.useMemo(
    () =>
      [...obrasData].sort(
        (a, b) =>
          new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
      ),
    [obrasData],
  )

  // Drafts de este cliente
  const draftsDeCliente = React.useMemo(() => {
    const prefijo = `${clienteId}::`
    return Object.entries(borradores)
      .filter(([k]) => k.startsWith(prefijo))
      .map(([k, v]) => {
        const tipo = k.split('::')[1] as TipoObra
        return { tipo, ...v }
      })
  }, [borradores, clienteId])

  if (!cliente) {
    if (cargandoCliente) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <div className="p-4 space-y-3 max-w-2xl mx-auto w-full">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Cliente no encontrado.</p>
        <Button onClick={onVolver} variant="outline">
          Volver
        </Button>
      </div>
    )
  }

  const resumenObras = obras.map((o) => {
    const pagosObra = todosPagos.filter((p) => p.obraId === o.id)
    const totales = calcularTotalesObra(o, pagosObra)
    const progreso =
      totales.totalConIva > 0
        ? Math.min(1, totales.totalAbonado / totales.totalConIva)
        : 0
    const diasVenc = diasHastaVencimiento(o, diasAutoRechazo)
    return { obra: o, totales, progreso, diasVenc }
  })

  // Stats del hero: solo ventas confirmadas (estadoPresupuesto='aceptado').
  // Los presupuestos sin aceptar todavía no son plata real, no se cuentan.
  const resumenVentas = resumenObras.filter((r) => esVenta(r.obra))
  const iniciales =
    cliente.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  const telefonoWhatsAppNormalizado = normalizarWhatsApp(
    cliente.telefonoWhatsApp,
  )
  const saldoTotal = resumenVentas.reduce(
    (acc, r) => acc + r.totales.saldoPendiente,
    0,
  )
  const totalAbonado = resumenVentas.reduce(
    (acc, r) => acc + r.totales.totalAbonado,
    0,
  )

  // Listado filtrado por tab. El orden de evaluación importa: una obra
  // aceptada es venta aunque tipo='presupuesto' (ver comentario de
  // cabecera del archivo).
  const resumenFiltrado = resumenObras.filter((r) => {
    switch (filtro) {
      case 'ventas':
        return esVenta(r.obra)
      case 'presupuestos':
        return (
          r.obra.tipo === 'presupuesto' &&
          (r.obra.estadoPresupuesto === 'pendiente' ||
            r.obra.estadoPresupuesto === 'rechazado')
        )
      case 'deudas':
        return esVenta(r.obra) && r.totales.saldoPendiente > 0
      case 'borradores':
        return r.obra.estadoPresupuesto === 'borrador'
      case 'todos':
      default:
        return true
    }
  })

  const contadorFiltro = {
    ventas: resumenObras.filter((r) => esVenta(r.obra)).length,
    presupuestos: resumenObras.filter(
      (r) =>
        r.obra.tipo === 'presupuesto' &&
        (r.obra.estadoPresupuesto === 'pendiente' ||
          r.obra.estadoPresupuesto === 'rechazado'),
    ).length,
    deudas: resumenObras.filter(
      (r) => esVenta(r.obra) && r.totales.saldoPendiente > 0,
    ).length,
    borradores: resumenObras.filter(
      (r) => r.obra.estadoPresupuesto === 'borrador',
    ).length,
    todos: resumenObras.length,
  }

  function abrirChatWhatsApp() {
    if (!telefonoWhatsAppNormalizado) return
    const url = `https://wa.me/${telefonoWhatsAppNormalizado}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleEliminarCliente() {
    if (!cliente) return
    try {
      // La cascada (obras → pagos/tipologías/remitos → turnos) la maneja
      // Supabase vía FK ON DELETE CASCADE, no hace falta borrarlo a mano.
      await eliminarClienteMutation.mutateAsync(cliente.id)
      onVolver()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al eliminar el cliente.',
      )
    }
  }

  async function handleEliminarObra(obra: Obra) {
    if (!cliente) return
    try {
      // Cascada (pagos/tipologías/remitos → turnos) via FK, no hace falta borrarlos a mano.
      await eliminarObraMutation.mutateAsync(obra.id)
      // Limpiar draft si lo había
      eliminarBorrador(cliente.id, obra.tipo ?? 'venta')
      setObraEliminar(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar la obra.')
    }
  }

  async function handleAceptarPresupuesto(obra: Obra) {
    try {
      await aceptarPresupuestoMutation.mutateAsync(obra)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al aceptar el presupuesto.',
      )
    } finally {
      setObraCambiarEstado(null)
    }
  }
  async function handleRechazarPresupuesto(obra: Obra) {
    try {
      await rechazarPresupuestoMutation.mutateAsync(
        obra,
        'Rechazado por el usuario',
      )
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al rechazar el presupuesto.',
      )
    } finally {
      setObraCambiarEstado(null)
    }
  }

  return (
    <AppLayout
      title={cliente.nombre}
      subtitle={`${obras.length} ${obras.length === 1 ? 'obra' : 'obras'}`}
      onBack={onVolver}
    >
      {/* ─── Hero del cliente (con avatar de shadcn, WhatsApp y menú de acciones) ─── */}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm dark:bg-linear-to-b dark:from-card/90 dark:to-card/60">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 shrink-0 border border-border/60 bg-muted/70 text-base font-semibold text-foreground">
            <AvatarFallback>{iniciales}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {cliente.nombre}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {cliente.telefonoWhatsApp ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-border/60 bg-background/70 px-3 text-sm text-foreground hover:bg-primary/5"
                  onClick={abrirChatWhatsApp}
                  aria-label="Abrir chat de WhatsApp"
                >
                  <WhatsAppIcon className="size-5 shrink-0" />
                  <span className="truncate money">
                    {formatWhatsApp(
                      cliente.telefonoWhatsApp,
                      prefijoWhatsApp,
                    ) || '—'}
                  </span>
                </Button>
              ) : (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    Sin número de WhatsApp cargado
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Botón compartir: solo vendedores propietarios pueden compartir */}
            {currentUser?.rol === 'vendedor' &&
              cliente.vendedorId === currentUser.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setModalCompartir(true)}
                >
                  <Share2 className="size-4" />
                  <span className="hidden sm:inline">Compartir</span>
                </Button>
              )}
            {/* Botón reasignar: solo el admin puede cambiar el vendedor propietario */}
            {currentUser?.rol === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setModalReasignar(true)}
              >
                <UserCog className="size-4" />
                <span className="hidden sm:inline">Reasignar</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setModalEdit(true)}
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
            <AlertDialog
              open={modalEliminarCliente}
              onOpenChange={setModalEliminarCliente}
            >
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Más acciones del cliente"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setModalEliminarCliente(true)
                    }}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar cliente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    ¿Eliminar a {cliente.nombre}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {obras.length > 0 ? (
                      <>
                        Se borrarán también las{' '}
                        <strong>{obras.length} obras</strong> y todos sus pagos
                        registrados. Esta acción no se puede deshacer.
                      </>
                    ) : (
                      'Esta acción no se puede deshacer.'
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEliminarCliente}
                    disabled={eliminarClienteMutation.isPending}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {eliminarClienteMutation.isPending
                      ? 'Eliminando...'
                      : 'Sí, eliminar todo'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Aviso de "compartido con" — visible para admin y para el propietario */}
        {cliente.compartidoCon.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Share2 className="size-3.5 shrink-0" aria-hidden="true" />
            Compartido con:{' '}
            <span className="font-medium text-foreground">
              {cliente.compartidoCon
                .map((id) => allUsers.find((u) => u.id === id)?.nombre)
                .filter(Boolean)
                .join(', ') || `${cliente.compartidoCon.length} vendedor(es)`}
            </span>
          </p>
        )}

        {/* Stats — solo ventas confirmadas, no presupuestos sin aceptar */}
        <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-3">
          <Stat
            label="Cobrado"
            value={`$${formatMoney(totalAbonado)}`}
            tone="success"
          />
          <Stat
            label="Saldo pendiente"
            value={`$${formatMoney(saldoTotal)}`}
            tone={saldoTotal > 0 ? 'danger' : 'success'}
          />
        </div>
      </section>

      {/* ─── Drafts disponibles para continuar ─── */}
      {draftsDeCliente.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/6 dark:bg-primary/10 ring-1 ring-primary/20 p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            Borradores en curso
          </p>
          {draftsDeCliente.map((d) => (
            <div
              key={d.tipo}
              className="flex items-center justify-between gap-2 rounded-lg bg-card/60 border border-border/40 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {d.tipo === 'presupuesto' ? 'Presupuesto' : 'Venta'}{' '}
                  <span className="text-muted-foreground font-normal">
                    · {d.obra.tipologias.length} ítem
                    {d.obra.tipologias.length === 1 ? '' : 's'}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Última edición: {formatFechaCorta(d.actualizadoEn)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => onContinuarBorrador(d.tipo)}
                >
                  <PlayCircle className="size-3.5" />
                  <span className="hidden sm:inline">Continuar</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => eliminarBorrador(clienteId, d.tipo)}
                  aria-label="Descartar borrador"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ─── Obras ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Obras
          </h3>
          <Button
            size="sm"
            className="h-9"
            onClick={() => setModalTipoObra(true)}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nueva obra</span>
            <span className="sm:hidden">Obra</span>
          </Button>
        </div>

        {/* Tabs de filtro — "Todos" siempre al final */}
        {obras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <FiltroTab
              icon={ShoppingCart}
              label="Ventas"
              count={contadorFiltro.ventas}
              activo={filtro === 'ventas'}
              onClick={() => setFiltro('ventas')}
            />
            <FiltroTab
              icon={FileText}
              label="Presupuestos"
              count={contadorFiltro.presupuestos}
              activo={filtro === 'presupuestos'}
              onClick={() => setFiltro('presupuestos')}
            />
            <FiltroTab
              icon={AlertCircle}
              label="Con deuda"
              count={contadorFiltro.deudas}
              activo={filtro === 'deudas'}
              onClick={() => setFiltro('deudas')}
            />
            <FiltroTab
              icon={Edit3}
              label="Borradores"
              count={contadorFiltro.borradores}
              activo={filtro === 'borradores'}
              onClick={() => setFiltro('borradores')}
            />
            <FiltroTab
              icon={LayoutGrid}
              label="Todos"
              count={contadorFiltro.todos}
              activo={filtro === 'todos'}
              onClick={() => setFiltro('todos')}
            />
          </div>
        )}

        {cargandoObras ? (
          <div className="grid gap-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : obras.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl">
            <PackageOpen
              className="size-8 mx-auto text-muted-foreground mb-2"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground mb-3">
              Todavía no hay obras cargadas para este cliente.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setModalTipoObra(true)}
            >
              <Plus className="size-4" />
              Cargar primera obra
            </Button>
          </div>
        ) : resumenFiltrado.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl">
            <PackageOpen
              className="size-8 mx-auto text-muted-foreground mb-2"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              No hay obras en este filtro.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {resumenFiltrado.map(({ obra, totales, progreso, diasVenc }) => (
              <ObraCard
                key={obra.id}
                obra={obra}
                totales={totales}
                progreso={progreso}
                diasVenc={diasVenc}
                tieneRemito={remitos.some((r) => r.obraId === obra.id)}
                onVerPresupuesto={() => setObraPresupuesto(obra)}
                onVerPagos={() => onVerPagosObra(obra.id)}
                onEditarObra={() => onEditarObra(obra.id)}
                onEliminarObra={() => setObraEliminar(obra)}
                onCambiarEstado={() => setObraCambiarEstado(obra)}
                onGenerarRemito={() => setObraRemito(obra)}
              />
            ))}
          </div>
        )}
      </section>

      <ClienteFormModal
        open={modalEdit}
        onClose={() => setModalEdit(false)}
        clienteExistente={cliente}
      />

      <TipoObraModal
        open={modalTipoObra}
        onClose={() => setModalTipoObra(false)}
        onElegir={onNuevaObra}
      />

      {obraPresupuesto && cliente && (
        <PresupuestoModal
          open={!!obraPresupuesto}
          onClose={() => setObraPresupuesto(null)}
          obra={obraPresupuesto}
          cliente={cliente}
        />
      )}

      {/* Cambiar estado (aceptar / rechazar) */}
      <CambiarEstadoModal
        open={!!obraCambiarEstado}
        obra={obraCambiarEstado}
        onClose={() => setObraCambiarEstado(null)}
        onAceptar={() =>
          obraCambiarEstado && handleAceptarPresupuesto(obraCambiarEstado)
        }
        onRechazar={() =>
          obraCambiarEstado && handleRechazarPresupuesto(obraCambiarEstado)
        }
      />

      {/* Modal de remito de fábrica (crear/ver/editar) */}
      <RemitoModal
        open={!!obraRemito}
        obra={obraRemito}
        onClose={() => setObraRemito(null)}
      />

      {/* Modal compartir cliente */}
      <CompartirClienteModal
        open={modalCompartir}
        cliente={cliente}
        vendedores={vendedores}
        compartidoCon={cliente.compartidoCon}
        onGuardar={async (ids) => {
          try {
            await actualizarClienteMutation.mutateAsync({
              ...cliente,
              compartidoCon: ids,
            })
            toast.success('Cliente compartido.')
            setModalCompartir(false)
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : 'Error al compartir el cliente.',
            )
          }
        }}
        onClose={() => setModalCompartir(false)}
      />

      {/* Modal reasignar vendedor (solo admin) */}
      <ReasignarVendedorModal
        open={modalReasignar}
        cliente={cliente}
        vendedores={vendedores}
        onGuardar={async (nuevoVendedorId) => {
          try {
            const compartidoConLimpio = cliente.compartidoCon.filter(
              (id) => id !== nuevoVendedorId,
            )
            await actualizarClienteMutation.mutateAsync({
              ...cliente,
              vendedorId: nuevoVendedorId,
              compartidoCon: compartidoConLimpio,
            })
            toast.success('Cliente reasignado.')
            setModalReasignar(false)
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : 'Error al reasignar el cliente.',
            )
          }
        }}
        onClose={() => setModalReasignar(false)}
      />

      {/* Diálogo de eliminar obra */}
      <AlertDialog
        open={!!obraEliminar}
        onOpenChange={(v) => !v && setObraEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán también todos los pagos, remitos y turnos de fábrica
              asociados a esta obra. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => obraEliminar && handleEliminarObra(obraEliminar)}
              disabled={eliminarObraMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {eliminarObraMutation.isPending
                ? 'Eliminando...'
                : 'Sí, eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}

/* ────────────── Sub-componentes ────────────── */

/* ─── CompartirClienteModal ───
 * Modal para elegir con qué vendedores compartir un cliente.
 * Lista todos los vendedores (excepto el propietario) con checkboxes.
 */
function CompartirClienteModal({
  open,
  cliente,
  vendedores,
  compartidoCon,
  onGuardar,
  onClose,
}: {
  open: boolean
  cliente: { id: string; nombre: string; vendedorId: string | null }
  vendedores: { id: string; nombre: string; username: string }[]
  compartidoCon: string[]
  onGuardar: (ids: string[]) => void
  onClose: () => void
}) {
  const [seleccionados, setSeleccionados] =
    React.useState<string[]>(compartidoCon)

  React.useEffect(() => {
    if (open) setSeleccionados(compartidoCon)
  }, [open, compartidoCon])

  // Vendedores disponibles para compartir (excluyendo al propietario)
  const disponibles = vendedores.filter((v) => v.id !== cliente.vendedorId)

  function toggle(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            Compartir cliente
          </DialogTitle>
          <DialogDescription>
            Elegí con qué vendedores compartir a{' '}
            <strong className="text-foreground">{cliente.nombre}</strong>. Los
            vendedores compartidos podrán ver sus obras y presupuestos.
          </DialogDescription>
        </DialogHeader>

        {disponibles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay otros vendedores para compartir.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {disponibles.map((v) => {
              const checked = seleccionados.includes(v.id)
              return (
                <label
                  key={v.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                    checked
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/60 hover:bg-elevated/40',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(v.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      @{v.username}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onGuardar(seleccionados)}>
            <Share2 className="size-4" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── ReasignarVendedorModal ───
 * Modal para que el admin cambie el vendedor propietario de un cliente
 * (o se lo asigne a sí mismo / lo deje "sin asignar"). Distinto de
 * "Compartir": esto cambia quién es el DUEÑO del cliente, no quién más
 * puede verlo. Si el nuevo propietario ya estaba en `compartidoCon`, lo
 * sacamos de ahí para no dejar un estado inconsistente (propietario
 * compartido consigo mismo).
 */
function ReasignarVendedorModal({
  open,
  cliente,
  vendedores,
  onGuardar,
  onClose,
}: {
  open: boolean
  cliente: {
    id: string
    nombre: string
    vendedorId: string | null
    compartidoCon: string[]
  }
  vendedores: { id: string; nombre: string; username: string }[]
  onGuardar: (nuevoVendedorId: string | null) => void
  onClose: () => void
}) {
  const [seleccionado, setSeleccionado] = React.useState<string | null>(
    cliente.vendedorId,
  )

  React.useEffect(() => {
    if (open) setSeleccionado(cliente.vendedorId)
  }, [open, cliente.vendedorId])

  const huboCambio = seleccionado !== cliente.vendedorId

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            Reasignar cliente
          </DialogTitle>
          <DialogDescription>
            Elegí a qué vendedor pertenece{' '}
            <strong className="text-foreground">{cliente.nombre}</strong>. El
            vendedor anterior deja de ser el propietario (si lo tenías
            compartido con el nuevo propietario, se quita de esa lista
            automáticamente).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <label
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
              seleccionado === null
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/60 hover:bg-elevated/40',
            )}
          >
            <input
              type="radio"
              name="reasignar-vendedor"
              className="size-4 accent-primary"
              checked={seleccionado === null}
              onChange={() => setSeleccionado(null)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Sin asignar</p>
              <p className="text-xs text-muted-foreground">
                Ningún vendedor propietario
              </p>
            </div>
          </label>
          {vendedores.map((v) => {
            const checked = seleccionado === v.id
            return (
              <label
                key={v.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  checked
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 hover:bg-elevated/40',
                )}
              >
                <input
                  type="radio"
                  name="reasignar-vendedor"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={() => setSeleccionado(v.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{v.nombre}</p>
                  <p className="text-xs text-muted-foreground">@{v.username}</p>
                </div>
              </label>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onGuardar(seleccionado)}
            disabled={!huboCambio}
          >
            <UserCog className="size-4" />
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Traduce el "tone" de un Stat al color de texto que le corresponde. */
function colorDeTono(tone: 'muted' | 'success' | 'danger') {
  if (tone === 'success') return 'text-success'
  if (tone === 'danger') return 'text-destructive'
  return 'text-foreground'
}

/**
 * Arma el texto de vencimiento de un presupuesto "pendiente", según cuántos
 * días faltan (diasVenc puede ser negativo si ya venció).
 */
function mensajeVencimiento(diasVenc: number) {
  if (diasVenc < 0) {
    return 'Vencido (se rechazará automáticamente)'
  }
  if (diasVenc === 0) {
    return 'Vence hoy'
  }
  if (diasVenc === 1) {
    return 'Vence en 1 día'
  }
  return `Vence en ${diasVenc} días`
}

/** Pill de filtro para el listado de obras (Ventas/Presupuestos/Deudas/Borradores/Todos). */
function FiltroTab({
  icon: Icon,
  label,
  count,
  activo,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
        activo
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card/60 text-muted-foreground border-border/60 hover:bg-elevated hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <span
        className={cn(
          'text-[11px]',
          activo ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        ({count})
      </span>
    </button>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'muted' | 'success' | 'danger'
}) {
  const valueColor = colorDeTono(tone)
  return (
    <div className="text-center sm:text-left">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 money text-base sm:text-lg font-semibold ${valueColor}`}
      >
        {value}
      </p>
    </div>
  )
}

interface ObraCardProps {
  obra: Obra
  totales: ReturnType<typeof calcularTotalesObra>
  progreso: number
  diasVenc?: number
  /** True si la obra ya tiene un remito de fábrica generado. */
  tieneRemito: boolean
  onVerPresupuesto: () => void
  onVerPagos: () => void
  onEditarObra: () => void
  onEliminarObra: () => void
  onCambiarEstado: () => void
  onGenerarRemito: () => void
}

function ObraCard({
  obra,
  totales,
  progreso,
  diasVenc,
  tieneRemito,
  onVerPresupuesto,
  onVerPagos,
  onEditarObra,
  onEliminarObra,
  onCambiarEstado,
  onGenerarRemito,
}: ObraCardProps) {
  const estado = obra.estadoPresupuesto
  // Solo para el texto mostrado cuando ya está aceptado: distingue si
  // nació como venta directa o como presupuesto (no confundir con el
  // helper `esVenta()` de obra-totales, que usa estadoPresupuesto).
  const eraVentaDirecta = obra.tipo === 'venta'
  // Solo se puede cambiar estado (aceptar/rechazar) si el presupuesto
  // está pendiente o rechazado. Una vez aceptado (= venta), la transición
  // es irreversible: ya no se puede cambiar el estado por ningún medio,
  // ni desde el botón de la card ni desde el menú ⋮.
  const puedeCambiarEstado = estado === 'pendiente' || estado === 'rechazado'
  // Solo se puede generar/ver remito si la obra es una venta aceptada.
  const puedeTenerRemito = estado === 'aceptado'

  return (
    <div className="relative p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors dark:bg-card/50">
      {/* Menú ⋮ arriba derecha */}
      <div className="absolute top-2 right-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-foreground hover:bg-elevated/60"
              aria-label="Más opciones"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {estado !== 'borrador' && (
              <DropdownMenuItem onClick={onVerPresupuesto}>
                <FileText className="size-3.5" />
                Ver presupuesto
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEditarObra}>
              <Pencil className="size-3.5" />
              {estado === 'aceptado' ? 'Editar venta' : 'Editar obra'}
            </DropdownMenuItem>
            {puedeCambiarEstado && (
              <DropdownMenuItem onClick={onCambiarEstado}>
                <ArrowRightLeft className="size-3.5" />
                Cambiar estado
              </DropdownMenuItem>
            )}
            {puedeTenerRemito && (
              <DropdownMenuItem onClick={onGenerarRemito}>
                <Factory className="size-3.5" />
                {tieneRemito
                  ? 'Ver remito de fábrica'
                  : 'Generar remito de fábrica'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onEliminarObra}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3 pr-10">
        <span className="font-semibold text-sm font-display">
          {obra.tipologias.length}{' '}
          {obra.tipologias.length === 1 ? 'ítem' : 'ítems'}
        </span>
        {obra.tipo === 'presupuesto' && (
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Presupuesto
          </span>
        )}
        {obra.tipo === 'venta' && (
          <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            <ShoppingCart className="size-3 mr-1" />
            Venta
          </span>
        )}
        <EstadoPresupuestoBadge estado={estado} size="sm" />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" aria-hidden="true" />
          {formatFechaCorta(obra.fecha)}
        </span>
      </div>

      {/* Vencimiento / info de estado */}
      {estado === 'pendiente' && diasVenc !== undefined && (
        <p className="text-[11px] text-muted-foreground mb-2 inline-flex items-center gap-1.5">
          <Clock className="size-3" aria-hidden="true" />
          {mensajeVencimiento(diasVenc)}
        </p>
      )}
      {estado === 'rechazado' && obra.rechazadoMotivo && (
        <p className="text-[11px] text-destructive/90 mb-2 inline-flex items-center gap-1.5">
          <XCircle className="size-3" aria-hidden="true" />
          {obra.rechazadoMotivo}
        </p>
      )}
      {estado === 'aceptado' && (
        <p className="text-[11px] text-success/90 mb-2 inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          {eraVentaDirecta ? 'Venta confirmada' : 'Presupuesto aceptado'}
          {obra.aceptadoEn && ` · ${formatFechaCorta(obra.aceptadoEn)}`}
        </p>
      )}
      {estado === 'borrador' && (
        <p className="text-[11px] text-muted-foreground mb-2 inline-flex items-center gap-1.5">
          <Clock className="size-3" aria-hidden="true" />
          En edición · no finalizado
        </p>
      )}

      {/* Barra de progreso de pago (solo si hay total y está aceptado) */}
      {estado === 'aceptado' && totales.totalConIva > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
            Pagado
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-success to-success/70 transition-[width] duration-500"
              style={{ width: `${progreso * 100}%` }}
            />
          </div>
          <span className="money text-xs text-muted-foreground shrink-0 tabular-nums">
            {Math.round(progreso * 100)}%
          </span>
        </div>
      )}

      {/* Total y saldo */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="money">
          Total: ${formatMoney(totales.totalConIva)}
        </span>
        {estado === 'aceptado' && totales.saldoPendiente > 0 && (
          <span className="money text-destructive font-medium">
            Saldo: ${formatMoney(totales.saldoPendiente)}
          </span>
        )}
        {estado === 'aceptado' &&
          totales.saldoPendiente === 0 &&
          totales.totalConIva > 0 && (
            <span className="money text-success font-medium">Pagado</span>
          )}
      </div>

      {/* ─── Botones de acción según estado ─── */}
      <div className="mt-3 pt-3 border-t border-border/40">
        {estado === 'borrador' && (
          // Borrador: solo "Continuar cargando"
          <Button
            variant="default"
            size="sm"
            className="h-9 w-full"
            onClick={onEditarObra}
          >
            <Pencil className="size-3.5" />
            Continuar cargando
          </Button>
        )}

        {(estado === 'pendiente' || estado === 'rechazado') && (
          // Pendiente/Rechazado: Presupuesto + Cambiar estado
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onVerPresupuesto}
            >
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">Presupuesto</span>
              <span className="sm:hidden">Presup.</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onCambiarEstado}
            >
              <ArrowRightLeft className="size-3.5" />
              <span>Cambiar estado</span>
            </Button>
          </div>
        )}

        {estado === 'aceptado' && (
          // Aceptado (es una venta): solo Registrar pago
          <Button
            variant="default"
            size="sm"
            className="h-9 w-full"
            onClick={onVerPagos}
          >
            <Wallet className="size-3.5" />
            Registrar pago
          </Button>
        )}
      </div>
    </div>
  )
}
