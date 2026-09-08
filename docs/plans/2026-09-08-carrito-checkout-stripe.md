# Plan: Carrito de compras y checkout con Stripe

## Objetivo

Reemplazar el cierre manual por WhatsApp de "Botella completa" por un
carrito multi-producto con pago automático (tarjeta o PayPal) vía Stripe
Checkout, apoyado en la primera pieza de backend real del proyecto (dos
Supabase Edge Functions) y una tabla de stock que decide qué se puede
vender y en cuánto tiempo se despacha.

## Contexto del Problema

Hoy el sitio no cobra nada: el visitante ve el precio calculado y tiene que
escribir por WhatsApp para cerrar la compra, fragancia por fragancia, sin
carrito ni registro de pedidos. Kike ya decidió vender en Estados Unidos por
dropshipping (Jomashop) y quiere una confirmación de pago automática — "no
es bien presentado ante un cliente" tener que confiar en que alguien revise
manualmente que llegó una transferencia. Ver detalle completo en el spec.

## Spec de Referencia

`docs/specs/2026-09-08-carrito-checkout-stripe.md` (aprobado). Piezas del
spec más relevantes para las decisiones técnicas de este plan:

- Sección "Posibles Errores y Mitigaciones": condición de carrera del último
  ítem en stock, webhook que no llega al navegador, Stripe sin configurar.
- Sección "Alcance Versión 1": total calculado del lado servidor, envío
  solo a EE.UU., WhatsApp como canal de dudas (no de cierre).

## Decisión adicional tomada durante la planeación

El spec no resolvía en qué moneda se calcula el precio para Stripe.
`db.js` calcula hoy "Botella completa" en **pesos colombianos**
(`costo_usd × TRM + importación_cop`, pensado para traer el frasco a
Colombia). Como el modelo de EE.UU. dice que el producto nunca pasa por
Colombia, Kike confirmó que el precio de Stripe se calcula **directo en
USD**: `precio_usd = costo_usd × (1 + margen_botella)`, reusando el mismo
`margen_botella` que ya existe en `configuracion`, sin TRM ni
`importacion_cop`. Esta fórmula vive **solo** en la Edge Function nueva —
no reemplaza ni toca `preciosDe()` en `db.js`, que sigue calculando el COP
que hoy se muestra en las pantallas de Probar/Set Ocasión (fuera de
alcance de este plan).

## Prerrequisitos bloqueantes (de Kike, fuera de este plan)

Nada de lo siguiente es tarea de código. Sin esto, el checkout no puede
activarse en producción:

1. Migrar la cuenta de PayPal de personal a Business.
2. Crear la cuenta de Stripe, activar PayPal como método de pago dentro de
   Stripe, y obtener: `publishable key`, `secret key`, `webhook signing
   secret`.
3. Cargar esas tres llaves como secretos de Supabase Edge Functions
   (`supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...`;
   la publishable key no es secreta, puede ir directo en el frontend como
   ya pasa con `SUPABASE_KEY` en `db.js`).

Mientras esto no esté listo, el sitio debe seguir funcionando exactamente
como hoy (ver Bloque F, tarea de apagado con gracia).

---

## Bloque A — Base de datos (migraciones SQL)

**A1. `07-stock.sql` — columna de stock en `perfume_overrides`**

- Sigue el patrón de `03-decants.sql`: agrega dos columnas a
  `perfume_overrides`.
  - `estado_stock text default 'bajo_pedido' check (estado_stock in ('en_stock','bajo_pedido','agotado'))`
  - `cantidad_stock integer default 0` — solo tiene sentido cuando
    `estado_stock = 'en_stock'`; cuántas unidades físicas hay en mano.
