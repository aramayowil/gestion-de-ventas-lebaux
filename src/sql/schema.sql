-- ════════════════════════════════════════════════════════════════
-- LEBAUX · Gestión de Aberturas — Esquema Supabase
-- ════════════════════════════════════════════════════════════════
-- Ejecutar este script en el SQL Editor de Supabase.
-- Crea todas las tablas, índices, triggers y políticas RLS.
--
-- Orden de tablas (por dependencias FK):
--   1. users        (admins + vendedores)
--   2. clientes     (propietario = vendedor)
--   3. ajustes      (config global, 1 fila por vendedor)
--   4. obras        (presupuestos + ventas)
--   5. tipologias   (items de aberturas por obra)
--   6. pagos        (recibos)
--   7. remitos      (remitos de fábrica)
--   8. turnos       (agenda de fábrica)
--   9. borradores   (drafts en curso)
-- ════════════════════════════════════════════════════════════════


-- ─── Extensiones ───
create extension if not exists "uuid-ossp";


-- ════════════════════════════════════════════════════════════════
-- 1. USERS
-- ════════════════════════════════════════════════════════════════
-- Usamos la tabla auth.users de Supabase para autenticación real,
-- y esta tabla para los metadatos de negocio (rol, nombre, etc.).

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  rol         text not null check (rol in ('admin', 'vendedor')) default 'vendedor',
  nombre      text not null default '',
  creado_por  uuid references public.users(id) on delete set null,
  creado_en   timestamptz not null default now()
);

comment on table public.users is 'Vendedores y administradores del sistema Lebaux.';


-- ════════════════════════════════════════════════════════════════
-- 2. CLIENTES
-- ════════════════════════════════════════════════════════════════

create table if not exists public.clientes (
  id              uuid primary key default uuid_generate_v4(),
  vendedor_id     uuid references public.users(id) on delete set null,
  nombre          text not null default '',
  telefono_whatsapp text not null default '',
  compartido_con  jsonb not null default '[]'::jsonb,
  is_mayorista    boolean not null default false,
  creado_en       timestamptz not null default now()
);

-- Índice para buscar clientes por vendedor (query más frecuente)
create index if not exists idx_clientes_vendedor on public.clientes(vendedor_id);
-- Índice para buscar por nombre (búsqueda)
create index if not exists idx_clientes_nombre on public.clientes using gin (to_tsvector('simple', nombre));
-- Índice para el filtro "Mayoristas" de la lista de clientes
create index if not exists idx_clientes_mayorista on public.clientes(is_mayorista) where is_mayorista;

comment on table public.clientes is 'Clientes del sistema. Cada cliente pertenece a un vendedor y puede compartirse con otros.';


-- ════════════════════════════════════════════════════════════════
-- 3. AJUSTES
-- ════════════════════════════════════════════════════════════════
-- Una fila por usuario (cada vendedor tiene sus propios ajustes).
-- El admin tiene una fila "global" con vendedor_id = null.

create table if not exists public.ajustes (
  id              uuid primary key default uuid_generate_v4(),
  vendedor_id     uuid unique references public.users(id) on delete cascade,
  empresa         jsonb not null default '{"nombre":"LEBAUX SRL","rubro":"Aberturas","direccion":"Av. Alem 1930, San Miguel de Tucumán","telefono":"(381) 572-9129","email":"lebauxaberturas1930@gmail.com"}'::jsonb,
  -- ivaBasePct: alícuota "tope" (ej. 0.21) a la que debe llegar
  -- cualquier ítem al discriminar IVA en un presupuesto/venta.
  -- ivaPorLinea: alícuota que YA viene incluida en el precio unitario
  -- que el vendedor carga, según la línea de la abertura (Modena,
  -- Herrero, A30). Se usa para descomponer cada ítem a su precio base
  -- (neto) al activar "Discriminar IVA".
  sistema         jsonb not null default '{"diasAutoRechazo":14,"prefijoWhatsApp":"54","moneda":"ARS","ivaPct":0.105,"ivaBasePct":0.21,"ivaPorLinea":{"Modena":0.21,"Herrero":0.105,"A30":0.105}}'::jsonb,
  actualizado_en  timestamptz not null default now()
);

comment on table public.ajustes is 'Configuración por vendedor (empresa + reglas del sistema).';

