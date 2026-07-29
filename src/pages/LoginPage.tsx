/**
 * pages/LoginPage.tsx — Pantalla de login con Supabase Auth.
 *
 * Pide email + password. Supabase Auth maneja la autenticación.
 */
import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Spinner } from '@/hooks/use-async-data'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [cargando, setCargando] = React.useState(false)

  const from = (location.state as { from?: string })?.from ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const r = await login(email, password)
    if (!r.ok) {
      setError(r.error ?? 'Error al iniciar sesión.')
      setCargando(false)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + título */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Lebaux"
              className="h-12 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Lebaux
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión de Aberturas
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 dark:bg-card/40">
          <div className="grid gap-2">
            <Label htmlFor="email">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" />
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
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" />
                Contraseña
              </span>
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
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
            ) : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
