-- ============================================================
--  01-costo-y-venta.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Deja la tabla public.perfume_overrides con las columnas que el panel
--    (catalogo.html) necesita para guardar precios, y le pone a las 143
--    fragancias un COSTO y un precio de VENTA sugeridos como punto de
--    partida. Sin estas dos columnas los botones del panel no guardan nada
--    y sale el recuadro rojo "Falta preparar la base de datos".
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO (desde la primera linea) y dale Run.
--    Al final debe mostrar:  filas 143 · con_costo 143 · con_venta 143
--    Luego vuelve al panel y recarga la pagina.
--
--  ES SEGURO REPETIRLO
--    Se puede ejecutar las veces que haga falta. Nunca pisa un precio que
--    ya tenga valor: solo rellena los que esten vacios. Si ya corregiste
--    precios a mano, siguen intactos.
--
--  DE DONDE SALEN LOS NUMEROS
--    COSTO = precio tipico en USD del frasco completo en el mercado de
--    descuento (lo que se paga por conseguirlo), estimado fragancia por
--    fragancia. VENTA = costo + 40%.
--    Son SUGERENCIAS, no precios verificados: por eso las fragancias
--    quedan marcadas como "sin verificar" y el panel te pide revisarlas
--    una por una con el filtro Verificacion -> Solo sin verificar.
-- ============================================================

-- ---------- 1) La tabla y sus columnas ----------
-- La tabla solo se crea si de verdad no existe, y en ese caso nace ya con
-- RLS activado y sus dos politicas. Va dentro de un bloque "do" a proposito:
-- el editor de Supabase revisa el texto del script y, si ve un "create table"
-- suelto, muestra una ventana de aviso sobre RLS aunque la tabla ya exista.
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

alter table public.perfume_overrides add column if not exists costo_usd   numeric;
alter table public.perfume_overrides add column if not exists venta_usd   numeric;
alter table public.perfume_overrides add column if not exists activo      boolean;
alter table public.perfume_overrides add column if not exists imagen_url  text;
alter table public.perfume_overrides add column if not exists volumen_ml  integer;
alter table public.perfume_overrides add column if not exists verificado  boolean default false;

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

-- ---------- 3) Permisos, si la tabla se creo a mano sin politicas ----------
-- Sin politicas los visitantes no pueden leer los precios. Si tu tabla ya
-- tiene las suyas (el caso normal) este bloque no toca absolutamente nada.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'perfume_overrides') then
    execute 'alter table public.perfume_overrides enable row level security';
    execute 'create policy "perfumes lectura publica" on public.perfume_overrides
               for select to anon, authenticated using (true)';
    execute 'create policy "perfumes escritura admin" on public.perfume_overrides
               for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- ---------- 4) Rescatar precios del modelo anterior ----------
-- Antes habia una sola columna precio_usd. Si tu tabla todavia la tiene con
-- datos, ese precio pasa a ser el de VENTA en vez de perderse. Va dentro de
-- un bloque condicional porque en una tabla nueva esa columna no existe y
-- nombrarla directamente romperia el script.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'perfume_overrides'
       and column_name  = 'precio_usd'
  ) then
    execute 'update public.perfume_overrides
                set venta_usd = precio_usd
              where venta_usd is null and precio_usd is not null';
  end if;
end $$;

