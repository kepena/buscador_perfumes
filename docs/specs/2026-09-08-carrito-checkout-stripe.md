# Carrito de compras y checkout con pago real (Stripe)

## Overview

Hoy el sitio no vende nada por sí solo: el cliente ve el precio y tiene que
escribir por WhatsApp para cerrar la compra, uno a uno. Esta feature agrega
un **carrito multi-producto** (el cliente puede juntar varias fragancias en
un mismo pedido) y un **checkout con pago automático** vía Stripe (tarjeta o
PayPal, en la misma sesión de pago). El pago deja de depender de que alguien
lo confirme a mano: Stripe confirma solo, y el sitio reacciona a esa
confirmación para marcar el pedido como pagado y descontar el stock
disponible. Es el primer pedazo de backend real del proyecto — hasta ahora
todo vivía en el navegador y en Supabase como base de datos pasiva.

## Usuarios Específicos

- **El visitante que ya hizo el test y llegó a "Botella completa".** Es quien
  usa el carrito y el checkout. Compra para sí mismo, paga con tarjeta o
  PayPal, y recibe el pedido en una dirección de Estados Unidos.
- **Kike, como administrador del panel `catalogo.html`.** Es quien mantiene
  al día cuánto stock hay de cada fragancia (en mano vs. bajo pedido) y quien
  se entera cuándo entra un pedido pagado para gestionar la compra a
  Jomashop y el envío.
- Fuera de alcance: el "Probar" (decant) y el "Set Ocasión" no llevan pago
  real en esta versión — el modelo de EE.UU. ya decidió "sin decants por
  ahora", así que solo "Botella completa" entra al carrito.

## Contexto del Problema

El negocio ya decidió vender en Estados Unidos por dropshipping (Jomashop),
pero el cierre de venta sigue siendo 100% manual por WhatsApp: cada cliente
escribe, Kike cotiza y confirma a mano, y no hay registro de pedidos ni de
qué hay disponible para vender. Eso no escala más allá de unas pocas ventas
por semana y no se ve profesional de cara al cliente — un negocio que solo
acepta "escríbeme por WhatsApp para pagar" transmite menos confianza que uno
con un botón de pago real, algo que Kike señaló explícitamente al decidir
que la confirmación de pago no puede ser manual.

Además, sin una tabla de stock, el sitio puede prometer una fragancia que ya
no se puede conseguir, o esconder que una sí está lista para salir en 2 días
en vez de 7-10.

## Alcance Versión 1

**Sí incluye:**

- Carrito multi-producto: el cliente agrega una o más "Botella completa" de
  distintas fragancias, ajusta cantidades, y ve el total antes de pagar.
- Ícono flotante de carrito visible en todo el sitio, con el número de items;
  al abrirlo muestra el resumen y el botón de pagar.
- Checkout hospedado por Stripe: tarjeta o PayPal en la misma pantalla de
  pago, sin que el cliente salga a llenar un formulario aparte para cada
  método.
- El total que se cobra se calcula del lado del servidor a partir del
  catálogo real en Supabase (mismo cálculo que ya usa `db.js`: costo × TRM +
  importación × margen) — nunca se confía en un total calculado en el
  navegador.
- Formulario de envío limitado a direcciones de Estados Unidos (nombre,
  dirección, ciudad, estado, código postal, email de contacto).
- Tabla de stock por fragancia con dos estados: **en stock** (envío en 2
  días) o **bajo pedido** (envío en 7-10 días); se edita desde el panel
  `catalogo.html` ya existente, junto a costo/venta/activo.
- El carrito no deja agregar ni pagar una fragancia sin stock ni disponible
  bajo pedido (es decir, completamente agotada).
- Pantalla de confirmación tras el pago exitoso, con el resumen del pedido y
  el plazo de envío según el stock de cada ítem.
- El botón de WhatsApp se mantiene en la pantalla de Botella, pero cambia de
  rol: ya no cierra la venta, queda como "¿Dudas antes de comprar? Escríbenos".
- Registro del pedido pagado en Supabase (qué se compró, a qué precio, datos
  de envío, estado del pago) para que Kike lo pueda ver y gestionar la
  compra a Jomashop.

**No incluye (queda para después):**

- Checkout embebido a la medida con el diseño 100% propio (Fase 2 — por
  ahora la pantalla de pago es la hospedada por Stripe, con logo y colores
  de marca donde Stripe lo permite, no un rediseño completo).
- "Probar" (decant) y "Set Ocasión" con pago real — siguen cerrando por
  WhatsApp como hoy.
- Envíos fuera de Estados Unidos.
- Devoluciones o reembolsos gestionados desde el sitio (se manejan a mano
  por ahora, apoyados en el registro del pedido en Supabase).
- Notificación automática a Kike por email/WhatsApp cuando entra un pedido
  — en esta versión se revisa el panel para verlo; automatizar el aviso
  puede ser una mejora posterior.
- Migrar la cuenta de PayPal de personal a Business: es una tarea de Kike en
  su cuenta de PayPal (y crear la cuenta/llaves de Stripe), no de código,
  pero es **prerrequisito** para poder activar el pago en producción.

## Comportamiento Esperado

**Agregar al carrito**

