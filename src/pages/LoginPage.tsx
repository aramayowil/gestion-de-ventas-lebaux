/**
 * pages/LoginPage.tsx — Pantalla de login con Supabase Auth.
 *
 * Pide email + password. Supabase Auth maneja la autenticación.
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Spinner } from '@/hooks/use-async-data'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState('')
  const [cargando, setCargando] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const r = await login(email, password)

    if (!r.ok) {
      setError(r.error ?? 'Error al iniciar sesión. Verifica tus credenciales.')
      setCargando(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4 sm:p-8">
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
          className="space-y-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 dark:bg-card/40 shadow-sm"
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
              autoFocus
              required
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
                disabled={cargando}
                className="pr-10" // Espacio para el icono del ojo
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={cargando}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
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

          {/* Mensaje de Error con aria-live para accesibilidad */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3"
              aria-live="polite"
            >
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={cargando}>
            {cargando ? (
              <span className="flex items-center gap-2 justify-center">
                <Spinner className="size-4" />
                Ingresando...
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
