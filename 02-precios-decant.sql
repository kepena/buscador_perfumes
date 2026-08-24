-- ============================================================
--  02-precios-decant.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    1. Anade las columnas volumen_ml y verificado a perfume_overrides.
--    2. Le pone a las 143 fragancias el tamano de frasco tipico (ml), que
--       es lo que el panel necesita para calcular el precio del decant de
--       5 ml y el de la botella completa.
--    3. Crea la tabla public.configuracion con los parametros del calculo
--       (TRM, factor de importacion, merma, margenes...) para poder
--       editarlos desde el panel en vez de tocar codigo.
--
--  ORDEN
--    Ejecuta primero 01-costo-y-venta.sql. Sin costo no hay precio que
--    calcular, por mucho volumen que haya.
--
--  ES SEGURO REPETIRLO
--    Nunca pisa un volumen ni un parametro que ya tenga valor: solo
--    rellena lo que este vacio.
-- ============================================================

-- ---------- 1) Columnas de volumen y verificacion ----------
create table if not exists public.perfume_overrides (
  id integer primary key
);

alter table public.perfume_overrides add column if not exists volumen_ml integer;
alter table public.perfume_overrides add column if not exists verificado boolean default false;

-- ---------- 2) Garantizar que id sea unico ----------
-- El panel guarda con "upsert" (inserta o actualiza segun el id), y eso
-- necesita que id tenga un indice unico. En una tabla creada por este mismo
-- archivo ya lo es; esto cubre el caso de una tabla creada a mano sin clave.
do $$
declare
  tabla oid := 'public.perfume_overrides'::regclass;
begin
  if not exists (
    select 1
      from pg_index i
     where i.indrelid = tabla
       and i.indisunique
       and i.indnatts = 1
       and i.indkey[0] = (select attnum from pg_attribute
                           where attrelid = tabla and attname = 'id' and not attisdropped)
  ) then
    execute 'create unique index perfume_overrides_id_unico on public.perfume_overrides (id)';
  end if;
end $$;