-- Migración de datos: filas de `ajustes` creadas ANTES de que existiera
-- el IVA por línea no tienen `ivaBasePct`/`ivaPorLinea` en su JSON. Este
-- UPDATE completa esos campos con los valores default sin pisar nada
-- de lo que el vendedor ya haya configurado. Es seguro correrlo más de
-- una vez (es idempotente: si el campo ya existe, `||` no lo modifica
-- porque jsonb_build_object solo se usa como base y el objeto existente
-- tiene prioridad al final).
update public.ajustes
set sistema = jsonb_build_object(
    'ivaBasePct', 0.21,
    'ivaPorLinea', jsonb_build_object('Modena', 0.21, 'Herrero', 0.105, 'A30', 0.105)
  ) || sistema
where not (sistema ? 'ivaBasePct') or not (sistema ? 'ivaPorLinea');



-- ════════════════════════════════════════════════════════════════
-- 4. OBRAS
-- ════════════════════════════════════════════════════════════════

create table if not exists public.obras (
  id                    uuid primary key default uuid_generate_v4(),
  cliente_id            uuid not null references public.clientes(id) on delete cascade,
  fecha                 timestamptz not null default now(),
  forma_pago            text,
  descuento_pct         numeric(5,4) not null default 0,
  creado_en             timestamptz not null default now(),
  tipo                  text not null check (tipo in ('presupuesto', 'venta')) default 'venta',
  incluye_iva           boolean not null default false,
  iva_pct               numeric(5,4) not null default 0,
  estado_presupuesto    text not null check (estado_presupuesto in ('borrador', 'pendiente', 'aceptado', 'rechazado')) default 'borrador',
  pendiente_en          timestamptz,
  aceptado_en           timestamptz,
  rechazado_en          timestamptz,
  rechazado_motivo      text,
  nota_cliente          text,
  -- Solo tiene efecto visual cuando incluye_iva es false: agrega una
  -- línea informativa "PRECIO CON IVA: $XXXXX" en form/PDF/WhatsApp,
  -- calculada al vuelo con el ivaBasePct de Ajustes. No afecta ningún
  -- cálculo de totales, saldo ni pagos.
  mostrar_precio_con_iva boolean not null default false
);

create index if not exists idx_obras_cliente on public.obras(cliente_id);
create index if not exists idx_obras_estado on public.obras(estado_presupuesto);
create index if not exists idx_obras_creado on public.obras(creado_en desc);

comment on table public.obras is 'Presupuestos y ventas. El tipo diferencia si es cotización o venta directa.';


-- ════════════════════════════════════════════════════════════════
-- 5. TIPOLOGIAS (items de aberturas por obra)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.tipologias (
  id              uuid primary key default uuid_generate_v4(),
  obra_id         uuid not null references public.obras(id) on delete cascade,
  descripcion     text not null default '',
  cantidad        integer not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  linea           text not null check (linea in ('Modena', 'Herrero', 'A30')) default 'Herrero',
  color           text not null check (color in ('Blanco', 'Negro', 'Gris')) default 'Blanco',
  orden           integer not null default 0
);

create index if not exists idx_tipologias_obra on public.tipologias(obra_id);

comment on table public.tipologias is 'Items de aberturas (tipologías) de cada obra.';


-- ════════════════════════════════════════════════════════════════
-- 6. PAGOS
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pagos (
  id              uuid primary key default uuid_generate_v4(),
  obra_id         uuid not null references public.obras(id) on delete cascade,
  numero_recibo   integer not null,
  fecha           timestamptz not null default now(),
  -- monto real cobrado/registrado (con recargo de tarjeta incluido, si aplica).
  monto           numeric(12,2) not null default 0,
  -- monto que efectivamente cancela saldo de la obra (sin recargo de
  -- tarjeta). Nullable: pagos legacy no lo tienen, se asume igual a `monto`.
  monto_base      numeric(12,2),
  forma_pago      text,
  nota            text,
  anulado         boolean not null default false,
  anulado_motivo  text,
  creado_en       timestamptz not null default now()
);

create index if not exists idx_pagos_obra on public.pagos(obra_id);
create index if not exists idx_pagos_recibo on public.pagos(numero_recibo);

