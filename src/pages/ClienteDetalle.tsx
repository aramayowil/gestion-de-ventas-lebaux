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
 */
import * as React from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  PackageOpen,
  Calendar,
  MessageCircle,
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
  AlertDialogTrigger,
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
} from '@/lib/obra-totales'
import type { Obra, TipoObra, User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ClienteFormModal } from '@/components/lebaux/clientes/ClienteFormModal'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClientAvatar } from '@/components/shared/ClientAvatar'
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

  const { data: obrasData = [], isLoading: cargandoObras } = useObras([clienteId])
  const eliminarObraMutation = useDeleteObra()
  const obraIds = React.useMemo(() => obrasData.map((o) => o.id), [obrasData])
  const { data: todosPagos = [] } = usePagos(obraIds)

  const ajustesSistema = useAjustes(null).data?.sistema ?? AJUSTES_DEFAULT.sistema
  const prefijoWhatsApp = ajustesSistema.prefijoWhatsApp
  const diasAutoRechazo = ajustesSistema.diasAutoRechazo

  // Drafts disponibles para continuar
  const borradores = useBorradorStore((s) => s.borradores)
  const eliminarBorrador = useBorradorStore((s) => s.eliminarBorrador)

  // Cambiar estado (aceptar/rechazar) desde botón o ⋮
  const aceptarPresupuestoMutation = useAceptarPresupuesto()
  const rechazarPresupuestoMutation = useRechazarPresupuesto()

  const [modalEdit, setModalEdit] = React.useState(false)
  const [modalTipoObra, setModalTipoObra] = React.useState(false)
  const [obraPresupuesto, setObraPresupuesto] = React.useState<Obra | null>(null)
  const [obraEliminar, setObraEliminar] = React.useState<Obra | null>(null)
  const [obraCambiarEstado, setObraCambiarEstado] = React.useState<Obra | null>(null)
  const [obraRemito, setObraRemito] = React.useState<Obra | null>(null)

  // Remitos (para saber si una obra ya tiene remito en el menú ⋮)
  const { data: remitos = [] } = useRemitos()

  // Auth + compartir clientes
  const currentUser = useAuthStore((s) => s.currentUser)
  const { data: allUsers = [] } = useUsers()
  const vendedores = React.useMemo(() => allUsers.filter((u: User) => u.rol === 'vendedor'), [allUsers])
  const [modalCompartir, setModalCompartir] = React.useState(false)

  const obras = React.useMemo(
    () =>
      [...obrasData].sort(
        (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
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
    const progreso = totales.totalConIva > 0
      ? Math.min(1, totales.totalAbonado / totales.totalConIva)
      : 0
    const diasVenc = diasHastaVencimiento(o, diasAutoRechazo)
    return { obra: o, totales, progreso, diasVenc }
  })

  const saldoTotal = resumenObras.reduce(
    (acc, r) => acc + r.totales.saldoPendiente,
    0,
  )
  const totalFacturado = resumenObras.reduce(
    (acc, r) => acc + r.totales.totalConDescuento,
    0,
  )
  const totalAbonado = Math.max(0, totalFacturado - saldoTotal)

  async function handleEliminarCliente() {
    if (!cliente) return
    try {
      // La cascada (obras → pagos/tipologías/remitos → turnos) la maneja
      // Supabase vía FK ON DELETE CASCADE, no hace falta borrarlo a mano.
      await eliminarClienteMutation.mutateAsync(cliente.id)
      onVolver()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el cliente.')
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
      toast.error(e instanceof Error ? e.message : 'Error al aceptar el presupuesto.')
    } finally {
      setObraCambiarEstado(null)
    }
  }
  async function handleRechazarPresupuesto(obra: Obra) {
    try {
      await rechazarPresupuestoMutation.mutateAsync(obra, 'Rechazado por el usuario')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al rechazar el presupuesto.')
    } finally {
      setObraCambiarEstado(null)
    }
  }

  return (
    <AppLayout
      title={cliente.nombre}
      subtitle={`${obras.length} ${obras.length === 1 ? 'obra' : 'obras'}`}
      onBack={onVolver}
      onIrAInicio={onVolver}
    >
        {/* ─── Hero del cliente (con botón Editar dentro) ─── */}
        <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60">
          <div className="flex items-start gap-4">
            <ClientAvatar
              nombre={cliente.nombre}
              size="lg"
              alert={saldoTotal > 0}
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight truncate">
                {cliente.nombre}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate money">
                  {formatWhatsApp(cliente.telefonoWhatsApp, prefijoWhatsApp) || '—'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Botón compartir: solo vendedores propietarios pueden compartir */}
              {currentUser?.rol === 'vendedor' && cliente.vendedorId === currentUser.id && (
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
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setModalEdit(true)}
              >
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-3 gap-3">
            <Stat label="Facturado" value={`$${formatMoney(totalFacturado)}`} tone="muted" />
            <Stat label="Cobrado" value={`$${formatMoney(totalAbonado)}`} tone="success" />
            <Stat label="Saldo" value={`$${formatMoney(saldoTotal)}`} tone={saldoTotal > 0 ? 'danger' : 'success'} />
          </div>
        </section>

        {/* ─── Drafts disponibles para continuar ─── */}
        {draftsDeCliente.length > 0 && (
          <section className="rounded-xl border border-primary/30 bg-primary/[0.06] dark:bg-primary/[0.1] ring-1 ring-primary/20 p-4 space-y-2">
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
                      · {d.obra.tipologias.length} ítem{d.obra.tipologias.length === 1 ? '' : 's'}
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
            <Button size="sm" className="h-9" onClick={() => setModalTipoObra(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nueva obra</span>
              <span className="sm:hidden">Obra</span>
            </Button>
          </div>

          {cargandoObras ? (
            <div className="grid gap-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : obras.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl">
              <PackageOpen className="size-8 mx-auto text-muted-foreground mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground mb-3">
                Todavía no hay obras cargadas para este cliente.
              </p>
              <Button variant="outline" size="sm" className="h-10" onClick={() => setModalTipoObra(true)}>
                <Plus className="size-4" />
                Cargar primera obra
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {resumenObras.map(({ obra, totales, progreso, diasVenc }) => (
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

        {/* ─── Eliminar cliente ─── */}
        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" />
                {obras.length > 0 ? 'Eliminar cliente y todas sus obras' : 'Eliminar cliente'}
              </Button>
            </AlertDialogTrigger>
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
                  {eliminarClienteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar todo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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
        onAceptar={() => obraCambiarEstado && handleAceptarPresupuesto(obraCambiarEstado)}
        onRechazar={() => obraCambiarEstado && handleRechazarPresupuesto(obraCambiarEstado)}
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
            await actualizarClienteMutation.mutateAsync({ ...cliente, compartidoCon: ids })
            toast.success('Cliente compartido.')
            setModalCompartir(false)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error al compartir el cliente.')
          }
        }}
        onClose={() => setModalCompartir(false)}
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
              Se borrarán también todos los pagos, remitos y turnos de
              fábrica asociados a esta obra. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => obraEliminar && handleEliminarObra(obraEliminar)}
              disabled={eliminarObraMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {eliminarObraMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
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
  const [seleccionados, setSeleccionados] = React.useState<string[]>(compartidoCon)

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
                    <p className="text-xs text-muted-foreground">@{v.username}</p>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onGuardar(seleccionados)}>
            <Share2 className="size-4" />
            Guardar
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
      <p className={`mt-0.5 money text-base sm:text-lg font-semibold ${valueColor}`}>
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
  const esVenta = obra.tipo === 'venta'
  // Solo se puede cambiar estado (aceptar/rechazar) si no es borrador.
  const puedeCambiarEstado = estado === 'pendiente' || estado === 'rechazado' || estado === 'aceptado'
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
                {tieneRemito ? 'Ver remito de fábrica' : 'Generar remito de fábrica'}
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
          {esVenta ? 'Venta confirmada' : 'Presupuesto aceptado'}
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
              className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-[width] duration-500"
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
        {estado === 'aceptado' && totales.saldoPendiente === 0 && totales.totalConIva > 0 && (
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