-- ---------- 3) Tamano de frasco por fragancia ----------
-- (id, volumen_ml) — el tamano que mas se consigue de cada una.
insert into public.perfume_overrides as o (id, volumen_ml) values
  (1, 100),   -- Dior Sauvage EDT
  (2, 100),   -- Dior Sauvage EDP
  (3, 60),    -- Dior Sauvage Elixir
  (4, 100),   -- Chanel Bleu de Chanel EDP
  (5, 100),   -- Versace Eros
  (6, 100),   -- Giorgio Armani Acqua di Giò
  (7, 100),   -- Yves Saint Laurent Y EDP
  (8, 125),   -- Jean Paul Gaultier Le Male Elixir
  (9, 100),   -- Paco Rabanne Invictus
  (10, 100),  -- Carolina Herrera CH Men Prive
  (11, 80),   -- Prada Candy
  (12, 100),  -- Marc Jacobs Daisy
  (13, 100),  -- Lancôme La Vie Est Belle
  (14, 90),   -- Yves Saint Laurent Opium
  (15, 125),  -- Davidoff Cool Water
  (16, 100),  -- Hugo Boss Bottled
  (17, 125),  -- Ralph Lauren Polo Blue
  (18, 100),  -- Calvin Klein CK One
  (19, 100),  -- Lattafa Khamrah
  (20, 100),  -- Lattafa Yara
  (21, 100),  -- Lattafa Asad
  (22, 100),  -- Lattafa Bade'e Al Oud
  (23, 100),  -- Lattafa Raghba
  (24, 100),  -- Lattafa Fakhar
  (25, 105),  -- Armaf Club de Nuit Intense Man
  (26, 105),  -- Armaf Club de Nuit Untold
  (27, 100),  -- Rasasi Hawas for Him
  (28, 100),  -- Rasasi Hawas Ice
  (29, 100),  -- Afnan 9PM
  (30, 100),  -- Afnan Supremacy Not Only Intense
  (31, 60),   -- Al Haramain Amber Oud Gold
  (32, 75),   -- Swiss Arabian Shaghaf Oud
  (33, 60),   -- Lattafa Ana Abiyedh
  (34, 100),  -- Lattafa Qaa'ed
  (35, 100),  -- Al Haramain L'Aventure
  (36, 100),  -- Lattafa Fakhar Rose
  (37, 70),   -- Maison Francis Kurkdjian Baccarat Rouge 540
  (38, 50),   -- Tom Ford Tobacco Vanille
  (39, 50),   -- Tom Ford Oud Wood
  (40, 50),   -- Le Labo Santal 33
  (41, 100),  -- Creed Aventus
  (42, 125),  -- Parfums de Marly Layton
  (43, 50),   -- Xerjoff Alexandria II
  (44, 100),  -- Amouage Interlude Man
  (45, 100),  -- Acqua di Parma Colonia
  (46, 100),  -- Escentric Molecules Molecule 01
  (47, 100),  -- Guerlain L'Homme Idéal
  (48, 100),  -- Montblanc Explorer
  (49, 100),  -- Cartier Pasha de Cartier Parfum
  (50, 75),   -- Diptyque Eau Capitale
  (51, 75),   -- Giorgio Armani Code
  (52, 100),  -- Chanel Bleu de Chanel EDT
  (53, 100),  -- Prada Luna Rossa Carbon
  (54, 100),  -- Versace Dylan Blue
  (55, 100),  -- Montblanc Legend
  (56, 100),  -- Azzaro The Most Wanted
  (57, 100),  -- Yves Saint Laurent La Nuit de l'Homme
  (58, 100),  -- Dolce & Gabbana Light Blue
  (59, 100),  -- Burberry Hero
  (60, 100),  -- Guerlain Habit Rouge
  (61, 100),  -- Tom Ford Noir Extreme
  (62, 100),  -- Paco Rabanne 1 Million
  (63, 125),  -- Jean Paul Gaultier Le Male
  (64, 100),  -- Dior Homme Intense
  (65, 100),  -- Versace Eros Flame
  (66, 100),  -- Lattafa Khamrah Qahwa
  (67, 100),  -- Lattafa Khamrah Dukhan
  (68, 100),  -- Lattafa Asad Bourbon
  (69, 100),  -- Afnan Supremacy Collector's Edition
  (70, 100),  -- Armaf Odyssey Mandarin Sky
  (71, 100),  -- Lattafa Opulent Dubai
  (72, 100),  -- Dior Sauvage Elixir Intense
  (73, 100),  -- Tom Ford Ombré Leather Parfum
  (74, 100),  -- Creed Aventus Cologne
  (75, 125),  -- Parfums de Marly Herod
  (76, 100),  -- Xerjoff Erba Pura
  (77, 100),  -- Amouage Reflection Man
  (78, 90),   -- Initio Oud for Greatness
  (79, 100),  -- Nishane Hacivat
  (80, 100),  -- Byredo Bal d'Afrique
  (81, 100),  -- Rasasi Hawas Elixir
  (82, 100),  -- Al Haramain L'Aventure Fraiche
  (83, 100),  -- Lattafa Yara Tous
  (84, 105),  -- Armaf Club de Nuit Sillage
  (85, 75),   -- Swiss Arabian Shaghaf Oud Elixir
  (86, 100),  -- Lattafa Fakhar Black
  (87, 60),   -- Al Haramain Amber Oud Tobacco Edition
  (88, 100),  -- Lattafa Qaa'ed Intense
  (89, 100),  -- Afnan 9PM Femme
  (90, 100),  -- Nautica Voyage
  (91, 50),   -- Kilian Angel's Share
  (92, 100),  -- Roja Parfums Elysium
  (93, 120),  -- Mancera Cedrat Boise
  (94, 100),  -- Montale Intense Café
  (95, 100),  -- Xerjoff Naxos
  (96, 100),  -- Amouage Interlude Woman
  (97, 125),  -- Parfums de Marly Percival
  (98, 100),  -- Louis Vuitton Ombre Nomade
  (99, 100),  -- Bvlgari Man in Black
  (100, 70),  -- Maison Francis Kurkdjian Grand Soir
  (101, 100), -- Afnan 9PM Night Out
  (102, 100), -- Paco Rabanne 1 Million Lucky
  (103, 125), -- Jean Paul Gaultier Le Male Le Parfum
  (104, 125), -- Jean Paul Gaultier Le Male Elixir Absolu
  (105, 125), -- Jean Paul Gaultier Le Beau Paradise Garden
  (106, 125), -- Jean Paul Gaultier Le Beau
  (107, 100), -- Xerjoff Torino 21
  (108, 105), -- Armaf Club de Nuit Urban Man Elixir
  (109, 100), -- Louis Vuitton L'Immensité
  (110, 100), -- Louis Vuitton Imagination
  (111, 100), -- French Avenue Vulcan Feu
  (112, 100), -- Emporio Armani Stronger With You Intensely
  (113, 100), -- French Avenue Liquid Brun
  (114, 50),  -- Tom Ford Fucking Fabulous
  (115, 100), -- Xerjoff Uden
  (116, 100), -- Xerjoff Accento
  (117, 75),  -- Creed Aventus Absolu
  (118, 100), -- Giorgio Armani Stronger With You Powerfully
  (119, 75),  -- Giorgio Armani Acqua di Giò Profondo Parfum
  (120, 100), -- Louis Vuitton Pacific Chill
  (121, 100), -- Lattafa Bade'e Al Oud Amethyst
  (122, 100), -- Lattafa Bade'e Al Oud Honor & Glory
  (123, 105), -- Armaf Club De Nuit Lionheart Man
  (124, 105), -- Armaf Club de Nuit Blue Iconic
  (125, 105), -- Armaf Club de Nuit Untold
  (126, 105), -- Armaf Club de Nuit Precieux I
  (127, 100), -- Rasasi Hawas Fire
  (128, 50),  -- Tom Ford Tuscan Leather
  (129, 50),  -- Tom Ford Grey Vetiver Parfum
  (130, 50),  -- Tom Ford Neroli Portofino Forte
  (131, 50),  -- Tom Ford Black Orchid Parfum
  (132, 100), -- Chanel Égoïste
  (133, 100), -- Chanel Allure Homme Sport Eau Extrême
  (134, 100), -- Creed Green Irish Tweed
  (135, 100), -- Creed Silver Mountain Water
  (136, 100), -- Yves Saint Laurent Y Le Parfum
  (137, 100), -- Yves Saint Laurent MYSLF L'Absolu
  (138, 100), -- Louis Vuitton Nouveau Monde
  (139, 70),  -- Maison Francis Kurkdjian Oud Satin Mood
  (140, 125), -- Parfums de Marly Pegasus
  (141, 125), -- Parfums de Marly Althaïr
  (142, 100), -- Al Haramain Détour Noir
  (143, 60)   -- Al Haramain Amber Oud Carbon Edition
