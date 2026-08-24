-- ============================================================
--  03-decants.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Anade la columna "decant" a perfume_overrides: dice si esa fragancia
--    se ofrece en decant o solo en frasco completo.
--
--    Todas entran en true, que es como funcionaba el sitio hasta ahora.
--    Desde el panel se van desmarcando las que no tengas para decantar; en
--    el test publico esas dejan de mostrar "Probar" y "Set Ocasion", y solo
--    ofrecen la botella.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--    Al final debe mostrar:  filas 143 · con_decant 143 · solo_botella 0
--
--  ORDEN
--    Ejecuta primero 01-costo-y-venta.sql, que es el que crea las 143
--    filas. Si corres este antes, la columna queda creada pero la
--    comprobacion final dira "filas 0": no hay a que ponersela todavia.
--
--  ES SEGURO REPETIRLO
--    Nunca pisa lo que ya hayas marcado: solo rellena las filas vacias.
-- ============================================================

-- ---------- 1) La columna ----------
-- Dentro de un bloque "do" para que el editor de Supabase no muestre la
-- ventana de aviso sobre RLS al ver un "create table" en el script.
do $$
begin
  if to_regclass('public.perfume_overrides') is null then
    execute 'create table public.perfume_overrides (id integer primary key)';
    execute 'alter table public.perfume_overrides enable row level security';
    execute 'create policy "perfumes lectura publica" on public.perfume_overrides
               for select to anon, authenticated using (true)';
    execute 'create policy "perfumes escritura admin" on public.perfume_overrides
               for all to authenticated using (true) with check (true)';
  end if;
end $$;

alter table public.perfume_overrides add column if not exists decant boolean default true;

-- ---------- 2) Las que quedaron vacias se ofrecen en decant ----------
-- Es el comportamiento que ya tenia el sitio, asi que nadie pierde una
-- opcion de compra por ejecutar esto.
update public.perfume_overrides
   set decant = true
 where decant is null
   and id > 0;

-- ---------- 3) Avisarle a la API que cambio el esquema ----------
notify pgrst, 'reload schema';

-- ---------- 4) Comprobacion final ----------
-- Debe dar: filas 143 · con_decant 143 · solo_botella 0
select count(*)                             as filas,
       count(decant)                        as con_decant,
       count(*) filter (where decant is false) as solo_botella
  from public.perfume_overrides
 where id > 0;
