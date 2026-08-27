-- ============================================================
--  05-costos-reales.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Reemplaza los costos estimados por los costos REALES de Jomashop,
--    recogidos uno por uno contra la ficha de cada producto, y de paso
--    corrige el volumen del frasco de cada fragancia.
--
--    Son 132 fragancias: todo el catálogo.
--
--  POR QUE IMPORTA EL VOLUMEN
--    El precio del decant se calcula como (costo / volumen) × mililitros.
--    Si una fragancia de 125 ml está registrada como de 100, el decant
--    sale un 25% más caro de lo que debería. 36 de las 132 NO son de
--    100 ml: los Parfums de Marly y los Jean Paul Gaultier vienen en 125,
--    los Armaf Club de Nuit en 105, los Maison Francis Kurkdjian en 70, y
--    hay frascos desde 50 hasta 150 ml.
--
--  QUE PRECIO SE GUARDA
--    El de LISTA, no el del cupón. Los cupones de Jomashop (20% y 30%)
--    van y vienen, así que el costo de la app es el que siempre se puede
--    conseguir. Cuando el cupón alcanza a estar disponible, el descuento
--    se le pasa al cliente por WhatsApp: por eso el test ahora lo invita
--    a preguntar si hay descuentos para ese perfume.
--
--  QUE NO TOCA
--    El precio de VENTA (venta_usd) queda como está. Después de correr
--    esto, entra al panel y usa "Restablecer precios originales" seguido
--    de un aumento porcentual, o ajusta fragancia por fragancia.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--
--  ES SEGURO REPETIRLO
--    Vuelve a dejar los mismos valores. No duplica filas.
-- ============================================================

