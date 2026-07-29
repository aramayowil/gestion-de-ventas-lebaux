/**
 * components/layout/AppLayout.tsx — Layout genérico de página.
 *
 * Estructura fija de 3 franjas apiladas, igual criterio que cualquier
 * app nativa: navbar (AppHeader) → main (contenido, scrolleable) →
 * bottom bar (BottomTabBar, opcional). No incluye footer: cada página
 * que necesite mostrar el aviso de almacenamiento local u otro texto de
 * pie lo agrega dentro de su propio contenido, como children.
 *
 * El contenedor raíz fija su altura a la pantalla (`h-dvh`, viewport
 * dinámico — se ajusta bien en mobile con barras de navegador que
 * aparecen/desaparecen) y hace que header y bottom bar tengan altura
 * fija (`shrink-0`, no se encogen ni scrollean), mientras que **solo**
 * el `<main>` recibe `flex-1 min-h-0 overflow-y-auto` y es el único
 * elemento que scrollea. Así la navbar queda genuinamente fija, sin
 * depender de `position: sticky` ni de que no haya `overflow` en algún
 * ancestro (ver index.css para el problema que esto evita).
 *
 * La bottom tab bar se pide explícitamente por prop (`withBottomBar`)
 * en vez de vivir en un layout aparte (`HubLayout`): así cualquier
 * página puede decidir si la necesita, sin depender de en qué Route
 * esté montada. Las 6 pantallas principales (Home, Dashboard, Clientes,
 * Agenda, Registros, Ajustes) la piden; las sub-páginas (detalle de
 * cliente, form de obra, pagos de obra) no.
 */
import * as React from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { BottomTabBar, BOTTOM_TAB_BAR_SPACE } from '@/components/layout/BottomTabBar'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  /** Título opcional a mostrar junto al logo (sub-páginas). */
  title?: string
  subtitle?: string
  onBack?: () => void
  onIrAInicio?: () => void
  /** Click en el botón "Nuevo cliente" del header. Si no se provee, no se muestra. */
  onNuevoCliente?: () => void
  /** Acciones extras en el header (raro). */
  headerActions?: React.ReactNode
  /** Ancho máximo compartido entre header y main (por defecto max-w-5xl). */
  maxWidth?: string
  /** Clases extra para el <main> (padding, spacing, etc. propios de la página). */
  mainClassName?: string
  /** Muestra la BottomTabBar fija abajo y reserva su espacio dentro del
   * <main> scrolleable. Solo la piden las 6 pantallas principales. */
  withBottomBar?: boolean
  /** Contenido de la página. */
  children: React.ReactNode
}

export function AppLayout({
  title,
  subtitle,
  onBack,
  onIrAInicio,
  onNuevoCliente,
  headerActions,
  maxWidth = 'max-w-5xl',
  mainClassName,
  withBottomBar = false,
  children,
}: AppLayoutProps) {
  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <div className="shrink-0">
        <AppHeader
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          onIrAInicio={onIrAInicio}
          onNuevoCliente={onNuevoCliente}
          actions={headerActions}
          maxWidth={maxWidth}
        />
      </div>

      <main
        className={cn(
          mainClassName ??
            `flex-1 min-h-0 overflow-y-auto ${maxWidth} w-full mx-auto px-4 py-5 space-y-5`,
          withBottomBar && BOTTOM_TAB_BAR_SPACE,
        )}
      >
        {children}
      </main>

      {withBottomBar && (
        <div className="shrink-0">
          <BottomTabBar />
        </div>
      )}
    </div>
  )
}
