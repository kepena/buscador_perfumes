# Buscador de Perfumes Pro — Contexto completo del proyecto

## Qué es esto
App web de recomendación de perfumes (quiz de 7-9 preguntas) para Kaiketek.
Sitio publicado en: **buscadorperfumes.kaiketek.com**
Repo: **github.com/kepena/buscador_perfumes** (rama `main`)
Hosting: **GitHub Pages** (sitio 100% estático, sin backend propio)
Base de datos: **Supabase** (plan gratuito) — ver sección propia más abajo
DNS: gestionado en **HostGator** (CNAME apuntando a kepena.github.io)

> Este archivo vive dentro del repo a propósito. Antes existía solo en el
> computador de Kike y se perdía entre sesiones de trabajo.

## Archivos del proyecto (todos en la raíz del repo)

| Archivo | Qué hace |
|---|---|
| `index.html` | Pantalla de inicio + test de preguntas + resultados + Set Ocasión |
| `styles.css` | Todos los estilos (tema dorado/oscuro) |
| `data.js` | Catálogo: array `PERFUMES` con 132 fragancias (131 activas) + `FALLBACK_IMG` |
| `app.js` | Preguntas dinámicas, motor de scoring, resultados, Set Ocasión, WhatsApp |
| `db.js` | **Capa de acceso a Supabase.** Precios, fotos y activaciones |
| `catalogo.html` | Panel de administración (protegido con contraseña) |
| `catalogo.css` | Estilos del panel |
| `catalogo.js` | Lógica del panel: costo, venta, fotos, activar/desactivar |
| `auth-catalogo.js` | Contraseña del panel (`94458370`, hasheada con SHA-256) |
| `01-costo-y-venta.sql` | Prepara la base: columnas `costo_usd`/`venta_usd` + precios sugeridos |
| `02-precios-decant.sql` | Columnas `volumen_ml`/`verificado` + tabla `configuracion` |
| `03-decants.sql` | Columna `decant`: si esa fragancia se decanta o va solo en frasco |
| `04-importacion-fija.sql` | Cambia la importación de porcentaje a valor fijo en pesos |
| `.github/workflows/mantener-supabase-activo.yml` | Cron que evita que Supabase se pause |

## Qué vive en `data.js` y qué vive en la base de datos

Esta separación es la regla más importante del proyecto:

| Dato | Dónde vive | Cómo se cambia |
|---|---|---|
| Nombre, notas, familia, clima, momento, potencia, imagen por defecto | `data.js` | Por Git (manual) |
| **COSTO** (lo que se paga por la fragancia) | Base de datos | Desde el panel |
| **VENTA** (lo que ve el cliente) | Base de datos | Desde el panel |
| **Activo / desactivado** | Base de datos | Desde el panel |
| **Foto real subida** | Supabase Storage; la URL en la base de datos | Desde el panel |

**Los precios NO van en `data.js`.** Son dato de negocio, cambian seguido y
tienen que ser visibles para todos los visitantes sin pasar por Git.

## Estructura de cada perfume en `data.js`

```js
{
  id: 1,
  activo: true,
  nombre: "Dior Sauvage EDT",
  tipo: "Diseñador",              // "Diseñador" | "Árabe" | "Lujo"
  aromaPrincipal: "Cítrico",       // una de 7 familias (ver abajo)
  subAroma: "Cítrico puro",        // subcategoría de esa familia (2-3 por familia)
  notaEspecifica: "citrico-simple",// OPCIONAL: nivel 3, solo en subfamilias grandes
  momento: "Diario",               // "Diario" | "Citas" | "Fiesta" | "Deporte"
  clima: "Caliente / Sol",         // "Caliente / Sol" | "Frío / Noche" | "Templado"
  estilo: "Joven",                 // "Joven" | "Formal" | "Versátil"
  potencia: "Normal",              // "Modo Bestia" | "Normal" | "Suave"
  presupuesto: "Medio",            // "Económico" | "Medio" | "Sin límite"
  notas: "Bergamota... / Lavanda... / Ambroxan...",  // salida/corazón/fondo
  imagen: "Dior%20Sauvage%20EDT.avif"  // ruta relativa codificada, o SVG data-URI
}
```