-- ---------- 1) Costo real y volumen real ----------
insert into public.perfume_overrides as o (id, costo_usd, volumen_ml, verificado) values
  (1, 173.20, 100, true),           -- Dior Sauvage EDT
  (2, 203.50, 100, true),           -- Dior Sauvage EDP
  (3, 311.77, 100, true),           -- Dior Sauvage Elixir
  (5, 80.74, 100, true),            -- Versace Eros EDP
  (6, 83.11, 100, true),            -- Giorgio Armani Acqua di Giò EDT
  (7, 124.99, 100, true),           -- Yves Saint Laurent Y EDP
  (8, 124.98, 125, true),           -- Jean Paul Gaultier Le Male Elixir
  (9, 54.86, 50, true),             -- Paco Rabanne Invictus
  (10, 87.18, 100, true),           -- Carolina Herrera 212 VIP Black EDP
  (11, 97.99, 80, true),            -- Prada Candy EDP
  (12, 59.99, 100, true),           -- Marc Jacobs Daisy EDT
  (13, 99.99, 100, true),           -- Lancôme La Vie Est Belle EDP
  (14, 89.05, 50, true),            -- Yves Saint Laurent Opium EDP
  (15, 26.99, 125, true),           -- Davidoff Cool Water EDT
  (16, 48.95, 100, true),           -- Hugo Boss Bottled EDT
  (17, 47.95, 125, true),           -- Ralph Lauren Polo Blue EDT
  (18, 29.99, 100, true),           -- Calvin Klein CK One EDT
  (19, 26.99, 100, true),           -- Lattafa Khamrah
  (20, 23.50, 100, true),           -- Lattafa Yara
  (21, 24.99, 100, true),           -- Lattafa Asad
  (22, 22.99, 100, true),           -- Lattafa Bade'e Al Oud "Oud For Glory"
  (23, 19.99, 100, true),           -- Lattafa Raghba
  (24, 39.99, 100, true),           -- Lattafa Art of Universe
  (25, 26.99, 105, true),           -- Armaf Club de Nuit Intense Man
  (26, 37.25, 105, true),           -- Armaf Club de Nuit Untold
  (27, 32.00, 100, true),           -- Rasasi Hawas for Him
  (28, 29.99, 100, true),           -- Rasasi Hawas Ice
  (29, 27.99, 100, true),           -- Afnan 9PM
  (30, 34.99, 90, true),            -- Afnan Turathi Electric
  (31, 44.99, 100, true),           -- Al Haramain Amber Oud Gold
  (32, 29.99, 75, true),            -- Swiss Arabian Shaghaf Oud
  (33, 19.99, 60, true),            -- Lattafa Ana Abiyedh
  (34, 17.99, 100, true),           -- Lattafa Qaa'ed
  (35, 27.99, 100, true),           -- Al Haramain L'Aventure
  (36, 22.00, 100, true),           -- Lattafa Fakhar Rose
  (37, 494.99, 70, true),           -- Maison Francis Kurkdjian Baccarat Rouge 540 Extrait
  (38, 366.93, 100, true),          -- Tom Ford Tobacco Vanille EDP
  (39, 297.05, 100, true),          -- Tom Ford Oud Wood EDP
  (40, 354.99, 100, true),          -- Le Labo Santal 33 EDP
  (41, 380.00, 100, true),          -- Creed Aventus EDP
  (42, 360.00, 125, true),          -- Parfums de Marly Layton EDP
  (43, 368.89, 100, true),          -- Xerjoff Alexandria II EDP
  (44, 295.00, 100, true),          -- Amouage Interlude Man EDP
  (45, 89.99, 100, true),           -- Acqua di Parma Colonia Eau de Cologne
  (46, 164.99, 100, true),          -- Escentric Molecules Molecule 01 EDT
  (47, 92.99, 100, true),           -- Guerlain L'Homme Idéal EDT
  (48, 54.99, 100, true),           -- Montblanc Explorer EDP
  (49, 88.99, 100, true),           -- Cartier Pasha de Cartier Parfum
  (50, 184.99, 75, true),           -- Diptyque Eau Capitale EDP
  (51, 112.80, 125, true),          -- Giorgio Armani Code EDP
  (53, 114.99, 150, true),          -- Prada Luna Rossa Carbon EDT
  (54, 71.24, 100, true),           -- Versace Dylan Blue EDT
  (55, 42.99, 100, true),           -- Montblanc Legend EDT
  (56, 84.81, 100, true),           -- Azzaro The Most Wanted EDP
  (57, 90.78, 60, true),            -- Yves Saint Laurent La Nuit de l'Homme EDT
  (58, 49.95, 100, true),           -- Dolce & Gabbana Light Blue EDT
  (59, 87.18, 100, true),           -- Burberry Hero EDT
  (60, 135.10, 100, true),          -- Guerlain Habit Rouge EDP
  (61, 148.69, 100, true),          -- Tom Ford Noir Extreme EDP
  (62, 87.18, 100, true),           -- Paco Rabanne 1 Million
  (63, 92.99, 125, true),           -- Jean Paul Gaultier Le Male EDT
  (64, 187.06, 100, true),          -- Dior Homme Intense
  (65, 77.18, 100, true),           -- Versace Eros Flame EDP
  (66, 29.99, 100, true),           -- Lattafa Khamrah Qahwa
  (67, 28.50, 100, true),           -- Lattafa Khamrah Dukhan
  (68, 27.95, 100, true),           -- Lattafa Asad Bourbon
  (69, 64.99, 100, true),           -- Afnan Supremacy Collector's Edition
  (70, 28.25, 100, true),           -- Armaf Odyssey Mandarin Sky
  (71, 24.99, 100, true),           -- Lattafa Opulent Dubai
  (73, 206.19, 100, true),          -- Tom Ford Ombré Leather Parfum
  (74, 334.99, 100, true),          -- Creed Aventus Cologne
  (75, 360.00, 125, true),          -- Parfums de Marly Herod EDP
  (76, 198.19, 100, true),          -- Xerjoff Erba Pura EDP
  (77, 295.00, 100, true),          -- Amouage Reflection Man EDP
  (78, 391.50, 90, true),           -- Initio Oud for Greatness EDP
  (79, 223.69, 100, true),          -- Nishane Hacivat Extrait
  (80, 259.99, 100, true),          -- Byredo Bal d'Afrique EDP
  (81, 35.00, 100, true),           -- Rasasi Hawas Elixir
  (82, 34.99, 100, true),           -- Al Haramain L'Aventure Fraiche
  (83, 22.99, 100, true),           -- Lattafa Yara Tous
  (84, 34.99, 105, true),           -- Armaf Club de Nuit Sillage
  (85, 39.99, 75, true),            -- Swiss Arabian Shaghaf Oud Elixir
  (86, 22.25, 100, true),           -- Lattafa Fakhar Black
  (87, 54.99, 100, true),           -- Al Haramain Amber Oud Tobacco Edition
  (88, 23.99, 100, true),           -- Lattafa The Kingdom
  (89, 29.99, 100, true),           -- Afnan 9PM Femme
  (90, 19.99, 100, true),           -- Nautica Voyage EDT
  (91, 299.99, 100, true),          -- Kilian Angel's Share EDP
  (92, 179.38, 100, true),          -- Roja Parfums Elysium Eau Intense
  (93, 79.99, 120, true),           -- Mancera Cedrat Boise EDP
  (94, 92.99, 100, true),           -- Montale Intense Café
  (95, 207.44, 100, true),          -- Xerjoff Naxos EDP
  (97, 360.00, 125, true),          -- Parfums de Marly Percival EDP
  (99, 85.99, 100, true),           -- Bvlgari Man in Black EDP
  (100, 264.99, 70, true),          -- Maison Francis Kurkdjian Grand Soir EDP
  (101, 44.99, 100, true),          -- Afnan 9PM Night Out
  (102, 124.98, 100, true),         -- Paco Rabanne 1 Million Lucky EDT
  (103, 118.56, 125, true),         -- Jean Paul Gaultier Le Male Le Parfum
  (104, 133.68, 125, true),         -- Jean Paul Gaultier Le Male Elixir Absolu
  (105, 115.09, 125, true),         -- Jean Paul Gaultier Le Beau Paradise Garden EDP
  (106, 124.99, 125, true),         -- Jean Paul Gaultier Le Beau Le Parfum
  (107, 232.44, 100, true),         -- Xerjoff Torino 21 EDP
  (108, 36.95, 105, true),          -- Armaf Club de Nuit Urban Man Elixir
  (111, 39.99, 100, true),          -- French Avenue Vulcan Feu
  (112, 116.38, 100, true),         -- Emporio Armani Stronger With You Intensely EDP
  (113, 35.99, 100, true),          -- French Avenue Liquid Brun
  (114, 424.36, 100, true),         -- Tom Ford Fucking Fabulous EDP
  (115, 232.44, 100, true),         -- Xerjoff Erba Gold EDP
  (116, 181.19, 100, true),         -- Xerjoff Accento EDP
  (117, 471.90, 100, true),         -- Creed Aventus Absolu
  (118, 123.50, 100, true),         -- Emporio Armani Stronger With You Powerfully EDP
  (119, 133.38, 100, true),         -- Giorgio Armani Acqua di Giò Profondo Parfum
  (121, 21.99, 100, true),          -- Lattafa Bade'e Al Oud Amethyst
  (122, 24.99, 100, true),          -- Lattafa Bade'e Al Oud Honor & Glory
  (123, 36.99, 100, true),          -- Armaf Club De Nuit Lionheart Man
  (124, 39.99, 105, true),          -- Armaf Club de Nuit Blue Iconic
  (125, 37.25, 105, true),          -- Armaf Club de Nuit Untold
  (126, 46.99, 55, true),           -- Armaf Club de Nuit Precieux I
  (127, 36.99, 100, true),          -- Rasasi Hawas Fire
  (128, 329.79, 100, true),         -- Tom Ford Tuscan Leather EDP
  (129, 144.99, 100, true),         -- Tom Ford Grey Vetiver Parfum
  (130, 309.18, 100, true),         -- Tom Ford Neroli Portofino EDP
  (131, 175.75, 100, true),         -- Tom Ford Black Orchid Parfum
  (134, 329.95, 100, true),         -- Creed Green Irish Tweed EDP
  (135, 329.50, 100, true),         -- Creed Silver Mountain Water EDP
  (136, 139.43, 100, true),         -- Yves Saint Laurent Y Le Parfum
  (137, 184.05, 100, true),         -- Yves Saint Laurent MYSLF L'Absolu
  (139, 424.99, 70, true),          -- Maison Francis Kurkdjian Oud Satin Mood Extrait
  (140, 360.00, 125, true),         -- Parfums de Marly Pegasus EDP
  (141, 360.00, 125, true),         -- Parfums de Marly Althaïr EDP
  (142, 24.99, 100, true),          -- Al Haramain Détour Noir
  (143, 49.99, 100, true)           -- Al Haramain Amber Oud Carbon Edition
