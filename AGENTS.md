# AGENTS.md — Guía para trabajar en Lebaux · Actas y Recibos

Este archivo es para cualquier agente de IA (o desarrollador nuevo) que
tenga que tocar este repositorio. El objetivo es que puedas orientarte
rápido sin tener que leer los ~130 archivos del proyecto de punta a
punta, y que entiendas **por qué** las cosas están hechas como están
antes de cambiarlas.

Si algo de este documento contradice lo que ves en el código, **el
código manda**: este archivo se puede desactualizar, el código no
miente. Si notás una diferencia, actualizá este archivo como parte de
tu cambio.

---

## 1. Los dos principios que priman sobre todo lo demás

Antes de cualquier detalle técnico, dos reglas que están por encima de
todas las demás y que deberían inclinar cualquier decisión ambigua:

### 1.1 — Priorizá que el código sea fácil de leer, no que sea eficiente

Este sistema lo usa un equipo chico (vendedores + administración de una
empresa de aberturas), no millones de usuarios. **No hay ningún
problema de performance real que resolver acá.** Lo que sí hay, todo el
tiempo, es la necesidad de que alguien —vos en la próxima sesión, otro
agente, un desarrollador humano— entienda rápido qué hace una función
sin tener que reconstruir el razonamiento desde cero.

En la práctica esto significa:

- Preferí **funciones nombradas y explícitas** a una-liners densos o
  encadenamientos de métodos difíciles de seguir. Un `for` con nombres
  claros es mejor que un `.reduce()` de una línea que hay que leer tres
  veces.
- Preferí **duplicar un poco de código legible** antes que crear una
  abstracción genérica prematura que ahorra 5 líneas pero obliga a
  saltar entre 3 archivos para entender qué pasa. Este proyecto ya tiene
  el ejemplo contrario documentado: `useNuevoClienteModal` (ver
  `hooks/use-nuevo-cliente-modal.tsx`) se creó recién cuando la
  duplicación _real_ apareció en 2 lugares con lógica idéntica — no
  antes, "por las dudas".
- **Comentá el porqué, no el qué.** El código ya dice qué hace; lo que
  no dice es por qué se decidió hacerlo así, qué alternativa se
  descartó, o qué bug se estaba evitando. Este proyecto tiene una
  cultura fuerte de comentarios de encabezado de archivo explicando el
  razonamiento — mantenela. Ejemplos reales para copiar el estilo:
  `lib/stores/borrador-store.ts`, `hooks/use-visual-viewport-top.ts`,
  `components/ui/sheet.tsx`.
- Si tenés que elegir entre una solución que ahorra un re-render y otra
  que es tres líneas más clara, **elegí la clara**. No hay presupuesto
  de performance que estemos gastando de más.
- Nombrá las cosas en español, consistente con el resto del proyecto
  (`clienteId`, `obtenerBorrador`, `formatMoney` son la excepción
  deliberada: nombres de librerías/convenciones en inglés se mantienen
  en inglés — ver sección 9).

### 1.2 — El diseño mobile es la prioridad, no un afterthought

**La mayoría del uso real de este sistema ocurre en el celular**, en
obra, con el vendedor cargando datos con una mano mientras sostiene una
cinta métrica con la otra, muchas veces con mala señal o batería baja.
El desktop existe y se cuida, pero cuando hay que elegir entre "se ve
mejor en desktop" y "funciona mejor en el celular", **gana el
celular**.

Esto no es una preferencia estética, es una decisión de arquitectura
que ya está tomada en varios lugares del código y que hay que respetar
al extenderlo:

- **Layout de altura fija, no scroll de página completa.** Ver
  `components/layout/AppLayout.tsx`: cada pantalla ocupa exactamente
  `h-dvh` (viewport dinámico, no `100vh`, porque en mobile la barra del
  navegador aparece/desaparece y `dvh` se ajusta solo). Adentro, header
  y bottom bar son fijos (`shrink-0`) y **solo** el `<main>` scrollea.
  Esto se decidió después de iterar dos veces sobre el problema — ver
  el historial de comentarios en ese archivo — porque un layout que
  scrollea entero rompe la navegación fija en cuanto el contenido crece.
- **Formularios como bottom-sheet en mobile, no modal centrado.** Ver
  `components/ui/sheet.tsx`: en pantallas chicas (`<640px`, mismo
  breakpoint que `useIsDesktop`) el formulario sube desde abajo, ocupa
  el ancho completo, tiene handle visual arriba. En desktop cae al
  mismo look que un `Dialog` centrado. Usalo para cualquier formulario
  nuevo (crear/editar algo) — no reintroduzcas `Dialog` para eso.