comment on table public.pagos is 'Pagos/recibos registrados sobre obras.';


-- ════════════════════════════════════════════════════════════════
-- 7. REMITOS (de fábrica)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.remitos (
  id              uuid primary key default uuid_generate_v4(),
  obra_id         uuid not null references public.obras(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  tipologia_ids   jsonb not null default '[]'::jsonb,
  fecha_entrega   date not null,
  nota            text,
  turno_id        uuid,
  creado_en       timestamptz not null default now()
);

create index if not exists idx_remitos_obra on public.remitos(obra_id);
create index if not exists idx_remitos_turno on public.remitos(turno_id);

comment on table public.remitos is 'Remitos de fábrica generados al finalizar una venta.';


-- ════════════════════════════════════════════════════════════════
-- 8. TURNOS (agenda de fábrica)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.turnos (
  id              uuid primary key default uuid_generate_v4(),
  remito_id       uuid not null references public.remitos(id) on delete cascade,
  obra_id         uuid not null references public.obras(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  fecha           date not null,
  hora            integer not null check (hora >= 8 and hora <= 17),
  estado          text not null check (estado in ('pendiente', 'en-fabrica', 'listo', 'entregado', 'cancelado')) default 'pendiente',
  nota            text,
  creado_en       timestamptz not null default now(),
  en_fabrica_en   timestamptz,
  listo_en        timestamptz,
  entregado_en    timestamptz,
  cancelado_en    timestamptz
);

create index if not exists idx_turnos_fecha on public.turnos(fecha);
create index if not exists idx_turnos_obra on public.turnos(obra_id);
-- Constraint: no dos turnos en misma fecha+hora (excluyendo cancelados)
create unique index if not exists idx_turnos_unique_fecha_hora
  on public.turnos(fecha, hora)
  where estado != 'cancelado';

comment on table public.turnos is 'Turnos de fábrica (agenda L-S 8-17hs). Un turno por hora.';


-- ════════════════════════════════════════════════════════════════
-- 9. BORRADORES (drafts en curso)
-- ════════════════════════════════════════════════════════════════
-- En Supabase los borradores pueden vivir en localStorage (no hace
-- falta sincronizarlos), pero dejamos la tabla por si se quiere
-- sincronizar en el futuro.

create table if not exists public.borradores (
  id              uuid primary key default uuid_generate_v4(),
  vendedor_id     uuid not null references public.users(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  tipo            text not null check (tipo in ('presupuesto', 'venta')),
  obra_data       jsonb not null,
  pago_inicial_monto numeric(12,2) not null default 0,
  pago_inicial_forma  text,
  actualizado_en  timestamptz not null default now()
);

create index if not exists idx_borradores_vendedor on public.borradores(vendedor_id);
create unique index if not exists idx_borradores_unique on public.borradores(vendedor_id, cliente_id, tipo);

comment on table public.borradores is 'Drafts de obras en curso (autosave).';


-- ════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════

-- Auto-actualizar ajustes.actualizado_en
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ajustes_touch on public.ajustes;
create trigger trg_ajustes_touch
  before update on public.ajustes
  for each row execute function public.touch_updated_at();

-- Auto-actualizar borradores.actualizado_en
drop trigger if exists trg_borradores_touch on public.borradores;
create trigger trg_borradores_touch
  before update on public.borradores
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════
-- Reglas:
--   · Admin: ve y edita TODO.
--   · Vendedor: ve/edita sus propios clientes + los compartidos con él.
--   · Obras: visibles si el cliente es visible para el vendedor.
--   · Pagos, tipologías, remitos, turnos: heredan visibilidad de la obra.
--   · Turnos y remitos: compartidos entre todos los vendedores (agenda común).

-- Habilitar RLS
alter table public.users        enable row level security;
alter table public.clientes     enable row level security;
alter table public.ajustes      enable row level security;
alter table public.obras        enable row level security;
alter table public.tipologias   enable row level security;
alter table public.pagos        enable row level security;
alter table public.remitos      enable row level security;
alter table public.turnos       enable row level security;
alter table public.borradores   enable row level security;


-- ─── USERS ───
-- Un usuario puede ver su propia fila. El admin ve todas.
create policy "users_select_own_or_admin"
  on public.users for select
  using (
    auth.uid() = id
    or exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

-- Solo admin puede insertar/actualizar/eliminar usuarios
create policy "users_insert_admin"
  on public.users for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "users_update_own_or_admin"
  on public.users for update
  using (
    auth.uid() = id
    or exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "users_delete_admin"
  on public.users for delete
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );


-- ─── CLIENTES ───
-- Un vendedor ve: sus clientes + los compartidos con él.
-- El admin ve todos.
create policy "clientes_select_visible"
  on public.clientes for select
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
    or vendedor_id = auth.uid()
    or compartido_con @> to_jsonb(auth.uid()::text)
  );

-- Un vendedor puede crear clientes (asignándose como propietario)
create policy "clientes_insert_own"
  on public.clientes for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
    or vendedor_id = auth.uid()
  );

-- Un vendedor puede editar sus propios clientes. El admin puede editar todos.
create policy "clientes_update_own_or_admin"
  on public.clientes for update
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
    or vendedor_id = auth.uid()
  );

-- Un vendedor puede eliminar sus propios clientes. El admin puede eliminar todos.
create policy "clientes_delete_own_or_admin"
  on public.clientes for delete
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
    or vendedor_id = auth.uid()
  );