on conflict (id) do update
   set costo_usd  = excluded.costo_usd,
       volumen_ml = excluded.volumen_ml,
       verificado = true;

-- ---------- 2) Fuera lo que ya no existe en el catálogo ----------
-- Louis Vuitton (98, 109, 110, 120, 138), Chanel (4, 52, 132, 133),
-- Amouage Interlude Woman (96) y Dior Sauvage Elixir Intense (72).
delete from public.perfume_overrides
 where id in (98, 109, 110, 120, 138, 4, 52, 132, 133, 96, 72);

-- ---------- 3) Comprobación ----------
-- Debe decir 132 verificadas.
select count(*)      as verificadas,
       min(costo_usd) as costo_minimo,
       max(costo_usd) as costo_maximo
  from public.perfume_overrides
 where verificado = true;

-- ============================================================
--  REFERENCIA: precios con cupón
--
--  No se guardan en la base. Quedan anotados para que sepas hasta
--  dónde le puedes bajar a un cliente sin perder margen. Son 50
--  de las 132; el resto no tenía cupón.
-- ============================================================
--
--    1  Dior Sauvage EDT                                  173.20 -> 121.24
--    2  Dior Sauvage EDP                                  203.50 -> 142.45
--    3  Dior Sauvage Elixir                               311.77 -> 218.24
--    5  Versace Eros EDP                                   80.74 -> 64.59
--    6  Giorgio Armani Acqua di Giò EDT                    83.11 -> 66.49
--    7  Yves Saint Laurent Y EDP                          124.99 -> 99.99
--    8  Jean Paul Gaultier Le Male Elixir                 124.98 -> 99.98
--   10  Carolina Herrera 212 VIP Black EDP                 87.18 -> 69.74
--   14  Yves Saint Laurent Opium EDP                       89.05 -> 71.24
--   38  Tom Ford Tobacco Vanille EDP                      366.93 -> 293.54
--   39  Tom Ford Oud Wood EDP                             297.05 -> 237.64
--   41  Creed Aventus EDP                                 380.00 -> 310.00
--   43  Xerjoff Alexandria II EDP                         368.89 -> 294.95
--   47  Guerlain L'Homme Idéal EDT                         92.99 -> 65.09
--   51  Giorgio Armani Code EDP                           112.80 -> 90.24
--   54  Versace Dylan Blue EDT                             71.24 -> 58.99
--   56  Azzaro The Most Wanted EDP                         84.81 -> 67.85
--   57  Yves Saint Laurent La Nuit de l'Homme EDT          90.78 -> 72.62
--   59  Burberry Hero EDT                                  87.18 -> 69.74
--   60  Guerlain Habit Rouge EDP                          135.10 -> 94.57
--   61  Tom Ford Noir Extreme EDP                         148.69 -> 118.95
--   62  Paco Rabanne 1 Million                             87.18 -> 69.74
--   63  Jean Paul Gaultier Le Male EDT                     92.99 -> 74.39
--   64  Dior Homme Intense                                187.06 -> 130.94
--   65  Versace Eros Flame EDP                             77.18 -> 61.74
--   69  Afnan Supremacy Collector's Edition                64.99 -> 54.99
--   73  Tom Ford Ombré Leather Parfum                     206.19 -> 164.95
--   76  Xerjoff Erba Pura EDP                             198.19 -> 158.95
--   79  Nishane Hacivat Extrait                           223.69 -> 178.95
--   91  Kilian Angel's Share EDP                          299.99 -> 279.99
--   92  Roja Parfums Elysium Eau Intense                  179.38 -> 143.50
--   94  Montale Intense Café                               92.99 -> 65.09
--   95  Xerjoff Naxos EDP                                 207.44 -> 165.95
--  102  Paco Rabanne 1 Million Lucky EDT                  124.98 -> 99.98
--  103  Jean Paul Gaultier Le Male Le Parfum              118.56 -> 94.85
--  104  Jean Paul Gaultier Le Male Elixir Absolu          133.68 -> 106.94
--  105  Jean Paul Gaultier Le Beau Paradise Garden EDP    115.09 -> 92.07
--  107  Xerjoff Torino 21 EDP                             232.44 -> 185.95
--  112  Emporio Armani Stronger With You Intensely EDP    116.38 -> 93.10
--  113  French Avenue Liquid Brun                          35.99 -> 25.99
--  114  Tom Ford Fucking Fabulous EDP                     424.36 -> 339.49
--  115  Xerjoff Erba Gold EDP                             232.44 -> 185.95
--  116  Xerjoff Accento EDP                               181.19 -> 144.95
--  117  Creed Aventus Absolu                              471.90 -> 419.99
--  119  Giorgio Armani Acqua di Giò Profondo Parfum       133.38 -> 106.70
--  128  Tom Ford Tuscan Leather EDP                       329.79 -> 263.83
--  130  Tom Ford Neroli Portofino EDP                     309.18 -> 247.34
--  131  Tom Ford Black Orchid Parfum                      175.75 -> 140.60
--  136  Yves Saint Laurent Y Le Parfum                    139.43 -> 111.54
--  137  Yves Saint Laurent MYSLF L'Absolu                 184.05 -> 147.24
