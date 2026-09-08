/* ============================================================
   BUSCADOR DE PERFUMES PRO — carrito.js
   Estado del carrito de compras, en localStorage.

   Guarda SOLO lo necesario para pintar el resumen en pantalla: id,
   nombre, precio (para mostrar), cantidad e imagen. El precio que vive
   aquí es de exhibición nada más — nunca es lo que se cobra. Lo que de
   verdad se cobra lo recalcula la Edge Function "crear-checkout" contra
   la base de datos en el momento de pagar, así que aunque alguien
   manipule este localStorage a mano, lo único que logra es ver un número
   distinto en su propia pantalla; no cambia ni un centavo de lo que
   paga.

   Solo existe una "Botella completa" por fragancia en el carrito — no
   tiene sentido, en este modelo, tener dos formatos distintos de la
   misma fragancia a la vez.
   ============================================================ */

window.Carrito = (function () {
  "use strict";

  const CLAVE_LS = "perfumesPro_carrito";
  // Tope de cordura: nadie pide 500 frascos de una fragancia por accidente
  // con el botón de "+". Un pedido más grande se coordina por WhatsApp.
  const CANTIDAD_MAXIMA = 20;

  function leer() {
    try {
      const raw = localStorage.getItem(CLAVE_LS);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items : [];
    } catch (e) {
      return [];
    }
  }

  function guardar(items) {
    try {
      localStorage.setItem(CLAVE_LS, JSON.stringify(items));
    } catch (e) {
      console.warn("No se pudo guardar el carrito en este navegador:", e);
    }
    // Aviso a quien esté pintando el ícono/panel del carrito, sin acoplar
    // este módulo a cómo se ve esa UI.
    try {
      window.dispatchEvent(new CustomEvent("carrito:cambio", { detail: { items: items } }));
    } catch (e) { /* navegadores muy viejos sin CustomEvent: sin aviso reactivo */ }
  }

  function obtenerItems() {
    return leer();
  }

  // item: { id, nombre, precioUsd, imagen }. Si ya está, suma 1 (o
  // "cantidad" si se manda) en vez de duplicar la fila.
  function agregar(item, cantidad) {
    const items = leer();
    const idNum = Number(item.id);
    const existente = items.find((i) => Number(i.id) === idNum);
    const suma = Number(cantidad) > 0 ? Number(cantidad) : 1;

    if (existente) {
      existente.cantidad = Math.min(CANTIDAD_MAXIMA, existente.cantidad + suma);
    } else {
      items.push({
        id: idNum,
        nombre: String(item.nombre || ""),
        precioUsd: Number(item.precioUsd) || 0,
        imagen: String(item.imagen || ""),
        cantidad: Math.min(CANTIDAD_MAXIMA, suma)
      });
    }
    guardar(items);
    return items;
  }

  function quitar(id) {
    const idNum = Number(id);
    const items = leer().filter((i) => Number(i.id) !== idNum);
    guardar(items);
    return items;
  }

  function cambiarCantidad(id, cantidad) {
    const idNum = Number(id);
    const nueva = Math.floor(Number(cantidad));
    let items = leer();
    if (!(nueva > 0)) {
      items = items.filter((i) => Number(i.id) !== idNum);
    } else {
      items = items.map((i) =>
        Number(i.id) === idNum ? Object.assign({}, i, { cantidad: Math.min(CANTIDAD_MAXIMA, nueva) }) : i
      );
    }
    guardar(items);
    return items;
  }

  function vaciar() {
    guardar([]);
  }

  function total() {
    return leer().reduce((suma, i) => suma + i.precioUsd * i.cantidad, 0);
  }

  function contarItems() {
    return leer().reduce((suma, i) => suma + i.cantidad, 0);
  }

  function formatearUsd(n) {
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    obtenerItems: obtenerItems,
    agregar: agregar,
    quitar: quitar,
    cambiarCantidad: cambiarCantidad,
    vaciar: vaciar,
    total: total,
    contarItems: contarItems,
    formatearUsd: formatearUsd
  };
})();