-- ─── AJUSTES ───
-- Cualquier usuario puede LEER la config (la necesita para PDFs, IVA, etc).
-- Pero solo el admin puede ESCRIBIRLA: son los datos de la empresa y las
-- reglas del sistema, compartidos por todos los vendedores.
create policy "ajustes_select_own_or_admin"
  on public.ajustes for select
  using (
    vendedor_id = auth.uid()
    or vendedor_id is null  -- fila global visible para todos
    or exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "ajustes_insert_admin"
  on public.ajustes for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "ajustes_update_admin"
  on public.ajustes for update
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
  );


-- ─── OBRAS ───
-- Visibles si el cliente es visible para el usuario actual.
create policy "obras_select_visible"
  on public.obras for select
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "obras_insert_visible"
  on public.obras for insert
  with check (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "obras_update_visible"
  on public.obras for update
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "obras_delete_visible"
  on public.obras for delete
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
      )
    )
  );


-- ─── TIPOLOGIAS ───
-- Heredan visibilidad de la obra.
create policy "tipologias_select_visible"
  on public.tipologias for select
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "tipologias_insert_visible"
  on public.tipologias for insert
  with check (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "tipologias_update_visible"
  on public.tipologias for update
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "tipologias_delete_visible"
  on public.tipologias for delete
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
      )
    )
  );


-- ─── PAGOS ───
-- Heredan visibilidad de la obra.
create policy "pagos_select_visible"
  on public.pagos for select
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "pagos_insert_visible"
  on public.pagos for insert
  with check (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "pagos_update_visible"
  on public.pagos for update
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
        or c.compartido_con @> to_jsonb(auth.uid()::text)
      )
    )
  );

create policy "pagos_delete_visible"
  on public.pagos for delete
  using (
    exists (
      select 1 from public.obras o
      join public.clientes c on c.id = o.cliente_id
      where o.id = obra_id
      and (
        exists (select 1 from public.users u where u.id = auth.uid() and u.rol = 'admin')
        or c.vendedor_id = auth.uid()
      )
    )
  );


-- ─── REMITOS ───
-- Compartidos: todos los vendedores pueden ver los remitos (para coordinar fábrica).
create policy "remitos_select_all"
  on public.remitos for select
  using (true);

create policy "remitos_insert_all"
  on public.remitos for insert
  with check (true);

create policy "remitos_update_all"
  on public.remitos for update
  using (true);

create policy "remitos_delete_all"
  on public.remitos for delete
  using (true);


-- ─── TURNOS ───
-- Compartidos: todos los vendedores pueden ver y gestionar turnos (agenda común).
create policy "turnos_select_all"
  on public.turnos for select
  using (true);

create policy "turnos_insert_all"
  on public.turnos for insert
  with check (true);

create policy "turnos_update_all"
  on public.turnos for update
  using (true);

create policy "turnos_delete_all"
  on public.turnos for delete
  using (true);


-- ─── BORRADORES ───
-- Cada vendedor ve/edita solo sus propios borradores.
create policy "borradores_select_own"
  on public.borradores for select
  using (vendedor_id = auth.uid());

