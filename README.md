# Lebaux · Actas y Recibos — Sistema de Presupuestos

Sistema de gestión de **clientes**, **obras**, **presupuestos** y **pagos** para Lebaux SRL.

**Vite + React 19 + TypeScript + React Router v6 + Tailwind CSS v4 + shadcn/ui**

> Nota para lectores de este README generado/mantenido con ayuda de IA:
> también existe [`AGENTS.md`](./AGENTS.md), la guía completa para
> cualquier agente de IA (o dev nuevo) que tenga que trabajar en este
> repo — arquitectura, convenciones, dónde tocar qué, y dos principios
> que priman sobre todo lo demás: código fácil de leer por sobre
> eficiente, y diseño mobile-first por sobre desktop-first. Si notás
> que este README describe algo distinto de lo que ves en el código
> (pasa: quedó desactualizado en varios puntos), confiá en el código y,
> si podés, actualizá ambos documentos.

## Qué hace el sistema

### Modelo de datos
- **Cliente**: `nombre` + `telefonoWhatsApp` (único, normalizado a solo dígitos).
- **Obra**: incluye `estadoPresupuesto` (`borrador` | `enviado` | `aceptado` | `rechazado`)
  y fechas `enviadoEn`, `aceptadoEn`, `rechazadoEn`.
- El presupuesto **no es una entidad separada**: es el estado de la obra.
- **Pago**: registrado contra una obra, con recibo numerado correlativo.

### Navegación
- **React Router (`HashRouter`)** con rutas reales — ver `src/App.tsx` para el mapa completo.
- Las 5 pantallas principales (Home, Dashboard, Clientes, Registros, Ajustes)
  comparten un layout (`HubLayout`) con una **tab bar inferior flotante**
  (`BottomTabBar.tsx`) para saltar entre secciones sin volver a Home primero.
- Tanto la tab bar inferior como el header superior (`AppHeader.tsx`) se
  **ocultan al escrolear hacia abajo y reaparecen al subir** (o al llegar
  arriba de todo), vía el hook `useHideOnScroll` — libera pantalla en listas
  largas sin perder acceso a la navegación.
- Las sub-pantallas (detalle de cliente, formulario de obra, pagos de obra)
  no llevan tab bar: ahí el patrón es "entrar → hacer algo → volver".
- Los KPIs del Dashboard son **clickeables** y deep-linkean con
  `useSearchParams` a vistas ya filtradas (ej: tocar "Saldo" lleva a
  `/clientes?filtro=deuda`; tocar "Enviados" lleva a
  `/registros?estado=enviado`).

### Sistema de presupuestos
- Al crear una obra sin pago inicial → estado **borrador**.
- Al crear una obra con pago inicial → estado **aceptado** automáticamente.
- Botón **Generar presupuesto** → modal con 2 opciones:
  - **Imprimir PDF** (PDF con estado visible + vencimiento).
  - **Enviar por WhatsApp** (abre `wa.me/<numero>?text=<mensaje>` con el resumen).
- Al enviar por WhatsApp el estado pasa a **enviado**.
- A los **N días** (configurable en Ajustes) sin aceptar, el estado pasa a
  **rechazado** automáticamente al abrir la app.
- Desde el perfil del cliente se puede marcar como aceptado/rechazado manualmente.

### Perfil de cliente
Cada obra tiene botones de acción:
- **Presupuesto** → modal para imprimir/enviar/cambiar estado.
- **Pago** → solo habilitado si el presupuesto está **aceptado**.
- **Editar** → va al formulario completo de la obra (`ObraForm`), que también
  es donde se editan las tipologías/aberturas.

### Ajustes
- **Tema**: claro / oscuro / sistema.
- **Datos de empresa**: nombre, rubro, dirección, teléfono, email (usados en PDFs).
- **Reglas**: días de auto-rechazo, prefijo WhatsApp, moneda.
- **Respaldo**: exportar / importar JSON de toda la base de datos.
- **Zona peligrosa**: restablecer config, borrar todos los datos.

### Estética
Grafito cálido + dorado latón Lebaux, tipografía Inter Variable + Fraunces,
glassmorphism, animaciones sutiles, mobile-first.