Las 7 familias de `aromaPrincipal`: Fresco, Cítrico, Dulce / Gourmand,
Cálido / Especiado, Madera, Cuero / Tabaco, Limpio y Suave.

## Lógica de precios (COSTO / VENTA)

Son dos valores **independientes**, los dos guardados en la base de datos y
los dos editables fragancia por fragancia desde el panel.

- **COSTO** — lo que Kike paga por conseguir la fragancia. Es la base para
  calcular el margen de utilidad. **El ajuste global nunca lo toca.**
- **VENTA** — lo que ve el cliente. Es el único precio que sale del panel:
  el test público solo conoce este.

### Ajuste global por porcentaje ("Aplicar a todos")

Actúa sobre el **precio de VENTA actual** y **es acumulativo**:

```
Venta 78 → +30% → 101.40 → +10% → 111.54
```

Aplicar +30% y luego +10% deja la venta un 43% por encima de donde estaba,
no un 40%. Es deliberado: el porcentaje se aplica sobre lo que hay ahora.

### "Restablecer precios originales"

Copia el **COSTO sobre la VENTA** en todas las fragancias que tengan costo.
El resultado es margen 0%: es el punto de partida para volver a fijar la
utilidad. Al terminar, el panel sugiere aplicar un aumento y pre-carga 30%.

### Margen

Cada fila muestra `Margen +43%`, calculado como `(venta − costo) / costo`.
Se marca en rojo si el margen es 0% o negativo.

### Fragancia sin precio de venta

No se puede vender algo sin precio, así que:
- **En el test público: no aparece.** Ni en el Top 4 ni en el Set Ocasión.
- **En el panel: aparece marcada en rojo**, con un aviso arriba que dice
  cuántas hay. Es la señal de que hay que ponerles precio.

Esto pasa típicamente al agregar una fragancia nueva por Git: entra sin
precio y hay que configurárselo en el panel antes de que se ofrezca.

### Rangos de presupuesto

Se calculan sobre la **VENTA** y **se configuran desde el panel**, no en el
código. Los cortes viven en la base de datos, en una fila reservada con
`id 0` de la misma tabla (`costo_usd` = tope de Económico, `venta_usd` =
tope de Medio). No existe ninguna fragancia con id 0, así que no choca con
nada y evita crear una tabla aparte para dos números.

Si nunca se han configurado, se usan los valores por defecto de
`RANGOS_PRECIO` en `data.js`: Económico ≤ $45 · Medio ≤ $110.

Al editarlos, el panel muestra cuántas fragancias quedarían en cada rango
**antes** de guardar, y rechaza un corte de "Medio" menor que el de
"Económico".

> **Pendiente:** el test público todavía no muestra el precio en números,
> solo la categoría. Cuando se trabajen los precios de las 3 opciones
> (Probar / Set Ocasión / Botella) hay que revisitarlo.

## Cómo se calcula el precio de la botella

```
costo puesto en Colombia = (costo_usd × TRM) + importación_cop
precio botella           = costo puesto en Colombia × (1 + margen_botella)
```

La **importación es un valor fijo en pesos por frasco**, no un porcentaje
del costo. Traer un Creed de US$300 y un Lattafa de US$26 cuesta
prácticamente lo mismo: flete, aduana y comisiones dependen del envío, no
del valor de la fragancia.

Antes era un factor multiplicador (`factor_importacion` = 1.2, un 20%), y
eso inflaba los caros y regalaba los baratos: el Creed pagaba $240.000 de
"importación" y el Lattafa $20.800, por venir en la misma caja.

Ejemplo con TRM 4.000, importación $30.000 y margen 40%:

| Fragancia | Costo USD | Costo puesto aquí | Botella | Decant 5 ml |
|---|---|---|---|---|
| Lattafa Khamrah | $26 | $134.000 | $188.000 | $23.000 |
| Dior Sauvage EDT | $78 | $342.000 | $479.000 | $54.000 |
| Creed Aventus | $300 | $1.230.000 | $1.722.000 | $188.000 |

El margen se aplica sobre el costo **ya puesto en Colombia**, así que ese
40% también cubre la plata que se puso en traerlo.

