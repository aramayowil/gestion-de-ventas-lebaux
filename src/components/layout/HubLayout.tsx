/**
 * components/layout/HubLayout.tsx — Envoltorio para las 6 pantallas
 * principales (Home, Dashboard, Clientes, Agenda, Registros, Ajustes).
 *
 * Antes esto era una función suelta adentro de App.tsx. Se movió acá
 * porque es parte del armazón de rutas — agrupa estas 6 rutas bajo
 * `<RequireAuth>` una sola vez en routes.tsx, en vez de repetirlo en
 * cada <Route>.
 *
 * Ya no agrega la BottomTabBar acá: cada página la pide directamente a
 * `AppLayout` vía la prop `withBottomBar` (ver AppLayout.tsx), así el
 * layout de navbar/main/bottom-bar queda enteramente controlado por la
 * página, sin depender de en qué Route esté montada.
 *
 * Las sub-pantallas (detalle de cliente, form de obra, pagos de obra) NO
 * pasan por este layout: se llega a ellas navegando desde un hub, y no
 * piden `withBottomBar`. Esa decisión de qué rutas usan este layout se
 * toma en routes/index.tsx, no acá.
 */
import { Outlet } from 'react-router-dom'

export function HubLayout() {
  return <Outlet />
}
