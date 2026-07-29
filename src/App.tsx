/**
 * App.tsx — Punto de entrada del sistema Lebaux.
 *
 * Inicializa Supabase Auth. Todos los datos del servidor (ajustes,
 * users, clientes, obras, etc.) se cargan automáticamente vía
 * TanStack Query (lazy, on-demand, con cache compartida) en cada
 * componente que los necesita — no hace falta precargar nada acá.
 */
import { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import { Rutas } from '@/routes/routes'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Spinner } from '@/hooks/use-async-data'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    init()
  }, [init])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <HashRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        {loading ? (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Spinner className="size-8" />
          </div>
        ) : (
          <Rutas />
        )}
      </HashRouter>
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  )
}