- **Targets táctiles de 44px como mínimo**, no 32px como en web de
  escritorio. Ver `components/ui/button.tsx`: el comentario de esa
  constante es literal — "44px = tamaño táctil mínimo recomendado
  (WCAG 2.5.5 / Apple HIG)". Cualquier elemento clickeable nuevo
  (botón, ítem de lista, checkbox) tiene que respetar ese mínimo.
- **Safe areas de iOS/Android.** `pt-safe` / `pb-safe` (definidos en
  `index.css`) se usan en header y bottom bar para no quedar debajo del
  notch o la barra de gestos. Si agregás un elemento fijo nuevo
  (arriba o abajo de la pantalla), pensá si necesita safe-area.
- **El teclado virtual no debe tapar el campo que se está editando.**
  Ver `hooks/use-visual-viewport-top.ts` (para `Dialog`/`AlertDialog`
  centrados) y el diseño de `Sheet` (anclado abajo, con `max-h` +
  scroll interno, que evita el problema por estructura). Si agregás un
  modal o input flotante nuevo, pensá en este caso antes de darlo por
  terminado.
- **`useIsDesktop()` (`hooks/use-is-desktop.ts`) es el único punto de
  verdad para "¿estoy en mobile o desktop?"** en todo el código. Es
  `min-width: 640px` (breakpoint `sm` de Tailwind). No inventes otro
  breakpoint ni otra forma de detectarlo — si hace falta, extendé ese
  hook.
- Cuando tengas que decidir el layout de una pantalla nueva, **diseñá
  primero pensando en una pantalla de ~375px de ancho**, y después
  fijate qué mejora agregarle en desktop (más columnas, layout de 2
  paneles, etc.) — no al revés.

Si en algún momento una mejora "se ve mejor en desktop" pero complica o
degrada la experiencia en mobile, la respuesta por defecto es no
hacerla, o hacerla condicional a `useIsDesktop()`.

---

## 2. Qué es este sistema

Lebaux SRL es una empresa de aberturas (puertas, ventanas) en San
Miguel de Tucumán, Argentina. Este sistema reemplaza planillas/actas en
papel para su equipo de ventas y administración. Le permite a un
vendedor:

1. Cargar un **cliente** (nombre + WhatsApp).
2. Cargar una **obra** para ese cliente: un conjunto de aberturas
   (tipologías) con cantidad, precio, línea y color, más un descuento
   opcional y, si corresponde, IVA discriminado.
3. Elegir si esa obra es un **presupuesto** (cotización que puede
   aceptarse o recharse) o una **venta directa**.
4. Imprimir el presupuesto en PDF o enviarlo por WhatsApp.
5. Registrar **pagos** parciales o totales contra esa obra, con recibo
   numerado correlativo.
6. Generar un **remito** para fábrica cuando la venta se cierra, y
   asignarle un **turno** (franja horaria) en la agenda de fábrica.

Un administrador, además, puede gestionar vendedores (crear cuentas,
compartir clientes entre vendedores) y configurar datos de la empresa,
reglas de auto-rechazo, prefijo de WhatsApp, etc.

### 2.1 — Modelo de datos (relación entre entidades)

```
User (vendedor o admin)
  └─ Cliente (1) ───< Obra (N) ───< Pago (N)
                        │
                        └───< Remito (0..1) ───< Turno (0..1)
```

- **`Cliente`**: `nombre` + `telefonoWhatsApp` (único por vendedor,
  normalizado a solo dígitos). Puede compartirse con otros vendedores
  (`compartidoCon: string[]`).
- **`Obra`**: el corazón del sistema. Incluye las `tipologias`
  (aberturas), descuento, y **el presupuesto no es una entidad
  separada: es un estado de la obra** (`estadoPresupuesto`). Ver
  sección 3 para el detalle de estados.
- **`Pago`**: registrado contra una obra específica, con
  `numeroRecibo` correlativo global (no por obra ni por cliente).
- **`Remito`**: se genera al finalizar una venta, agrupa qué
  tipologías van a fábrica.
- **`Turno`**: franja horaria (8 a 17, una por hora) en un día
  específico, con a lo sumo un remito asignado. Tiene su propio
  ciclo de estado (`pendiente → en-fábrica → listo → entregado`, o
  `cancelado`).

El modelo completo con todos los campos y comentarios está en
`src/lib/types.ts` — es el archivo más importante para entender el
dominio antes de tocar cualquier lógica de negocio.

---

## 3. Reglas de negocio del presupuesto (lo más propenso a bugs)

