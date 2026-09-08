-- ============================================================
--  07-stock.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Anade a perfume_overrides el estado de stock de "Botella completa":
--      · estado_stock    -> 'en_stock' | 'bajo_pedido' | 'agotado'
--      · cantidad_stock  -> unidades físicas en mano (solo importa cuando
--                            estado_stock = 'en_stock')
--
--    Es la pieza que le dice al carrito qué se puede vender y en cuánto
--    tiempo se despacha: "en_stock" promete envío en 2 días, "bajo_pedido"
--    en 7-10 días (se pide a Jomashop), y "agotado" no se puede comprar.
--
--    Todas entran en 'bajo_pedido' por defecto: no promete un envío rápido
--    que nadie confirmó, pero tampoco bloquea la venta como sí lo haría
--    'agotado'. Es el mismo criterio ya usado con "decant": ante la duda,
--    que se pueda seguir vendiendo.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--
--  ORDEN
--    Ejecuta primero 01-costo-y-venta.sql, que es el que crea las 143
--    filas. Si corres este antes, las columnas quedan creadas pero la
--    comprobación final dirá "filas 0".
--
--  ES SEGURO REPETIRLO
--    Nunca pisa lo que ya hayas marcado en el panel: solo rellena las
--    filas que todavía no tengan estado de stock.
-- ============================================================

-- ---------- 1) Las columnas ----------
alter table public.perfume_overrides
  add column if not exists estado_stock text default 'bajo_pedido'
    check (estado_stock in ('en_stock', 'bajo_pedido', 'agotado'));

alter table public.perfume_overrides
  add column if not exists cantidad_stock integer not null default 0;

-- ---------- 2) Las que quedaron vacías entran "bajo pedido" ----------
update public.perfume_overrides
   set estado_stock = 'bajo_pedido'
 where estado_stock is null
   and id > 0;

-- ---------- 3) Avisarle a la API que cambió el esquema ----------
notify pgrst, 'reload schema';

-- ---------- 4) Comprobación final ----------
-- Debe dar: filas 143 · en_stock 0 · bajo_pedido 143 · agotado 0
-- (hasta que Kike empiece a marcar fragancias desde el panel)
select count(*) filter (where id > 0)                                as filas,
       count(*) filter (where estado_stock = 'en_stock' and id > 0)   as en_stock,
       count(*) filter (where estado_stock = 'bajo_pedido' and id > 0) as bajo_pedido,
       count(*) filter (where estado_stock = 'agotado' and id > 0)    as agotado
  from public.perfume_overrides;