> **Ojo:** el campo VENTA en dólares del panel **no** es el precio que ve el
> cliente. VENTA solo decide en qué rango de presupuesto cae la fragancia
> (Económico / Medio / Sin límite) y sirve para los filtros del panel.

### El test público no muestra precios

Los precios calculados se ven **solo en el panel**. En el test, el cliente
elige formato (Probar / Set / Botella) y el precio se lo damos por WhatsApp.

Es deliberado, no un olvido: mientras los costos sean estimaciones, un
número en pantalla es una promesa, y una promesa equivocada se paga en la
conversación con el cliente.

Para volver a mostrarlos cuando los costos estén verificados, en `app.js`:

```js
const MOSTRAR_PRECIOS_EN_TEST = false;   // ponlo en true
```

Esa sola línea devuelve los tres precios de las tarjetas de formato y el
total del Set. El panel no cambia: ahí los precios se ven siempre, que es
donde hacen falta para fijarlos.

### El cierre es el contacto

Como no hay precios, el paso siguiente del cliente es escribir. Las tres
pantallas de compra (Probar, Botella y Set) terminan con el mismo bloque:
el botón de WhatsApp y, debajo, **el número a la vista** —
`+57 315 012 4948` — más una línea que dice que ahí se confirma precio y
disponibilidad.

El número se escribe una sola vez, en `WHATSAPP_NUMERO` (`app.js`), y la
versión legible se deriva de ahí con `numeroVisible()`. Así no puede pasar
que el enlace apunte a un número y el texto muestre otro.

Va a la vista y no solo dentro del enlace porque hay quien prefiere
copiarlo y escribir desde su propio WhatsApp, y hay quien abre el test en
un computador sin la aplicación instalada.

## Louis Vuitton: fuera del catálogo

Las cinco fragancias de Louis Vuitton (Ombre Nomade, L'Immensité,
Imagination, Pacific Chill y Nouveau Monde) se quitaron de `data.js`.

LV vende solo en sus propias boutiques: no está en los distribuidores donde
se surte el negocio, así que no hay forma de conseguirlas ni de costearlas.
Un catálogo que recomienda algo que no se puede vender le hace perder el
tiempo al cliente y a quien atiende el WhatsApp.

Sus filas en `perfume_overrides` (ids 98, 109, 110, 120, 138) quedaron
huérfanas en la base. No estorban — `db.js` solo lee las que existen en
`data.js` — pero se pueden borrar con:

```sql
delete from public.perfume_overrides where id in (98, 109, 110, 120, 138);
```

Las fotos siguen en el repo por si entran reemplazos de esos mismos huecos.

## Cambios de referencia al buscar costos reales

Al ir contra el catálogo real de Jomashop aparecieron referencias que el
negocio no puede surtir o que Kike prefiere cambiar por la versión que sí
vende. Los cambios hechos hasta ahora:

| id | Antes | Ahora |
|----|-------|-------|
| 72 | Dior Sauvage Elixir Intense | *eliminada* (no existe como producto aparte; la ficha es la Elixir, id 3) |
| 130 | Tom Ford Neroli Portofino Forte | Tom Ford Neroli Portofino |
| 106 | Jean Paul Gaultier Le Beau | Jean Paul Gaultier Le Beau Le Parfum |
| 115 | Xerjoff Uden | Xerjoff Erba Gold |
| 24 | Lattafa Fakhar | Lattafa Art of Universe |
| 30 | Afnan Supremacy Not Only Intense | Afnan Turathi Electric |
| 88 | Lattafa Qaa'ed Intense | Lattafa The Kingdom |

Al renombrar, la foto vieja muestra el frasco equivocado, así que se borró
del repo. `imagen` apunta al archivo nuevo, que todavía no existe; hasta
que Kike suba la foto (o pegue una URL en el panel) sale `FALLBACK_IMG`.
Las tres pantallas que muestran frasco ya tienen ese respaldo, así que no
se ve un ícono roto.

Las notas de los tres reemplazos se verificaron en Fragrantica al momento
de meterlos, igual que el resto del catálogo. Sus filas viejas en
`perfume_overrides` traían el costo del perfume anterior, así que hay que
limpiarlas:

