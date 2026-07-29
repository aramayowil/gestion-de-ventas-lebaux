/**
 * routes/index.tsx — Definición de todas las rutas del sistema.
 *
 * Antes esto vivía mezclado adentro de App.tsx. Se separó acá para que
 * App.tsx quede corto y solo se encargue de "arrancar" la app (tema,
 * router, notificaciones), mientras que este archivo se encarga de "qué
 * pantalla corresponde a cada URL".
 *
 * Cada wrapper (HomeRoute, DashboardRoute, etc.) traduce useParams/
 * useNavigate a las props que la página ya esperaba, así el código de
 * cada página en components/lebaux/ no tuvo que tocarse.
 *
 * Rutas:
 *   /                                  — home con 4 cards de acceso
 *   /dashboard                         — KPIs, alertas, gráficos
 *   /clientes                          — lista de clientes con búsqueda
 *   /clientes/:clienteId               — perfil de un cliente con sus obras
 *   /clientes/:clienteId/obras/nueva   — form de creación de obra
 *   /clientes/:clienteId/obras/:obraId — form de edición de obra
 *   /obras/:obraId/pagos               — historial y registro de pagos de una obra
 *   /registros                         — historial de presupuestos y pagos
 *   /ajustes                           — configuración del sistema
 */
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import type { TipoObra } from '@/lib/types'
import { HubLayout } from '@/components/layout/HubLayout'
import { RequireAuth, RequireAdmin } from '@/components/auth/RequireAuth'
import { HomePage } from '@/pages/HomePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientesHome } from '@/pages/ClientesHome'
import { RegistrosPage } from '@/pages/RegistrosPage'
import { AjustesPage } from '@/pages/AjustesPage'
import { AgendaFabricaPage } from '@/pages/AgendaFabricaPage'
import { LoginPage } from '@/pages/LoginPage'
import { GestionVendedoresPage } from '@/pages/GestionVendedoresPage'
import { ClienteDetalle } from '@/pages/ClienteDetalle'
import { ObraForm } from '@/pages/obra-form'
import { PagosObraPage } from '@/pages/PagosObraPage'
import { useObraById } from '@/hooks/queries'

/* ────────────── Wrappers de ruta ──────────────
 * Traducen useParams/useNavigate a las props que cada página ya espera. */

function HomeRoute() {
  const navigate = useNavigate()
  return (
    <HomePage
      onIr={(destino) => navigate(`/${destino}`)}
      onVerCliente={(id) => navigate(`/clientes/${id}`)}
    />
  )
}

function DashboardRoute() {
  const navigate = useNavigate()
  return (
    <DashboardPage
      onVolver={() => navigate('/')}
      onVerCliente={(id) => navigate(`/clientes/${id}`)}
    />
  )
}

function ClientesRoute() {
  const navigate = useNavigate()
  return (
    <ClientesHome
      onVerCliente={(id) => navigate(`/clientes/${id}`)}
      onVolver={() => navigate('/')}
    />
  )
}

function RegistrosRoute() {
  const navigate = useNavigate()
  return (
    <RegistrosPage
      onVolver={() => navigate('/')}
      onVerCliente={(id) => navigate(`/clientes/${id}`)}
    />
  )
}

function AjustesRoute() {
  const navigate = useNavigate()
  return <AjustesPage onVolver={() => navigate('/')} />
}

function AgendaRoute() {
  const navigate = useNavigate()
  return (
    <AgendaFabricaPage
      onVolver={() => navigate('/')}
      onVerCliente={(id) => navigate(`/clientes/${id}`)}
    />
  )
}

function GestionVendedoresRoute() {
  const navigate = useNavigate()
  return <GestionVendedoresPage onVolver={() => navigate('/')} />
}