Esto es lo más delicado del sistema porque tiene varios estados y
transiciones automáticas. Antes de tocar nada relacionado, leé
`src/lib/types.ts` (comentario sobre `EstadoPresupuesto`) y
`src/hooks/use-auto-rechazo-presupuestos.ts`.

| Acción                                                                 | Estado resultante                       |
| ---------------------------------------------------------------------- | --------------------------------------- |
| Crear obra sin pago inicial                                            | `borrador`                              |
| Crear obra con pago inicial                                            | `aceptado` (se asume venta directa)     |
| Enviar presupuesto (PDF o WhatsApp) desde `borrador`                   | `pendiente`                             |
| Marcar manualmente como aceptado (desde el perfil del cliente)         | `aceptado`                              |
| Marcar manualmente como rechazado                                      | `rechazado`                             |
| `pendiente` + N días sin aceptar (configurable en Ajustes, default 14) | `rechazado` automático, al abrir la app |
| Reenviar un presupuesto `rechazado` o `pendiente`                      | vuelve a `pendiente`                    |

Notas importantes:

- El auto-rechazo se dispara desde `RequireAuth` (ver
  `components/auth/RequireAuth.tsx`), **no** desde `App.tsx` — se
  ejecuta en cada navegación autenticada, no solo al arrancar la app.
- "Registrar pago" solo se habilita cuando `estadoPresupuesto ===
'aceptado'`. No relajes esa regla sin entender por qué existe: evita
  cobrar por algo que el cliente todavía no aceptó.
- Los cálculos de totales (descuento, IVA, saldo pendiente) viven
  **todos** en `src/lib/obra-totales.ts`, centralizados. Si necesitás
  un cálculo de plata nuevo, agregalo ahí — no lo repitas inline en un
  componente.

---

## 4. Arquitectura técnica

### 4.1 — Stack

- **Vite + React 19 + TypeScript**
- **React Router v6** (`BrowserRouter`; el hosting debe redirigir rutas a
  `index.html`, ver 4.4)
- **Tailwind CSS v4** (config inline en `index.css`, no
  `tailwind.config.js` — así funciona v4)
- **shadcn/ui** como base de componentes (`components/ui/`), con
  bastantes agregados propios sobre esa base
- **Supabase** (Postgres + Auth) como backend — **no es un sistema
  100% cliente/localStorage**, a pesar de lo que puedan sugerir
  comentarios viejos en el código (ver 4.7)
- **TanStack Query (`@tanstack/react-query`)** para leer/escribir datos
  del servidor, con cache automático
- **Zustand** — pero _solo_ para estado de UI/sesión, no para datos de
  negocio (ver 4.6)
- **`@react-pdf/renderer`** para generar los PDFs de presupuesto,
  comprobante y recibo, importado dinámicamente (lazy) para no inflar
  el bundle inicial

### 4.2 — Dónde entra el código (flujo de arranque)

```
main.tsx
  └─ App.tsx           ← inicializa auth (Supabase), ThemeProvider, BrowserRouter, Toaster
       └─ routes/routes.tsx (<Rutas />)
            ├─ /login                     → LoginPage (pública, sin layout)
            └─ todo lo demás requiere <RequireAuth>
                 ├─ dentro de <HubLayout>: Home, Dashboard, Clientes,
                 │  Agenda, Registros, Ajustes, /admin/vendedores
                 └─ fuera de HubLayout: detalle de cliente, form de
                    obra, pagos de obra (sub-páginas sin bottom bar)
```

`routes/routes.tsx` tiene, para cada pantalla, un pequeño componente
"wrapper" (`HomeRoute`, `ClienteDetalleRoute`, etc.) que traduce
`useParams`/`useNavigate`/`useSearchParams` de React Router a las props
que la página ya espera (`onVolver`, `onVerCliente`, etc.). Esto es
deliberado: las páginas en `pages/` no saben nada de React Router, solo
reciben callbacks. Si agregás una ruta nueva, seguí ese mismo patrón:
un wrapper chico en `routes.tsx`, la página en sí sigue recibiendo
props normales.

### 4.3 — `HubLayout` vs `AppLayout` (no confundir)

Son dos cosas distintas con nombres parecidos:

- **`HubLayout`** (`components/layout/HubLayout.tsx`): vive en
  `routes.tsx`, agrupa las 6 rutas principales bajo un mismo
  `<RequireAuth>` en el árbol de rutas. Hoy es literalmente
  `return <Outlet />` — ya no hace nada de UI.