```sql
delete from public.perfume_overrides where id = 72;

update public.perfume_overrides
   set costo_usd = null, venta_usd = null, imagen_url = null, verificado = false
 where id in (24, 30, 88);
```

El id 26 (Armaf Club de Nuit Untold, duplicado del 125) sigue desactivado
y es el único cupo libre del catálogo.

## Chanel: fuera del catálogo

Las cuatro de Chanel (ids 4 Bleu EDP, 52 Bleu EDT, 132 Égoïste y
133 Allure Homme Sport Eau Extrême) se quitaron por decisión de Kike, por
la misma razón que Louis Vuitton: no hay de dónde surtirlas. Sus fotos
salieron del repo. Para limpiar la base:

```sql
delete from public.perfume_overrides where id in (4, 52, 132, 133);
```

El id 118 se llamaba "Giorgio Armani Stronger With You Powerfully"; la
línea Stronger With You es de **Emporio** Armani, así que se corrigió el
nombre y el archivo de la foto.

También salió del catálogo **96 Amouage Interlude Woman**, por decisión de
Kike al costear la marca:

```sql
delete from public.perfume_overrides where id = 96;
```

## Disponible en decant

No todo el catálogo se puede decantar: hay frascos que solo se consiguen
sellados. Cada fragancia lleva una marca (`decant`) que se edita desde el
panel, y de ella depende lo que ve el cliente:

| Marca | Qué se le ofrece en el test |
|---|---|
| Con decant | Probar (5 ml) · Set Ocasión · Botella |
| Solo frasco completo | **Solo Botella**, con una línea que explica por qué |

Una fragancia sin decant sigue apareciendo en el Top 4 y se sigue
vendiendo: lo único que cambia es el formato. Tampoco entra nunca en el Set
Ocasión, ni siquiera como relleno de una casilla.

**Ante la duda, se asume que sí hay decant.** Si la base de datos no
responde, o la columna todavía no existe, el sitio se comporta como antes
de que esta opción existiera. Equivocarse hacia "sí" cuesta una
conversación por WhatsApp; equivocarse hacia "no" esconde el formato más
vendido.

### El Set son 15 ml, siempre

El Set Ocasión son 15 ml repartidos entre fragancias distintas. Si no hay
tres que se puedan decantar, no se cancela ni se entrega menos producto: se
reparten los mismos 15 ml en decants más grandes, en pasos de 5 ml, y el
decant grande va para la fragancia que el cliente eligió en el test.

| Fragancias con decant | Reparto |
|---|---|
| 3 o más | 5 + 5 + 5 (el Set de casillas de siempre) |
| 2 | 10 + 5 |
| 1 | 15 |

Con menos de tres, el Set se arma solo y se muestra en una pantalla, sin
las preguntas de las casillas: no hay entre qué elegir.

El precio de un decant grande **no** es el múltiplo del de 5 ml: el vial y
el trabajo de trasvase se cobran una sola vez, así que uno de 10 ml sale
más barato que dos de 5 ml. La fórmula es la misma de siempre, con los ml
como variable:

```
DECANT(ml) = (COSTO_REAL_COP ÷ volumen) × ml × multiplicador + costo_vial
```

El piso comercial (`minimo_decant_cop`) sí escala: si 5 ml no se venden por
menos de $15.000, 15 ml no pueden venderse por menos de $45.000.

## Filtros del panel

Con 138 fragancias hacen falta para encontrar una concreta. Todos se
combinan entre sí:

- Chips de tipo (Todos / Diseñador / Árabe / Lujo) y búsqueda por nombre.
- Bloque plegable **Filtros avanzados**: estado (activas/desactivadas),
  rango de precio de venta, rango de margen %, y característica (aroma,
  momento, clima, estilo, potencia).

Los desplegables de característica se llenan con los valores que existen
de verdad en `PERFUMES`, para que no aparezcan opciones vacías ni falten
valores al crecer el catálogo.

Los filtros con valor se resaltan en dorado y se muestra cuántos hay
puestos más el total visible. Es fácil dejar uno olvidado y creer que el
catálogo se quedó corto.

### Tamaño de las tarjetas

Al final de la barra de filtros hay dos vistas:

