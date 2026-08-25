-- ============================================================
--  04-importacion-fija.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Cambia como se cobra la importacion en el calculo de precios.
--
--      ANTES:  costo puesto aqui = costo_usd × TRM × factor_importacion
--              (un 20% sobre el valor de compra)
--
--      AHORA:  costo puesto aqui = (costo_usd × TRM) + importacion_cop
--              (un valor fijo en pesos por frasco)
--
--    El porcentaje inflaba los caros y regalaba los baratos: traer un Creed
--    de US$300 y un Lattafa de US$26 cuesta practicamente lo mismo, pero el
--    Creed pagaba $240.000 de "importacion" y el Lattafa $20.800.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--    Al final debe mostrar la fila:  importacion_cop | 30000
--
--  ⚠️ AJUSTA EL VALOR
--    30000 es un punto de partida, no tu costo real. Cambia el numero en la
--    linea marcada mas abajo por lo que de verdad te cuesta traer UN frasco
--    (flete + aduana + comisiones, dividido entre los frascos del envio), o
--    dejalo asi y edítalo desde el panel en Parametros de precio.
--
--  ES SEGURO REPETIRLO
--    Si ya pusiste tu valor, volver a ejecutarlo no lo pisa.
-- ============================================================

-- ---------- 1) La tabla de parametros ----------
-- Dentro de un bloque "do" para que el editor de Supabase no muestre la
-- ventana de aviso sobre RLS al ver un "create table" en el script.
do $$
begin
  if to_regclass('public.configuracion') is null then
    execute 'create table public.configuracion (
               clave text primary key,
               valor numeric not null)';
    execute 'alter table public.configuracion enable row level security';
    execute 'create policy "configuracion lectura publica" on public.configuracion
               for select to anon, authenticated using (true)';
    execute 'create policy "configuracion escritura admin" on public.configuracion
               for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- ---------- 2) El parametro nuevo ----------
--                                        ⬇⬇⬇ AQUI VA TU VALOR ⬇⬇⬇
insert into public.configuracion (clave, valor) values ('importacion_cop', 30000)
on conflict (clave) do nothing;

-- ---------- 3) Fuera el parametro viejo ----------
-- Ya no lo lee nadie. Se borra para que no queden dos numeros de importacion
-- en la tabla y no se sepa cual manda.
delete from public.configuracion where clave = 'factor_importacion';

-- ---------- 4) Comprobacion final ----------
-- Debe mostrar importacion_cop con tu valor, y NO debe aparecer
-- factor_importacion por ningun lado.
select clave, valor
  from public.configuracion
 order by clave;
