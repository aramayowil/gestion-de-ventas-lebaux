/**
 * pages/GestionVendedoresPage.tsx — Solo admin.
 *
 * Lista todos los vendedores y permite crear nuevos (asignando username
 * + password). También puede eliminar vendedores (lo que NO elimina sus
 * clientes/obras, solo el acceso).
 *
 * Las credenciales seteadas al crear no pueden cambiarse después
 * (excepto el username, que el vendedor cambia desde Ajustes).
 */
import * as React from 'react'
import { toast } from 'sonner'
import { UserPlus, Trash2, User as UserIcon, KeyRound, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetBody,
} from '@/components/ui/sheet'
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
import { AppLayout } from '@/components/layout/AppLayout'
import { useUsers, useCrearVendedor, useEliminarVendedor, useClientes, useTestEdgeFunction } from '@/hooks/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/stores/auth-store'
import { formatFechaCorta } from '@/lib/obra-totales'
import type { User } from '@/lib/types'

interface Props {
  onVolver: () => void
}

export function GestionVendedoresPage({ onVolver }: Props) {
  // TanStack Query: users + clientes (con cache e invalidación automática)
  const { data: users = [], isLoading: loadingUsers } = useUsers()
  const crearVendedorMutation = useCrearVendedor()
  const eliminarVendedorMutation = useEliminarVendedor()
  const testEdgeFunctionMutation = useTestEdgeFunction()
  const currentUser = useAuthStore((s) => s.currentUser)
  const { data: clientes = [] } = useClientes()

  const [modalCrear, setModalCrear] = React.useState(false)
  const [userEliminar, setUserEliminar] = React.useState<User | null>(null)

  const vendedores = users.filter((u) => u.rol === 'vendedor')

  // Contar clientes por vendedor
  const clientesPorVendedor = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const c of clientes) {
      if (c.vendedorId) {
        m.set(c.vendedorId, (m.get(c.vendedorId) ?? 0) + 1)
      }
    }
    return m
  }, [clientes])

  async function handleTestEdgeFunction() {
    try {
      const res = await testEdgeFunctionMutation.mutateAsync()
      toast.success(`Conexión OK (status ${res.status}): ${res.message}`, {
        duration: 8000,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al testear la conexión.', {
        duration: 10000,
      })
    }
  }

  async function handleEliminar(u: User) {
    try {
      await eliminarVendedorMutation.mutateAsync(u.id)
      toast.success(`Vendedor "${u.nombre}" eliminado.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar el vendedor.')
    } finally {
      setUserEliminar(null)
    }
  }

  return (
    <AppLayout
      title="Gestión de vendedores"
      subtitle={`${vendedores.length} vendedor${vendedores.length === 1 ? '' : 'es'}`}
      onBack={onVolver}
      maxWidth="max-w-3xl"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={handleTestEdgeFunction}
            disabled={testEdgeFunctionMutation.isPending}
          >
            <Wifi className="size-4" />
            <span className="hidden sm:inline">
              {testEdgeFunctionMutation.isPending ? 'Probando...' : 'Testear conexión'}
            </span>
          </Button>
          <Button size="sm" className="h-9" onClick={() => setModalCrear(true)}>
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Nuevo vendedor</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      }
      withBottomBar
    >
        {loadingUsers ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
            ))}
          </div>
        ) : vendedores.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl">
            <UserIcon className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Todavía no hay vendedores creados.
            </p>
            <Button variant="outline" size="sm" onClick={() => setModalCrear(true)}>
              <UserPlus className="size-4" />
              Crear primer vendedor
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {vendedores.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 flex items-center gap-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  <UserIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{u.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{u.username} · {clientesPorVendedor.get(u.id) ?? 0} cliente(s) · {formatFechaCorta(u.creadoEn)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setUserEliminar(u)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info sobre credenciales */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3.5 flex items-start gap-2.5">
          <KeyRound className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80">
            Las credenciales (usuario + contraseña) que asignás al crear un
            vendedor no pueden cambiarse después. El vendedor solo puede
            cambiar su nombre de usuario desde Ajustes.
          </p>
        </div>

      {/* Modal crear vendedor */}
      <CrearVendedorModal
        open={modalCrear}
        onClose={() => setModalCrear(false)}
        onCrear={async (email, password, username, nombre) => {
          try {
            await crearVendedorMutation.mutateAsync({
              email,
              password,
              username,
              nombre,
              creadoPor: currentUser?.id ?? '',
            })
            toast.success('Vendedor creado correctamente.')
            setModalCrear(false)
            return true
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error al crear el vendedor.')
            return false
          }
        }}
      />

      {/* Confirmar eliminar */}
      <AlertDialog open={!!userEliminar} onOpenChange={(v) => !v && setUserEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vendedor "{userEliminar?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el acceso del vendedor, pero sus clientes y obras
              quedan registrados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userEliminar && handleEliminar(userEliminar)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}

/* ────────────── Sub-componente: modal crear ────────────── */

function CrearVendedorModal({
  open,
  onClose,
  onCrear,
}: {
  open: boolean
  onClose: () => void
  onCrear: (email: string, password: string, username: string, nombre: string) => Promise<boolean>
}) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [nombre, setNombre] = React.useState('')
  const [cargando, setCargando] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setEmail('')
      setPassword('')
      setUsername('')
      setNombre('')
      setCargando(false)
    }
  }, [open])

  async function handleSubmit() {
    setCargando(true)
    await onCrear(email, password, username, nombre)
    setCargando(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Crear vendedor</SheetTitle>
          <SheetDescription>
            Asigná un usuario y contraseña. Estas credenciales no podrán
            cambiarse después (excepto el nombre de usuario).
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="grid gap-2">
            <Label htmlFor="v-nombre">Nombre para mostrar</Label>
            <Input
              id="v-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-email">Email (login)</Label>
            <Input
              id="v-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@lebaux.com"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-username">Nombre de usuario (display)</Label>
            <Input
              id="v-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="juan"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="v-password">Contraseña</Label>
            <Input
              id="v-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={cargando}>
            <UserPlus className="size-4" />
            {cargando ? 'Creando...' : 'Crear vendedor'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default GestionVendedoresPage