- **Cómoda** — la tarjeta completa: foto grande, notas, etiquetas, precios
  calculados de decant y botella.
- **Compacta** — dos tarjetas por fila y sin lo que no se edita. Deja a la
  vista costo, venta, frasco, verificado, decant y el interruptor de
  activo. Una tarjeta pasa de ~390 px de alto a ~210, y al ir en dos
  columnas se ve casi cuatro veces más catálogo por pantalla.

La elección se recuerda en ese navegador (`localStorage`): es una
preferencia de cómo trabajas, no un dato del catálogo.

Al filtrar por precio o margen, una fragancia sin ese dato queda fuera: no
hay forma de decir si cumple.

## Base de datos (Supabase)

Proyecto: `evqifaeeamvrttuildkz` · Las claves están en `db.js` (la clave
publishable es pública por diseño; **nunca** poner ahí la `service_role`).

### Tabla `perfume_overrides`

| Columna | Para qué |
|---|---|
| `id` | Coincide con el `id` de `PERFUMES` en `data.js` |
| `costo_usd` | COSTO |
| `venta_usd` | VENTA |
| `activo` | `true`/`false`, o `null` si vale lo de `data.js` |
| `imagen_url` | URL pública de la foto en Storage |
| `volumen_ml` | Tamaño del frasco; sin él no se puede calcular el decant |
| `verificado` | `false` mientras el costo y el volumen sean los sugeridos |
| `decant` | `true` si se ofrece en decant; `false` = solo frasco completo |
| `precio_usd` | *Columna del modelo anterior, de un solo precio. En desuso.* |

### Cómo se prepara la base desde cero

Los dos archivos `.sql` de la raíz del repo dejan la base lista. Se pegan
**completos** en supabase.com → SQL Editor → New query, en este orden:

| Archivo | Qué crea | Debe terminar mostrando |
|---|---|---|
| `01-costo-y-venta.sql` | Columnas `costo_usd`, `venta_usd`, `activo`, `imagen_url` + COSTO y VENTA sugeridos para las 143 | `filas 143 · con_costo 143 · con_venta 143` |
| `02-precios-decant.sql` | Columnas `volumen_ml`, `verificado` + tabla `configuracion` con los 9 parámetros | `filas 143 · con_volumen 143 · parametros 9` |
| `03-decants.sql` | Columna `decant`, con todas las fragancias en `true` | `filas 143 · con_decant 143 · solo_botella 0` |
| `04-importacion-fija.sql` | Reemplaza `factor_importacion` por `importacion_cop` | la fila `importacion_cop` con tu valor |

Los dos se pueden repetir las veces que haga falta: **nunca pisan un valor
que ya exista**, solo rellenan lo que esté vacío. Si ya corregiste precios a
mano en el panel, volver a ejecutarlos no te los borra.

Los precios y volúmenes que traen son **sugerencias** (costo = precio típico
del frasco en el mercado de descuento, venta = costo + 40%), por eso las
fragancias entran marcadas como *sin verificar*. El panel las lista con el
filtro *Verificación → Solo sin verificar* para irlas confirmando una a una.

Si el panel muestra el recuadro rojo *“Falta preparar la base de datos”*, es
que le faltan columnas: el propio recuadro dice cuál de los dos archivos
ejecutar.

### Seguridad

- **Lectura pública** (`anon`): la necesita el test para los visitantes.
- **Escritura solo `authenticated`**: el panel canjea la contraseña que
  Kike teclea por un token temporal contra Supabase Auth. La contraseña no
  está en el código (solo su hash SHA-256), así que quien lea el código
  fuente no puede escribir en la base de datos.
- Usuario administrador: `admin@buscadorperfumes.kaiketek.com`, con la
  misma contraseña del panel, y **confirmado** (Auto Confirm User).

### La sesión de escritura vence a la hora

El token que Supabase entrega al teclear la contraseña dura una hora. Al
caducar, la base rechaza toda escritura con 401 y el panel parecía roto de
formas que no tenían nada que ver:

- *"La base de datos rechazó el cambio por falta de permiso"* al tocar
  cualquier control, mientras arriba seguía el recuadro verde de
  "Conectado" — ese se pinta al entrar y no volvía a comprobarse.
