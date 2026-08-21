// ============================================================
// Protección simple por contraseña para catalogo.html
//
// IMPORTANTE: esto es una "cortina" para evitar que gente casual
// entre por accidente o curiosidad, NO es seguridad real. Como el
// sitio es estático (GitHub Pages, sin servidor propio), cualquier
// persona con conocimientos técnicos podría ver el código fuente
// en el navegador y encontrar la forma de saltarse esta protección.
// No la uses para proteger información sensible de verdad.
//
// La contraseña se guarda como hash SHA-256, no en texto plano,
// para que al menos no sea visible a simple vista en el código.
//
// Desde la migración a base de datos, esta misma contraseña cumple
// además una función REAL de seguridad: se canjea contra Supabase por
// un permiso temporal de escritura. Sin ese permiso, la base de datos
// rechaza cualquier intento de modificar precios, fotos o activaciones,
// aunque alguien lea el código fuente del sitio. La contraseña en sí
// nunca queda escrita en el código: la tecleas tú y se usa al vuelo.
// ============================================================

(function () {
  "use strict";

  // Hash SHA-256 de la contraseña del catálogo.
  const HASH_CLAVE_CORRECTA =
    "e978fcc5807ae67faec88882e1778d5c20a282c465062d7916e677e1101e9995";

  const CLAVE_SESION = "perfumesPro_catalogoDesbloqueado";
  const CLAVE_INTENTOS = "perfumesPro_catalogoIntentos";
  const CLAVE_BLOQUEO_HASTA = "perfumesPro_catalogoBloqueoHasta";
  const MAX_INTENTOS = 5;
  const BLOQUEO_MS = 60000; // 1 minuto de espera tras agotar los intentos

  async function calcularHash(texto) {
    const datos = new TextEncoder().encode(texto);
    const buffer = await crypto.subtle.digest("SHA-256", datos);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function segundosRestantesDeBloqueo() {
    const hasta = Number(sessionStorage.getItem(CLAVE_BLOQUEO_HASTA) || 0);
    const restante = Math.ceil((hasta - Date.now()) / 1000);
    return restante > 0 ? restante : 0;
  }

  function registrarIntentoFallido() {
    const actuales = Number(sessionStorage.getItem(CLAVE_INTENTOS) || 0) + 1;
    sessionStorage.setItem(CLAVE_INTENTOS, String(actuales));
    if (actuales >= MAX_INTENTOS) {
      sessionStorage.setItem(CLAVE_BLOQUEO_HASTA, String(Date.now() + BLOQUEO_MS));
      sessionStorage.setItem(CLAVE_INTENTOS, "0");
    }
  }

  function mostrarContenido() {
    const pantallaAcceso = document.getElementById("pantalla-acceso");
    const contenido = document.getElementById("contenido-catalogo");
    if (pantallaAcceso) pantallaAcceso.remove();
    if (contenido) contenido.hidden = false;

    // Estos textos no viven en el HTML estático a propósito, para que
    // no sean visibles con "Ver código fuente" antes de autenticarse.
    // Se rellenan aquí, solo después de una contraseña correcta.
    const elEyebrow = document.getElementById("txt-eyebrow");
    const elTitulo = document.getElementById("txt-titulo");
    const elSub = document.getElementById("txt-sub");
    if (elEyebrow) elEyebrow.textContent = `Catálogo completo · ${typeof PERFUMES !== "undefined" ? PERFUMES.length : ""} fragancias`;
    if (elTitulo) elTitulo.textContent = "Todos los perfumes y sus precios";
    if (elSub) {
      elSub.textContent =
        "Ajusta el precio de todo el catálogo con un porcentaje, edita cada fragancia individualmente, o desactiva las que no quieres que salgan en los resultados del test. Los cambios se guardan en la base de datos y los ven todos los visitantes.";
    }
    document.title = "Catálogo completo — Buscador de Perfumes Pro";
  }

  function yaEstaDesbloqueado() {
    return sessionStorage.getItem(CLAVE_SESION) === "1";
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Si ya se desbloqueó antes en esta misma pestaña/sesión, saltamos
    // directo al contenido sin pedir la contraseña otra vez.
    if (yaEstaDesbloqueado()) {
      mostrarContenido();
      return;
    }

    const form = document.getElementById("form-acceso");
    const input = document.getElementById("input-clave-acceso");
    const mensajeError = document.getElementById("acceso-error");

    if (!form || !input) return;

    const restanteInicial = segundosRestantesDeBloqueo();
    if (restanteInicial > 0 && mensajeError) {
      mensajeError.textContent = `Demasiados intentos. Espera ${restanteInicial} segundos.`;
      mensajeError.hidden = false;
    }

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const restante = segundosRestantesDeBloqueo();
      if (restante > 0) {
        if (mensajeError) {
          mensajeError.textContent = `Demasiados intentos. Espera ${restante} segundos.`;
          mensajeError.hidden = false;
        }
        return;
      }

      const intento = input.value.trim();
      if (!intento) return;

      const hashIntento = await calcularHash(intento);

      if (hashIntento === HASH_CLAVE_CORRECTA) {
        sessionStorage.setItem(CLAVE_SESION, "1");
        sessionStorage.removeItem(CLAVE_INTENTOS);
        sessionStorage.removeItem(CLAVE_BLOQUEO_HASTA);

        // Canjeamos la contraseña recién tecleada por un token de
        // escritura de la base de datos. Solo con ese token se pueden
        // guardar cambios; sin él el panel queda en modo lectura.
        let resultado = { ok: true, motivo: null };
        if (typeof PerfumesDB !== "undefined" && PerfumesDB.estaConfigurada()) {
          resultado = await PerfumesDB.iniciarSesion(intento);
        }

        mostrarContenido();

        // El panel decide qué mostrar según el motivo exacto del rechazo:
        // no es lo mismo que falte crear el usuario administrador, que exista
        // sin confirmar, o que simplemente no haya red.
        if (typeof window.PerfumesPanelEstado === "function") {
          window.PerfumesPanelEstado(resultado);
        }
      } else {
        registrarIntentoFallido();
        if (mensajeError) {
          mensajeError.textContent = "Contraseña incorrecta. Intenta de nuevo.";
          mensajeError.hidden = false;
        }
        input.value = "";
        input.focus();
      }
    });
  });
})();