function ClienteDetalleRoute() {
  const { clienteId } = useParams<{ clienteId: string }>()
  const navigate = useNavigate()
  if (!clienteId) return <Navigate to="/clientes" replace />
  return (
    <ClienteDetalle
      key={clienteId}
      clienteId={clienteId}
      onVolver={() => navigate('/clientes')}
      onNuevaObra={(tipo) => navigate(`/clientes/${clienteId}/obras/nueva?tipo=${tipo}`)}
      onEditarObra={(obraId) =>
        navigate(`/clientes/${clienteId}/obras/${obraId}`)
      }
      onVerPagosObra={(obraId) => navigate(`/obras/${obraId}/pagos`)}
      onContinuarBorrador={(tipo) =>
        navigate(`/clientes/${clienteId}/obras/nueva?tipo=${tipo}`)
      }
    />
  )
}

function ObraFormRoute() {
  const { clienteId, obraId } = useParams<{
    clienteId: string
    obraId?: string
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  if (!clienteId) return <Navigate to="/clientes" replace />
  const tipoParam = searchParams.get('tipo')
  const tipoInicial: TipoObra | undefined =
    tipoParam === 'presupuesto' || tipoParam === 'venta' ? tipoParam : undefined
  return (
    <ObraForm
      key={`obra-${clienteId}-${obraId ?? 'nueva'}`}
      clienteId={clienteId}
      obraId={obraId}
      tipoInicial={tipoInicial}
      onVolver={() => navigate(`/clientes/${clienteId}`)}
      onIrAInicio={() => navigate('/')}
      onFinalizado={() => navigate(`/clientes/${clienteId}`, { replace: true })}
    />
  )
}

function PagosObraRoute() {
  const { obraId } = useParams<{ obraId: string }>()
  const navigate = useNavigate()
  const { data: obra } = useObraById(obraId)
  if (!obraId) return <Navigate to="/" replace />
  return (
    <PagosObraPage
      key={obraId}
      obraId={obraId}
      onVolver={() => {
        if (obra) navigate(`/clientes/${obra.clienteId}`)
        else navigate('/')
      }}
    />
  )
}

/**
 * Rutas — árbol completo de rutas de la aplicación.
 *
 * Las 6 pantallas principales (Home, Dashboard, Clientes, Agenda,
 * Registros, Ajustes) van adentro de HubLayout, que solo las agrupa bajo
 * `<RequireAuth>`; cada una pide su propia tab bar inferior directamente
 * a `AppLayout` (prop `withBottomBar`).
 *
 * Las sub-pantallas (detalle de cliente, form de obra, pagos de obra) NO
 * pasan por HubLayout ni piden `withBottomBar`: se llega a ellas
 * navegando desde un hub, así que no necesitan la tab bar de vuelta.
 */
export function Rutas() {
  return (
    <Routes>
      {/* Login: pública, sin layout */}
      <Route path="/login" element={<LoginPage />} />

      {/* Todo lo demás requiere sesión */}
      <Route element={<RequireAuth><HubLayout /></RequireAuth>}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/clientes" element={<ClientesRoute />} />
        <Route path="/agenda" element={<AgendaRoute />} />
        <Route path="/registros" element={<RegistrosRoute />} />
        <Route path="/ajustes" element={<AjustesRoute />} />
        {/* Solo admin */}
        <Route
          path="/admin/vendedores"
          element={
            <RequireAdmin>
              <GestionVendedoresRoute />
            </RequireAdmin>
          }
        />
      </Route>

      {/* Sub-páginas (también requieren sesión pero sin bottom bar) */}
      <Route
        path="/clientes/:clienteId"
        element={
          <RequireAuth>
            <ClienteDetalleRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/clientes/:clienteId/obras/nueva"
        element={
          <RequireAuth>
            <ObraFormRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/clientes/:clienteId/obras/:obraId"
        element={
          <RequireAuth>
            <ObraFormRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/obras/:obraId/pagos"
        element={
          <RequireAuth>
            <PagosObraRoute />
          </RequireAuth>
        }
      />
      {/* Cualquier ruta desconocida vuelve al home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