- El recuadro rojo de *"Falta preparar la base de datos"*, mandando a
  ejecutar un SQL ya ejecutado. El chequeo de columnas mandaba el token, el
  401 llegaba antes que cualquier respuesta sobre columnas, y el código
  trataba todo lo que no fuera 200 como "faltan columnas".

Cómo funciona ahora:

- `db.js` guarda también el **token de refresco**. Si una escritura recibe
  401 o 403, renueva la sesión y **repite la escritura una vez**. En el
  caso normal no te enteras de nada.
- Si el refresco tampoco funciona, se borran las tres llaves de sesión a la
  vez — token, refresco y el flag de "desbloqueado" de `auth-catalogo.js` —
  y sale un recuadro que dice qué pasó, con un botón para volver a entrar.
  Borrar el flag es lo que hace que recargar vuelva a pedir la contraseña:
  dejarlo puesto sin token es el estado que dejaba el panel abierto pero
  incapaz de guardar nada.
- **El chequeo de columnas va sin token**, porque la lectura es pública. Así
  un token vencido no puede volver a disfrazarse de columna que falta.

### Storage

Bucket **público** `fotos-perfumes`. El archivo va ahí y en la tabla solo
queda la URL. Antes las fotos se guardaban en base64 dentro de
`localStorage`, que se llenaba con 3 o 4 fotos y fallaba en silencio.

Formatos: cualquier imagen (el selector filtra por `image/*`). JPG, PNG,
WebP, AVIF y GIF conservan su extensión correcta. **Máximo 5 MB.** Cada
fragancia guarda una sola foto, con nombre fijo `perfume-<id>.<ext>`;
subir otra reemplaza la anterior.

Las políticas de Storage son políticas RLS sobre `storage.objects`:
lectura para `anon` y `authenticated`, escritura (insert/update/delete)
solo para `authenticated`, todas acotadas a
`bucket_id = 'fotos-perfumes'`.

El panel comprueba el bucket al entrar y distingue tres situaciones que
dan síntomas parecidos pero se arreglan distinto: que no exista, que
exista pero **no sea público** (la foto sube sin error y los visitantes
ven un hueco), y que falten permisos de escritura.

### El proyecto gratuito se pausa

Supabase pausa los proyectos gratuitos tras ~7 días sin actividad. El
workflow `mantener-supabase-activo.yml` consulta la tabla cada 3 días para
evitarlo. Requiere el secreto `JERO_SUPABASE_KEY` en el repo.

## Caché en memoria

`db.js` descarga los datos **una sola vez** al cargar la página y los sirve
desde memoria. Por eso los lectores de `app.js` siguen siendo síncronos y el
motor de scoring no cambió. La descarga arranca al cargar la portada, sin
bloquear nada: para cuando el visitante termina las preguntas ya está lista.

Si la base de datos falla o tarda más de 6 segundos, se usa lo que haya en
`localStorage` y, si no hay nada, los valores por defecto. **El sitio nunca
se rompe por culpa de la base de datos.**

## El árbol de preguntas (3 niveles)

1. **Marca/tipo** (Diseñador/Árabe/Lujo/Cualquiera)
2. **Familia de aroma** (las 7 de arriba)
3. **Subpregunta 2.5** — 2-3 opciones según la familia elegida (siempre existe)
4. **Subpregunta 2.6** — SOLO para subfamilias grandes (Madera→Cedro/Oud,
   Dulce→Frutal/Vainilla, etc.) — no todas las subfamilias la tienen
5. Momento del día
6. Clima
7. Vibra/edad
8. Potencia
9. Presupuesto

El motor de scoring en `app.js` (`calcularScore`) suma puntos por cada
coincidencia (aroma=25, subAroma=15, notaEspecifica=15, tipo=15, momento=12,
clima=10, estilo=5, presupuesto=3 — máximo teórico 100). Muestra un Top 4.

## Flujo de resultados → Set Ocasión

Tras el test: Top 4 con letrero "Haz click en la que más te interese".
Al elegir una tarjeta se despliegan 3 opciones:
- **Probar** (decant 5ml) → tarjeta con foto + botón WhatsApp
- **Set Ocasión** (destacada) → pantalla con 3 casillas (Cálido/Día,
  Frío/Noche, Ocasión libre), una ya llena con la elección
