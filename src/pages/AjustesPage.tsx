/**
 * pages/AjustesPage.tsx — Configuración del sistema.
 *
 * Secciones:
 *   1. Tema (claro/oscuro/sistema) — usa next-themes — cualquier usuario
 *   2. Mi cuenta (nombre completo, alias y email de acceso) — cualquier usuario
 *   3. Vendedores (link a /admin/vendedores) — SOLO ADMIN
 *   4. Datos de empresa (usados en PDFs) — SOLO ADMIN
 *   5. Reglas del sistema (días auto-rechazo, prefijo WhatsApp, moneda) — SOLO ADMIN
 *   6. Respaldo (exportar/importar JSON) — SOLO ADMIN
 *   7. Zona peligrosa (borrar todo) — SOLO ADMIN
 *
 * El gating es doble: acá ocultamos las secciones en la UI, y además
 * las políticas RLS de la tabla `ajustes` (ver src/sql/schema.sql)
 * rechazan el insert/update si quien llama no es admin. Así, aunque
 * alguien manipule el front, la base de datos igual protege los datos.
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Sun,
  Moon,
  Monitor,
  Building2,
  Sliders,
  Database,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  UserCircle,
  Users,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAjustes, useActualizarAjustes, useActualizarPerfil, AJUSTES_DEFAULT } from '@/hooks/queries'
import { EMPRESA_DEFAULT, SISTEMA_DEFAULT, LINEAS } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Props {
  onVolver: () => void
}

export function AjustesPage({ onVolver }: Props) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  // Solo el admin puede ver/editar datos de empresa, reglas del sistema,
  // respaldo y borrado masivo. Un vendedor solo ve "Tema" y "Mi cuenta".
  const currentUser = useAuthStore((s) => s.currentUser)
  const emailAcceso = useAuthStore((s) => s.session?.user.email ?? '')
  const refrescarUsuario = useAuthStore((s) => s.fetchCurrentUser)
  const esAdmin = currentUser?.rol === 'admin'

  const { data: ajustes, isLoading: cargandoAjustes } = useAjustes(null)
  const empresa = ajustes?.empresa ?? AJUSTES_DEFAULT.empresa
  const sistema = ajustes?.sistema ?? AJUSTES_DEFAULT.sistema
  const actualizarAjustes = useActualizarAjustes()

  function actualizarEmpresa(patch: Partial<typeof empresa>) {
    return actualizarAjustes.mutateAsync({
      vendedorId: null,
      datos: { empresa: { ...empresa, ...patch }, sistema },
    })
  }
  function actualizarSistema(patch: Partial<typeof sistema>) {
    return actualizarAjustes.mutateAsync({
      vendedorId: null,
      datos: { empresa, sistema: { ...sistema, ...patch } },
    })
  }

  // "Mi cuenta": disponible para cualquier usuario logueado
  const actualizarPerfil = useActualizarPerfil()
  const [nuevoNombre, setNuevoNombre] = React.useState('')
  const [nuevoUsername, setNuevoUsername] = React.useState('')

  React.useEffect(() => {
    if (!currentUser) return
    setNuevoNombre(currentUser.nombre)
    setNuevoUsername(currentUser.username)
  }, [currentUser])

  async function handleGuardarPerfil() {
    if (!currentUser) return
    try {
      await actualizarPerfil.mutateAsync({
        userId: currentUser.id,
        nuevoNombre,
        nuevoUsername,
      })
      await refrescarUsuario()
      toast.success('Perfil actualizado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar el perfil.')
    }
  }

  const [empresaLocal, setEmpresaLocal] = React.useState(empresa)
  const [sistemaLocal, setSistemaLocal] = React.useState(sistema)
  const [montado, setMontado] = React.useState(false)

  React.useEffect(() => {
    setEmpresaLocal(empresa)
    setSistemaLocal(sistema)
  }, [empresa, sistema])

  React.useEffect(() => setMontado(true), [])

  async function handleGuardarEmpresa() {
    try {
      await actualizarEmpresa(empresaLocal)
      toast.success('Datos de empresa guardados.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar.')
    }
  }
  async function handleGuardarSistema() {
    if (sistemaLocal.diasAutoRechazo < 1 || sistemaLocal.diasAutoRechazo > 365) {
      toast.error('Los días de auto-rechazo deben estar entre 1 y 365.')
      return
    }
    try {
      await actualizarSistema(sistemaLocal)
      toast.success('Reglas del sistema guardadas.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar.')
    }
  }
  async function handleReset() {
    try {
      await actualizarAjustes.mutateAsync({
        vendedorId: null,
        datos: { empresa: EMPRESA_DEFAULT, sistema: SISTEMA_DEFAULT },
      })
      setEmpresaLocal(EMPRESA_DEFAULT)
      setSistemaLocal(SISTEMA_DEFAULT)
      toast.success('Configuración restablecida a valores por defecto.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al restablecer.')
    }
  }
  function handleExportar() {
    // TODO: exportar clientes/obras/pagos reales desde Supabase (pendiente).
    const json = JSON.stringify({ version: 1, fechaExport: new Date().toISOString() }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lebaux_backup_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Respaldo descargado.')
  }
  function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // TODO: importar clientes/obras/pagos reales a Supabase (pendiente).
      toast.success('Respaldo importado. Recargá la página para ver los cambios.')
      setTimeout(() => window.location.reload(), 1500)
    }
    reader.readAsText(file)
    e.target.value = '' // reset para permitir re-importar el mismo archivo
  }
  function handleBorrarTodo() {
    // TODO: borrar datos reales en Supabase (cuidado con RLS) — pendiente.
    toast.success('Todos los datos fueron borrados.')
    setTimeout(() => window.location.reload(), 1000)
  }

  return (
    <AppLayout
      title="Ajustes"
      subtitle="Configuración del sistema"
      onBack={onVolver}
      maxWidth="max-w-3xl"
      withBottomBar
    >
        {/* ─── Tema ─── */}
        <SectionCard icon={Sun} title="Tema">
          <div className="grid grid-cols-3 gap-2">
            <TemaOption
              icon={Sun}
              label="Claro"
              active={montado && theme === 'light'}
              onClick={() => setTheme('light')}
            />
            <TemaOption
              icon={Moon}
              label="Oscuro"
              active={montado && theme === 'dark'}
              onClick={() => setTheme('dark')}
            />
            <TemaOption
              icon={Monitor}
              label="Sistema"
              active={montado && theme === 'system'}
              onClick={() => setTheme('system')}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            El tema se guarda en este navegador y se aplica automáticamente.
          </p>
        </SectionCard>

        {/* ─── Mi cuenta ─── */}
        {currentUser && (
          <SectionCard icon={UserCircle} title="Mi cuenta">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="mi-nombre">Nombre completo</Label>
                <Input
                  id="mi-nombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  autoComplete="name"
                />
                <p className="text-[11px] text-muted-foreground">
                  Es el nombre que te identifica dentro del sistema.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mi-username">Alias visible</Label>
                <Input
                  id="mi-username"
                  value={nuevoUsername}
                  onChange={(e) => setNuevoUsername(e.target.value)}
                  placeholder="juan"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se muestra como @{nuevoUsername.trim() || 'usuario'} dentro del sistema.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mi-email">Email de acceso</Label>
                <Input
                  id="mi-email"
                  type="email"
                  value={emailAcceso}
                  disabled
                  className="bg-muted/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  Usás este email junto con tu contraseña para iniciar sesión.
                </p>
              </div>
              <Button
                onClick={handleGuardarPerfil}
                disabled={
                  !nuevoNombre.trim() ||
                  !nuevoUsername.trim() ||
                  (nuevoNombre.trim() === currentUser.nombre &&
                    nuevoUsername.trim().toLowerCase() === currentUser.username) ||
                  actualizarPerfil.isPending
                }
                className="w-full sm:w-auto"
              >
                {actualizarPerfil.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </SectionCard>
        )}

        {/* ─── Vendedores (solo admin) ─── */}
        {esAdmin && (
        <SectionCard icon={Users} title="Vendedores">
          <p className="text-xs text-muted-foreground mb-3">
            Administrá el equipo de ventas: creá cuentas nuevas o editá las existentes.
          </p>
          <Button
            className="h-11"
            onClick={() => navigate('/admin/vendedores')}
          >
            <Users className="size-4" />
            Gestionar vendedores
          </Button>
        </SectionCard>
        )}

        {/* ─── Datos de empresa (solo admin) ─── */}
        {esAdmin && (
        <SectionCard icon={Building2} title="Datos de la empresa">
          <p className="text-xs text-muted-foreground mb-3">
            Estos datos se usan en los PDFs de presupuestos y comprobantes.
          </p>
          {cargandoAjustes ? (
            <div className="grid gap-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <Skeleton className="h-11 w-full mt-1" />
            </div>
          ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="emp-nombre">Nombre</Label>
              <Input
                id="emp-nombre"
                value={empresaLocal.nombre}
                onChange={(e) => setEmpresaLocal((s) => ({ ...s, nombre: e.target.value }))}
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-rubro">Rubro</Label>
              <Input
                id="emp-rubro"
                value={empresaLocal.rubro}
                onChange={(e) => setEmpresaLocal((s) => ({ ...s, rubro: e.target.value }))}
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-dir">Dirección</Label>
              <Input
                id="emp-dir"
                value={empresaLocal.direccion}
                onChange={(e) => setEmpresaLocal((s) => ({ ...s, direccion: e.target.value }))}
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="emp-tel">Teléfono</Label>
                <Input
                  id="emp-tel"
                  value={empresaLocal.telefono}
                  onChange={(e) => setEmpresaLocal((s) => ({ ...s, telefono: e.target.value }))}
                  className="h-11"
                  inputMode="tel"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={empresaLocal.email}
                  onChange={(e) => setEmpresaLocal((s) => ({ ...s, email: e.target.value }))}
                  className="h-11"
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              onClick={handleGuardarEmpresa}
              disabled={actualizarAjustes.isPending}
              className="h-11 mt-1"
            >
              {actualizarAjustes.isPending ? 'Guardando...' : 'Guardar datos de empresa'}
            </Button>
          </div>
          )}
        </SectionCard>
        )}

        {/* ─── Reglas del sistema (solo admin) ─── */}
        {esAdmin && (
        <SectionCard icon={Sliders} title="Reglas del sistema">
          {cargandoAjustes ? (
            <div className="grid gap-3">
              <Skeleton className="h-11 w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full mt-1" />
            </div>
          ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="reg-dias">
                Días para auto-rechazo de presupuestos
              </Label>
              <NumericInput
                id="reg-dias"
                min={1}
                max={365}
                value={sistemaLocal.diasAutoRechazo}
                onChange={(v) =>
                  setSistemaLocal((s) => ({
                    ...s,
                    diasAutoRechazo: v || 14,
                  }))
                }
                placeholder="14"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Los presupuestos pendientes que no fueron aceptados en este plazo
                se marcarán automáticamente como rechazados al abrir la app.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="reg-pref">Prefijo WhatsApp</Label>
                <Input
                  id="reg-pref"
                  value={sistemaLocal.prefijoWhatsApp}
                  onChange={(e) =>
                    setSistemaLocal((s) => ({
                      ...s,
                      prefijoWhatsApp: e.target.value.replace(/\D/g, '') || '54',
                    }))
                  }
                  className="h-11"
                  inputMode="numeric"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">54 = Argentina</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-mon">Moneda</Label>
                <Input
                  id="reg-mon"
                  value={sistemaLocal.moneda}
                  onChange={(e) =>
                    setSistemaLocal((s) => ({ ...s, moneda: e.target.value }))
                  }
                  className="h-11"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-iva-base">IVA base / tope (%)</Label>
              <NumericInput
                id="reg-iva-base"
                allowDecimals
                min={0}
                max={100}
                value={Math.round((sistemaLocal.ivaBasePct ?? SISTEMA_DEFAULT.ivaBasePct) * 1000) / 10}
                onChange={(v) =>
                  setSistemaLocal((s) => ({ ...s, ivaBasePct: v / 100 }))
                }
                placeholder="21"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Alícuota "tope" a la que debe llegar cualquier ítem al discriminar
                IVA en un presupuesto o venta (ej. 21%).
              </p>
            </div>
            <div className="grid gap-2">
              <Label>IVA incluido en el precio, por línea (%)</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Alícuota que YA viene incluida en el precio unitario que el
                vendedor carga para cada línea de abertura. Al discriminar IVA,
                el sistema usa esto para descomponer el precio de cada ítem a
                su valor base (neto) antes de aplicar el IVA base de arriba.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LINEAS.map((linea) => (
                  <div key={linea} className="grid gap-1.5">
                    <Label htmlFor={`reg-iva-linea-${linea}`} className="text-xs text-muted-foreground">
                      {linea}
                    </Label>
                    <NumericInput
                      id={`reg-iva-linea-${linea}`}
                      allowDecimals
                      min={0}
                      max={100}
                      value={
                        Math.round(
                          (sistemaLocal.ivaPorLinea?.[linea] ??
                            SISTEMA_DEFAULT.ivaPorLinea[linea]) * 1000,
                        ) / 10
                      }
                      onChange={(v) =>
                        setSistemaLocal((s) => ({
                          ...s,
                          ivaPorLinea: {
                            ...(s.ivaPorLinea ?? SISTEMA_DEFAULT.ivaPorLinea),
                            [linea]: v / 100,
                          },
                        }))
                      }
                      placeholder="10,5"
                      className="h-11"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-recargo-tarjeta">Recargo por pago con Tarjeta (%)</Label>
              <NumericInput
                id="reg-recargo-tarjeta"
                allowDecimals
                min={0}
                max={100}
                value={
                  Math.round(
                    (sistemaLocal.recargoTarjetaPct ?? SISTEMA_DEFAULT.recargoTarjetaPct) * 1000,
                  ) / 10
                }
                onChange={(v) =>
                  setSistemaLocal((s) => ({ ...s, recargoTarjetaPct: v / 100 }))
                }
                placeholder="30"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Se aplica a cualquier pago (inicial o posterior) que el vendedor
                registre con forma de pago Tarjeta, tanto en ventas como al
                registrar un pago sobre una venta existente.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-recargo-cheque">Recargo por pago con Cheque (IVA %)</Label>
              <NumericInput
                id="reg-recargo-cheque"
                allowDecimals
                min={0}
                max={100}
                value={
                  Math.round(
                    (sistemaLocal.recargoChequePct ?? SISTEMA_DEFAULT.recargoChequePct) * 1000,
                  ) / 10
                }
                onChange={(v) =>
                  setSistemaLocal((s) => ({ ...s, recargoChequePct: v / 100 }))
                }
                placeholder="21"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Se suma al monto base de cualquier pago (inicial o posterior)
                que el vendedor registre con forma de pago Cheque, para
                trasladarle al cliente el IVA que ese cheque genera. Igual
                mecánica que el recargo de Tarjeta.
              </p>
            </div>
            <Button
              onClick={handleGuardarSistema}
              disabled={actualizarAjustes.isPending}
              className="h-11 mt-1"
            >
              {actualizarAjustes.isPending ? 'Guardando...' : 'Guardar reglas'}
            </Button>
          </div>
          )}
        </SectionCard>
        )}

        {/* ─── Respaldo (solo admin) ─── */}
        {esAdmin && (
        <SectionCard icon={Database} title="Respaldo y restauración">
          <p className="text-xs text-muted-foreground mb-3">
            Exportá todos los datos (clientes, obras, pagos y configuración)
            como un archivo JSON. Podés importarlo en otro dispositivo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={handleExportar}>
              <Download className="size-4" />
              Exportar respaldo
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportar}
                className="sr-only"
              />
              <span className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/60 backdrop-blur-sm shadow-xs hover:bg-elevated hover:border-primary/30 transition-colors text-sm font-medium">
                <Upload className="size-4" />
                Importar respaldo
              </span>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            ⚠️ Importar reemplaza todos los datos actuales.
          </p>
        </SectionCard>
        )}

        {/* ─── Zona peligrosa (solo admin) ─── */}
        {esAdmin && (
        <SectionCard icon={Trash2} title="Zona peligrosa" danger>
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="h-11 justify-start"
              onClick={handleReset}
            >
              <RotateCcw className="size-4" />
              Restablecer configuración a valores por defecto
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <Trash2 className="size-4" />
                  Borrar TODOS los datos (clientes, obras, pagos)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    ¿Borrar todos los datos?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente todos los clientes,
                    obras y pagos. La configuración se restablece a valores
                    por defecto. Esta acción NO se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBorrarTodo}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Sí, borrar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SectionCard>
        )}
    </AppLayout>
  )
}

/* ────────────── Sub-componentes ────────────── */

function SectionCard({
  icon: Icon,
  title,
  children,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <Card className={cn(
      'border-border/60 bg-card/60 backdrop-blur-sm dark:bg-gradient-to-b dark:from-card/90 dark:to-card/60',
      danger && 'border-destructive/30',
    )}>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            'flex size-8 items-center justify-center rounded-lg ring-1 ring-inset',
            danger
              ? 'bg-destructive/15 text-destructive ring-destructive/25'
              : 'bg-primary/15 text-primary ring-primary/25',
          )}>
            <Icon className="size-4" />
          </span>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h3>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function TemaOption({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all',
        active
          ? 'bg-primary/10 border-primary/40 text-primary'
          : 'bg-card/40 border-border/60 text-muted-foreground hover:bg-elevated hover:text-foreground',
      )}
    >
      <Icon className="size-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