on conflict (id) do update
   set volumen_ml = coalesce(o.volumen_ml, excluded.volumen_ml);

-- Las filas que nunca se revisaron quedan marcadas como pendientes, que es
-- lo que hace que el panel las liste en "Solo sin verificar".
update public.perfume_overrides
   set verificado = false
 where verificado is null;

-- ---------- 4) Parametros del calculo de precios ----------
create table if not exists public.configuracion (
  clave text primary key,
  valor numeric not null
);

-- Valores por defecto, los mismos que trae db.js. Si ya cambiaste alguno
-- desde el panel, "do nothing" lo respeta.
insert into public.configuracion (clave, valor) values
  ('trm', 4000),                 -- pesos por dolar
  ('factor_importacion', 1.2),   -- flete + aduana + comisiones
  ('multiplicador_decant', 3),   -- recupera el frasco en ~7 de 18 decants
  ('costo_vial_cop', 3000),      -- atomizador + etiqueta + tiempo
  ('merma', 0.08),               -- se pierde al trasvasar
  ('margen_botella', 0.4),       -- sobre el costo real puesto en Colombia
  ('descuento_set', 0.1),        -- por llevar los tres decants
  ('minimo_decant_cop', 15000),  -- piso comercial
  ('ml_decant', 5)               -- tamano del decant
on conflict (clave) do nothing;

-- ---------- 5) Permisos de la tabla de configuracion ----------
-- Lectura para cualquiera (el test publico calcula precios con esto) y
-- escritura solo para el usuario administrador, igual que perfume_overrides.
alter table public.configuracion enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'configuracion'
                    and policyname = 'configuracion lectura publica') then
    create policy "configuracion lectura publica"
      on public.configuracion for select
      to anon, authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'configuracion'
                    and policyname = 'configuracion escritura admin') then
    create policy "configuracion escritura admin"
      on public.configuracion for all
      to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- 6) Avisarle a la API que cambio el esquema ----------
notify pgrst, 'reload schema';

-- ---------- 7) Comprobacion final ----------
-- Debe dar: filas 143 · con_volumen 143 · parametros 9
select (select count(*)           from public.perfume_overrides where id > 0) as filas,
       (select count(volumen_ml)  from public.perfume_overrides where id > 0) as con_volumen,
       (select count(*)           from public.configuracion)                  as parametros;