- **`AppLayout`** (`components/layout/AppLayout.tsx`): es el layout
  visual real (navbar + main + bottom bar opcional) que **cada página**
  renderiza individualmente. Ver sección 1.2 para el detalle de por qué
  está armado así.

Si tenés que agregar una pantalla nueva: la página renderiza su propio
`<AppLayout>` (con `withBottomBar` si es una de las 6 principales), y
la ruta se agrega en `routes.tsx` dentro o fuera de `<HubLayout>` según
corresponda.

### 4.4 — `BrowserRouter` y requisito del hosting

El código actual usa `BrowserRouter`, por lo que las URLs son limpias
(sin `#`). Esto exige que el hosting responda con `index.html` ante
cualquier ruta de la SPA: un refresh directo en `/clientes/123` debe
hacer rewrite a la aplicación y no devolver 404. Antes de desplegar en
un hosting nuevo, verificá esa regla. No cambies a `HashRouter` para
tapar una configuración faltante sin evaluar antes el impacto sobre
URLs existentes y enlaces compartidos.

La opción `viewTransition` de `navigate()` no controla las
transiciones imperativas con la combinación actual de `BrowserRouter`
declarativo y React Router v6. Por eso el paso Login → Home usa una
animación propia documentada en la sección 4.5.

### 4.5 — Login, estados de espera y sesión persistente

El acceso combina `pages/LoginPage.tsx`, `lib/stores/auth-store.ts`,
`lib/supabase-client.ts`, `App.tsx` y `RequireAuth`. Hay dos
estados de carga distintos y **no deben volver a mezclarse**:

- **`auth-store.loading` es solo para recuperar la sesión al arrancar.**
  Mientras vale `true`, `App.tsx` muestra el spinner global porque
  todavía no se sabe si corresponde renderizar Login o las rutas
  privadas.
- **`LoginPage.cargando` es solo para un intento de acceso.** Mantiene
  el formulario montado, deshabilita email, contraseña, mostrar/ocultar
  contraseña y el botón de envío, y muestra `Verificando datos…` con
  un `Spinner`. El formulario expone además `aria-busy`.
- El botón de mostrar/ocultar contraseña mantiene un target táctil de 44 px
  (`size-11`), incluso dentro del campo. El email desactiva autocapitalizado
  y corrección ortográfica para evitar cambios involuntarios en mobile.
- `auth-store.login()` **no debe poner el `loading` global en
  `true`**. Si lo hace, `App.tsx` desmonta Login y reemplaza el
  feedback local por una pantalla completa de carga.
- `handleSubmit` corta envíos duplicados antes de consultar, normaliza
  el email con `.trim()`, traduce errores comunes de Supabase a
  mensajes en español y recupera los controles ante errores de red.
  Los errores se anuncian con `role="alert"` y se asocian a ambos
  campos mediante `aria-describedby`.

Después de un acceso correcto no se navega de golpe. `LoginPage`
activa `saliendo`, aplica la clase `login-salida` de `index.css` y
espera su `onAnimationEnd` antes de hacer
`navigate("/", { replace: true })`. La salida dura 180 ms y se
encadena con las clases `home-entrada` que ya usa `HomePage`. Si el
sistema tiene `prefers-reduced-motion: reduce`, se navega
inmediatamente y sin demora artificial. Si cambiás esta transición,
probala con el spinner activo: los eventos de animación hijos
burbujean, por eso el handler comprueba
`event.target === event.currentTarget`.

La sesión no tiene un cierre automático por inactividad implementado
en la app. El cliente de Supabase usa `persistSession: true` y
`autoRefreshToken: true`, de modo que la sesión sobrevive recargas y
cierres del navegador y renueva el token automáticamente. En la
práctica permanece abierta hasta que el usuario cierra sesión, el
backend revoca el refresh token o Supabase aplica una política de
duración del lado servidor. No prometas una sesión literalmente eterna
desde el frontend: si se configura un timebox o timeout en Supabase,
esa política manda.

Al modificar el login, verificá como mínimo:

1. intento válido con red lenta: formulario visible, controles
   deshabilitados y spinner en el botón;
2. credenciales inválidas: mensaje en español y formulario nuevamente
   habilitado;
3. error de red: no queda atrapado en estado de carga;
4. doble Enter/toque: se realiza un solo intento;
5. acceso correcto: salida suave y llegada a Home sin historial hacia
   Login;
6. `prefers-reduced-motion`: navegación inmediata;
7. recarga y reapertura del navegador: la sesión se recupera sin pedir
   credenciales mientras siga siendo válida.

### 4.6 — Zustand: solo para 2 cosas, no para datos de negocio

