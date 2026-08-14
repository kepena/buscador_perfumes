/* ============================================================
   CATÁLOGO ADMINISTRABLE — catalogo.js
   Render del catálogo, ajuste de precios global/individual,
   persistencia en localStorage compartida con el test principal.
   ============================================================ */

(function () {
  "use strict";

  const CLAVE_STORAGE = "perfumesPro_preciosOverride";
  const CLAVE_STORAGE_IMAGENES = "perfumesPro_imagenesOverride";
  const CLAVE_STORAGE_ACTIVOS = "perfumesPro_activosOverride";

  /* ============ PERSISTENCIA DE PRECIOS ============ */
  // Guardamos solo las diferencias respecto al precioUSD original de data.js,
  // como un mapa { id: nuevoPrecio }. index.html también lee esta misma
  // clave antes de calcular el Match, así los ajustes se reflejan en el test.

  function leerOverrides() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local de precios:", e);
      return {};
    }
  }

  function guardarOverrides(overrides) {
    try {
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(overrides));
    } catch (e) {
      console.warn("No se pudo guardar el almacenamiento local de precios:", e);
    }
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

  let overrides = leerOverrides();

  /* ============ PERSISTENCIA DE FOTOS REALES ============ */
  // Igual mecanismo que los precios: un mapa { id: urlDeLaFoto } guardado
  // en localStorage. index.html también lo lee, así que si pegas la foto
  // real aquí, aparece también en los resultados del test.

  function leerOverridesImagenes() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE_IMAGENES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local de imágenes:", e);
      return {};
    }
  }

  function guardarOverridesImagenes(overridesImg) {
    try {
      localStorage.setItem(CLAVE_STORAGE_IMAGENES, JSON.stringify(overridesImg));
    } catch (e) {
      console.warn("No se pudo guardar el almacenamiento local de imágenes:", e);
    }
  }

  function imagenActual(perfume, overridesImg) {
    const guardada = overridesImg[perfume.id];
    return typeof guardada === "string" && guardada.trim() !== ""
      ? guardada
      : perfume.imagen;
  }

  let overridesImagenes = leerOverridesImagenes();

  /* ============ PERSISTENCIA DE ACTIVAR / DESACTIVAR ============ */
  // Igual mecanismo: solo guardamos los perfumes cuyo estado difiere del
  // valor por defecto en data.js (activo: true), como { id: false }.
  // El test (index.html) lee esta misma clave y nunca muestra un perfume
  // desactivado como resultado, sin necesidad de borrarlo del catálogo.

  function leerOverridesActivos() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE_ACTIVOS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("No se pudo leer el almacenamiento local de activos:", e);
      return {};
    }
  }

  function guardarOverridesActivos(overridesAct) {
    try {
      localStorage.setItem(CLAVE_STORAGE_ACTIVOS, JSON.stringify(overridesAct));
    } catch (e) {
      console.warn("No se pudo guardar el almacenamiento local de activos:", e);
    }
  }

  function estaActivo(perfume, overridesAct) {
    const guardado = overridesAct[perfume.id];
    return typeof guardado === "boolean" ? guardado : perfume.activo !== false;
  }

  let overridesActivos = leerOverridesActivos();

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
      // Leemos el archivo con FileReader y lo convertimos en un data URL
      // (base64), que se guarda directamente en localStorage. Así no
      // dependemos de ninguna URL externa que pueda fallar.
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

        spanEstadoImagen.textContent = "Cargando…";
        spanEstadoImagen.classList.remove("guardada");

        const lector = new FileReader();
        lector.onload = () => {
          const dataUrl = lector.result;
          overridesImagenes[perfume.id] = dataUrl;
          try {
            guardarOverridesImagenes(overridesImagenes);
            imgEl.src = dataUrl;
            actualizarEstadoImagen(true);
          } catch (e) {
            // Si el navegador se queda sin espacio de almacenamiento local
            // (localStorage tiene límite, normalmente 5-10MB en total),
            // avisamos en vez de fallar en silencio.
            delete overridesImagenes[perfume.id];
            spanEstadoImagen.textContent = "No hay espacio suficiente guardado en el navegador.";
            spanEstadoImagen.classList.remove("guardada");
          }
        };
        lector.onerror = () => {
          spanEstadoImagen.textContent = "No se pudo leer el archivo, intenta de nuevo.";
          spanEstadoImagen.classList.remove("guardada");
        };
        lector.readAsDataURL(archivo);
      });

      btnQuitarImagen.addEventListener("click", () => {
        delete overridesImagenes[perfume.id];
        guardarOverridesImagenes(overridesImagenes);
        imgEl.src = perfume.imagen;
        inputSubirImagen.value = "";
        actualizarEstadoImagen(false);
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
        guardarPrecioIndividual(perfume.id, nuevoValor);
        const precioNuevo = precioActual(perfume, overrides);
        actualizarEtiquetasPrecio(spanOriginal, spanCategoria, perfume, precioNuevo);
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
        if (nuevoEstado === (perfume.activo !== false)) {
          // Coincide con el valor por defecto: no hace falta guardar override
          delete overridesActivos[perfume.id];
        } else {
          overridesActivos[perfume.id] = nuevoEstado;
        }
        guardarOverridesActivos(overridesActivos);
        fila.classList.toggle("desactivada", !nuevoEstado);
        toggleTexto.textContent = nuevoEstado ? "Activo" : "Desactivado";
        actualizarContadorActivos();
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
    overrides[id] = formatearPrecio(nuevoPrecio);
    guardarOverrides(overrides);
  }

  function aplicarAjusteGlobal() {
    const porcentaje = parseFloat(inputPorcentaje.value);
    if (Number.isNaN(porcentaje) || porcentaje < 0) {
      panelNota.textContent = "Ingresa un porcentaje válido (0 o mayor).";
      return;
    }
    const direccion = selectDireccion.value; // "subir" | "bajar"
    const factor = direccion === "subir" ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    PERFUMES.forEach((perfume) => {
      const base = precioActual(perfume, overrides);
      const nuevo = Math.max(1, formatearPrecio(base * factor));
      overrides[perfume.id] = nuevo;
    });

    guardarOverrides(overrides);
    renderizarCatalogo();

    const verbo = direccion === "subir" ? "subido" : "bajado";
    panelNota.textContent = `Precios de las ${PERFUMES.length} fragancias ${verbo} un ${porcentaje}%. Los cambios ya se aplican también en los resultados del test.`;
  }

  function restablecerPrecios() {
    overrides = {};
    guardarOverrides(overrides);
    renderizarCatalogo();
    panelNota.textContent = "Precios restablecidos a los valores originales del catálogo.";
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
  renderizarCatalogo();
})();
