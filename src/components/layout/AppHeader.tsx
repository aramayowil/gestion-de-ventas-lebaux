/**
 * components/layout/AppHeader.tsx — Navbar premium simplificada.
 *
 * Solo contiene:
 *   · Logo de Lebaux (isotipo o logo completo según pantalla)
 *   · Botón "Volver" opcional (sub-páginas)
 *   · ThemeToggle opcional (solo en Ajustes, donde se controla el tema)
 *
 * El botón "Nuevo cliente" vive como FAB (ver AppLayout.tsx) — se sacó
 * del header porque en mobile competía por espacio con el logo/título,
 * y un FAB fijo abajo a la derecha es más accesible con el pulgar.
 *
 * Como el tema ahora vive en Ajustes, no mostramos el toggle en cada
 * navbar para reducir carga visual.
 *
 * La barra queda fija y siempre visible porque `AppLayout` la coloca
 * fuera del `<main>` scrolleable (en un contenedor `shrink-0`, con
 * altura de viewport fija arriba) — no depende de `position: sticky`,
 * que es frágil ante cualquier `overflow` en un ancestro. Ver
 * components/layout/AppLayout.tsx.
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Settings, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'

interface AppHeaderProps {
  /** Título opcional a mostrar junto al logo (sub-páginas). */
  title?: string
  subtitle?: string
  onBack?: () => void
  /** Acciones extras (raro). */
  actions?: React.ReactNode
  maxWidth?: string
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  actions,
  maxWidth = 'max-w-5xl',
}: AppHeaderProps) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const etiquetaUsuario =
    currentUser?.rol === 'admin' ? 'Administrador' : 'Vendedor'

  function irAlInicioDesdeLogo() {
    navigate('/')
  }

  return (
    <header
      className={cn(
        'z-20 border-b border-border/60 bg-card/80 backdrop-blur-xl pt-safe dark:bg-card/60',
      )}
    >
      <div
        className={cn(
          maxWidth,
          'mx-auto flex items-center gap-2.5 px-3 py-2.5 sm:px-4',
        )}
      >
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Volver"
            className="h-11 w-11 -ml-2 shrink-0 rounded-full"
          >
            <ArrowLeft className="size-5" />
          </Button>
        ) : null}

        <button
          type="button"
          onClick={irAlInicioDesdeLogo}
          aria-label="Ir al inicio"
          className="shrink-0 cursor-pointer rounded-md transition-opacity hover:opacity-80"
        >
          <img
            src={onBack ? '/logo_recortado.png' : '/logo.png'}
            alt=""
            className={cn(
              'object-contain',
              onBack ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-auto sm:h-10',
            )}
          />
        </button>

        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg font-display">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="truncate text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {/* Usuario + logout */}
          {currentUser && (
            <div className="ml-1 flex items-center gap-1.5 border-l border-border/40 pl-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <span className="truncate max-w-24 sm:max-w-28">
                      {title ? currentUser.nombre : etiquetaUsuario}
                    </span>
                    <ChevronDown className="ml-1.5 size-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="h-9 justify-start px-2 text-sm"
                      onClick={() => navigate('/ajustes')}
                    >
                      <Settings className="mr-2 size-4 shrink-0" />
                      Ajustes
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-9 justify-start px-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={logout}
                    >
                      <LogOut className="mr-2 size-4 shrink-0" />
                      Cerrar sesión
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