Hay exactamente dos stores en `src/lib/stores/`:

- **`auth-store.ts`**: sesión de Supabase Auth + el objeto `User` de
  negocio (rol, nombre). Es lo único que necesita vivir "global" y
  reactivo fuera del árbol de componentes.
- **`borrador-store.ts`**: autosave de formularios de obra en curso
  (persistido en `localStorage`, clave `clienteId::tipo`). Son
  borradores, no obras reales — cuando el usuario finaliza, el draft se
  borra y la obra pasa a vivir en Supabase.

**Todo lo demás (clientes, obras, pagos, remitos, turnos, ajustes,
usuarios) se lee/escribe con TanStack Query en `hooks/queries.ts`, no
con Zustand.** Si te encontrás por escribir un store de Zustand nuevo
para algo que viene de la base de datos, pará: eso va en
`hooks/queries.ts` siguiendo el patrón que ya existe ahí (ver 4.8).

### 4.7 — Ojo con comentarios legacy que ya no aplican

El código tiene rastros de una etapa anterior (localStorage puro, sin
Supabase). Dos ejemplos concretos para no confundirte:

- `hooks/use-async-data.tsx` conserva únicamente el componente visual
  `Spinner` (usado en `App.tsx` y `LoginPage.tsx`). El hook legacy
  `useAsyncData` y `AsyncBoundary` se eliminaron porque la migración a
  Supabase ya ocurrió. Si necesitás cargar datos nuevos, usá TanStack Query.
- El `README.md` del proyecto describe una versión más vieja del
  sistema (menciona 5 pantallas en vez de 6, un `AppFooter` que ya no
  existe, una `BottomTabBar` que se "oculta al escrolear" cuando hoy es
  siempre fija, "100% cliente sin backend" cuando hoy corre sobre
  Supabase). Si tocás algo que ese README describe distinto de como lo
  ves en el código, **el código manda** — y de paso, si tenés tiempo,
  actualizá el README.

### 4.8 — Patrón de `hooks/queries.ts`

Todos los hooks de datos siguen la misma convención, entidad por
entidad:

```ts
useXxx() // useQuery: leer (cache automático)
useCreateXxx() // useMutation: crear (invalida cache al terminar)
useUpdateXxx() // useMutation: actualizar (invalida cache al terminar)
useDeleteXxx() // useMutation: eliminar (invalida cache al terminar)
```

Cada entidad tiene además una función `mapXxx()` privada que traduce
las columnas de Postgres (`snake_case`) al tipo de TypeScript
(`camelCase`) — por ejemplo `mapCliente()` convierte
`telefono_whatsapp` → `telefonoWhatsApp`. Si agregás un campo nuevo a
una tabla, actualizá tanto el `mapXxx()` de lectura como el objeto que
se manda en `insert`/`update`.

Las query keys viven centralizadas en el objeto `QK` al principio del
archivo — usalas siempre desde ahí, no hardcodees el array de la key en
otro lado, o las invalidaciones de cache van a desincronizarse.

Si agregás una entidad nueva: replicá este patrón completo (mapper +
4 hooks) en el mismo archivo `hooks/queries.ts`, no crees un archivo
separado por entidad — así todo el código de acceso a datos queda en
un solo lugar fácil de auditar.

### 4.9 — Roles y permisos

Hay dos roles (`Rol` en `types.ts`): `admin` y `vendedor`.

- Un **vendedor** solo ve sus propios clientes, o los que otro
  vendedor le compartió explícitamente (columna `compartido_con`,
  `jsonb` en Postgres — importante: el filtro `.or()` de Supabase para
  esa columna necesita sintaxis JSON con comillas, no sintaxis de array
  de Postgres; ver el comentario en `useClientes()` si tenés que tocar
  ese filtro).
- Un **admin** ve todo y además accede a `/admin/vendedores`
  (`GestionVendedoresPage`), protegida con `<RequireAdmin>` (redirige a
  `/` si el usuario logueado no es admin).

### 4.10 — Base de datos

El schema completo de Postgres está en `src/sql/schema.sql` (10 tablas:
`users`, `clientes`, `ajustes`, `obras`, `tipologias`, `pagos`,
`remitos`, `turnos`, `borradores`, `links_cortos`). Si cambiás algo del
modelo de datos, el cambio tiene que reflejarse en 3 lugares a la vez:

1. `src/lib/types.ts` (el tipo de TypeScript)
2. `src/sql/schema.sql` (la tabla de Postgres)
3. El `mapXxx()` correspondiente en `hooks/queries.ts`

