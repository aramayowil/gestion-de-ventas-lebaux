/**
 * pages/LoginPage.tsx — Pantalla de login con Supabase Auth.
 *
 * Pide email + password. Supabase Auth maneja la autenticación y el formulario
 * conserva su lugar mientras espera: así el usuario ve qué está ocurriendo en
 * vez de saltar a una pantalla de carga global.
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Spinner } from '@/hooks/use-async-data'
import { cn } from '@/lib/utils'

function obtenerMensajeErrorLogin(error?: string): string {
  const errorNormalizado = error?.toLowerCase() ?? ''

  if (errorNormalizado.includes('invalid login credentials')) {
    return 'El email o la contraseña no son correctos.'
  }
  if (errorNormalizado.includes('email not confirmed')) {
    return 'Primero tenés que confirmar tu email.'
  }
  if (errorNormalizado.includes('rate limit')) {
    return 'Hubo demasiados intentos. Esperá un momento y volvé a probar.'
  }
  if (
    errorNormalizado.includes('fetch') ||
    errorNormalizado.includes('network')
  ) {
    return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.'
  }

  return 'No pudimos iniciar sesión. Intentá nuevamente.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState('')
  const [cargando, setCargando] = React.useState(false)
  const [saliendo, setSaliendo] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Evita un segundo intento si el formulario se envía dos veces antes de
    // que React alcance a deshabilitarlo (por ejemplo, con Enter + toque).
    if (cargando) return

    setError('')
    setCargando(true)

    try {
      const resultado = await login(email.trim(), password)

      if (!resultado.ok) {
        setError(obtenerMensajeErrorLogin(resultado.error))
        setCargando(false)
        return
      }

      // La salida se coordina con la animación que Home ya reproduce al montar.
      // Si el usuario pidió reducir movimiento, navegamos sin demoras.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigate('/', { replace: true })
        return
      }

      setSaliendo(true)
    } catch {
      setError(
        'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.',
      )
      setCargando(false)
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center bg-background p-4 sm:p-8',
        saliendo && 'login-salida',
      )}
      onAnimationEnd={(event) => {
        if (saliendo && event.target === event.currentTarget) {
          navigate('/', { replace: true })
        }
      }}
    >
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Logo Lebaux"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenido de nuevo
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-sm dark:bg-card/40"
          aria-busy={cargando}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                Email
              </span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@lebaux.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              disabled={cargando}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  Contraseña
                </span>
              </Label>
            </div>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                disabled={cargando}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={cargando}
                className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mensaje de error anunciado para accesibilidad */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3"
              id="login-error"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={cargando}>
            {cargando ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner className="size-4" />
                Verificando datos…
              </span>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