-- ---------- 5) Precios sugeridos, fragancia por fragancia ----------
-- (id, costo_usd, venta_usd)
-- coalesce(o.campo, excluded.campo) = "deja el que ya hay; si esta vacio,
-- pon el sugerido". Por eso se puede repetir sin borrar tu trabajo.
insert into public.perfume_overrides as o (id, costo_usd, venta_usd) values
  (1, 85, 119),    -- Dior Sauvage EDT
  (2, 95, 133),    -- Dior Sauvage EDP
  (3, 130, 182),   -- Dior Sauvage Elixir
  (4, 120, 168),   -- Chanel Bleu de Chanel EDP
  (5, 45, 63),     -- Versace Eros
  (6, 55, 77),     -- Giorgio Armani Acqua di Giò
  (7, 85, 119),    -- Yves Saint Laurent Y EDP
  (8, 95, 133),    -- Jean Paul Gaultier Le Male Elixir
  (9, 45, 63),     -- Paco Rabanne Invictus
  (10, 45, 63),    -- Carolina Herrera CH Men Prive
  (11, 60, 84),    -- Prada Candy
  (12, 70, 98),    -- Marc Jacobs Daisy
  (13, 85, 119),   -- Lancôme La Vie Est Belle
  (14, 80, 112),   -- Yves Saint Laurent Opium
  (15, 25, 35),    -- Davidoff Cool Water
  (16, 45, 63),    -- Hugo Boss Bottled
  (17, 55, 77),    -- Ralph Lauren Polo Blue
  (18, 25, 35),    -- Calvin Klein CK One
  (19, 26, 36),    -- Lattafa Khamrah
  (20, 22, 31),    -- Lattafa Yara
  (21, 22, 31),    -- Lattafa Asad
  (22, 24, 34),    -- Lattafa Bade'e Al Oud
  (23, 18, 25),    -- Lattafa Raghba
  (24, 22, 31),    -- Lattafa Fakhar
  (25, 28, 39),    -- Armaf Club de Nuit Intense Man
  (26, 28, 39),    -- Armaf Club de Nuit Untold
  (27, 32, 45),    -- Rasasi Hawas for Him
  (28, 32, 45),    -- Rasasi Hawas Ice
  (29, 24, 34),    -- Afnan 9PM
  (30, 26, 36),    -- Afnan Supremacy Not Only Intense
  (31, 30, 42),    -- Al Haramain Amber Oud Gold
  (32, 22, 31),    -- Swiss Arabian Shaghaf Oud
  (33, 20, 28),    -- Lattafa Ana Abiyedh
  (34, 22, 31),    -- Lattafa Qaa'ed
  (35, 26, 36),    -- Al Haramain L'Aventure
  (36, 22, 31),    -- Lattafa Fakhar Rose
  (37, 250, 350),  -- Maison Francis Kurkdjian Baccarat Rouge 540
  (38, 230, 322),  -- Tom Ford Tobacco Vanille
  (39, 220, 308),  -- Tom Ford Oud Wood
  (40, 210, 294),  -- Le Labo Santal 33
  (41, 300, 420),  -- Creed Aventus
  (42, 260, 364),  -- Parfums de Marly Layton
  (43, 300, 420),  -- Xerjoff Alexandria II
  (44, 290, 406),  -- Amouage Interlude Man
  (45, 120, 168),  -- Acqua di Parma Colonia
  (46, 110, 154),  -- Escentric Molecules Molecule 01
  (47, 75, 105),   -- Guerlain L'Homme Idéal
  (48, 50, 70),    -- Montblanc Explorer
  (49, 110, 154),  -- Cartier Pasha de Cartier Parfum
  (50, 140, 196),  -- Diptyque Eau Capitale
  (51, 55, 77),    -- Giorgio Armani Code
  (52, 105, 147),  -- Chanel Bleu de Chanel EDT
  (53, 65, 91),    -- Prada Luna Rossa Carbon
  (54, 45, 63),    -- Versace Dylan Blue
  (55, 40, 56),    -- Montblanc Legend
  (56, 60, 84),    -- Azzaro The Most Wanted
  (57, 70, 98),    -- Yves Saint Laurent La Nuit de l'Homme
  (58, 55, 77),    -- Dolce & Gabbana Light Blue
  (59, 60, 84),    -- Burberry Hero
  (60, 75, 105),   -- Guerlain Habit Rouge
  (61, 160, 224),  -- Tom Ford Noir Extreme
  (62, 55, 77),    -- Paco Rabanne 1 Million
  (63, 55, 77),    -- Jean Paul Gaultier Le Male
  (64, 95, 133),   -- Dior Homme Intense
  (65, 50, 70),    -- Versace Eros Flame
  (66, 28, 39),    -- Lattafa Khamrah Qahwa
  (67, 28, 39),    -- Lattafa Khamrah Dukhan
  (68, 25, 35),    -- Lattafa Asad Bourbon
  (69, 28, 39),    -- Afnan Supremacy Collector's Edition
  (70, 30, 42),    -- Armaf Odyssey Mandarin Sky
  (71, 25, 35),    -- Lattafa Opulent Dubai
  (72, 175, 245),  -- Dior Sauvage Elixir Intense
  (73, 190, 266),  -- Tom Ford Ombré Leather Parfum
  (74, 250, 350),  -- Creed Aventus Cologne
  (75, 260, 364),  -- Parfums de Marly Herod
  (76, 250, 350),  -- Xerjoff Erba Pura
  (77, 280, 392),  -- Amouage Reflection Man
  (78, 280, 392),  -- Initio Oud for Greatness
  (79, 230, 322),  -- Nishane Hacivat
  (80, 230, 322),  -- Byredo Bal d'Afrique
  (81, 32, 45),    -- Rasasi Hawas Elixir
  (82, 28, 39),    -- Al Haramain L'Aventure Fraiche
  (83, 22, 31),    -- Lattafa Yara Tous
  (84, 28, 39),    -- Armaf Club de Nuit Sillage
  (85, 25, 35),    -- Swiss Arabian Shaghaf Oud Elixir
  (86, 25, 35),    -- Lattafa Fakhar Black
  (87, 32, 45),    -- Al Haramain Amber Oud Tobacco Edition
  (88, 25, 35),    -- Lattafa Qaa'ed Intense
  (89, 25, 35),    -- Afnan 9PM Femme
  (90, 18, 25),    -- Nautica Voyage
  (91, 260, 364),  -- Kilian Angel's Share
  (92, 320, 448),  -- Roja Parfums Elysium
  (93, 110, 154),  -- Mancera Cedrat Boise
  (94, 95, 133),   -- Montale Intense Café
  (95, 260, 364),  -- Xerjoff Naxos
  (96, 290, 406),  -- Amouage Interlude Woman
  (97, 260, 364),  -- Parfums de Marly Percival
  (98, 370, 518),  -- Louis Vuitton Ombre Nomade
  (99, 70, 98),    -- Bvlgari Man in Black
  (100, 230, 322), -- Maison Francis Kurkdjian Grand Soir
  (101, 26, 36),   -- Afnan 9PM Night Out
  (102, 45, 63),   -- Paco Rabanne 1 Million Lucky
  (103, 85, 119),  -- Jean Paul Gaultier Le Male Le Parfum
  (104, 110, 154), -- Jean Paul Gaultier Le Male Elixir Absolu
  (105, 75, 105),  -- Jean Paul Gaultier Le Beau Paradise Garden
  (106, 65, 91),   -- Jean Paul Gaultier Le Beau
  (107, 240, 336), -- Xerjoff Torino 21
  (108, 30, 42),   -- Armaf Club de Nuit Urban Man Elixir
  (109, 340, 476), -- Louis Vuitton L'Immensité
  (110, 340, 476), -- Louis Vuitton Imagination
  (111, 34, 48),   -- French Avenue Vulcan Feu
  (112, 65, 91),   -- Emporio Armani Stronger With You Intensely
  (113, 34, 48),   -- French Avenue Liquid Brun
  (114, 300, 420), -- Tom Ford Fucking Fabulous
  (115, 200, 280), -- Xerjoff Uden
  (116, 250, 350), -- Xerjoff Accento
  (117, 400, 560), -- Creed Aventus Absolu
  (118, 75, 105),  -- Giorgio Armani Stronger With You Powerfully
  (119, 90, 126),  -- Giorgio Armani Acqua di Giò Profondo Parfum
  (120, 340, 476), -- Louis Vuitton Pacific Chill
  (121, 26, 36),   -- Lattafa Bade'e Al Oud Amethyst
  (122, 28, 39),   -- Lattafa Bade'e Al Oud Honor & Glory
  (123, 30, 42),   -- Armaf Club De Nuit Lionheart Man
  (124, 30, 42),   -- Armaf Club de Nuit Blue Iconic
  (125, 28, 39),   -- Armaf Club de Nuit Untold
  (126, 30, 42),   -- Armaf Club de Nuit Precieux I
  (127, 32, 45),   -- Rasasi Hawas Fire
  (128, 230, 322), -- Tom Ford Tuscan Leather
  (129, 190, 266), -- Tom Ford Grey Vetiver Parfum
  (130, 220, 308), -- Tom Ford Neroli Portofino Forte
  (131, 160, 224), -- Tom Ford Black Orchid Parfum
  (132, 110, 154), -- Chanel Égoïste
  (133, 115, 161), -- Chanel Allure Homme Sport Eau Extrême
  (134, 300, 420), -- Creed Green Irish Tweed
  (135, 290, 406), -- Creed Silver Mountain Water
  (136, 95, 133),  -- Yves Saint Laurent Y Le Parfum
  (137, 110, 154), -- Yves Saint Laurent MYSLF L'Absolu
  (138, 340, 476), -- Louis Vuitton Nouveau Monde
  (139, 300, 420), -- Maison Francis Kurkdjian Oud Satin Mood
  (140, 270, 378), -- Parfums de Marly Pegasus
  (141, 260, 364), -- Parfums de Marly Althaïr
  (142, 30, 42),   -- Al Haramain Détour Noir
  (143, 32, 45)    -- Al Haramain Amber Oud Carbon Edition
on conflict (id) do update
   set costo_usd = coalesce(o.costo_usd, excluded.costo_usd),
       venta_usd = coalesce(o.venta_usd, excluded.venta_usd);

-- ---------- 6) Avisarle a la API que cambio el esquema ----------
-- Sin esto Supabase puede seguir respondiendo "column does not exist" un
-- rato largo aunque las columnas ya esten creadas.
notify pgrst, 'reload schema';

-- ---------- 7) Comprobacion final ----------
-- Debe dar: filas 143 · con_costo 143 · con_venta 143
select count(*)         as filas,
       count(costo_usd) as con_costo,
       count(venta_usd) as con_venta
  from public.perfume_overrides
 where id > 0;