create policy "borradores_insert_own"
  on public.borradores for insert
  with check (vendedor_id = auth.uid());

create policy "borradores_update_own"
  on public.borradores for update
  using (vendedor_id = auth.uid());

create policy "borradores_delete_own"
  on public.borradores for delete
  using (vendedor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEED: Admin inicial
-- ════════════════════════════════════════════════════════════════
-- Crear el usuario admin en auth.users y luego en public.users.
-- Ejecutar DESPUÉS de crear el usuario en Supabase Dashboard >
-- Authentication > Users > Add user.
--
-- Una vez creado el usuario admin en Auth, ejecutar:
--
--   insert into public.users (id, username, rol, nombre, creado_por)
--   values (
--     '<UUID_DEL_ADMIN_EN_AUTH>',
--     'admin',
--     'admin',
--     'Administrador',
--     null
--   );
--
-- Y crear la fila de ajustes global:
--
--   insert into public.ajustes (vendedor_id) values (null);


-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: is_mayorista en clientes
-- ════════════════════════════════════════════════════════════════
-- Si ya corriste este script antes (tabla `clientes` ya existía), el
-- `create table if not exists` de más arriba no le agrega columnas
-- nuevas a una tabla existente. Este bloque es idempotente: agregá
-- la columna solo si todavía no está.

alter table public.clientes
  add column if not exists is_mayorista boolean not null default false;

-- Pagos creados antes de que existiera el recargo de tarjeta: monto_base
-- no existía, así que monto === montoBase siempre. Completamos monto_base
-- con el valor de monto para no romper el cálculo de saldo de obras viejas.
alter table public.pagos
  add column if not exists monto_base numeric(12,2);

update public.pagos
set monto_base = monto
where monto_base is null;

create index if not exists idx_clientes_mayorista
  on public.clientes(is_mayorista) where is_mayorista;


-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: nota_cliente + mostrar_precio_con_iva en obras
-- ════════════════════════════════════════════════════════════════
-- Nota libre para el cliente y checkbox "mostrar precio final con IVA"
-- (solo visual, no afecta cálculos). Idempotente.

alter table public.obras
  add column if not exists nota_cliente text;

alter table public.obras
  add column if not exists mostrar_precio_con_iva boolean not null default false;


-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: bucket "comprobantes" (PDFs para enviar por WhatsApp)
-- ════════════════════════════════════════════════════════════════
-- Los PDFs de presupuestos, ventas y recibos se suben acá para poder
-- generar un link temporal (signed URL, 30 días) y mandarlo por
-- WhatsApp junto al mensaje de texto. El bucket es PRIVADO: nadie
-- puede leerlo sin una signed URL, ya que los PDFs tienen montos y
-- datos del cliente.
--
-- Path de cada archivo: {obra_id}/{tipo}.pdf
--   Ej: "a1b2c3.../presupuesto.pdf"
--       "a1b2c3.../pago-0007-combinado.pdf"
--       "a1b2c3.../pago-0007-recibo.pdf"
-- Siempre se sube con upsert=true, así que regenerar un PDF pisa el
-- anterior en vez de acumular archivos viejos.
--
-- IMPORTANTE: este bloque crea el bucket, pero las políticas de
-- storage.objects deben crearse UNA POR UNA porque Postgres no
-- permite "create policy if not exists". Si ya corriste este bloque
-- antes, los "drop policy if exists" evitan el error de duplicado.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- INSERT / UPDATE (upsert): cualquier usuario autenticado con fila en
-- public.users puede subir. No hace falta filtrar por carpeta como en
-- las tablas de negocio: el path ya empieza con el obra_id, y el
-- acceso de LECTURA (lo sensible) no es público — se controla más
-- abajo con SELECT.
drop policy if exists "comprobantes_insert_autenticado" on storage.objects;
create policy "comprobantes_insert_autenticado"
  on storage.objects for insert
  with check (
    bucket_id = 'comprobantes'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );

drop policy if exists "comprobantes_update_autenticado" on storage.objects;
create policy "comprobantes_update_autenticado"
  on storage.objects for update
  using (
    bucket_id = 'comprobantes'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );

-- SELECT: solo necesario para que el propio cliente de Supabase (JS)
-- pueda generar la signed URL desde el front autenticado. El link
-- firmado resultante es lo que de verdad viaja por WhatsApp; esta
-- policy NO expone el archivo públicamente.
drop policy if exists "comprobantes_select_autenticado" on storage.objects;
create policy "comprobantes_select_autenticado"
  on storage.objects for select
  using (
    bucket_id = 'comprobantes'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );

drop policy if exists "comprobantes_delete_autenticado" on storage.objects;
create policy "comprobantes_delete_autenticado"
  on storage.objects for delete
  using (
    bucket_id = 'comprobantes'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: limpieza de filas duplicadas en `ajustes`
-- ════════════════════════════════════════════════════════════════
-- Bug histórico: como una unique constraint estándar de Postgres no
-- considera dos NULL como iguales, el `upsert` de la config global
-- (vendedor_id = null) insertaba una fila nueva en cada guardado en
-- vez de actualizar la existente. Esto puede haber dejado varias
-- filas con vendedor_id null en la base. Nos quedamos con la más
-- reciente (por actualizado_en) y borramos el resto — es seguro
-- correr esto más de una vez.
delete from public.ajustes a
using public.ajustes b
where a.vendedor_id is null
  and b.vendedor_id is null
  and a.id <> b.id
  and (
    a.actualizado_en < b.actualizado_en
    or (a.actualizado_en = b.actualizado_en and a.id < b.id)
  );

-- Mismo problema podría haber ocurrido por vendedor (aunque menos
-- probable, ya que ahí vendedor_id no es null y el conflicto se
-- resuelve bien). Por las dudas, misma limpieza por vendedor_id.
delete from public.ajustes a
using public.ajustes b
where a.vendedor_id is not null
  and a.vendedor_id = b.vendedor_id
  and a.id <> b.id
  and (
    a.actualizado_en < b.actualizado_en
    or (a.actualizado_en = b.actualizado_en and a.id < b.id)
  );


-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: links_cortos (acortador de PDFs para WhatsApp)
-- ════════════════════════════════════════════════════════════════
-- Guarda la relación código-corto → signed URL larga de Supabase
-- Storage. El redirector (Netlify Function) busca por `codigo` y
-- hace un 302 a `url_destino`. Así el link que viaja por WhatsApp
-- queda con el dominio propio, corto, en vez de la URL fea de
-- Supabase con el token de firma expuesto.
--
-- No usamos RLS restrictiva de "propio vendedor" acá porque la
-- función de redirect corre con la Service Role Key desde el
-- backend (Netlify Function), no desde el cliente autenticado —
-- similar al patrón ya usado en la Edge Function `crear-vendedor`.
create table if not exists public.links_cortos (
  id             uuid primary key default uuid_generate_v4(),
  codigo         text not null unique,
  url_destino    text not null,
  -- Referencia informativa a qué comprobante corresponde (para poder
  -- reutilizar el mismo código si se regenera el mismo PDF en vez de
  -- crear uno nuevo cada vez). No es una FK dura: el path de storage
  -- (obra_id/pago-XXXX-tipo.pdf) ya identifica el recurso, así que
  -- guardamos ese path tal cual en vez de referenciar la tabla obras.
  storage_path   text,
  creado_en      timestamptz not null default now(),
  -- Igual que la signed URL que envuelve, el link corto expira: si
  -- alguien lo abre pasado este momento, el redirector debe rechazarlo
  -- en vez de mandar a una signed URL de Supabase ya vencida (o peor,
  -- a una que fue renovada y ahora apunta a otro contenido).
  expira_en      timestamptz not null
);

comment on table public.links_cortos is 'Códigos cortos que redirigen a signed URLs de comprobantes/presupuestos en Storage, para compartir por WhatsApp con dominio propio.';

create index if not exists idx_links_cortos_codigo on public.links_cortos (codigo);
create index if not exists idx_links_cortos_storage_path on public.links_cortos (storage_path);

alter table public.links_cortos enable row level security;

-- Sin policies de SELECT/INSERT para el cliente autenticado: esta
-- tabla se opera exclusivamente desde la Netlify Function con la
-- Service Role Key (que bypassea RLS), igual que `crear-vendedor`.
-- Si en el futuro se quisiera leer/crear desde el frontend directo,
-- agregar acá una policy análoga a las de `ajustes`.