1. El cliente termina el test y llega a la tarjeta de una fragancia recomendada.
2. Si la fragancia tiene stock o está disponible bajo pedido, ve el botón
   "Agregar Botella al carrito" además de las opciones actuales.
3. Al agregarla, el ícono flotante de carrito aparece (o actualiza su
   contador) sin sacar al cliente de la pantalla de resultados. Puede seguir
   viendo otras fragancias del Top 4 y agregarlas también.
4. Si la fragancia está completamente agotada (ni en stock ni bajo pedido),
   el botón de agregar no aparece y se muestra un aviso breve ("Agotado por
   ahora"), con el botón de WhatsApp para preguntar disponibilidad.

**Ver y editar el carrito**

5. Al hacer click en el ícono flotante se abre un panel con cada fragancia
   agregada: foto, nombre, precio, cantidad (editable) y un botón para
   quitarla.
6. El total se recalcula en pantalla al cambiar cantidades, y se muestra el
   plazo de envío más largo entre los ítems agregados (si uno está bajo
   pedido, el pedido completo se marca como 7-10 días).
7. El carrito se conserva si el cliente cierra el navegador y vuelve más
   tarde (mientras use el mismo dispositivo/navegador).

**Pagar**

8. Con al menos un ítem en el carrito, el cliente ve el botón "Pagar" y,
   junto a él, las insignias de confianza ya aprobadas ("100% originales",
   "Garantía de autenticidad").
9. Antes de ir a Stripe, se le pide el formulario de envío (nombre,
   dirección de EE.UU., email).
10. Al confirmar, el cliente es llevado a la pantalla de pago de Stripe,
    donde elige tarjeta o PayPal y completa el pago.
11. Justo antes de mostrarle esa pantalla, el sitio vuelve a verificar los
    precios y el stock contra la base de datos real — si algo cambió desde
    que se agregó al carrito, se le avisa antes de cobrar (ver sección de
    errores).

**Después del pago**

12. Pago exitoso → el cliente vuelve al sitio a una pantalla de confirmación
    con el resumen del pedido, el total pagado y el plazo de envío estimado.
13. El pedido queda registrado como pagado, con sus datos de envío, y el
    stock de cada fragancia comprada se descuenta automáticamente.
14. Pago cancelado o abandonado a mitad de camino → el cliente vuelve al
    carrito tal como lo dejó, sin que se le haya cobrado nada, y puede
    intentar de nuevo.

**Administración del stock (Kike, en `catalogo.html`)**

15. Cada fragancia del panel muestra su estado de stock junto a los campos
    que ya existen (costo, venta, activo): en stock, bajo pedido, o
    agotada.
16. Cambiar el estado se refleja de inmediato en lo que el sitio ofrece a
    los visitantes — igual que ya pasa hoy con activar/desactivar una
    fragancia.

## Posibles Errores y Mitigaciones

- **El precio cambió entre que se agregó al carrito y el momento de pagar**
  (Kike ajustó la TRM o el margen mientras tanto): el cliente ve el precio
  actualizado antes de que se le cobre, nunca se le cobra un precio viejo
  sin avisarle.
- **El stock se agotó mientras el ítem estaba en el carrito** (otro cliente
  compró lo último, o Kike lo marcó agotado): al intentar pagar, esa
  fragancia se quita del carrito con un aviso claro ("Ya no está disponible,
  la quitamos de tu carrito"), y el cliente puede seguir con el resto del
  pedido o cerrar el carrito para escribir por WhatsApp.
- **El pago se completa en Stripe pero la confirmación no llega al sitio**
  (falla de red, el cliente cierra la pestaña muy rápido): el pedido igual
  queda registrado como pagado apenas Stripe confirma por su cuenta —el
  cliente no puede perder un pago aunque su navegador falle en ese
  instante—, y ve la confirmación la próxima vez que entra al sitio si dejó
  su email.
- **Dos clientes compran el último ítem en stock casi al mismo tiempo**: solo
  al primero que complete el pago se le confirma con el plazo de "en stock,
  2 días"; si el segundo ya pagó antes de que el sistema se diera cuenta,
  Kike lo ve marcado en el panel y le avisa al cliente que su pedido pasa a
  "bajo pedido" (7-10 días) en vez de cancelarlo, salvo que el cliente
  prefiera el reembolso.
- **El cliente llena mal la dirección de envío** (código postal inválido,
  país distinto a EE.UU.): el formulario no deja avanzar al pago sin una
  dirección de Estados Unidos válida, con el campo en rojo señalando el
  error, igual que ya se hace en el panel de administración.
- **Stripe no está configurado todavía** (falta migrar PayPal a Business o
  crear las llaves de Stripe): el botón de "Agregar al carrito" / "Pagar"
  no se activa en producción hasta que ese prerrequisito esté listo; el
  sitio no debe romperse ni mostrar un botón que falle al hacer click.
- **La base de datos o la función de pago no responden** (Supabase caído,
  tiempo de espera agotado): el cliente ve un aviso claro de que el pago no
  se pudo procesar en este momento y que puede intentar de nuevo o escribir
  por WhatsApp — nunca se le cobra sin que el sitio pueda confirmar el
  pedido del otro lado.