- Default `'bajo_pedido'` a propósito: no promete envío en 2 días de algo
  que Kike no ha marcado, pero tampoco bloquea la venta (a diferencia de
  `'agotado'`), igual que el criterio ya usado para `decant` ("ante la duda,
  se asume que sí").
- Selección de verificación al final del archivo, mismo formato que los
  anteriores (`filas 143 · en_stock N · bajo_pedido N · agotado N`).
- **Hecho cuando**: se ejecuta en Supabase sin error y la consulta de
  verificación muestra las 143 filas con `estado_stock` poblado.

**A2. `08-ordenes.sql` — tablas de pedidos**

- Tabla `ordenes`:
  `id uuid primary key default gen_random_uuid()`, `creado_en timestamptz default now()`,
  `email_cliente text not null`, `nombre_cliente text not null`,
  `direccion text not null`, `ciudad text not null`, `estado_direccion text not null`,
  `codigo_postal text not null`, `total_usd numeric not null`,
  `estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente','pagado','cancelado'))`,
  `stripe_session_id text unique`, `stripe_payment_intent_id text`,
  `plazo_envio_dias text` (`'2'` o `'7-10'`), `conflicto_stock boolean not null default false`.
- Tabla `orden_items`:
  `id bigint generated always as identity primary key`, `orden_id uuid references ordenes(id) not null`,
  `perfume_id integer not null`, `nombre_perfume text not null` (snapshot, no depende de que `data.js` no cambie después),
  `cantidad integer not null check (cantidad > 0)`, `precio_unitario_usd numeric not null`,
  `estado_stock_al_comprar text not null`.
- RLS: lectura y escritura **solo** vía `service_role` (que usan las Edge
  Functions, nunca el navegador) — el cliente público nunca lee ni escribe
  estas tablas directamente. Sin política para `anon`/`authenticated`, o
  con una política explícita `for select to authenticated using ((auth.jwt() ->> 'email') = 'jeronimo.pena.chaves@gmail.com')`
  para que Kike pueda verlas desde el SQL Editor o un futuro panel.
- **Hecho cuando**: las dos tablas existen, con las FK y checks activos, y
  un insert de prueba vía `service_role` funciona mientras un insert con la
  clave `anon` es rechazado por RLS.

---

## Bloque B — Supabase Edge Functions

**B1. `supabase/functions/crear-checkout/index.ts`**

- Input (POST JSON): `{ items: [{ id, cantidad }], envio: { nombre, email, direccion, ciudad, estado, codigo_postal } }`.
- Valida server-side, sin confiar en nada que mande el navegador salvo los
  `id` y `cantidad`:
  1. Cada `id` existe en `perfume_overrides`, está `activo` y tiene
     `costo_usd` cargado (si falta, se excluye del pedido, igual que hoy
     "sin precio → no se ofrece").
  2. `estado_stock` no es `'agotado'`. Si es `'en_stock'`, `cantidad_stock >= cantidad` pedida.
  3. Calcula `precio_unitario_usd = redondear2(costo_usd * (1 + margen_botella))`
     leyendo `margen_botella` de `configuracion` (misma fuente que usa `db.js`).
- Si algún ítem no pasa validación, se devuelve en la respuesta la lista de
  ítems rechazados (para que el frontend los quite del carrito y avise al
  cliente) junto con el resto del pedido, si queda algo comprable.
- Con al menos un ítem válido:
  1. Inserta una fila en `ordenes` (`estado_pago = 'pendiente'`) y sus
     `orden_items`, usando `service_role`.
  2. Calcula `plazo_envio_dias`: `'7-10'` si algún ítem del pedido está
     `bajo_pedido`, si no `'2'`.
  3. Crea la Stripe Checkout Session:
     `payment_method_types: ['card', 'paypal']`, `mode: 'payment'`,
     `line_items` con `price_data` dinámico (`currency: 'usd'`,
     `unit_amount` en centavos = `precio_unitario_usd * 100`),
     `metadata: { orden_id }`, `success_url` y `cancel_url` apuntando al
     sitio con `?orden_id=...`.
  4. Guarda `stripe_session_id` en la orden.
  5. Devuelve `{ url, orden_id, rechazados: [...] }`.
- **Hecho cuando**: llamando la función con un carrito válido se recibe una
  URL de Stripe real y la orden queda en Supabase como `'pendiente'`;
  llamándola con un ítem agotado, ese ítem vuelve en `rechazados` y no se
  crea sesión de Stripe para él.

**B2. `supabase/functions/webhook-stripe/index.ts`**

- Verifica la firma del webhook con `STRIPE_WEBHOOK_SECRET` (rechaza
  cualquier request que no venga de Stripe).
- Escucha `checkout.session.completed`:
  1. Lee `metadata.orden_id`.
  2. Si la orden ya está `'pagado'` (reintento de Stripe), responde 200 sin
     hacer nada más — evita descontar stock dos veces por el mismo pago.
  3. Marca `estado_pago = 'pagado'`, guarda `stripe_payment_intent_id`.
  4. Por cada `orden_items`, descuenta `cantidad_stock` de
     `perfume_overrides` cuando `estado_stock = 'en_stock'`. Si el
     descuento deja `cantidad_stock <= 0`, pasa `estado_stock` a
     `'bajo_pedido'` (se acabó la unidad lista para envío en 2 días, pero
     Jomashop la sigue consiguiendo). Si el descuento resulta negativo
     (alguien más compró primero — condición de carrera), deja
     `cantidad_stock` en 0 y marca `conflicto_stock = true` en la orden, sin
     revertir el pago.
- **Hecho cuando**: un pago de prueba en modo test de Stripe deja la orden
  en `'pagado'`, descuenta el stock correspondiente, y reenviar el mismo
  evento (Stripe reintenta) no lo descuenta dos veces.

---

## Bloque C — Frontend: carrito

**C1. Módulo `carrito.js` nuevo**

- Estado del carrito en `localStorage` (clave `perfumesPro_carrito`):
  lista de `{ id, nombre, precioUsd, cantidad, imagen }`.
- Funciones: `agregarAlCarrito(perfume)`, `quitarDelCarrito(id)`,
  `cambiarCantidad(id, cantidad)`, `totalCarrito()`, `vaciarCarrito()`,
  `contarItems()`.
- El precio que se guarda en `localStorage` es solo para pintar el resumen
  en pantalla — **nunca** es lo que se cobra (eso lo recalcula `crear-checkout`).

**C2. Ícono flotante + panel de resumen en `index.html`/`app.js`**

- Ícono fijo (posición fixed, visible en portada/preguntas/resultados) con
  contador de `contarItems()`.
- Al hacer click abre un panel/modal: lista de ítems con foto, nombre,
  cantidad editable (+/-), botón quitar, total, y botón "Pagar" (deshabilitado
  si el carrito está vacío).
- Estilo con las variables de color/tipografía ya existentes en
  `styles.css` (paleta dorada/oscura, Fraunces/Manrope) — no se crean
  colores nuevos.

**C3. Botón "Agregar al carrito" en la tarjeta de Botella completa**

- En la función que arma la tarjeta de Botella (alrededor de
  `app.js:1050-1081`, junto a `etiquetaPrecio(precios && precios.botellaCop)`):
  agrega un botón "Agregar al carrito" que llama `agregarAlCarrito(...)`
  usando el precio en USD (nuevo cálculo, ver Bloque D) — **no** el
  `botellaCop` que ya se muestra ahí, que sigue siendo para Probar/Set.
- Si `estado_stock === 'agotado'`, el botón no aparece; en su lugar,
  "Agotado por ahora" + el bloque de contacto WhatsApp que ya existe
  (`bloqueContacto`).
- **Hecho cuando**: agregar una fragancia actualiza el contador del ícono
  sin recargar la pantalla, y persiste si el visitante recarga la página.

---

## Bloque D — Frontend: checkout y formulario de envío

**D1. Precio en USD para el carrito**

- Nueva función en `db.js` (junto a `preciosDe`), p. ej. `precioBotellaUsd(id)`:
  `costo_usd * (1 + margen_botella)`, redondeado a 2 decimales. Se expone
  en el objeto que ya devuelve `PerfumesDB` para que `app.js` la use al
  armar el botón "Agregar al carrito".

**D2. Formulario de envío**

- Se muestra al hacer click en "Pagar" desde el panel del carrito, antes de
  llamar a `crear-checkout`.
- Campos: nombre, email, dirección, ciudad, estado (select con los 50
  estados de EE.UU. + territorios), código postal.
- Validación en el navegador antes de habilitar "Continuar al pago":
  código postal formato EE.UU. (5 dígitos, opcional `-####`), todos los
  campos requeridos llenos. Errores en rojo (`.error`, siguiendo la
  convención ya usada en `catalogo.js`).

**D3. Llamada a `crear-checkout` y redirect**

- Al confirmar el formulario: `POST` a la Edge Function con el carrito +
  datos de envío.
- Si la respuesta trae `rechazados`, se muestran esos ítems removidos del
  carrito con el aviso "Ya no está disponible, la quitamos de tu carrito"
  y se recalcula el total antes de continuar (si queda algo comprable, el
  cliente puede seguir; si no, vuelve al carrito vacío).
- Si queda algún ítem válido: redirect del navegador a `url` (la sesión de
  Stripe Checkout).
- **Hecho cuando**: con Stripe en modo test, completar el pago con una
  tarjeta de prueba redirige de vuelta al sitio.

**D4. Pantalla de confirmación**

- Página/sección nueva (puede ser una vista dentro de `index.html` que se
  activa cuando la URL trae `?orden_id=...`).
- Consulta el estado de la orden (vía una tercera función pequeña de
  solo-lectura, o un `select` público limitado por `orden_id` con RLS que
  solo permita leer por ese id exacto — a decidir en implementación, sin
  exponer todas las órdenes).
- Si `estado_pago = 'pagado'`: resumen del pedido, total, plazo de envío
  (`'2 días'` o `'7-10 días'` según `plazo_envio_dias`).
- Si todavía `'pendiente'` (el webhook no ha llegado): mensaje de "Estamos
  confirmando tu pago, esto puede tardar un minuto" con un reintento
  automático cada pocos segundos — cubre el caso del spec en que la
  confirmación no llega al instante al navegador del cliente.
- Vacía el carrito de `localStorage` una vez la orden aparece pagada.

---

## Bloque E — Admin de stock en `catalogo.html`

**E1. Campo de stock en la tarjeta de cada fragancia**

- Junto a los controles ya existentes (costo, venta, activo, decant, en
  `catalogo.js` alrededor de la lógica de `inputDecant`/`guardarCampo`):
  selector con las tres opciones (`en_stock` / `bajo_pedido` / `agotado`) y,
  si se elige `en_stock`, un campo numérico para `cantidad_stock`.
- Guarda usando el mismo patrón que ya existe:
  `PerfumesDB.guardarCampo(perfume.id, "estado_stock", nuevo)` y
  `PerfumesDB.guardarCampo(perfume.id, "cantidad_stock", nuevo)`.
- Si `conflicto_stock` quedó marcado en alguna orden reciente para esta
  fragancia (Bloque B2), mostrar un aviso visible en su tarjeta del panel
  ("2 pedidos compitieron por la última unidad — revisa la orden X") para
  que Kike decida a mano si reembolsa o pasa el pedido a bajo pedido.
- **Hecho cuando**: cambiar el estado de stock desde el panel se refleja de
  inmediato en si el botón "Agregar al carrito" aparece en el sitio
  público.

**E2. Filtro por estado de stock**

- Se agrega a los filtros avanzados ya existentes (mismo patrón que el
  filtro de decant/activo), para poder ver de un vistazo cuántas
  fragancias están agotadas o bajo pedido.

---

## Bloque F — Apagado con gracia si Stripe no está configurado

**F1. Bandera de "pagos activos"**

- Nuevo parámetro en `configuracion`: `pagos_habilitados boolean default false`.
- Mientras sea `false` (valor por defecto hasta que Kike confirme llaves
  de Stripe cargadas): no se muestra el ícono de carrito ni el botón
  "Agregar al carrito" en ningún lado del sitio — todo se ve exactamente
  como hoy, con WhatsApp como único cierre.
- Kike lo activa desde `catalogo.html` (un toggle más, mismo patrón que
  `activo`) el día que los tres secretos de Stripe estén cargados.
- **Hecho cuando**: con `pagos_habilitados = false` el sitio se comporta
  idéntico a como está hoy (cero cambios visibles), y en `true` aparece
  todo el flujo de carrito.

---

## Bloque G — Rol de WhatsApp en la pantalla de Botella

**G1. Cambiar el texto del bloque de contacto en Botella**

- En `app.js`, la pantalla de Botella (alrededor de la línea 1081,
  `bloqueContacto(...)`) cambia el mensaje/CTA de WhatsApp de "cerrar la
  venta" a "¿Dudas antes de comprar? Escríbenos", visible junto al botón
  "Agregar al carrito" cuando `pagos_habilitados = true`.
- Cuando `pagos_habilitados = false`, el bloque de WhatsApp se comporta
  exactamente igual que hoy (sigue siendo el cierre).
- **Hecho cuando**: con pagos activos, ambos botones (Agregar al carrito y
  WhatsApp) conviven en la tarjeta de Botella con los textos correctos.

---

## Orden de ejecución sugerido

1. Bloque A (migraciones) — sin esto nada más puede empezar.
2. Bloque B (Edge Functions) — se puede probar con `curl`/Postman antes de
   tocar el frontend.
3. Bloque F1 (bandera `pagos_habilitados`) — se crea temprano y en `false`,
   así el resto del trabajo en frontend (Bloques C, D, G) no se ve en
   producción hasta que esté listo.
4. Bloque C (carrito) → Bloque D (checkout/envío/confirmación).
5. Bloque E (admin de stock) — puede ir en paralelo a C/D, no tiene
   dependencia entre sí más que la columna creada en A1.
6. Bloque G (texto de WhatsApp) al final, cuando ya se ve el botón de pagar
   junto a él.
7. Activar `pagos_habilitados = true` solo después de que Kike confirme
   los tres prerrequisitos bloqueantes.