- **Botella completa** → igual que Probar pero con otra etiqueta

Buscar `SET OCASIÓN` en los comentarios de `app.js` para ubicarlas.

## Contacto por WhatsApp

Constante `WHATSAPP_NUMERO` al inicio de `app.js` (`573150124948`).
`generarLinkWhatsApp(mensaje)` arma el link `wa.me` con mensaje pre-escrito.
Se usa en: portada, tarjeta "Probar", tarjeta "Botella", Set Ocasión.

## Restricciones a respetar

- **No romper el test principal**: árbol de preguntas, motor de scoring,
  Set Ocasión y contacto WhatsApp ya funcionan y están probados.
- **No meter precios en `data.js`.** Van en la base de datos.
- El diseño visual (paleta dorada/oscura, Fraunces/Manrope) no cambia.
- `catalogo.html` sigue protegido con la misma contraseña simple.
- El panel separa el **estado de la conexión** (recuadro fijo arriba) del
  **resultado de la última acción** (nota gris). No volver a mezclarlos:
  cuando compartían el mismo párrafo, el diagnóstico real desaparecía al
  primer clic y el panel parecía averiado sin explicación.
- Los mensajes de error van en rojo (`.error`). Heredar el gris terciario
  sobre el fondo oscuro los vuelve ilegibles, y un error que no se lee es
  lo mismo que no mostrarlo.

## Historial de decisiones ya tomadas (para no repetir trabajo)

- 132 entradas, 131 activas (1 duplicado desactivado a propósito:
  id 26 "Armaf Club de Nuit Untold").
- Las notas fueron verificadas una por una contra fuentes reales
  (Fragrantica) — no inventar notas nuevas sin verificar. **Esto aplica
  igual a las fragancias que entren después**: ninguna referencia nueva o
  de reemplazo entra al catálogo con notas de memoria.
- Cómo verificar desde este entorno: `fragrantica.com`, `parfumo.com` y
  las tiendas de las marcas están bloqueadas por el proxy de red, así que
  `WebFetch` no sirve. La vía que sí funciona es `WebSearch`, y el criterio
  es **dos fuentes independientes que coincidan** (p. ej. el resumen de la
  ficha de Fragrantica más la web oficial de la marca o un minorista).
  Cualquier nota que aparezca en una sola fuente se descarta: así se cayó
  el "ambroxan" de la base de Turathi Electric.
- `notaEspecifica` no existe para todas las subfamilias, solo las que
  tenían saturación de perfumes empatados.
- Ya se resolvió un problema de perfumes que nunca aparecían por empates de
  score: rotación aleatoria entre empatados exactos (`app.js`, en el motor
  del Set Ocasión).
- La migración de `localStorage` a Supabase se hizo porque los cambios del
  panel solo se veían en el navegador donde se hacían. Eso causó pérdida de
  trabajo varias veces (fotos "desaparecidas", perfumes que se creían
  desactivados pero seguían activos para los visitantes).
- El panel separa el **estado de la conexión** (recuadro fijo) del
  **resultado de la última acción** (nota de abajo). Antes compartían el
  mismo párrafo y el diagnóstico real se perdía al primer clic.
- Cuando no hay permiso de escritura, los controles del panel se bloquean.
  Es preferible a dejar hacer cambios que se pierden.
- Los guardados fallidos NO se escriben en `localStorage`. Cuando se hacía,
  el panel ofrecía "subir 143 cambios pendientes" que no correspondían a
  ningún cambio real.
- La pantalla de acceso no tenía ninguna regla CSS propia pese a traer las
  clases en el HTML: caía en los estilos por defecto del navegador. Ya
  tiene estilo, está centrada y lleva un enlace para volver al test.
- Las fragancias desactivadas se marcan con **color de borde y una
  etiqueta**, no bajando la opacidad de la tarjeta: atenuarlas las volvía
  ilegibles sobre el fondo oscuro.
- El enlace al catálogo desde el test abre un diálogo que avisa que es una
  zona de administración, en vez de mandar al visitante contra una
  pantalla de contraseña.
