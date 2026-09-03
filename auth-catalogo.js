// ============================================================
// Puerta de acceso a catalogo.html
//
// QUIÉN VALIDA LA CONTRASEÑA
//   Supabase, no el navegador. Lo que se teclea aquí se manda tal cual a
//   /auth/v1/token. Si Supabase devuelve un token, se abre el panel; si no,
//   no se abre. En este archivo NO hay contraseña ni hash de contraseña:
//   no queda nada publicado contra lo que alguien pueda trabajar sin red.
//
//   Antes había un hash SHA-256 de la clave en este mismo archivo. Como el
//   repositorio es público y la clave era un número de 8 dígitos, ese hash
//   se rompía por fuerza bruta en segundos —y esa misma clave es la del
//   usuario de Supabase, así que romperla daba permiso de escritura real
//   sobre la base. Por eso se quitó.
//
// QUÉ PROTEGE DE VERDAD
//   La seguridad no está en esta pantalla: está en las políticas RLS de
//   Supabase. Leer el catálogo es público; escribir exige un token de
//   usuario autenticado. Aunque alguien se salte esta pantalla a la fuerza,
//   la base rechaza cualquier cambio. Esta pantalla es la puerta; la
//   cerradura está del lado del servidor.
//
// POR QUÉ NO HAY ENTRADA SIN RED
//   Sin conexión no hay forma de comprobar una contraseña sin publicar algo
//   con qué compararla, y publicar eso es justo el problema que se quitó.
//   Sin red el panel no abre, y lo dice.
// ============================================================

(function () {
  "use strict";

  const CLAVE_INTENTOS = "perfumesPro_catalogoIntentos";
  const CLAVE_BLOQUEO_HASTA = "perfumesPro_catalogoBloqueoHasta";
  const MAX_INTENTOS = 5;
  const BLOQUEO_MS = 60000; // 1 minuto de espera tras agotar los intentos

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

  function limpiarIntentos() {
    sessionStorage.removeItem(CLAVE_INTENTOS);
    sessionStorage.removeItem(CLAVE_BLOQUEO_HASTA);
  }

  function mostrarContenido() {
    const pantallaAcceso = document.getElementById("pantalla-acceso");
    const contenido = document.getElementById("contenido-catalogo");
    if (pantallaAcceso) pantallaAcceso.remove();
    if (contenido) contenido.hidden = false;

    // Estos textos no viven en el HTML estático a propósito, para que
    // no sean visibles con "Ver código fuente" antes de autenticarse.
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

  // Qué decirle a quien no pudo entrar. Un "contraseña incorrecta" cuando
  // en realidad se cayó el internet manda a la persona a buscar el error
  // donde no está.
  function mensajeDeFallo(motivo) {
    if (motivo === "sin-red") {
      return "No hay conexión con la base de datos. Sin internet no se puede verificar la contraseña.";
    }
    if (motivo === "sin-confirmar") {
      return "El usuario administrador existe en Supabase pero está sin confirmar. Confírmalo en Authentication → Users.";
    }
    if (motivo === "sin-configurar") {
      return "La base de datos no está configurada en db.js, así que no hay contra qué verificar la contraseña.";
    }
    return "Contraseña incorrecta. Intenta de nuevo.";
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Al recargar, se entra directo SOLO si sigue viva la sesión de
    // escritura de Supabase. Antes bastaba una marca en sessionStorage, que
    // cualquiera podía escribir a mano desde la consola del navegador para
    // ver el panel. Ahora la llave es el token, no una bandera.
    if (typeof PerfumesDB !== "undefined" && PerfumesDB.sesionDeEscrituraActiva()) {
      mostrarContenido();
      if (typeof window.PerfumesPanelEstado === "function") {
        window.PerfumesPanelEstado({ ok: true });
      }
      return;
    }

    const form = document.getElementById("form-acceso");
    const input = document.getElementById("input-clave-acceso");
    const mensajeError = document.getElementById("acceso-error");
    const boton = form ? form.querySelector("button[type=submit]") : null;

    if (!form || !input) return;

    function error(texto) {
      if (!mensajeError) return;
      mensajeError.textContent = texto;
      mensajeError.hidden = false;
    }

    const restanteInicial = segundosRestantesDeBloqueo();
    if (restanteInicial > 0) {
      error(`Demasiados intentos. Espera ${restanteInicial} segundos.`);
    }

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const restante = segundosRestantesDeBloqueo();
      if (restante > 0) {
        error(`Demasiados intentos. Espera ${restante} segundos.`);
        return;
      }

      const intento = input.value;
      if (!intento.trim()) return;

      if (typeof PerfumesDB === "undefined" || !PerfumesDB.estaConfigurada()) {
        error(mensajeDeFallo("sin-configurar"));
        return;
      }

      // Ir hasta Supabase toma un momento; sin este aviso parece que el
      // botón no hizo nada y la gente lo pulsa varias veces.
      if (boton) {
        boton.disabled = true;
        boton.textContent = "Verificando…";
      }
      if (mensajeError) mensajeError.hidden = true;

      const resultado = await PerfumesDB.iniciarSesion(intento);

      if (boton) {
        boton.disabled = false;
        boton.textContent = "Entrar";
      }

      if (!resultado.ok) {
        // Solo cuenta como intento fallido si la contraseña estuvo mal. Que
        // se caiga el internet no debería dejar a nadie fuera un minuto.
        if (resultado.motivo !== "sin-red") registrarIntentoFallido();
        error(mensajeDeFallo(resultado.motivo));
        input.value = "";
        input.focus();
        return;
      }

      limpiarIntentos();
      input.value = "";
      mostrarContenido();

      if (typeof window.PerfumesPanelEstado === "function") {
        window.PerfumesPanelEstado(resultado);
      }
    });
  });
})();