La app requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
en un archivo `.env` para arrancar (ver `lib/supabase-client.ts` — si
faltan, tira error al importar, a propósito, para no correr contra una
base inexistente). Al momento de escribir esto no hay un
`.env.example` en el repo; si te toca configurar el entorno desde cero,
vas a necesitar pedir esas credenciales o crear tu propio proyecto de
Supabase y correr `schema.sql` contra él.

### 4.11 — Netlify Functions (fuera de `src/`, no confundir con Edge Functions de Supabase)

Además de la Edge Function de Supabase (`supabase/functions/crear-vendedor/`,
que corre en la infraestructura de Supabase), el proyecto tiene
**Netlify Functions** en `netlify/functions/`, que corren en la
infraestructura de Netlify junto al sitio estático. Ambas usan el
mismo patrón de seguridad: reciben la Service Role Key de Supabase por
variable de entorno y bypassean RLS a propósito, porque el cliente
autenticado normal no tiene (ni debe tener) permisos para esa
operación.

`netlify/functions/` está **fuera** de `src/` y del `include` de
`tsconfig.app.json` — no forma parte del build de Vite (`tsc -b && vite
build`). Netlify las compila por su cuenta al deployar, detectándolas
automáticamente vía `functions = "netlify/functions"` en
`netlify.toml`.

Documentación completa del primer uso de este patrón (acortador de
links para compartir PDFs por WhatsApp con dominio propio en vez de la
URL larga de Supabase Storage): **`docs/acortador-de-links.md`**.

---

## 5. Estructura de carpetas

```
src/
├── App.tsx                  # arranque: auth init, ThemeProvider, BrowserRouter, Toaster
├── main.tsx
├── index.css                 # Tailwind v4 (config inline) + tokens de color (oklch) + fuentes
├── vite-env.d.ts
│
├── routes/
│   └── routes.tsx            # árbol de rutas + wrappers useParams→props
│
├── components/
│   ├── layout/                # armazón de la app (no negocio)
│   │   ├── AppLayout.tsx        # navbar + main + bottom bar (ver sección 1.2 y 4.3)
│   │   ├── AppHeader.tsx        # navbar en sí
│   │   ├── HubLayout.tsx        # solo agrupa rutas, ya no arma UI
│   │   ├── BottomTabBar.tsx     # tab bar inferior (6 secciones)
│   │   ├── ThemeProvider.tsx    # wrapper de next-themes
│   │   └── ThemeToggle.tsx
│   │
│   ├── auth/
│   │   └── RequireAuth.tsx    # <RequireAuth> y <RequireAdmin>, guards de ruta
│   │
│   ├── lebaux/                 # componentes de negocio (no páginas completas)
│   │   ├── clientes/            # ClienteFormModal, PresupuestoModal, EstadoBadge
│   │   ├── dashboard/            # DebtAlerts
│   │   └── obras/                # RegistrarPagoModal, RemitoModal, TipoObraModal,
│   │                              # CambiarEstadoModal, HistorialPagos
│   │
│   ├── shared/                # componentes chicos reusables entre pantallas
│   │   ├── ClientAvatar.tsx
│   │   └── EstadoPresupuestoBadge.tsx
│   │
│   ├── pdf/                   # generación de PDFs (@react-pdf/renderer)
│   │   ├── PresupuestoPdfLayout.tsx  + PresupuestoPdfButton.tsx
│   │   ├── ComprobantePdfLayout.tsx  + ComprobantePdfButton.tsx
│   │   ├── ReciboPagoPdfLayout.tsx   + ReciboPagoPdfButton.tsx
│   │   └── ImprimirDialog.tsx
│   │
│   └── ui/                    # shadcn/ui + agregados propios
│       ├── button.tsx, card.tsx, input.tsx, label.tsx, select.tsx,
│       │   checkbox.tsx, switch.tsx, textarea.tsx, badge.tsx, skeleton.tsx
│       ├── dialog.tsx           # modal centrado clásico (ver cuándo usarlo, sección 6)
│       ├── sheet.tsx            # modal responsivo: bottom-sheet mobile / dialog desktop
│       ├── alert-dialog.tsx     # confirmaciones cortas (sí/no)
│       ├── dropdown-menu.tsx, popover.tsx
│       ├── money-input.tsx, numeric-input.tsx   # inputs de negocio (formato $ / números)
│       ├── kpi-card.tsx, mini-chart.tsx          # piezas del Dashboard
│       ├── calendar-disponibilidad.tsx           # calendario de la Agenda de fábrica
│       ├── accordion-section.tsx                 # acordeón del form de obra en mobile
│       └── sonner.tsx           # toaster de notificaciones
│
├── pages/                     # una pantalla completa = un archivo/carpeta acá
│   ├── HomePage.tsx
│   ├── DashboardPage.tsx
│   ├── ClientesHome.tsx
│   ├── ClienteDetalle.tsx
│   ├── RegistrosPage.tsx
│   ├── AjustesPage.tsx
│   ├── AgendaFabricaPage.tsx
│   ├── GestionVendedoresPage.tsx   # solo admin
│   ├── PagosObraPage.tsx
│   ├── LoginPage.tsx              # acceso, espera local y transición de salida a Home
│   └── obra-form/              # el formulario más grande y complejo del sistema
│       ├── index.ts               # re-export
│       ├── ObraForm.tsx           # orquestación / layout (acordeón en mobile, todo visible en desktop)
│       ├── useObraForm.ts         # TODA la lógica: autosave, guardar, pago inicial, eliminar
│       ├── TipologiasSection.tsx  # sub-sección "detalle de aberturas"
│       ├── AplicarDescuentosAccordion.tsx
│       ├── ConfirmarPresupuestoModal.tsx
│       └── FinalizarVentaModal.tsx
│
├── hooks/
│   ├── queries.ts                        # TODOS los hooks de datos (ver 4.8)
│   ├── use-is-desktop.ts                 # único punto de verdad mobile/desktop (ver 1.2)
│   ├── use-visual-viewport-top.ts        # reposiciona Dialog/AlertDialog sobre el teclado virtual
│   ├── use-auto-rechazo-presupuestos.ts  # se ejecuta en cada <RequireAuth>
│   ├── use-nuevo-cliente-modal.tsx       # modal "nuevo cliente" compartido (Home + Clientes)
│   └── use-async-data.tsx                # componente Spinner compartido (ver 4.7)
│
├── lib/
│   ├── types.ts               # el modelo de datos — LEER ESTO PRIMERO
│   ├── constants.ts            # catálogos (líneas, colores, formas de pago, defaults)
│   ├── obra-totales.ts         # TODOS los cálculos de plata + helpers de WhatsApp/fecha
│   ├── storage-keys.ts         # claves de localStorage (solo para borradores)
│   ├── supabase-client.ts      # cliente Supabase + persistencia/refresh de sesión
│   ├── pdf-generate.tsx        # genera/sube PDFs + acorta el link (ver link-corto.ts)
│   ├── link-corto.ts           # cliente del acortador de links (ver docs/acortador-de-links.md)
│   ├── utils.ts                # cn() — merge de clases Tailwind
│   └── stores/
│       ├── auth-store.ts        # sesión, perfil e inicialización global (Zustand)
│       └── borrador-store.ts    # drafts de formularios de obra (Zustand + localStorage)
│
└── sql/
    └── schema.sql               # schema completo de Postgres (10 tablas)
```

