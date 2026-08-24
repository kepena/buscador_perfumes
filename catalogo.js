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

  let costos = {};             // { id: loQuePagamos }
  let ventas = {};             // { id: loQueVeElCliente }
  let overridesImagenes = {};  // { id: urlDeLaFotoReal }
  let overridesActivos = {};   // { id: true | false }

  // db.js mantiene una única copia en memoria. Aquí refrescamos nuestras
  // referencias a esa copia después de cada cambio.
  function sincronizarMapasLocales() {
    const datos = PerfumesDB.overrides();
    costos = datos.costos;
    ventas = datos.ventas;
    overridesImagenes = datos.imagenes;
    overridesActivos = datos.activos;
  }

  // Traduce un fallo de red o de permisos a algo que se entienda sin
  // tener que abrir la consola del navegador.
  // Un mensaje de error tiene que verse. Estos dos helpers se encargan de
  // aplicar y quitar la clase que lo hace legible, para no depender de
  // recordarlo en cada uno de los sitios donde se muestra un error.
  function errorEn(elemento, texto) {
    elemento.textContent = texto;
    elemento.classList.add("error");
    elemento.classList.remove("guardada");
  }

  function limpiarError(elemento) {
    elemento.classList.remove("error");
  }

  function mensajeDeError(e) {
    const texto = String((e && e.message) || e || "");
    if (texto.indexOf("401") !== -1 || texto.indexOf("403") !== -1) {
      return "La base de datos rechazó el cambio por falta de permiso. Mira el recuadro rojo de arriba.";
    }
    if (texto.indexOf("timeout") !== -1) {
      return "La conexión tardó demasiado. Revisa tu internet e intenta de nuevo.";
    }
    // La base de datos todavía no tiene las columnas de costo y venta.
    if (texto.toLowerCase().indexOf("bucket not found") !== -1 || texto.indexOf("NoSuchBucket") !== -1) {
      return "Falta crear el bucket de fotos en Supabase. Mira el recuadro rojo de arriba.";
    }
    // Falta alguna columna en la base de datos. Se nombra cuál, porque cada
    // una se arregla ejecutando una carga distinta.
    if (texto.indexOf("volumen_ml") !== -1 || texto.indexOf("verificado") !== -1) {
      return "Falta la columna de volumen en la base de datos. Mira el recuadro rojo de arriba.";
    }
    if (/\bdecant\b/.test(texto) && texto.indexOf("column") !== -1) {
      return "Falta la columna de decants en la base de datos. Mira el recuadro de arriba.";
    }
    if (texto.indexOf("costo_usd") !== -1 || texto.indexOf("venta_usd") !== -1) {
      return "Faltan las columnas de costo y venta en la base de datos. Mira el recuadro rojo de arriba.";
    }
    if (texto.indexOf("PGRST204") !== -1 || texto.indexOf("schema cache") !== -1) {
      return "Falta una columna en la base de datos. Mira el recuadro rojo de arriba.";
    }
    return "No se pudo guardar. Detalle: " + texto.slice(0, 160);
  }

  /* ============ ESTADO PERMANENTE DE LA CONEXIÓN ============ */
  // Este recuadro es distinto de la nota de abajo: la nota cuenta qué pasó
  // con la última acción y se sobrescribe todo el rato; esto cuenta si el
  // panel puede guardar o no, y se queda fijo. Antes ambas cosas competían
  // por el mismo párrafo, así que el diagnóstico real desaparecía en cuanto
  // tocabas un botón y solo quedaba un "no se pudo guardar" sin explicación.

  let puedeEscribir = true;

  function mostrarEstado(tipo, html) {
    if (!panelEstado) return;
    panelEstado.className = "panel-estado " + tipo;
    panelEstado.innerHTML = html;
    panelEstado.hidden = false;
  }

  // Cuando no se puede guardar, atenuamos y bloqueamos los controles que
  // escriben. Es preferible a dejar hacer 143 cambios que se van a perder.
  function fijarPermisoDeEscritura(puede) {
    puedeEscribir = puede;
    document.body.classList.toggle("sin-permiso-escritura", !puede);
    if (btnAplicarGlobal) btnAplicarGlobal.disabled = !puede;
    if (btnResetPrecios) btnResetPrecios.disabled = !puede;
    if (btnGuardarRangos) btnGuardarRangos.disabled = !puede;
    if (btnGuardarParametros) btnGuardarParametros.disabled = !puede;
  }

  const INSTRUCCIONES_SQL_VOLUMEN =
    "<ol>" +
    "<li>Entra a tu proyecto en <strong>supabase.com</strong></li>" +
    "<li>Menú izquierdo → <strong>SQL Editor</strong> → <strong>New query</strong></li>" +
    "<li>Ejecuta el archivo <code>02-precios-decant.sql</code> <strong>completo</strong>, " +
    "desde la primera línea. Está en la raíz del repo, al lado de este panel. " +
    "Si solo se ejecutó el final, la tabla de configuración " +
    "quedó creada pero las columnas no.</li>" +
    "<li>Comprueba con: <code>select count(*) filter (where volumen_ml is not null) from perfume_overrides;</code> " +
    "— debe dar 143</li>" +
    "<li>Vuelve aquí y recarga la página</li>" +
    "</ol>";

  const INSTRUCCIONES_BUCKET =
    "<ol>" +
    "<li>Entra a tu proyecto en <strong>supabase.com</strong></li>" +
    "<li>Menú izquierdo → <strong>Storage</strong> → <strong>New bucket</strong></li>" +
    "<li>Nombre: <code>fotos-perfumes</code> (exacto)</li>" +
    "<li>Marca <strong>Public bucket</strong> — si no, los visitantes no verán las fotos</li>" +
    "<li><strong>Create bucket</strong></li>" +
    "<li>Ábrelo → pestaña <strong>Policies</strong> → <strong>New policy</strong> → " +
    "plantilla <em>“Allow access to authenticated users only”</em>, marcando " +
    "<code>INSERT</code>, <code>UPDATE</code> y <code>DELETE</code></li>" +
    "<li>Vuelve aquí y recarga la página</li>" +
    "</ol>";

  const INSTRUCCIONES_SQL =
    "<ol>" +
    "<li>Entra a tu proyecto en <strong>supabase.com</strong></li>" +
    "<li>Menú izquierdo → <strong>SQL Editor</strong> → <strong>New query</strong></li>" +
    "<li>Pega y ejecuta el archivo <code>01-costo-y-venta.sql</code> <strong>completo</strong>. " +
    "Está en la raíz del repo, al lado de este panel.</li>" +
    "<li>Debe terminar mostrando <code>filas 143 · con_costo 143 · con_venta 143</code></li>" +
    "<li>Vuelve aquí y recarga la página</li>" +
    "</ol>";

  const INSTRUCCIONES_SQL_DECANT =
    "<ol>" +
    "<li>Entra a tu proyecto en <strong>supabase.com</strong></li>" +
    "<li>Menú izquierdo → <strong>SQL Editor</strong> → <strong>New query</strong></li>" +
    "<li>Pega y ejecuta el archivo <code>03-decants.sql</code> <strong>completo</strong>. " +
    "Está en la raíz del repo, al lado de este panel.</li>" +
    "<li>Debe terminar mostrando <code>filas 143 · con_decant 143 · solo_botella 0</code></li>" +
    "<li>Vuelve aquí y recarga la página</li>" +
    "</ol>";

  const INSTRUCCIONES_USUARIO_ADMIN =
    "<ol>" +
    "<li>Entra a tu proyecto en <strong>supabase.com</strong></li>" +
    "<li>Menú izquierdo → <strong>Authentication</strong> → <strong>Users</strong></li>" +
    "<li>Botón <strong>Add user</strong> → <strong>Create new user</strong></li>" +
    "<li>Email: <code>admin@buscadorperfumes.kaiketek.com</code> (exacto)</li>" +
    "<li>Password: la misma contraseña con la que entraste aquí</li>" +
    "<li>Marca la casilla <strong>Auto Confirm User</strong></li>" +
    "<li>Vuelve aquí y recarga la página</li>" +
    "</ol>";

  // auth-catalogo.js llama a esto después de validar la contraseña.
  window.PerfumesPanelEstado = function (resultado) {
    const motivo = resultado && resultado.motivo;

    if (resultado && resultado.ok) {
      fijarPermisoDeEscritura(true);
      mostrarEstado("ok", "<strong>✓ Conectado a la base de datos</strong>Tus cambios se guardan en la nube y los ven todos los visitantes del test.");
      // La contraseña puede ser correcta y aun así faltar las columnas.
      comprobarEsquema();
      return;
    }

    fijarPermisoDeEscritura(false);

    if (motivo === "sin-red") {
      mostrarEstado("error",
        "<strong>⚠ No hay conexión con la base de datos</strong>" +
        "No se pudo contactar a Supabase. Revisa tu internet y recarga la página. " +
        "Mientras tanto puedes ver el catálogo, pero no guardar cambios.");
      return;
    }

    if (motivo === "sin-confirmar") {
      mostrarEstado("error",
        "<strong>⚠ El usuario administrador está sin confirmar</strong>" +
        "Existe en Supabase, pero quedó pendiente de confirmación, así que no puede guardar. " +
        "Entra a <strong>Authentication → Users</strong>, abre ese usuario y confírmalo (o bórralo y créalo de nuevo marcando <strong>Auto Confirm User</strong>).");
      return;
    }

    // Caso más frecuente: el usuario administrador nunca se creó.
    mostrarEstado("error",
      "<strong>⚠ Falta crear el usuario administrador en Supabase</strong>" +
      "Por eso no se guarda ningún cambio. Los controles de precio, fotos y activación están bloqueados hasta que lo arregles:" +
      INSTRUCCIONES_USUARIO_ADMIN);
  };

  // El COSTO y la VENTA viven solo en la base de datos. data.js ya no
  // contiene precios: son dato de negocio, cambian seguido y tienen que ser
  // visibles para todos sin pasar por Git.
  function costoActual(perfume) {
    const guardado = costos[perfume.id];
    return typeof guardado === "number" && !Number.isNaN(guardado) ? guardado : null;
  }

  function ventaActual(perfume) {
    const guardado = ventas[perfume.id];
    return typeof guardado === "number" && !Number.isNaN(guardado) ? guardado : null;
  }

  // Una fragancia sin precio de venta no se puede vender, así que el test
  // público no la muestra. Aquí sí aparece, marcada, para poder arreglarla.
  function sinPrecio(perfume) {
    return ventaActual(perfume) === null;
  }

  function contarSinPrecio() {
    return PERFUMES.filter(sinPrecio).length;
  }

  // Determina la categoría de presupuesto a partir del precio de venta,
  // usando los cortes configurados aquí mismo, para que el filtro del test
  // siga siendo coherente después de cualquier ajuste.
  function categoriaParaPrecio(precio) {
    const r = PerfumesDB.rangos();
    if (precio <= r.maxEconomico) return "Económico";
    if (precio <= r.maxMedio) return "Medio";
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

  // Una fragancia sin precio de venta no aparece en el test público, así
  // que hay que poder verlo sin revisar las 143 filas una por una.
  // Cuántas fragancias siguen con el volumen y el precio sugeridos.
  function actualizarAvisoSinVerificar() {
    const aviso = $("#aviso-sin-verificar");
    if (!aviso) return;
    const cuantas = PERFUMES.filter((p) => !PerfumesDB.estaVerificado(p.id)).length;
    if (cuantas === 0) {
      aviso.hidden = true;
      return;
    }
    aviso.hidden = false;
    aviso.innerHTML =
      "<strong>⚠ " + cuantas + " de " + PERFUMES.length + " fragancias con volumen/precio sin verificar</strong>" +
      "Se muestran en el test con el precio sugerido. Revisa el frasco y el costo de cada una y marca " +
      "<strong>Verificado</strong> para confirmarla. Usa el filtro <em>Verificación → Solo sin verificar</em>.";
  }

  function actualizarAvisoSinPrecio() {
    const aviso = $("#aviso-sin-precio");
    if (!aviso) return;
    const cuantas = contarSinPrecio();
    if (cuantas === 0) {
      aviso.hidden = true;
      return;
    }
    aviso.hidden = false;
    aviso.textContent =
      `⚠️ ${cuantas} fragancia(s) sin precio de venta. No aparecen en el test hasta que se lo pongas.`;
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
  const panelEstado = $("#panel-estado");
  const inputBuscar = $("#input-buscar");
  const inputMaxEconomico = $("#input-max-economico");
  const inputMaxMedio = $("#input-max-medio");
  const btnGuardarRangos = $("#btn-guardar-rangos");
  const txtRangoResto = $("#txt-rango-resto");
  const conteoRangos = $("#conteo-rangos");

  const filtroEstado = $("#filtro-estado");
  const filtroPrecioMin = $("#filtro-precio-min");
  const filtroPrecioMax = $("#filtro-precio-max");
  const filtroMargenMin = $("#filtro-margen-min");
  const filtroMargenMax = $("#filtro-margen-max");
  const btnLimpiarFiltros = $("#btn-limpiar-filtros");
  const badgeFiltros = $("#filtros-activos-badge");
  const textoResultado = $("#filtros-resultado");
  const selectsCaracteristica = $$("[data-campo-perfume]");
  const filtroVerificado = $("#filtro-verificado");
  const filtroDecant = $("#filtro-decant");
  const inputsParametro = $$("[data-parametro]");
  const btnGuardarParametros = $("#btn-guardar-parametros");
  const ejemploPrecios = $("#ejemplo-precios");
  const chipsFiltro = $$(".filtro-chip");
  const botonesVista = $$(".filtro-vista-btn");

  let filtroTipoActual = "Todos";
  let terminoBusqueda = "";

  /* ============ RENDER ============ */

  function formatearPrecio(n) {
    return Math.round(n * 100) / 100;
  }

  function renderizarCatalogo() {
    gridCatalogo.innerHTML = "";

    const filtrados = PERFUMES.filter(pasaTodosLosFiltros);
    actualizarResumenFiltros(filtrados.length);

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
          limpiarError(spanEstadoImagen);
          btnQuitarImagen.hidden = false;
        } else {
          spanEstadoImagen.textContent = "";
          spanEstadoImagen.classList.remove("guardada");
          limpiarError(spanEstadoImagen);
          btnQuitarImagen.hidden = true;
        }
      }
      actualizarEstadoImagen(yaTieneOverride);

      const LIMITE_TAMANO_MB = 5;

      inputSubirImagen.addEventListener("change", () => {
        const archivo = inputSubirImagen.files && inputSubirImagen.files[0];
        if (!archivo) return;

        if (!archivo.type.startsWith("image/")) {
          errorEn(spanEstadoImagen, "Ese archivo no es una imagen.");
          return;
        }
        if (archivo.size > LIMITE_TAMANO_MB * 1024 * 1024) {
          errorEn(spanEstadoImagen, `La foto pesa demasiado (máx. ${LIMITE_TAMANO_MB}MB).`);
          return;
        }

        spanEstadoImagen.textContent = "Subiendo…";
        spanEstadoImagen.classList.remove("guardada");
        limpiarError(spanEstadoImagen);
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
            errorEn(spanEstadoImagen, mensajeDeError(e));
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
            errorEn(spanEstadoImagen, mensajeDeError(e));
          })
          .then(() => {
            btnQuitarImagen.disabled = false;
          });
      });

      const inputVolumen = nodo.querySelector('[data-campo="volumen-input"]');
      const spanPreciosCalc = nodo.querySelector('[data-campo="precios-calculados"]');
      const inputVerificado = nodo.querySelector('[data-campo="verificado-input"]');
      const textoVerificado = nodo.querySelector('[data-campo="verificado-texto"]');
      const labelVerificado = inputVerificado.closest(".fila-verificado");
      const inputDecant = nodo.querySelector('[data-campo="decant-input"]');
      const textoDecant = nodo.querySelector('[data-campo="decant-texto"]');
      const labelDecant = inputDecant.closest(".fila-decant");
      const spanErrorFila = nodo.querySelector('[data-campo="error-fila"]');

      const inputCosto = nodo.querySelector('[data-campo="costo-input"]');
      const inputVenta = nodo.querySelector('[data-campo="venta-input"]');
      const spanMargen = nodo.querySelector('[data-campo="margen"]');
      const spanCategoria = nodo.querySelector('[data-campo="presupuesto"]');

      function pintarPrecios() {
        const costo = costoActual(perfume);
        const venta = ventaActual(perfume);
        inputCosto.value = costo === null ? "" : formatearPrecio(costo);
        inputVenta.value = venta === null ? "" : formatearPrecio(venta);
        fila.classList.toggle("sin-precio", venta === null);
        actualizarEtiquetasPrecio(spanMargen, spanCategoria, costo, venta);

        const vol = PerfumesDB.volumenDe(perfume.id);
        inputVolumen.value = vol === null ? "" : vol;

        const verificado = PerfumesDB.estaVerificado(perfume.id);
        inputVerificado.checked = verificado;
        textoVerificado.textContent = verificado ? "✓ Verificado" : "Sin verificar";
        labelVerificado.classList.toggle("esta-verificado", verificado);
        fila.classList.toggle("sin-verificar", !verificado);

        const conDecant = PerfumesDB.hayDecant(perfume.id);
        inputDecant.checked = conDecant;
        textoDecant.textContent = conDecant ? "🧪 Hay decants" : "Solo frasco completo";
        labelDecant.classList.toggle("tiene-decant", conDecant);
        fila.classList.toggle("solo-botella", !conDecant);

        pintarPreciosCalculados();
      }

      // Decant y botella salen del costo, el volumen y los parámetros. Se
      // muestran para poder revisarlos sin hacer la cuenta a mano.
      function pintarPreciosCalculados() {
        const pr = PerfumesDB.preciosDe(perfume.id);
        if (!pr) {
          spanPreciosCalc.innerHTML =
            '<span class="sin-datos">Falta costo o volumen para calcular precios</span>';
          return;
        }
        const cop = PerfumesDB.formatearCOP;
        // Sin decant, el precio del decant no es un dato: es ruido. Se
        // sustituye por la razón, para no tener que mirar la casilla.
        const lineaDecant = pr.hayDecant
          ? "Decant 5ml <b>" + cop(pr.decantCop) + "</b><br>"
          : '<span class="sin-datos">Sin decant · solo botella</span><br>';
        const lineaRecupero = pr.hayDecant
          ? "Recuperas en " + pr.decantsParaRecuperar + " de " + pr.decantsUtiles + " decants"
          : "";
        spanPreciosCalc.innerHTML =
          lineaDecant +
          "Botella <b>" + cop(pr.botellaCop) + "</b><br>" +
          lineaRecupero;
      }
      inputCosto.dataset.id = perfume.id;
      inputVenta.dataset.id = perfume.id;
      pintarPrecios();

      // Un mismo manejador para los dos campos: cambian columnas distintas
      // pero se comportan igual, y ambos recalculan el margen al terminar.
      function conectarCampoPrecio(input, campo) {
        input.addEventListener("change", () => {
          const valor = parseFloat(input.value);
          if (Number.isNaN(valor) || valor <= 0) {
            pintarPrecios(); // valor inválido: dejamos lo que había
            return;
          }
          input.disabled = true;
          PerfumesDB.guardarCampo(perfume.id, campo, formatearPrecio(valor))
            .then(() => {
              limpiarError(spanErrorFila);
              spanErrorFila.textContent = "";
            })
            .catch((e) => {
              console.warn("No se pudo guardar el " + campo + ":", e);
              // El aviso va junto al campo que falló. Ponerlo solo en la nota
              // del fondo hacía que el valor se revirtiera sin explicación
              // visible: parecía que el panel simplemente no guardaba.
              errorEn(spanErrorFila, mensajeDeError(e));
              errorEn(panelNota, mensajeDeError(e));
            })
            .then(() => {
              sincronizarMapasLocales();
              pintarPrecios();
              actualizarAvisoSinPrecio();
              input.disabled = false;
            });
        });
      }
      conectarCampoPrecio(inputCosto, "costo");
      conectarCampoPrecio(inputVenta, "venta");
      conectarCampoPrecio(inputVolumen, "volumen");

      // Marcar como verificada es la forma de decir "revisé el volumen y el
      // precio de esta fragancia". Hasta entonces el test muestra el precio
      // sugerido, pero el panel la deja señalada.
      inputVerificado.addEventListener("change", () => {
        const nuevo = inputVerificado.checked;
        inputVerificado.disabled = true;
        PerfumesDB.guardarCampo(perfume.id, "verificado", nuevo)
          .catch((e) => {
            console.warn("No se pudo guardar la verificación:", e);
            errorEn(panelNota, mensajeDeError(e));
          })
          .then(() => {
            sincronizarMapasLocales();
            pintarPrecios();
            actualizarAvisoSinVerificar();
            inputVerificado.disabled = false;
          });
      });

      // Disponible en decant. Al desmarcarla, el test público deja de
      // ofrecer esta fragancia como decant suelto y dentro del Set Ocasión:
      // solo enseña la botella completa.
      inputDecant.addEventListener("change", () => {
        const nuevo = inputDecant.checked;
        inputDecant.disabled = true;
        PerfumesDB.guardarCampo(perfume.id, "decant", nuevo)
          .then(() => {
            limpiarError(spanErrorFila);
            spanErrorFila.textContent = "";
          })
          .catch((e) => {
            console.warn("No se pudo guardar la disponibilidad en decant:", e);
            errorEn(spanErrorFila, mensajeDeError(e));
            errorEn(panelNota, mensajeDeError(e));
          })
          .then(() => {
            sincronizarMapasLocales();
            pintarPrecios();
            inputDecant.disabled = false;
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
            errorEn(panelNota, mensajeDeError(e));
          });
      });

      gridCatalogo.appendChild(nodo);
    });

    actualizarContadorActivos();
    actualizarAvisoSinPrecio();
    actualizarAvisoSinVerificar();
  }

  // Muestra el margen de utilidad: cuánto se le está ganando a esa
  // fragancia respecto a lo que cuesta. Es la cifra que importa de un
  // vistazo, más que el precio suelto.
  function actualizarEtiquetasPrecio(spanMargen, spanCategoria, costo, venta) {
    spanMargen.classList.remove("cambiado", "fila-margen-negativo");

    if (venta === null) {
      spanMargen.textContent = "Sin precio de venta";
      spanMargen.classList.add("fila-margen-negativo");
      spanCategoria.textContent = "—";
      return;
    }

    spanCategoria.textContent = categoriaParaPrecio(venta);

    if (costo === null || costo <= 0) {
      spanMargen.textContent = "Sin costo";
      return;
    }

    const margen = Math.round(((venta - costo) / costo) * 100);
    if (margen === 0) {
      spanMargen.textContent = "Margen 0% — al costo";
      spanMargen.classList.add("fila-margen-negativo");
    } else if (margen < 0) {
      spanMargen.textContent = `Margen ${margen}% — pérdida`;
      spanMargen.classList.add("fila-margen-negativo");
    } else {
      spanMargen.textContent = `Margen +${margen}%`;
      spanMargen.classList.add("cambiado");
    }
  }

  /* ============ AJUSTE GLOBAL POR PORCENTAJE ============ */

  function aplicarAjusteGlobal() {
    const porcentaje = parseFloat(inputPorcentaje.value);
    if (Number.isNaN(porcentaje) || porcentaje < 0) {
      panelNota.textContent = "Ingresa un porcentaje válido (0 o mayor).";
      limpiarError(panelNota);
      return;
    }
    const direccion = selectDireccion.value; // "subir" | "bajar"
    const factor = direccion === "subir" ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    // El porcentaje actúa sobre el precio de VENTA actual y es acumulativo:
    // aplicar +10% dos veces deja la venta un 21% por encima de donde
    // estaba. El COSTO no se toca nunca desde aquí.
    //
    // Para volver al punto de partida está "Restablecer precios", que copia
    // el costo sobre la venta y deja el margen en cero.
    const nuevasVentas = {};
    PERFUMES.forEach((perfume) => {
      const venta = ventaActual(perfume);
      if (venta === null) return; // sin precio: no hay nada que ajustar
      nuevasVentas[perfume.id] = Math.max(1, formatearPrecio(venta * factor));
    });

    if (Object.keys(nuevasVentas).length === 0) {
      panelNota.textContent = "No hay fragancias con precio de venta para ajustar.";
      limpiarError(panelNota);
      return;
    }

    // Las 143 filas viajan en una sola petición, no una por perfume.
    btnAplicarGlobal.disabled = true;
    panelNota.textContent = "Guardando…";
    limpiarError(panelNota);

    PerfumesDB.guardarVentasEnLote(nuevasVentas)
      .then(() => {
        sincronizarMapasLocales();
        renderizarCatalogo();
        const verbo = direccion === "subir" ? "subido" : "bajado";
        const cuantas = Object.keys(nuevasVentas).length;
        panelNota.textContent = `Precio de venta de ${cuantas} fragancia(s) ${verbo} un ${porcentaje}%. El costo no cambió. Los visitantes del test ya ven los precios nuevos.`;
        limpiarError(panelNota);
      })
      .catch((e) => {
        console.warn("No se pudo aplicar el ajuste global:", e);
        sincronizarMapasLocales();
        renderizarCatalogo();
        errorEn(panelNota, mensajeDeError(e));
      })
      .then(() => {
        btnAplicarGlobal.disabled = !puedeEscribir;
      });
  }

  function restablecerPrecios() {
    btnResetPrecios.disabled = true;
    panelNota.textContent = "Igualando el precio de venta al costo…";
    limpiarError(panelNota);

    // Copia el COSTO sobre la VENTA. Las fotos y los activados/desactivados
    // no se tocan.
    PerfumesDB.ventaIgualACosto()
      .then((r) => {
        sincronizarMapasLocales();
        renderizarCatalogo();
        if (r && r.sinCambios && r.motivo === "sin-costos") {
          panelNota.textContent = "No hay costos configurados, así que no hay nada que copiar al precio de venta.";
          limpiarError(panelNota);
        } else if (r && r.sinCambios) {
          panelNota.textContent = "El precio de venta ya era igual al costo en todas las fragancias. Margen actual: 0%.";
          limpiarError(panelNota);
        } else {
          panelNota.textContent =
            `Listo: el precio de venta de ${r.cambiadas} fragancia(s) quedó igual al costo, con margen 0%. ` +
            "Ahora aplica un aumento aquí arriba para fijar tu utilidad — por ejemplo 30%.";
          inputPorcentaje.value = 30;
          selectDireccion.value = "subir";
        }
      })
      .catch((e) => {
        console.warn("No se pudieron restablecer los precios:", e);
        sincronizarMapasLocales();
        renderizarCatalogo();
        errorEn(panelNota, mensajeDeError(e));
      })
      .then(() => {
        btnResetPrecios.disabled = !puedeEscribir;
      });
  }

  /* ============ FILTROS AVANZADOS ============ */
  // Con 143 fragancias, encontrar una concreta a ojo es inviable. Estos
  // filtros se combinan entre sí y con los chips de tipo y el buscador.

  function numeroDe(input) {
    const v = parseFloat(input.value);
    return Number.isNaN(v) ? null : v;
  }

  // Margen de utilidad en porcentaje, o null si no se puede calcular
  // (sin costo o sin venta no hay margen del que hablar).
  function margenDe(perfume) {
    const costo = costoActual(perfume);
    const venta = ventaActual(perfume);
    if (costo === null || venta === null || costo <= 0) return null;
    return Math.round(((venta - costo) / costo) * 100);
  }

  function pasaTodosLosFiltros(perfume) {
    if (filtroTipoActual !== "Todos" && perfume.tipo !== filtroTipoActual) return false;

    if (terminoBusqueda &&
        !perfume.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase())) return false;

    const estado = filtroEstado.value;
    if (estado !== "todos") {
      const activo = estaActivo(perfume, overridesActivos);
      if (estado === "activos" && !activo) return false;
      if (estado === "inactivos" && activo) return false;
    }

    // Precio y margen: una fragancia sin ese dato queda fuera en cuanto se
    // filtra por él, porque no hay forma de decir si cumple o no.
    const precioMin = numeroDe(filtroPrecioMin);
    const precioMax = numeroDe(filtroPrecioMax);
    if (precioMin !== null || precioMax !== null) {
      const venta = ventaActual(perfume);
      if (venta === null) return false;
      if (precioMin !== null && venta < precioMin) return false;
      if (precioMax !== null && venta > precioMax) return false;
    }

    const margenMin = numeroDe(filtroMargenMin);
    const margenMax = numeroDe(filtroMargenMax);
    if (margenMin !== null || margenMax !== null) {
      const margen = margenDe(perfume);
      if (margen === null) return false;
      if (margenMin !== null && margen < margenMin) return false;
      if (margenMax !== null && margen > margenMax) return false;
    }

    const verif = filtroVerificado.value;
    if (verif !== "todos") {
      const esta = PerfumesDB.estaVerificado(perfume.id);
      if (verif === "sin" && esta) return false;
      if (verif === "con" && !esta) return false;
    }

    const formato = filtroDecant.value;
    if (formato !== "todos") {
      const conDecant = PerfumesDB.hayDecant(perfume.id);
      if (formato === "con" && !conDecant) return false;
      if (formato === "sin" && conDecant) return false;
    }

    for (let i = 0; i < selectsCaracteristica.length; i++) {
      const select = selectsCaracteristica[i];
      if (select.value && perfume[select.dataset.campoPerfume] !== select.value) return false;
    }

    return true;
  }

  // Los desplegables se llenan con los valores que existen de verdad en el
  // catálogo, para que no aparezcan opciones que no filtran nada ni falten
  // valores nuevos al crecer data.js.
  function llenarSelectsCaracteristica() {
    selectsCaracteristica.forEach((select) => {
      const campo = select.dataset.campoPerfume;
      const valores = Array.from(new Set(PERFUMES.map((p) => p[campo]).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "es")
      );
      select.innerHTML = '<option value="">Cualquiera</option>';
      valores.forEach((valor) => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = valor;
        select.appendChild(opcion);
      });
    });
  }

  function controlesDeFiltro() {
    return [filtroEstado, filtroVerificado, filtroDecant, filtroPrecioMin, filtroPrecioMax, filtroMargenMin, filtroMargenMax]
      .concat(selectsCaracteristica);
  }

  function contarFiltrosActivos() {
    return controlesDeFiltro().filter((el) => el.value && el.value !== "todos").length;
  }

  // Resalta los filtros con valor y avisa cuántos hay puestos. Sin esto es
  // fácil dejar un filtro olvidado y creer que el catálogo se vació.
  function actualizarResumenFiltros(cuantasSeVen) {
    controlesDeFiltro().forEach((el) => {
      el.classList.toggle("con-valor", Boolean(el.value) && el.value !== "todos");
    });

    const activos = contarFiltrosActivos();
    if (activos === 0) {
      badgeFiltros.hidden = true;
    } else {
      badgeFiltros.hidden = false;
      badgeFiltros.textContent = activos === 1 ? "1 filtro" : `${activos} filtros`;
    }

    const hayFiltro = activos > 0 || filtroTipoActual !== "Todos" || terminoBusqueda;
    textoResultado.textContent = hayFiltro
      ? `Mostrando ${cuantasSeVen} de ${PERFUMES.length} fragancias`
      : "";
  }

  function limpiarFiltros() {
    filtroEstado.value = "todos";
    filtroVerificado.value = "todos";
    filtroDecant.value = "todos";
    [filtroPrecioMin, filtroPrecioMax, filtroMargenMin, filtroMargenMax].forEach((i) => {
      i.value = "";
    });
    selectsCaracteristica.forEach((s) => { s.value = ""; });
    inputBuscar.value = "";
    terminoBusqueda = "";
    seleccionarFiltroTipo("Todos");
  }

  llenarSelectsCaracteristica();
  btnLimpiarFiltros.addEventListener("click", limpiarFiltros);
  controlesDeFiltro().forEach((el) => {
    const evento = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evento, renderizarCatalogo);
  });

  /* ============ PARÁMETROS DE PRECIO ============ */
  // Nueve números que definen todos los precios del catálogo. Cambiar
  // cualquiera recalcula las 143 fragancias, así que antes de guardar se
  // muestra el efecto sobre un ejemplo concreto.

  // Los parámetros se guardan como fracciones (0.4) porque así entran en la
  // fórmula, pero en pantalla se escriben como porcentajes (40%), que es
  // como se piensan. Estas dos funciones traducen entre ambos.
  //
  //   "porcentaje": 0.4  ⇄  40
  //   "recargo":    1.2  ⇄  20   (un 20% por encima del costo)
  function aPantalla(valorGuardado, formato) {
    if (formato === "porcentaje") return Math.round(valorGuardado * 1000) / 10;
    if (formato === "recargo") return Math.round((valorGuardado - 1) * 1000) / 10;
    return valorGuardado;
  }

  function aGuardar(valorEnPantalla, formato) {
    if (formato === "porcentaje") return valorEnPantalla / 100;
    if (formato === "recargo") return 1 + valorEnPantalla / 100;
    return valorEnPantalla;
  }

  function pintarParametros() {
    const par = PerfumesDB.parametros();
    inputsParametro.forEach((input) => {
      input.value = aPantalla(par[input.dataset.parametro], input.dataset.formato);
    });
    actualizarEjemploPrecios();
  }

  function actualizarEjemploPrecios() {
    if (!ejemploPrecios) return;
    // Tomamos la primera fragancia con costo y volumen como muestra.
    const muestra = PERFUMES.find((p) => PerfumesDB.preciosDe(p.id));
    if (!muestra) {
      ejemploPrecios.textContent = "Sin fragancias con costo y volumen para mostrar un ejemplo.";
      return;
    }
    const pr = PerfumesDB.preciosDe(muestra.id);
    const cop = PerfumesDB.formatearCOP;
    const par = PerfumesDB.parametros();
    ejemploPrecios.textContent =
      `Ejemplo · ${muestra.nombre} (${pr.volumenMl}ml): ` +
      `costo real ${cop(pr.costoRealCop)} (importación +${aPantalla(par.factor_importacion, "recargo")}%) · ` +
      `decant ${cop(pr.decantCop)} · botella ${cop(pr.botellaCop)} (margen +${aPantalla(par.margen_botella, "porcentaje")}%) · ` +
      `recuperas el frasco con ${pr.decantsParaRecuperar} de ${pr.decantsUtiles} decants.`;
  }

  function guardarParametros() {
    const cambios = [];
    let invalido = null;

    inputsParametro.forEach((input) => {
      const enPantalla = parseFloat(input.value);
      if (Number.isNaN(enPantalla) || enPantalla < 0) {
        invalido = input.dataset.parametro;
        return;
      }
      const valor = aGuardar(enPantalla, input.dataset.formato);
      if (valor !== PerfumesDB.parametros()[input.dataset.parametro]) {
        cambios.push([input.dataset.parametro, valor]);
      }
    });

    if (invalido) {
      errorEn(panelNota, `El parámetro "${invalido}" no tiene un número válido.`);
      return;
    }
    if (cambios.length === 0) {
      limpiarError(panelNota);
      panelNota.textContent = "No hay cambios en los parámetros.";
      return;
    }

    btnGuardarParametros.disabled = true;
    limpiarError(panelNota);
    panelNota.textContent = "Guardando parámetros…";

    // Se guardan en secuencia para que un fallo a mitad no deje unos
    // aplicados y otros no sin que quede claro cuáles.
    cambios
      .reduce(
        (cadena, [clave, valor]) => cadena.then(() => PerfumesDB.guardarParametro(clave, valor)),
        Promise.resolve()
      )
      .then(() => {
        renderizarCatalogo();
        pintarParametros();
        limpiarError(panelNota);
        panelNota.textContent =
          `${cambios.length} parámetro(s) guardado(s). Los precios de las ${PERFUMES.length} fragancias se recalcularon.`;
      })
      .catch((e) => {
        console.warn("No se pudieron guardar los parámetros:", e);
        pintarParametros();
        errorEn(panelNota, mensajeDeError(e));
      })
      .then(() => {
        btnGuardarParametros.disabled = !puedeEscribir;
      });
  }

  btnGuardarParametros.addEventListener("click", guardarParametros);

  /* ============ RANGOS DE PRESUPUESTO ============ */
  // Definen en qué categoría cae cada fragancia según su precio de VENTA.
  // Cambiarlos redefine qué se le ofrece a quien elige un presupuesto en el
  // test, así que se muestra cuántas fragancias quedan en cada uno antes de
  // guardar.

  function pintarRangos() {
    const r = PerfumesDB.rangos();
    inputMaxEconomico.value = r.maxEconomico;
    inputMaxMedio.value = r.maxMedio;
    txtRangoResto.textContent = `Sin límite: más de $${r.maxMedio}`;
    actualizarConteoRangos();
  }

  // Cuenta con los valores que hay escritos en las casillas, no con los
  // guardados: así se ve el efecto del cambio antes de confirmarlo.
  function actualizarConteoRangos() {
    const maxEco = parseFloat(inputMaxEconomico.value);
    const maxMedio = parseFloat(inputMaxMedio.value);

    if (Number.isNaN(maxEco) || Number.isNaN(maxMedio) || maxEco <= 0 || maxMedio <= maxEco) {
      conteoRangos.textContent =
        "El corte de “Medio” tiene que ser mayor que el de “Económico”, y ambos mayores que cero.";
      conteoRangos.classList.add("error");
      return false;
    }

    conteoRangos.classList.remove("error");
    let eco = 0, medio = 0, sinLimite = 0, sinPrecioAun = 0;
    PERFUMES.forEach((perfume) => {
      const venta = ventaActual(perfume);
      if (venta === null) { sinPrecioAun++; return; }
      if (venta <= maxEco) eco++;
      else if (venta <= maxMedio) medio++;
      else sinLimite++;
    });

    conteoRangos.textContent =
      `Con estos cortes: ${eco} económicas · ${medio} medias · ${sinLimite} sin límite` +
      (sinPrecioAun ? ` · ${sinPrecioAun} sin precio` : "");
    return true;
  }

  function guardarRangos() {
    if (!actualizarConteoRangos()) return;

    const maxEco = parseFloat(inputMaxEconomico.value);
    const maxMedio = parseFloat(inputMaxMedio.value);

    btnGuardarRangos.disabled = true;
    limpiarError(panelNota);
    panelNota.textContent = "Guardando los rangos…";

    PerfumesDB.guardarRangos(maxEco, maxMedio)
      .then(() => {
        renderizarCatalogo(); // las categorías por fila cambian con los cortes
        pintarRangos();
        limpiarError(panelNota);
        panelNota.textContent =
          `Rangos guardados: Económico hasta $${maxEco}, Medio hasta $${maxMedio}. El test ya filtra con estos valores.`;
      })
      .catch((e) => {
        console.warn("No se pudieron guardar los rangos:", e);
        pintarRangos();
        errorEn(panelNota, mensajeDeError(e));
      })
      .then(() => {
        btnGuardarRangos.disabled = !puedeEscribir;
      });
  }

  btnGuardarRangos.addEventListener("click", guardarRangos);
  inputMaxEconomico.addEventListener("input", actualizarConteoRangos);
  inputMaxMedio.addEventListener("input", actualizarConteoRangos);

  /* ============ FILTROS Y BÚSQUEDA ============ */

  function seleccionarFiltroTipo(tipo) {
    filtroTipoActual = tipo;
    chipsFiltro.forEach((chip) => {
      chip.classList.toggle("activo", chip.dataset.filtroTipo === tipo);
    });
    renderizarCatalogo();
  }

  /* ============ TAMAÑO DE LAS TARJETAS ============ */
  // La elección se recuerda en este navegador: es una preferencia de cómo
  // trabajas, no un dato del catálogo, así que no tiene por qué viajar a la
  // base de datos ni verla los demás.

  const CLAVE_VISTA = "perfumesPro_vistaCatalogo";

  function aplicarVista(vista) {
    const compacta = vista === "compacta";
    gridCatalogo.classList.toggle("compacta", compacta);
    botonesVista.forEach((btn) => {
      btn.classList.toggle("activo", btn.dataset.vista === (compacta ? "compacta" : "comoda"));
    });
    try {
      localStorage.setItem(CLAVE_VISTA, compacta ? "compacta" : "comoda");
    } catch (e) {
      // Modo incógnito o almacenamiento lleno: la vista funciona igual,
      // solo que no se recuerda para la próxima visita.
    }
  }

  function vistaGuardada() {
    try {
      return localStorage.getItem(CLAVE_VISTA) === "compacta" ? "compacta" : "comoda";
    } catch (e) {
      return "comoda";
    }
  }

  botonesVista.forEach((btn) => {
    btn.addEventListener("click", () => aplicarVista(btn.dataset.vista));
  });
  aplicarVista(vistaGuardada());

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
      pintarParametros();
      pintarRangos();
      renderizarCatalogo();
      avisarModoDeGuardado();
      comprobarEsquema();
      comprobarBucket();
      ofrecerMigracion();
    });
  }

  function avisarModoDeGuardado() {
    if (!PerfumesDB.estaConfigurada()) {
      fijarPermisoDeEscritura(false);
      mostrarEstado("error",
        "<strong>⚠ El panel no está conectado a ninguna base de datos</strong>" +
        "Faltan las claves de Supabase en <code>db.js</code>. Los cambios no se guardarían en ningún lado.");
      return;
    }
    // Si ya había sesión de escritura de antes (misma pestaña), lo reflejamos
    // sin esperar a que se vuelva a teclear la contraseña.
    if (PerfumesDB.sesionDeEscrituraActiva()) {
      window.PerfumesPanelEstado({ ok: true });
    }
  }

  // Tener permiso para escribir no basta: si la tabla no tiene las columnas
  // costo_usd y venta_usd, cada guardado se rechaza igual. Lo comprobamos al
  // entrar para poder decirlo una sola vez, con instrucciones, en vez de
  // dejar que cada intento falle por separado.
  function comprobarEsquema() {
    if (!PerfumesDB.estaConfigurada()) return;

    PerfumesDB.verificarEsquema().then((r) => {
      if (r.ok || r.motivo === "sin-red") return;

      console.warn("Esquema incompleto:", r.grupos, r.detalle);
      const grupos = r.grupos || ["precios"];

      // Falta solo la columna de decant: todo lo demás funciona y el test
      // sigue ofreciendo decants de todas las fragancias, como antes. Es un
      // aviso, no un bloqueo.
      if (grupos.length === 1 && grupos[0] === "decant") {
        mostrarEstado("aviso",
          "<strong>⚠ Falta la columna de decants</strong>" +
          "La tabla no tiene la columna <code>decant</code>, así que <strong>no puedes marcar " +
          "cuáles se venden solo en frasco completo</strong> (la casilla se revierte al tocarla). " +
          "Mientras tanto el test ofrece decant de todas, como hasta ahora." +
          INSTRUCCIONES_SQL_DECANT);
        return;
      }

      // Falta la carga de volumen, pero costo y venta sí están: el panel
      // funciona a medias, así que se bloquea solo lo que no puede guardar.
      if (grupos.length === 1 && grupos[0] === "volumen") {
        mostrarEstado("error",
          "<strong>⚠ Falta la segunda parte de la carga de precios</strong>" +
          "La tabla no tiene las columnas <code>volumen_ml</code> ni <code>verificado</code>, así que " +
          "<strong>el volumen del frasco no se puede guardar</strong> (se revierte al escribirlo) y no se " +
          "calculan los precios de decant ni botella. Los precios en dólares y las activaciones sí funcionan." +
          INSTRUCCIONES_SQL_VOLUMEN);
        return;
      }

      fijarPermisoDeEscritura(false);
      mostrarEstado("error",
        "<strong>⚠ Falta preparar la base de datos</strong>" +
        "La tabla todavía no tiene las columnas de <strong>costo</strong> y <strong>venta</strong>, " +
        "así que ningún cambio se puede guardar. Por eso los botones no hacen nada." +
        INSTRUCCIONES_SQL);
    });
  }

  // El bucket de fotos es independiente de la tabla: puede faltar aunque
  // todo lo demás funcione. Se avisa aparte, sin bloquear precios ni
  // activaciones, porque eso sí sigue funcionando sin él.
  function comprobarBucket() {
    if (!PerfumesDB.estaConfigurada()) return;

    PerfumesDB.verificarBucket().then((r) => {
      if (r.ok || r.motivo === "sin-red") return;

      console.warn("Problema con el bucket de fotos:", r.motivo, r.detalle || "");
      const aviso = $("#aviso-bucket");
      if (!aviso) return;

      if (r.motivo === "bucket-privado") {
        // Caso traicionero: la foto se sube sin error, pero los visitantes
        // ven un hueco porque no tienen permiso para leerla.
        aviso.className = "panel-estado aviso";
        aviso.innerHTML =
          "<strong>⚠ El bucket de fotos no es público</strong>" +
          "Puedes subir fotos, pero los visitantes del test <strong>no las verán</strong>. " +
          "Entra a <strong>Storage</strong>, abre <code>fotos-perfumes</code>, y en su configuración " +
          "activa <strong>Public bucket</strong>.";
        aviso.hidden = false;
        return;
      }

      aviso.className = "panel-estado error";
      aviso.innerHTML =
        "<strong>⚠ Falta crear el bucket de fotos</strong>" +
        "Los precios y las activaciones sí se guardan, pero <strong>no se puede subir ninguna foto</strong> " +
        "hasta que exista el almacenamiento." +
        INSTRUCCIONES_BUCKET;
      aviso.hidden = false;
    });
  }

  // Si este navegador todavía tiene cambios viejos guardados localmente
  // que nunca llegaron a la nube, ofrecemos subirlos en vez de perderlos.
  function ofrecerMigracion() {
    if (!puedeEscribir) return;
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
