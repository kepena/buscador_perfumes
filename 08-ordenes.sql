-- ============================================================
--  08-ordenes.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Crea las tablas donde queda registrado un pedido pagado del carrito:
--
--      ordenes       -> un pedido: datos de envío, total, estado del pago
--      orden_items   -> las fragancias de ese pedido, con el precio al que
--                       se cobró cada una (guardado aparte, no se recalcula
--                       después: si mañana cambia el margen, el pedido
--                       viejo no cambia de precio)
--
--    También agrega el interruptor general del checkout:
--
--      configuracion.pagos_habilitados = 0 (apagado)
--
--    Mientras esté en 0, el sitio se ve exactamente igual que hoy: sin
--    carrito, sin botón de pagar. Kike lo enciende desde el panel el día
--    que confirme las llaves de Stripe cargadas.
--
--  QUIEN PUEDE LEER/ESCRIBIR ordenes / orden_items
--    Nadie desde el navegador, ni con la clave pública ni con sesión de
--    escritura del panel. Las dos Edge Functions (crear-checkout,
--    webhook-stripe) usan la clave service_role, que salta las políticas
--    de RLS por diseño de Supabase — por eso no necesitan una política
--    aparte aquí.
--
--    La única excepción es una política de LECTURA para el correo admin,
--    para poder revisar pedidos desde el SQL Editor de Supabase sin tener
--    que exponer la tabla a nadie más. Ajusta ese correo si cambia (tiene
--    que coincidir con EMAIL_ADMIN en db.js, igual que en
--    06-escritura-restringida.sql).
--
--    La pantalla de confirmación del cliente NO lee esta tabla
--    directamente: usa una tercera Edge Function de solo lectura
--    (estado-orden) que devuelve únicamente estado_pago, total y plazo de
--    envío para un orden_id puntual. Así un pedido nunca queda expuesto
--    completo (nombre, dirección, email) a quien solo tiene la URL.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--
--  ES SEGURO REPETIRLO
--    Las tablas solo se crean si no existen. El valor de pagos_habilitados
--    no se pisa si ya lo cambiaste desde el panel.
-- ============================================================

-- ---------- 1) Tabla ordenes ----------
create table if not exists public.ordenes (
  id                     uuid primary key default gen_random_uuid(),
  creado_en              timestamptz not null default now(),
  email_cliente          text not null,
  nombre_cliente         text not null,
  direccion              text not null,
  ciudad                 text not null,
  estado_direccion       text not null,
  codigo_postal          text not null,
  total_usd              numeric not null,
  estado_pago            text not null default 'pendiente'
                           check (estado_pago in ('pendiente', 'pagado', 'cancelado')),
  stripe_session_id      text unique,
  stripe_payment_intent_id text,
  plazo_envio_dias       text,
  conflicto_stock        boolean not null default false
);

alter table public.ordenes enable row level security;

-- ---------- 2) Tabla orden_items ----------
create table if not exists public.orden_items (
  id                     bigint generated always as identity primary key,
  orden_id               uuid not null references public.ordenes(id) on delete cascade,
  perfume_id             integer not null,
  nombre_perfume         text not null,
  cantidad               integer not null check (cantidad > 0),
  precio_unitario_usd    numeric not null,
  estado_stock_al_comprar text not null
);

alter table public.orden_items enable row level security;

-- ---------- 3) Lectura solo para el admin (SQL Editor / futuro panel) ----------
drop policy if exists "ordenes lectura admin" on public.ordenes;
create policy "ordenes lectura admin" on public.ordenes
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'jeronimo.pena.chaves@gmail.com');

drop policy if exists "orden_items lectura admin" on public.orden_items;
create policy "orden_items lectura admin" on public.orden_items
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'jeronimo.pena.chaves@gmail.com');

-- A propósito, NO hay política de insert/update/delete para anon ni para
-- authenticated: solo service_role (las Edge Functions) escribe aquí.

-- ---------- 4) Interruptor de pagos ----------
insert into public.configuracion (clave, valor) values ('pagos_habilitados', 0)
on conflict (clave) do nothing;

-- ---------- 5) Comprobación final ----------
-- Deben salir las dos tablas, con RLS activo y una sola política de
-- select cada una.
select tablename,
       policyname,
       cmd,
       roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('ordenes', 'orden_items')
 order by tablename, policyname;