```
netlify/
└── functions/                  # Netlify Functions (NO forman parte del build de Vite,
    ├── acortar-link.ts           # ver sección 4.11). Corren con Service Role Key.
    └── l.ts                     # redirector de links cortos (/l/:codigo)

docs/                           # documentación de features puntuales, más detallada
└── acortador-de-links.md         # de lo que entra cómodo en este archivo. Sumar acá
                                   # cuando un feature tenga varias piezas móviles
                                   # (DB + función serverless + frontend) que valga la
                                   # pena explicar con su propio diagrama de flujo.
```

---

## 6. Cuándo usar `Sheet` vs `Dialog` vs `AlertDialog`

Hay tres primitivos de "ventana flotante" en `components/ui/`, cada uno
con un propósito distinto — no los mezcles:

- **`Sheet`** (`sheet.tsx`): para **formularios** (crear/editar algo).
  Bottom-sheet en mobile, dialog centrado en desktop. Es la opción por
  defecto para cualquier formulario nuevo. Ejemplos ya migrados:
  `ClienteFormModal`, `RegistrarPagoModal`, `CrearVendedorModal`,
  `TipoObraModal`, `PresupuestoModal`.
- **`Dialog`** (`dialog.tsx`): para contenido que **no** es un
  formulario pero quiere el mismo look centrado en ambos tamaños (por
  ejemplo, un preview). Usalo solo si de verdad no calza el patrón de
  `Sheet`.
- **`AlertDialog`** (`alert-dialog.tsx`): para **confirmaciones cortas
  de una sola decisión** ("¿Eliminar turno?", "¿Confirmar rechazo?").
  Quedan centradas incluso en mobile a propósito: son solo texto + 2
  botones, no ameritan el peso visual de un sheet completo.

