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
| `data.js` | Catálogo: array `PERFUMES` con 143 fragancias (142 activas) + `FALLBACK_IMG` |
| `app.js` | Preguntas dinámicas, motor de scoring, resultados, Set Ocasión, WhatsApp |
| `db.js` | **Capa de acceso a Supabase.** Precios, fotos y activaciones |
| `catalogo.html` | Panel de administración (protegido con contraseña) |
| `catalogo.css` | Estilos del panel |
| `catalogo.js` | Lógica del panel: costo, venta, fotos, activar/desactivar |
| `auth-catalogo.js` | Contraseña del panel (`94458370`, hasheada con SHA-256) |
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

Se calculan sobre la **VENTA**, con `RANGOS_PRECIO` de `data.js`:
Económico ≤ $45 · Medio ≤ $110 · Sin límite > $110.

> **Pendiente:** el test público todavía no muestra el precio en números,
> solo la categoría. Cuando se trabajen los precios de las 3 opciones
> (Probar / Set Ocasión / Botella) hay que revisitarlo.

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
| `precio_usd` | *Columna del modelo anterior, de un solo precio. En desuso.* |

### Seguridad

- **Lectura pública** (`anon`): la necesita el test para los visitantes.
- **Escritura solo `authenticated`**: el panel canjea la contraseña que
  Kike teclea por un token temporal contra Supabase Auth. La contraseña no
  está en el código (solo su hash SHA-256), así que quien lea el código
  fuente no puede escribir en la base de datos.
- Usuario administrador: `admin@buscadorperfumes.kaiketek.com`, con la
  misma contraseña del panel, y **confirmado** (Auto Confirm User).

### Storage

Bucket público `fotos-perfumes`. El archivo va ahí y en la tabla solo queda
la URL. Antes las fotos se guardaban en base64 dentro de `localStorage`, que
se llenaba con 3 o 4 fotos y fallaba en silencio.

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

## Historial de decisiones ya tomadas (para no repetir trabajo)

- 143 entradas, 142 activas (1 duplicado desactivado a propósito:
  id 26 "Armaf Club de Nuit Untold").
- Las notas fueron verificadas una por una contra fuentes reales
  (Fragrantica) — no inventar notas nuevas sin verificar.
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
