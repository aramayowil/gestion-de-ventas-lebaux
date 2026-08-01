/**
 * components/layout/BottomTabBar.tsx — Tab bar inferior fija.
 *
 * Vive en layout/ (no en lebaux/) porque es parte del armazón de la app,
 * igual criterio que AppHeader/AppLayout/HubLayout/ThemeProvider.
 *
 * Antes, Home era un "hub" sin conexiones entre secciones: Dashboard,
 * Clientes, Registros y Ajustes solo se accedían desde Home, así que
 * moverse entre secciones significaba volver a Home cada vez.
 *
 * Esta barra vive fija al pie de las pantallas principales: cada una
 * la pide directamente a `AppLayout` con la prop `withBottomBar` (ver
 * components/layout/AppLayout.tsx). Permite saltar directo entre
 * secciones sin pasar por Home, como cualquier tab bar mobile-first
 * estándar. Inicio se abre tocando el logo del encabezado, por lo que no
 * necesita ocupar uno de los cuatro accesos de esta barra.
 *
 * Diseño: barra fija de borde a borde (no pastilla flotante), igual
 * criterio que AppHeader — layout de 3 franjas apiladas: header (navbar)
 * / main / bottom bar, como cualquier app nativa. `AppLayout` es quien
 * arma esas 3 franjas; este componente es solo el contenido de la
 * tercera.
 *
 * No usa `position: fixed` ni `z-index`: queda fija porque `AppLayout`
 * la coloca en su propio contenedor `shrink-0`, hermano del `<main>`
 * que scrollea (que es el único con `overflow-y-auto`), dentro de un
 * layout de altura total fija (`h-dvh`). Al no estar dentro del área
 * scrolleable, nunca se mueve — es fija por estructura, no por
 * posicionamiento. Mismo criterio que AppHeader (ver ese archivo).
 *
 * Comportamiento: SIEMPRE visible, no se oculta al escrolear. Al ser una
 * app cerrada usada a diario por el mismo equipo, priorizamos acceso
 * constante a la navegación por sobre "ganar" un par de líneas extra de
 * contenido en pantalla.
 *
 * No aparece en sub-pantallas (detalle de cliente, formulario de obra,
 * pagos de obra): ahí el patrón de navegación es "entrar → hacer algo →
 * volver", y agregar la tab bar solo compite por atención con las
 * acciones propias de esa pantalla. Esas páginas simplemente no pasan
 * `withBottomBar` a su `AppLayout`.
 */
import { NavLink } from 'react-router-dom'
import { CalendarDays, ChartColumn, History, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/dashboard', label: 'Dashboard', icon: ChartColumn, end: false },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, end: false },
  { to: '/registros', label: 'Registros', icon: History, end: false },
] as const

export function BottomTabBar() {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'border-t border-border/50 bg-card/95 pb-safe',
        'backdrop-blur-xl',
        'dark:bg-card/90',
        'shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.4)]',
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-1 justify-center"
          >
            {({ isActive }) => (
              <span
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 px-1.5 py-2 text-[10px] font-medium tracking-wide transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-xl px-3.5 py-1 transition-colors',
                    isActive && 'bg-primary/15',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Alto aproximado de la barra, quedó del esquema anterior por si algún
 * caller externo todavía necesita reservar espacio manualmente (ver
 * ClientesHome/RegistrosPage, que usan mainClassName custom). Ya no la
 * usa AppLayout con el mainClassName por defecto para "esconder"
 * contenido detrás de una barra fixed — ahora es simplemente el padding
 * inferior del <main> para que el último ítem no quede pegado al borde. */
export const BOTTOM_TAB_BAR_SPACE = 'pb-20'