Estructura interna de `Sheet` (para no romper el layout al usarlo):

```tsx
<Sheet open={open} onOpenChange={...}>
  <SheetContent className="sm:max-w-md">
    <SheetHeader>          {/* shrink-0, siempre visible arriba */}
      <SheetTitle>...</SheetTitle>
      <SheetDescription>...</SheetDescription>
    </SheetHeader>

    <SheetBody>             {/* flex-1 overflow-y-auto — el único que scrollea */}
      {/* campos del formulario acá */}
    </SheetBody>

    <SheetFooter>           {/* shrink-0, siempre visible abajo */}
      <Button variant="outline" onClick={onClose}>Cancelar</Button>
      <Button onClick={handleGuardar}>Guardar</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

Si el formulario tiene 2 estados (por ejemplo "formulario" → "éxito",
como `RegistrarPagoModal`), cada estado tiene su propio `SheetBody`
(mirá ese archivo como referencia).

---

## 7. Diseño visual (para no romper la identidad de marca)

La paleta sale del logo de Lebaux (dorado/ámbar + gris), definida en
`index.css` con OKLCH para que el contraste se mantenga consistente
entre tema claro y oscuro. Los tokens de color son semánticos
(`--primary`, `--muted`, `--success`, `--destructive`, etc.) — **usá
siempre el token semántico, nunca un color hardcodeado** (`bg-primary`,
no `bg-[#FDC97D]`), así el tema oscuro sigue funcionando gratis.

Tipografía: **Inter Variable** para toda la UI, incluidos los títulos
(`font-display`). La fuente se distribuye localmente mediante
`@fontsource-variable/inter` para mantener el mismo aspecto en todos los
dispositivos. Las cifras usan variantes tabulares y alineadas globalmente para
facilitar la comparación de importes y datos contables.

Radios de borde, sombras y demás también son tokens (`--radius`,
`rounded-xl`, etc.) — antes de usar un valor arbitrario, fijate si ya
existe una utilidad de Tailwind que lo resuelve con el token
correspondiente.

---

## 8. Comandos

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build → genera dist/
npm run preview   # sirve dist/ localmente
npm run lint      # eslint .
```

`npm run build` corre `tsc -b` (type-check estricto) antes de
`vite build` — si el build falla, primero revisá el output de
TypeScript, no asumas que es un problema de Vite.

Antes de dar por terminado un cambio, como mínimo corré:

```bash
npx tsc -b --noEmit   # confirma que no rompiste tipos
npm run lint          # confirma que no hay warnings/errores nuevos de eslint
```

Si el cambio es visual o de layout, ese chequeo no alcanza — no hay
tests automatizados de UI en este proyecto todavía, así que la
verificación real es mirar el resultado, idealmente en un viewport
angosto (~375px) antes que en desktop (ver sección 1.2).

---

## 9. Convenciones de código

- **Nombres de variables, funciones y comentarios: en español.** Es la
  convención ya establecida en todo el proyecto (`clienteId`,
  `obtenerBorrador`, `calcularTotalesObra`). Las excepciones son
  nombres que vienen de una librería o convención externa en inglés
  (`onClick`, `useEffect`, `props`, `children`) — esos se mantienen en
  inglés porque cambiarlos rompería la legibilidad para cualquiera que
  conozca React.
- **Cada archivo de negocio empieza con un comentario de bloque**
  explicando qué hace y, más importante, **por qué** está hecho así.
  Es el estilo dominante en el repo — seguilo. No hace falta que sea
  largo, pero si tomaste una decisión no obvia (por qué esta librería y
  no otra, por qué este orden de checks, qué caso raro estás
  cubriendo), anotala ahí.
- **Un archivo por componente/página**, salvo sub-componentes chicos
  que solo tienen sentido junto a su padre (ver `CrearVendedorModal`
  definido inline al final de `GestionVendedoresPage.tsx` — eso está
  bien porque no se usa en ningún otro lado).
- **TypeScript estricto**: no uses `any` salvo que sea absolutamente
  necesario (interoperar con algo sin tipos), y en ese caso comentá por
  qué.
- **`cn()` (`lib/utils.ts`) para componer clases de Tailwind**
  condicionalmente, nunca concatenación de strings a mano.
- Antes de crear un componente nuevo, **revisá si ya existe algo
  parecido en `components/ui/` o `components/shared/`** — este
  proyecto prefiere extender un componente existente (agregarle una
  prop) antes que crear uno paralelo con 90% del mismo código.
