/* ============================================================
   CATÁLOGO ADMINISTRABLE — catalogo.js
   Render del catálogo, ajuste de precios global/individual,
   persistencia en la base de datos (Supabase) vía db.js, compartida
   con el test principal y visible para todos los visitantes.
   ============================================================ */

(function () {
  "use strict";

  /* ============ PERSISTENCIA EN LA BASE DE DATOS ============ */
  // Antes estos 3 overrides (precio, foto, activo) vivían en localStorage,
  // así que solo existían en el navegador donde se hicieron los cambios:
  // ni los visitantes ni el propio administrador desde otro dispositivo
  // los veían. Ahora los administra db.js contra Supabase.
  //
  // Los mapas siguen teniendo exactamente la misma forma { id: valor } que
  // antes, así que todo el render de más abajo funciona sin modificarse.

  let overrides = {};          // { id: precioEditado }
  let overridesImagenes = {};  // { id: urlDeLaFotoReal }
  let overridesActivos = {};   // { id: true | false }

  // db.js mantiene una única copia en memoria de los overrides. Aquí
  // refrescamos nuestras referencias a esa copia después de cada cambio.
  function sincronizarMapasLocales() {
    const datos = PerfumesDB.overrides();
    overrides = datos.precios;
    overridesImagenes = datos.imagenes;
    overridesActivos = datos.activos;
  }

  // Traduce un fallo de red o de permisos a algo que se entienda sin
  // tener que abrir la consola del navegador.
  function mensajeDeError(e) {
    const texto = String((e && e.message) || e || "");
    if (texto.indexOf("401") !== -1 || texto.indexOf("403") !== -1) {
      return "Sin permiso para guardar. Recarga la página y vuelve a ingresar la contraseña.";
    }
    if (texto.indexOf("timeout") !== -1) {
      return "La conexión tardó demasiado. Revisa tu internet e intenta de nuevo.";
    }
    return "No se pudo guardar el cambio. Intenta de nuevo.";
  }

  function precioActual(perfume, overrides) {
    const guardado = overrides[perfume.id];
    return typeof guardado === "number" && !Number.isNaN(guardado)
      ? guardado
      : perfume.precioUSD;
  }

  // Determina la categoría de presupuesto (Económico/Medio/Sin límite) a partir
  // del precio actual, para que el filtro del test siga siendo coherente incluso
  // después de un ajuste global grande.
  function categoriaParaPrecio(precio) {
    if (precio <= RANGOS_PRECIO.Económico.max) return "Económico";
    if (precio <= RANGOS_PRECIO.Medio.max) return "Medio";
    return "Sin límite";
  }

  function imagenActual(perfume, overridesImg) {
    const guardada = overridesImg[perfume.id];
    return typeof guardada === "string" && guardada.trim() !== ""
      ? guardada
      : perfume.imagen;
  }

  function estaActivo(perfume, overridesAct) {
    const guardado = overridesAct[perfume.id];
    return typeof guardado === "boolean" ? guardado : perfume.activo !== false;
  }

  function contarActivos() {
    return PERFUMES.filter((p) => estaActivo(p, overridesActivos)).length;
  }

  function actualizarContadorActivos() {
    const contador = $("#contador-activos");
    if (contador) {
      contador.textContent = `${contarActivos()} de ${PERFUMES.length} activas`;
    }
  }

  /* ============ REFERENCIAS DOM ============ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const gridCatalogo = $("#grid-catalogo");
  const plantillaFila = $("#plantilla-fila-catalogo");
  const inputPorcentaje = $("#input-porcentaje");
  const selectDireccion = $("#select-direccion");
  const btnAplicarGlobal = $("#btn-aplicar-global");
  const btnResetPrecios = $("#btn-reset-precios");
  const panelNota = $("#panel-nota");
  const inputBuscar = $("#input-buscar");
  const chipsFiltro = $$(".filtro-chip");

  let filtroTipoActual = "Todos";
  let terminoBusqueda = "";

  /* ============ RENDER ============ */

  function formatearPrecio(n) {
    return Math.round(n * 100) / 100;
  }

  function renderizarCatalogo() {
    gridCatalogo.innerHTML = "";

    const filtrados = PERFUMES.filter((p) => {
      const coincideTipo = filtroTipoActual === "Todos" || p.tipo === filtroTipoActual;
      const coincideBusqueda =
        !terminoBusqueda || p.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase());
      return coincideTipo && coincideBusqueda;
    });

    if (filtrados.length === 0) {
      const vacio = document.createElement("p");
      vacio.className = "catalogo-vacio";
      vacio.textContent = "No hay fragancias que coincidan con tu búsqueda.";
      gridCatalogo.appendChild(vacio);
      return;
    }

    filtrados.forEach((perfume) => {
      const nodo = plantillaFila.content.cloneNode(true);
      const fila = nodo.querySelector(".fila-catalogo");
      fila.dataset.id = perfume.id;

      const activo = estaActivo(perfume, overridesActivos);
      if (!activo) fila.classList.add("desactivada");

      const imgEl = nodo.querySelector('[data-campo="imagen"]');
      const imagenMostrada = imagenActual(perfume, overridesImagenes);
      imgEl.src = imagenMostrada;
      imgEl.alt = `Frasco de ${perfume.nombre}`;
      imgEl.addEventListener("error", function manejarError() {
        imgEl.removeEventListener("error", manejarError);
        imgEl.src = FALLBACK_IMG;
      });

      nodo.querySelector('[data-campo="tipo"]').textContent = perfume.tipo;
      nodo.querySelector('[data-campo="id"]').textContent = `#${perfume.id}`;
      nodo.querySelector('[data-campo="nombre"]').textContent = perfume.nombre;
      nodo.querySelector('[data-campo="notas"]').textContent = perfume.notas;
      nodo.querySelector('[data-campo="aroma"]').textContent = `${perfume.aromaPrincipal} · ${perfume.subAroma}`;
      nodo.querySelector('[data-campo="momento"]').textContent = perfume.momento;
      nodo.querySelector('[data-campo="clima"]').textContent = perfume.clima;
      nodo.querySelector('[data-campo="potencia"]').textContent = perfume.potencia;

      // Subida de foto real desde el computador (ver botón "📷 Subir foto").
      // El archivo se sube a Supabase Storage y en la base de datos solo
      // queda su URL. Antes se guardaba el archivo entero en base64 dentro
      // de localStorage, que se llenaba con 3 o 4 fotos y hacía fallar el
      // guardado en silencio.
      const inputSubirImagen = nodo.querySelector('[data-campo="imagen-subir-input"]');
      const btnQuitarImagen = nodo.querySelector('[data-campo="imagen-quitar"]');
      const spanEstadoImagen = nodo.querySelector('[data-campo="imagen-estado"]');
      const yaTieneOverride = typeof overridesImagenes[perfume.id] === "string" && overridesImagenes[perfume.id].trim() !== "";

      function actualizarEstadoImagen(guardada) {
        if (guardada) {
          spanEstadoImagen.textContent = "✓ Foto real guardada";
          spanEstadoImagen.classList.add("guardada");
          btnQuitarImagen.hidden = false;
        } else {
          spanEstadoImagen.textContent = "";
          spanEstadoImagen.classList.remove("guardada");
          btnQuitarImagen.hidden = true;
        }
      }
      actualizarEstadoImagen(yaTieneOverride);

      const LIMITE_TAMANO_MB = 5;

      inputSubirImagen.addEventListener("change", () => {
        const archivo = inputSubirImagen.files && inputSubirImagen.files[0];
        if (!archivo) return;

        if (!archivo.type.startsWith("image/")) {
          spanEstadoImagen.textContent = "Ese archivo no es una imagen.";
          spanEstadoImagen.classList.remove("guardada");
          return;
        }
        if (archivo.size > LIMITE_TAMANO_MB * 1024 * 1024) {
          spanEstadoImagen.textContent = `La foto pesa demasiado (máx. ${LIMITE_TAMANO_MB}MB).`;
          spanEstadoImagen.classList.remove("guardada");
          return;
        }

        spanEstadoImagen.textContent = "Subiendo…";
        spanEstadoImagen.classList.remove("guardada");
        inputSubirImagen.disabled = true;

        PerfumesDB.subirFoto(perfume.id, archivo)
          .then((url) => {
            sincronizarMapasLocales();
            imgEl.src = url;
            actualizarEstadoImagen(true);
          })
          .catch((e) => {
            console.warn("No se pudo subir la foto:", e);
            sincronizarMapasLocales();
            spanEstadoImagen.textContent = mensajeDeError(e);
            spanEstadoImagen.classList.remove("guardada");
          })
          .then(() => {
            inputSubirImagen.disabled = false;
          });
      });

      btnQuitarImagen.addEventListener("click", () => {
        btnQuitarImagen.disabled = true;
        PerfumesDB.quitarFoto(perfume.id)
          .then(() => {
            sincronizarMapasLocales();
            imgEl.src = perfume.imagen;
            inputSubirImagen.value = "";
            actualizarEstadoImagen(false);
          })
          .catch((e) => {
            console.warn("No se pudo quitar la foto:", e);
            spanEstadoImagen.textContent = mensajeDeError(e);
          })
          .then(() => {
            btnQuitarImagen.disabled = false;
          });
      });

      const precio = precioActual(perfume, overrides);
      const inputPrecio = nodo.querySelector('[data-campo="precio-input"]');
      inputPrecio.value = formatearPrecio(precio);
      inputPrecio.dataset.id = perfume.id;

      const spanOriginal = nodo.querySelector('[data-campo="precio-original"]');
      const spanCategoria = nodo.querySelector('[data-campo="presupuesto"]');
      actualizarEtiquetasPrecio(spanOriginal, spanCategoria, perfume, precio);

      inputPrecio.addEventListener("change", () => {
        const nuevoValor = parseFloat(inputPrecio.value);
        if (Number.isNaN(nuevoValor) || nuevoValor <= 0) {
          inputPrecio.value = formatearPrecio(precioActual(perfume, overrides));
          return;
        }
        guardarPrecioIndividual(perfume.id, nuevoValor).then(() => {
          const precioNuevo = precioActual(perfume, overrides);
          inputPrecio.value = formatearPrecio(precioNuevo);
          actualizarEtiquetasPrecio(spanOriginal, spanCategoria, perfume, precioNuevo);
        });
      });

      // Toggle activar / desactivar: un perfume desactivado nunca aparece
      // como resultado del test, pero sigue visible aquí (atenuado) para
      // poder reactivarlo cuando quieras.
      const toggleInput = nodo.querySelector('[data-campo="toggle-activo"]');
      const toggleTexto = nodo.querySelector('[data-campo="toggle-texto"]');
      toggleInput.checked = activo;
      toggleTexto.textContent = activo ? "Activo" : "Desactivado";

      toggleInput.addEventListener("change", () => {
        const nuevoEstado = toggleInput.checked;
        // Si coincide con el valor por defecto de data.js no guardamos
        // override: mandamos null y db.js limpia esa columna.
        const valorAGuardar =
          nuevoEstado === (perfume.activo !== false) ? null : nuevoEstado;

        // Pintamos el cambio de inmediato para que el panel se sienta ágil,
        // y si el guardado falla lo revertimos.
        fila.classList.toggle("desactivada", !nuevoEstado);
        toggleTexto.textContent = nuevoEstado ? "Activo" : "Desactivado";

        PerfumesDB.guardarCampo(perfume.id, "activo", valorAGuardar)
          .then(() => {
            sincronizarMapasLocales();
            actualizarContadorActivos();
          })
          .catch((e) => {
            console.warn("No se pudo guardar el estado:", e);
            sincronizarMapasLocales();
            const revertido = estaActivo(perfume, overridesActivos);
            toggleInput.checked = revertido;
            fila.classList.toggle("desactivada", !revertido);
            toggleTexto.textContent = revertido ? "Activo" : "Desactivado";
            actualizarContadorActivos();
            panelNota.textContent = mensajeDeError(e);
          });
      });

      gridCatalogo.appendChild(nodo);
    });

    actualizarContadorActivos();
  }

  function actualizarEtiquetasPrecio(spanOriginal, spanCategoria, perfume, precioMostrado) {
    const original = perfume.precioUSD;
    if (formatearPrecio(precioMostrado) !== formatearPrecio(original)) {
      spanOriginal.textContent = `Original: $${formatearPrecio(original)}`;
      spanOriginal.classList.add("cambiado");
    } else {
      spanOriginal.textContent = "Precio original";
      spanOriginal.classList.remove("cambiado");
    }
    spanCategoria.textContent = categoriaParaPrecio(precioMostrado);
  }

  /* ============ AJUSTE GLOBAL POR PORCENTAJE ============ */

  function guardarPrecioIndividual(id, nuevoPrecio) {
    return PerfumesDB.guardarCampo(id, "precio", formatearPrecio(nuevoPrecio))
      .then(sincronizarMapasLocales)
      .catch((e) => {
        console.warn("No se pudo guardar el precio:", e);
        sincronizarMapasLocales();
        panelNota.textContent = mensajeDeError(e);
      });
  }

  function aplicarAjusteGlobal() {
    const porcentaje = parseFloat(inputPorcentaje.value);
    if (Number.isNaN(porcentaje) || porcentaje < 0) {
      panelNota.textContent = "Ingresa un porcentaje válido (0 o mayor).";
      return;
    }
    const direccion = selectDireccion.value; // "subir" | "bajar"
    const factor = direccion === "subir" ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    const nuevosPrecios = {};
    PERFUMES.forEach((perfume) => {
      const base = precioActual(perfume, overrides);
      nuevosPrecios[perfume.id] = Math.max(1, formatearPrecio(base * factor));
    });

    // Las 143 filas viajan en una sola petición, no una por perfume.
    btnAplicarGlobal.disabled = true;
    panelNota.textContent = "Guardando…";

    PerfumesDB.guardarPreciosEnLote(nuevosPrecios)
      .then(() => {
        sincronizarMapasLocales();
        renderizarCatalogo();
        const verbo = direccion === "subir" ? "subido" : "bajado";
        panelNota.textContent = `Precios de las ${PERFUMES.length} fragancias ${verbo} un ${porcentaje}%. Los cambios ya se aplican también en los resultados del test, para todos los visitantes.`;
      })
      .catch((e) => {
        console.warn("No se pudo aplicar el ajuste global:", e);
        sincronizarMapasLocales();
        renderizarCatalogo();
        panelNota.textContent = mensajeDeError(e);
      })
      .then(() => {
        btnAplicarGlobal.disabled = false;
      });
  }

  function restablecerPrecios() {
    btnResetPrecios.disabled = true;
    panelNota.textContent = "Restableciendo…";

    // Solo borra los precios: las fotos y los activados/desactivados
    // se quedan como están.
    PerfumesDB.restablecerPrecios()
      .then(() => {
        sincronizarMapasLocales();
        renderizarCatalogo();
        panelNota.textContent = "Precios restablecidos a los valores originales del catálogo.";
      })
      .catch((e) => {
        console.warn("No se pudieron restablecer los precios:", e);
        sincronizarMapasLocales();
        renderizarCatalogo();
        panelNota.textContent = mensajeDeError(e);
      })
      .then(() => {
        btnResetPrecios.disabled = false;
      });
  }

  /* ============ FILTROS Y BÚSQUEDA ============ */

  function seleccionarFiltroTipo(tipo) {
    filtroTipoActual = tipo;
    chipsFiltro.forEach((chip) => {
      chip.classList.toggle("activo", chip.dataset.filtroTipo === tipo);
    });
    renderizarCatalogo();
  }

  /* ============ EVENT LISTENERS ============ */

  btnAplicarGlobal.addEventListener("click", aplicarAjusteGlobal);
  btnResetPrecios.addEventListener("click", restablecerPrecios);

  chipsFiltro.forEach((chip) => {
    chip.addEventListener("click", () => seleccionarFiltroTipo(chip.dataset.filtroTipo));
  });

  // Rellenamos el conteo de cada chip a partir del catálogo real, en vez
  // de escribirlo a mano, para que nunca quede desactualizado si el
  // catálogo crece o se recorta.
  function actualizarConteosChips() {
    chipsFiltro.forEach((chip) => {
      const tipo = chip.dataset.filtroTipo;
      const cantidad = tipo === "Todos" ? PERFUMES.length : PERFUMES.filter((p) => p.tipo === tipo).length;
      chip.textContent = `${tipo} (${cantidad})`;
    });
  }
  actualizarConteosChips();

  let debounceBusqueda = null;
  inputBuscar.addEventListener("input", () => {
    clearTimeout(debounceBusqueda);
    debounceBusqueda = setTimeout(() => {
      terminoBusqueda = inputBuscar.value.trim();
      renderizarCatalogo();
    }, 150);
  });

  /* ============ INICIO ============ */
  // Esperamos a que lleguen los overrides de la base de datos ANTES de
  // pintar, para no mostrar un precio viejo que cambie medio segundo
  // después. Si la base de datos falla, db.js devuelve lo que haya de
  // respaldo y el panel se abre igual, avisando en la nota.
  function iniciar() {
    if (typeof PerfumesDB === "undefined") {
      panelNota.textContent =
        "Falta cargar db.js. Revisa que catalogo.html lo incluya antes de catalogo.js.";
      return;
    }

    gridCatalogo.innerHTML = '<p class="catalogo-vacio">Cargando catálogo…</p>';

    PerfumesDB.cargarOverrides().then(() => {
      sincronizarMapasLocales();
      renderizarCatalogo();
      avisarModoDeGuardado();
      ofrecerMigracion();
    });
  }

  function avisarModoDeGuardado() {
    if (!PerfumesDB.estaConfigurada()) {
      panelNota.textContent =
        "⚠️ Sin conexión a la base de datos: los cambios se guardan solo en este navegador y no los verán los visitantes.";
      return;
    }
    panelNota.textContent =
      "Los cambios se guardan en la base de datos y los ven todos los visitantes del test.";
  }

  // Si este navegador todavía tiene cambios viejos guardados localmente
  // que nunca llegaron a la nube, ofrecemos subirlos en vez de perderlos.
  function ofrecerMigracion() {
    const pendientes = PerfumesDB.pendientesDeMigrar();
    if (pendientes.total === 0) return;

    const aviso = document.createElement("div");
    aviso.className = "panel-nota";
    aviso.style.marginTop = "10px";

    const texto = document.createElement("span");
    texto.textContent = `Este navegador tiene ${pendientes.total} cambio(s) guardado(s) solo aquí (${pendientes.precios} precio(s), ${pendientes.imagenes} foto(s), ${pendientes.activos} activado(s)/desactivado(s)) que aún no están en la base de datos. `;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-primario";
    boton.textContent = "Subirlos ahora";
    boton.addEventListener("click", () => {
      boton.disabled = true;
      boton.textContent = "Subiendo…";
      PerfumesDB.migrarDesdeLocalStorage()
        .then((resultado) => {
          sincronizarMapasLocales();
          renderizarCatalogo();
          aviso.textContent = `✓ ${resultado.total} cambio(s) subido(s) a la base de datos.`;
        })
        .catch((e) => {
          console.warn("Falló la migración:", e);
          aviso.textContent = mensajeDeError(e);
        });
    });

    aviso.appendChild(texto);
    aviso.appendChild(boton);
    panelNota.parentNode.appendChild(aviso);
  }

  iniciar();
})();
