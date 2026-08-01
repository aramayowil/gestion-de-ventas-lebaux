/**
 * pages/HomePage.tsx — Bienvenida sencilla al espacio de trabajo.
 *
 * La navegación inferior ya concentra todos los accesos principales, por eso
 * esta pantalla no repite métricas ni acciones. Su único propósito es recibir
 * al usuario con una bienvenida clara y tranquila antes de comenzar el día.
 */
import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useNuevoClienteModal } from '@/hooks/use-nuevo-cliente-modal'
import { useAuthStore } from '@/lib/stores/auth-store'

interface Props {
  onVerCliente: (clienteId: string) => void
}

export function HomePage({ onVerCliente }: Props) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const location = useLocation()
  const regresoDesdeLogo =
    (location.state as { desdeLogo?: boolean } | null)?.desdeLogo === true
  const { abrirNuevoCliente, modalNuevoCliente } = useNuevoClienteModal(
    (cliente) => onVerCliente(cliente.id),
  )

  const saludo = React.useMemo(() => {
    const hora = new Date().getHours()

    if (hora < 12) return 'Buenos días'
    if (hora < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  const fechaDeHoy = React.useMemo(() => {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  }, [])

  const destinatario =
    currentUser?.rol === 'vendedor' ? 'Vendedor' : 'Administrador'

  return (
    <AppLayout
      withBottomBar
      onNuevoCliente={abrirNuevoCliente}
      animarNuevoCliente
      mainClassName="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-8 pt-16 text-center sm:justify-center sm:pt-8"
    >
      <section
        key={location.key}
        className="flex w-full max-w-xl flex-col items-center"
      >
        <h1 className="home-entrada font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {saludo}, {destinatario}.
        </h1>

        <p className="home-entrada home-entrada-2 mt-3 text-xs capitalize tracking-wide text-muted-foreground">
          {fechaDeHoy}
        </p>

        <p className="home-entrada home-entrada-3 mt-16 max-w-md text-lg leading-8 text-muted-foreground sm:text-xl">
          Cada nuevo día es una oportunidad para avanzar, crecer y hacer la
          diferencia.
        </p>

        {!regresoDesdeLogo && (
          <p className="home-entrada home-entrada-4 mt-14 font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Comencemos.
          </p>
        )}
      </section>

      {modalNuevoCliente}
    </AppLayout>
  )
}

export default HomePage
