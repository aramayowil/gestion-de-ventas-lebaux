/**
 * components/lebaux/clientes/ClienteFormModal.tsx — Modal para crear/editar cliente.
 *
 * Simplificado: solo pide nombre + teléfono WhatsApp (único).
 * El teléfono se normaliza a solo dígitos antes de validar y guardar.
 */
import * as React from 'react'
import { toast } from 'sonner'
import { MessageCircle, AlertTriangle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useClientes, useCreateCliente, useUpdateCliente } from '@/hooks/queries'
import { useAjustes, AJUSTES_DEFAULT } from '@/hooks/queries'
import { useAuthStore } from '@/lib/stores/auth-store'
import { nuevoCliente, type Cliente } from '@/lib/types'
import {
  normalizarWhatsApp,
  formatearTelefonoInput,
  validarTelefonoArgentina,
} from '@/lib/obra-totales'

interface Props {
  open: boolean
  onClose: () => void
  clienteExistente?: Cliente
  onGuardado?: (cliente: Cliente) => void
}

export function ClienteFormModal({
  open,
  onClose,
  clienteExistente,
  onGuardado,
}: Props) {
  const { data: clientes = [] } = useClientes()
  const crearClienteMutation = useCreateCliente()
  const actualizarClienteMutation = useUpdateCliente()
  function buscarDuplicadoWhatsApp(tel: string, excluirId?: string) {
    return clientes.find((c) => c.telefonoWhatsApp === tel && c.id !== excluirId)
  }
  const prefijoWhatsApp = useAjustes(null).data?.sistema.prefijoWhatsApp ?? AJUSTES_DEFAULT.sistema.prefijoWhatsApp
  const currentUser = useAuthStore((s) => s.currentUser)

  const [nombre, setNombre] = React.useState('')
  const [telefono, setTelefono] = React.useState('')
  const [sinNumero, setSinNumero] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setNombre(clienteExistente?.nombre ?? '')
      // Cargar el teléfono formateado (con espacios y guion) si existe
      const telCrudo = clienteExistente?.telefonoWhatsApp ?? ''
      setTelefono(telCrudo ? formatearTelefonoInput(telCrudo) : '')
      // Si es un cliente existente sin número, dejamos el check tildado
      setSinNumero(!!clienteExistente && !telCrudo)
    }
  }, [open, clienteExistente])

  // Al tildar "sin número" limpiamos el campo para que no quede un
  // teléfono a medio escribir dando vueltas.
  function handleSinNumeroChange(checked: boolean) {
    setSinNumero(checked)
    if (checked) setTelefono('')
  }

  async function handleGuardar() {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      toast.error('El nombre del cliente es obligatorio.')
      return
    }

    let telNormalizado = ''
    if (!sinNumero) {
      telNormalizado = normalizarWhatsApp(telefono)
      if (!telNormalizado) {
        toast.error('El teléfono WhatsApp es obligatorio, o tildá "Sin número".')
        return
      }
      if (!validarTelefonoArgentina(telNormalizado)) {
        toast.error(
          'El teléfono no es válido. Debe ser un número argentino de 10 dígitos ' +
          '(sin el 0 inicial ni el 15). Ej: 381 572-9129.',
        )
        return
      }

      // Validar duplicado por WhatsApp (solo aplica si hay número)
      const dup = buscarDuplicadoWhatsApp(
        telNormalizado,
        clienteExistente?.id,
      )
      if (dup) {
        toast.error(
          `Ya existe un cliente "${dup.nombre}" con ese WhatsApp. No pueden repetirse.`,
        )
        return
      }
    }

    try {
      if (clienteExistente) {
        const cliente: Cliente = {
          ...clienteExistente,
          nombre: nombreTrim,
          telefonoWhatsApp: telNormalizado,
        }
        await actualizarClienteMutation.mutateAsync(cliente)
        toast.success(`Cliente "${cliente.nombre}" actualizado.`)
        if (sinNumero) {
          toast.warning(`"${cliente.nombre}" quedó guardado sin número de WhatsApp.`)
        }
        onGuardado?.(cliente)
      } else {
        const nuevo = nuevoCliente({
          nombre: nombreTrim,
          telefonoWhatsApp: telNormalizado,
          vendedorId: currentUser?.id ?? null,
          compartidoCon: [],
        })
        const creado = await crearClienteMutation.mutateAsync(nuevo)
        const clienteReal = creado ?? nuevo
        toast.success(`Cliente "${clienteReal.nombre}" creado.`)
        if (sinNumero) {
          toast.warning(`"${clienteReal.nombre}" quedó guardado sin número de WhatsApp.`)
        }
        onGuardado?.(clienteReal)
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el cliente.')
    }
  }

  // Handler del input: formatea mientras se tipea/pega.
  // El estado `telefono` guarda el valor formateado (con espacios y guion),
  // pero al guardar se normaliza a solo dígitos.
  function handleTelefonoChange(raw: string) {
    setTelefono(formatearTelefonoInput(raw))
  }

  // Vista previa del número como quedará en WhatsApp (con +54 9)
  // Construimos el formato completo manualmente porque formatWhatsApp
  // solo agrega +54 si el número ya viene con ese prefijo.
  const telefonoDisplay = (() => {
    if (!telefono) return ''
    const n = normalizarWhatsApp(telefono)
    if (n.length !== 10) return telefono
    return `+${prefijoWhatsApp} 9 ${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}`
  })()

  const telValido = telefono ? validarTelefonoArgentina(telefono) : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {clienteExistente ? 'Editar cliente' : 'Nuevo cliente'}
          </SheetTitle>
          <SheetDescription>
            Solo necesitamos el nombre y un WhatsApp de contacto. El WhatsApp
            debe ser único: no pueden existir dos clientes con el mismo número.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="grid gap-2">
            <Label htmlFor="cli-nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cli-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cli-tel">
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5" aria-hidden="true" />
                WhatsApp {!sinNumero && <span className="text-destructive">*</span>}
              </span>
            </Label>
            <Input
              id="cli-tel"
              value={telefono}
              onChange={(e) => handleTelefonoChange(e.target.value)}
              placeholder="Ej: 381 572-9129"
              inputMode="tel"
              autoComplete="off"
              disabled={sinNumero}
              className={cn(
                telValido === false && 'border-destructive/50 focus-visible:ring-destructive/30',
                telValido === true && 'border-success/50 focus-visible:ring-success/30',
              )}
            />
            {telefono && !sinNumero && (
              <p
                className={cn(
                  'text-[11px]',
                  telValido
                    ? 'text-success'
                    : 'text-muted-foreground',
                )}
              >
                {telValido ? (
                  <>Se enviará a: <span className="money">{telefonoDisplay}</span></>
                ) : (
                  <>Formato esperado: XXX XXX-XXXX (10 dígitos, sin 0 ni 15)</>
                )}
              </p>
            )}

            <label
              htmlFor="cli-sin-numero"
              className="mt-1 flex items-center gap-2 cursor-pointer select-none"
            >
              <Checkbox
                id="cli-sin-numero"
                checked={sinNumero}
                onCheckedChange={(v) => handleSinNumeroChange(v === true)}
              />
              <span className="text-sm text-muted-foreground">
                Cliente sin número de WhatsApp
              </span>
            </label>

            {sinNumero && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Vas a poder crear el cliente igual, pero va a quedar marcado
                  con un aviso de "sin número" hasta que lo cargues.
                </span>
              </p>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" className="h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="h-11"
            onClick={handleGuardar}
            disabled={crearClienteMutation.isPending || actualizarClienteMutation.isPending}
          >
            {crearClienteMutation.isPending || actualizarClienteMutation.isPending
              ? 'Guardando...'
              : clienteExistente ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
