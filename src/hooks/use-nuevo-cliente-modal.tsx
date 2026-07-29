/**
 * hooks/use-nuevo-cliente-modal.tsx
 *
 * El modal "Nuevo cliente" se abre desde dos lugares (Home y Clientes),
 * y en ambos la lógica es idéntica: un `useState` para el `open`, una
 * instancia de `ClienteFormModal`, y el mismo `onGuardado` (cerrar +
 * navegar al cliente recién creado). Antes esa lógica estaba copiada en
 * los dos componentes; este hook la centraliza para que cada pantalla
 * solo tenga que llamarlo y renderizar el modal que devuelve.
 */
import * as React from 'react'
import { ClienteFormModal } from '@/components/lebaux/clientes/ClienteFormModal'
import type { Cliente } from '@/lib/types'

/**
 * @param onGuardado callback ejecutado cuando el cliente se crea con éxito
 *   (después de cerrar el modal). Típicamente navega al perfil del cliente.
 */
export function useNuevoClienteModal(onGuardado: (cliente: Cliente) => void) {
  const [open, setOpen] = React.useState(false)

  const abrirNuevoCliente = React.useCallback(() => setOpen(true), [])

  const modalNuevoCliente = (
    <ClienteFormModal
      open={open}
      onClose={() => setOpen(false)}
      onGuardado={(cliente) => {
        setOpen(false)
        onGuardado(cliente)
      }}
    />
  )

  return { abrirNuevoCliente, modalNuevoCliente }
}
