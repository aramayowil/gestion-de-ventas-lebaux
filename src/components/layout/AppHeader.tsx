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
import { ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'

interface AppHeaderProps {
  /** Título opcional a mostrar junto al logo (sub-páginas). */
  title?: string
  subtitle?: string
  onBack?: () => void
  onIrAInicio?: () => void
  /** Acciones extras (raro). */
  actions?: React.ReactNode
  maxWidth?: string
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  onIrAInicio,
  actions,
  maxWidth = 'max-w-5xl',
}: AppHeaderProps) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  return (
    <header
      className={cn(
        'z-20 border-b border-border/40 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 pt-safe dark:bg-card/60 dark:supports-[backdrop-filter]:bg-card/50',
      )}
    >
      <div className={cn(maxWidth, 'mx-auto flex items-center gap-2.5 px-3 py-2.5 sm:px-4')}>
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

        {onBack ? (
          // Si onIrAInicio no se pasa (o apunta al mismo lugar que onBack),
          // no mostramos logo: el botón "atrás" ya cubre esa acción y
          // agregar el isotipo sería redundante al lado del título.
          //
          // Solo se vuelve clickeable cuando el caller necesita un atajo a
          // un destino realmente distinto de "volver" (ver ObraForm, donde
          // "atrás" vuelve a la obra pero el logo va al inicio real).
          onIrAInicio ? (
            <button
              type="button"
              onClick={onIrAInicio}
              aria-label="Ir al inicio"
              className="shrink-0 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img
                src="/logo_recortado.png"
                alt=""
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
              />
            </button>
          ) : null
        ) : (
          // En Home (sin botón "volver") usamos logo.png completo porque
          // hay más espacio horizontal y la marca completa tiene más peso.
          <img
            src="/logo.png"
            alt="Lebaux"
            className="h-9 sm:h-10 w-auto shrink-0 cursor-pointer"
            onClick={onIrAInicio}
          />
        )}

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
            <div className="flex items-center gap-1.5 pl-1.5 ml-1 border-l border-border/40">
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-24">
                {currentUser.nombre}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Cerrar sesión"
                className="size-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filete dorado: la firma visual de Lebaux */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </header>
  )
}