## Cómo correrlo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → genera dist/
npm run preview  # sirve dist/ localmente
npm run lint      # eslint .
```

## Arquitectura

- **100% cliente, sin backend.** Datos en `localStorage` vía Zustand.
- **React Router v6** (`HashRouter`) — ver `src/App.tsx`. Cada ruta tiene un
  "wrapper" chico que traduce `useParams`/`useNavigate` a las props que las
  páginas ya esperaban (`onVolver`, `onVerCliente`, etc.).
- **Auto-rechazo de presupuestos**: hook `useAutoRechazoPresupuestos` se
  ejecuta una vez al montar la app y marca como rechazados los presupuestos
  enviados que superaron el plazo configurado.
- **PDFs con carga diferida**: `@react-pdf/renderer` se importa dinámicamente.

## Estructura

```
src/
├── App.tsx                  # Rutas (react-router) + HubLayout (tab bar persistente)
├── main.tsx
├── index.css                # Tailwind v4 + tokens premium dark (oklch) + fonts
├── components/
│   ├── ui/                  # shadcn/ui
│   ├── lebaux/               # Pantallas + componentes de negocio
│   │   ├── HomePage.tsx              # Home con 4 cards de acceso
│   │   ├── DashboardPage.tsx         # KPIs clickeables + gráficos + alertas
│   │   ├── ClientesHome.tsx          # Lista de clientes (búsqueda + filtro ?filtro=deuda)
│   │   ├── RegistrosPage.tsx         # Tabs Presupuestos/Pagos + filtros (?tab=, ?estado=)
│   │   ├── AjustesPage.tsx           # Tema + empresa + reglas + respaldo
│   │   ├── ClienteDetalle.tsx        # Ficha de cliente + obras
│   │   ├── obra-form/                # Form de obra, dividido en varios archivos:
│   │   │   ├── ObraForm.tsx              #   orquestación / layout
│   │   │   ├── useObraForm.ts            #   estado + handlers (guardar, pago inicial, eliminar)
│   │   │   ├── TipologiasSection.tsx     #   sub-sección "Detalle de aberturas"
│   │   │   └── TotalesYPagoSection.tsx   #   sub-sección "Descuento, pago y totales"
│   │   ├── PresupuestoModal.tsx      # Imprimir/WhatsApp/cambiar estado
│   │   ├── BottomTabBar.tsx          # Tab bar inferior persistente (5 hubs)
│   │   ├── EstadoPresupuestoBadge.tsx
│   │   ├── ClientAvatar.tsx, KpiCard.tsx, DebtAlerts.tsx, MiniChart.tsx
│   │   ├── AppHeader.tsx, AppFooter.tsx
│   │   ├── ClienteFormModal.tsx, RegistrarPagoModal.tsx, HistorialPagos.tsx
│   │   └── EstadoBadge.tsx, ThemeToggle.tsx
│   ├── pdf/                 # Layouts PDF: Presupuesto, Comprobante, ReciboPago
│   └── ThemeProvider.tsx
├── hooks/
│   ├── use-is-desktop.ts
│   ├── use-hide-on-scroll.ts              # Dirección de scroll → mostrar/ocultar header y tab bar
│   ├── use-auto-rechazo-presupuestos.ts  # Auto-rechazo al montar
│   └── use-nuevo-cliente-modal.tsx       # Modal "Nuevo cliente" compartido (Home + Clientes)
└── lib/
    ├── stores/              # Zustand: cliente, obra, pago, ajustes
    ├── types.ts             # Modelo de datos
    ├── constants.ts         # Catálogos + defaults
    ├── obra-totales.ts      # Cálculos + helpers WhatsApp/presupuesto
    ├── pdf-generate.tsx, utils.ts
```

## Reglas de negocio

| Acción | Estado resultante |
|--------|-------------------|
| Crear obra sin pago inicial | `borrador` |
| Crear obra con pago inicial | `aceptado` |
| Enviar presupuesto por WhatsApp/PDF desde borrador | `enviado` |
| Marcar manualmente como aceptado | `aceptado` |
| Marcar manualmente como rechazado | `rechazado` |
| Presupuesto `enviado` + N días sin aceptar | `rechazado` (auto, al abrir app) |
| Reenviar un presupuesto rechazado/enviado | vuelve a `enviado` |
| Resetear a borrador (desde enviado/rechazado) | `borrador` |

## WhatsApp

- El teléfono se guarda **normalizado a solo dígitos** (sin +, espacios ni guiones).
- Para enviar: `https://wa.me/<prefijo><numero>?text=<mensaje_urlencoded>`.
- El mensaje incluye: nombre empresa, nombre cliente, ítems con subtotales,
  descuento, total, y un cierre.
- El prefijo (default `54` para Argentina) se configura en Ajustes.

## PDFs

- **PresupuestoPdfLayout**: estado visible, fecha de vencimiento, ítems,
  totales, condiciones, contacto de la empresa.
- **ComprobantePdfLayout** y **ReciboPagoPdfLayout**: comprobante de pago /
  recibo, con datos de cliente `nombre` + `telefonoWhatsApp`.

## Responsive / mobile

- Mobile-first, KPIs 2×2 en mobile, 4×1 en desktop.
- Diálogos full-width en mobile.
- Safe-area iOS/Android (`pt-safe`, `pb-safe`), targets táctiles 44px,
  `prefers-reduced-motion`.
