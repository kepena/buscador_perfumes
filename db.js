/* ============================================================
   BUSCADOR DE PERFUMES PRO — db.js
   Capa de acceso a la base de datos externa (Supabase).

   Guarda y lee lo que el panel administra de cada fragancia:
     · COSTO (lo que se paga)       -> columna costo_usd
     · VENTA (lo que ve el cliente) -> columna venta_usd
     · activo / desactivado         -> columna activo
     · foto real subida             -> columna imagen_url (va a Storage)

   COSTO y VENTA son independientes. El ajuste por porcentaje del panel
   actúa siempre sobre la VENTA y es acumulativo; el COSTO solo cambia si
   se edita a mano. "Restablecer precios" copia el COSTO sobre la VENTA,
   dejando margen cero como punto de partida.

   El catálogo en sí (nombres, notas, familias) sigue viniendo de data.js
   y actualizándose por Git. Los precios, en cambio, son dato de negocio y
   viven solo aquí.

   Si las claves de abajo están vacías, o si la red falla, todo sigue
   funcionando contra localStorage igual que antes. El sitio nunca se
   rompe por culpa de la base de datos.
   ============================================================ */

window.PerfumesDB = (function () {
  "use strict";

  /* ============================================================
     ⬇⬇⬇  PEGA AQUÍ LAS DOS CLAVES DE SUPABASE  ⬇⬇⬇
     Las encuentras en: Project Settings → API
       · SUPABASE_URL  = "Project URL"     (https://xxxxx.supabase.co)
       · SUPABASE_KEY  = clave pública     (aparece como "anon public"
                                            o "Publishable key")
     ⚠️ NUNCA pegues aquí la clave "service_role" / "Secret key".
        Esa se salta todas las reglas de seguridad y este repo es público.
     ============================================================ */
  const SUPABASE_URL = "https://evqifaeeamvrttuildkz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_5J5kSaPEfLh29jaEe7QBuQ_hRRPbiFD";

  // Correo fijo del único usuario administrador. No es un buzón real:
  // Supabase solo lo usa como identificador. La contraseña es la misma
  // que ya protege catalogo.html, y la tecleas tú — no está en el código.
  const EMAIL_ADMIN = "admin@buscadorperfumes.kaiketek.com";

  const TABLA = "perfume_overrides";
  const BUCKET = "fotos-perfumes";
  const TIMEOUT_MS = 6000; // si la BD no responde, seguimos sin ella
  const CLAVE_TOKEN = "perfumesPro_tokenEscritura";

  // Claves de localStorage originales. Se mantienen como respaldo para
  // que el sitio funcione si la BD no está configurada todavía, y para
  // poder migrar a la nube lo que ya tengas guardado en este navegador.
  const LS = {
    costos: "perfumesPro_costos",
    ventas: "perfumesPro_ventas",
    imagenes: "perfumesPro_imagenesOverride",
    activos: "perfumesPro_activosOverride",
    // Clave del modelo anterior, de un solo precio. Se sigue leyendo para
    // poder recuperar lo que quedara guardado en el navegador de antes.
    preciosViejos: "perfumesPro_preciosOverride"
  };

  const configurada = SUPABASE_URL !== "" && SUPABASE_KEY !== "";

  /* ============ CACHÉ EN MEMORIA ============ */
  // El test público lee estos overrides muchas veces (al calcular el Top 4,
  // en cada casilla del Set Ocasión...). Consultar la red cada vez lo haría
  // lento, así que descargamos UNA sola vez y servimos desde memoria.

  let cache = cacheVacia();
  let cargado = false;
  let promesaEnCurso = null;

  function cacheVacia() {
    return { costos: {}, ventas: {}, imagenes: {}, activos: {} };
  }

  /* ============ UTILIDADES DE RED ============ */

  function conTimeout(promesa, ms) {
    return new Promise((resolver, rechazar) => {
      const id = setTimeout(() => rechazar(new Error("timeout")), ms);
      promesa.then(
        (v) => { clearTimeout(id); resolver(v); },
        (e) => { clearTimeout(id); rechazar(e); }
      );
    });
  }

  function tokenGuardado() {
    try {
      return sessionStorage.getItem(CLAVE_TOKEN) || null;
    } catch (e) {
      return null;
    }
  }

  // Cabeceras para cualquier llamada. Si ya iniciamos sesión con la
  // contraseña del panel, mandamos el token: eso es lo que habilita
  // la escritura. Sin token solo se puede leer.
  function cabeceras(extra) {
    const h = Object.assign({ apikey: SUPABASE_KEY }, extra || {});
    const token = tokenGuardado();
    if (token) h.Authorization = "Bearer " + token;
    return h;
  }

  /* ============ RESPALDO EN LOCALSTORAGE ============ */

  function leerLS(clave) {
    try {
      const raw = localStorage.getItem(clave);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function leerTodoLS() {
    const ventas = leerLS(LS.ventas);
    const viejos = leerLS(LS.preciosViejos);
    // Si solo hay datos del modelo anterior, los tomamos como precio de venta.
    Object.keys(viejos).forEach((id) => {
      if (ventas[id] === undefined) ventas[id] = viejos[id];
    });
    return {
      costos: leerLS(LS.costos),
      ventas: ventas,
      imagenes: leerLS(LS.imagenes),
      activos: leerLS(LS.activos)
    };
  }

  function escribirLS(clave, objeto) {
    try {
      localStorage.setItem(clave, JSON.stringify(objeto));
      return true;
    } catch (e) {
      return false;
    }
  }

  function guardarTodoLS(datos) {
    escribirLS(LS.costos, datos.costos);
    escribirLS(LS.ventas, datos.ventas);
    escribirLS(LS.imagenes, datos.imagenes);
    escribirLS(LS.activos, datos.activos);
  }

  /* ============ LECTURA DE OVERRIDES ============ */

  // Convierte las filas que devuelve Supabase al mismo formato de mapas
  // { id: valor } que ya usaban catalogo.js y app.js, para no tener que
  // cambiar la lógica que los consume.
  function filasAMapas(filas) {
    const datos = cacheVacia();
    filas.forEach((fila) => {
      const id = Number(fila.id);
      if (Number.isNaN(id)) return;
      if (fila.costo_usd !== null && fila.costo_usd !== undefined) {
        datos.costos[id] = Number(fila.costo_usd);
      }
      // venta_usd es la columna del modelo actual. Si la fila todavía viene
      // del modelo anterior (una sola columna precio_usd), la usamos como
      // precio de venta para no quedarnos sin precio mientras se migra.
      if (fila.venta_usd !== null && fila.venta_usd !== undefined) {
        datos.ventas[id] = Number(fila.venta_usd);
      } else if (fila.precio_usd !== null && fila.precio_usd !== undefined) {
        datos.ventas[id] = Number(fila.precio_usd);
      }
      if (typeof fila.activo === "boolean") {
        datos.activos[id] = fila.activo;
      }
      if (typeof fila.imagen_url === "string" && fila.imagen_url.trim() !== "") {
        datos.imagenes[id] = fila.imagen_url;
      }
    });
    return datos;
  }

  // Descarga los overrides una sola vez. Las llamadas simultáneas
  // comparten la misma promesa (no se dispara la petición dos veces).
  function cargarOverrides() {
    if (cargado) return Promise.resolve(cache);
    if (promesaEnCurso) return promesaEnCurso;

    if (!configurada) {
      cache = leerTodoLS();
      cargado = true;
      return Promise.resolve(cache);
    }

    // Pedimos todas las columnas en vez de enumerarlas: así el panel sigue
    // funcionando tanto antes como después de añadir costo_usd y venta_usd.
    const url = SUPABASE_URL + "/rest/v1/" + TABLA + "?select=*";

    promesaEnCurso = conTimeout(
      fetch(url, { headers: cabeceras() }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
      TIMEOUT_MS
    )
      .then((filas) => {
        cache = filasAMapas(Array.isArray(filas) ? filas : []);
        cargado = true;
        promesaEnCurso = null;
        return cache;
      })
      .catch((e) => {
        // La BD no respondió. En vez de dejar el sitio a medias, caemos
        // a lo que haya en este navegador; si tampoco hay nada, el test
        // usa los valores originales de data.js y funciona igual.
        console.warn("No se pudo leer la base de datos, usando respaldo local:", e);
        cache = leerTodoLS();
        cargado = true;
        promesaEnCurso = null;
        return cache;
      });

    return promesaEnCurso;
  }

  // Acceso SÍNCRONO a lo ya descargado. app.js lo usa dentro del motor de
  // scoring, que no puede ser asíncrono sin reescribirlo entero. Antes de
  // llamarlo hay que haber esperado cargarOverrides() al menos una vez.
  function overrides() {
    return cache;
  }

  function estaCargado() {
    return cargado;
  }

  /* ============ INICIO DE SESIÓN PARA ESCRIBIR ============ */
  // Recibe la contraseña que el administrador acaba de teclear en
  // catalogo.html (la misma de siempre) y la canjea por un token de
  // escritura. La contraseña no se guarda en ningún lado.

  // Devuelve { ok, motivo }. El motivo importa: sin él el panel solo puede
  // decir "no se pudo", que no le sirve de nada a quien tiene que arreglarlo.
  //   "sin-usuario"     -> el usuario administrador no existe en Supabase
  //   "sin-confirmar"   -> existe pero quedó sin confirmar
  //   "sin-red"         -> no hubo respuesta
  function iniciarSesion(password) {
    if (!configurada) return Promise.resolve({ ok: false, motivo: "sin-configurar" });

    return conTimeout(
      fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL_ADMIN, password: password })
      }).then((r) => r.json()),
      TIMEOUT_MS
    )
      .then((data) => {
        if (data && data.access_token) {
          try {
            sessionStorage.setItem(CLAVE_TOKEN, data.access_token);
          } catch (e) { /* sesión sin storage: seguimos sin persistir */ }
          return { ok: true, motivo: null };
        }

        const codigo = String((data && (data.error_code || data.error)) || "");
        const texto = String((data && (data.msg || data.error_description || data.message)) || "");
        const todo = (codigo + " " + texto).toLowerCase();

        let motivo = "sin-usuario";
        if (todo.indexOf("not confirmed") !== -1 || todo.indexOf("email_not_confirmed") !== -1) {
          motivo = "sin-confirmar";
        }
        console.warn("Supabase rechazó el inicio de sesión:", codigo, texto);
        return { ok: false, motivo: motivo, detalle: texto };
      })
      .catch((e) => {
        console.warn("No se pudo iniciar sesión de escritura:", e);
        return { ok: false, motivo: "sin-red" };
      });
  }

  function sesionDeEscrituraActiva() {
    return tokenGuardado() !== null;
  }

  /* ============ COMPROBACIÓN DEL ESQUEMA ============ */
  // Pregunta a la base de datos si ya existen las columnas del modelo de
  // dos precios. Sin ellas TODA escritura se rechaza con un error 400, y
  // desde el panel eso se vive como "el botón no hace nada": conviene
  // detectarlo al entrar y decirlo, en vez de fallar en cada intento.

  function verificarEsquema() {
    if (!configurada) return Promise.resolve({ ok: false, motivo: "sin-configurar" });

    const url =
      SUPABASE_URL + "/rest/v1/" + TABLA + "?select=costo_usd,venta_usd&limit=1";

    return conTimeout(
      fetch(url, { headers: cabeceras() }).then((r) => {
        if (r.ok) return { ok: true };
        return r.text().then((t) => ({
          ok: false,
          motivo: "faltan-columnas",
          detalle: t
        }));
      }),
      TIMEOUT_MS
    ).catch((e) => {
      console.warn("No se pudo verificar el esquema:", e);
      return { ok: false, motivo: "sin-red" };
    });
  }

  /* ============ ESCRITURA ============ */

  // Manda SIEMPRE la fila completa (precio + activo + imagen) para que
  // no haya ambigüedad: guardar un precio nuevo nunca puede borrar por
  // accidente la foto que ya estaba guardada.
  function filaCompleta(id) {
    const idNum = Number(id);
    const costo = cache.costos[idNum];
    const venta = cache.ventas[idNum];
    const activo = cache.activos[idNum];
    const imagen = cache.imagenes[idNum];
    // No incluimos precio_usd a propósito: es la columna del modelo anterior
    // y al no mandarla, la base de datos la deja intacta.
    return {
      id: idNum,
      costo_usd: typeof costo === "number" ? costo : null,
      venta_usd: typeof venta === "number" ? venta : null,
      activo: typeof activo === "boolean" ? activo : null,
      imagen_url: typeof imagen === "string" && imagen !== "" ? imagen : null
    };
  }

  function enviarFilas(filas) {
    if (filas.length === 0) return Promise.resolve(true);

    if (!configurada) {
      guardarTodoLS(cache);
      return Promise.resolve(true);
    }

    return conTimeout(
      fetch(SUPABASE_URL + "/rest/v1/" + TABLA, {
        method: "POST",
        headers: cabeceras({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify(filas)
      }).then((r) => {
        if (!r.ok) {
          return r.text().then((t) => {
            throw new Error("HTTP " + r.status + " " + t);
          });
        }
        return true;
      }),
      TIMEOUT_MS
    );
  }

  // Actualiza la caché en memoria primero (para que la pantalla responda
  // al instante) y después manda el cambio a la nube.
  //
  // Si el envío falla DESHACEMOS el cambio en memoria antes de propagar el
  // error. Esto es importante: sin ese paso, el panel seguiría mostrando
  // como guardado algo que la base de datos rechazó, que es justo el
  // problema que esta migración vino a resolver.
  //
  // El valor intentado sí queda en el respaldo de localStorage: así no se
  // pierde el trabajo, y la próxima vez que abras el panel te ofrecerá
  // subirlo.
  function guardarCampo(id, campo, valor) {
    const idNum = Number(id);
    const mapa = { costo: "costos", venta: "ventas", activo: "activos", imagen: "imagenes" };
    const destino = mapa[campo];
    if (!destino) return Promise.reject(new Error("Campo desconocido: " + campo));

    const tenia = Object.prototype.hasOwnProperty.call(cache[destino], idNum);
    const previo = cache[destino][idNum];

    if (valor === null || valor === undefined || valor === "") {
      delete cache[destino][idNum];
    } else {
      cache[destino][idNum] = valor;
    }

    return enviarFilas([filaCompleta(idNum)])
      .then((r) => {
        // Solo espejamos en localStorage lo que la base de datos ya aceptó.
        // Guardar tambien los intentos fallidos hacia que el panel ofreciera
        // "subir" cambios que en realidad nunca existieron.
        guardarTodoLS(cache);
        return r;
      })
      .catch((e) => {
        if (tenia) cache[destino][idNum] = previo;
        else delete cache[destino][idNum];
        throw e;
      });
  }

  // Para el ajuste global por porcentaje: un solo viaje a la red con
  // las 143 filas, en vez de 143 peticiones sueltas.
  // Ajuste global: recibe { id: nuevoPrecioDeVenta } y lo manda en un solo
  // viaje a la red, en vez de una petición por fragancia.
  function guardarVentasEnLote(mapaVentas) {
    const previos = Object.assign({}, cache.ventas);
    Object.keys(mapaVentas).forEach((id) => {
      cache.ventas[Number(id)] = mapaVentas[id];
    });
    const filas = Object.keys(mapaVentas).map((id) => filaCompleta(id));
    return enviarFilas(filas)
      .then((r) => { guardarTodoLS(cache); return r; })
      .catch((e) => {
        cache.ventas = previos; // el ajuste global no se aplicó: lo deshacemos
        throw e;
      });
  }

  // Restablecer precios: deja imagen y activo intactos, solo borra precio.
  // "Restablecer precios" copia el COSTO sobre la VENTA en todas las
  // fragancias que tengan costo definido. El resultado es margen cero: es el
  // punto de partida para volver a aplicar el porcentaje de utilidad.
  function ventaIgualACosto() {
    const previos = Object.assign({}, cache.ventas);
    const ids = Object.keys(cache.costos).map(Number);
    if (ids.length === 0) return Promise.resolve({ sinCambios: true, motivo: "sin-costos" });

    let cambiadas = 0;
    ids.forEach((id) => {
      if (cache.ventas[id] !== cache.costos[id]) cambiadas++;
      cache.ventas[id] = cache.costos[id];
    });
    if (cambiadas === 0) return Promise.resolve({ sinCambios: true, motivo: "ya-igual" });

    return enviarFilas(ids.map((id) => filaCompleta(id)))
      .then(() => { guardarTodoLS(cache); return { sinCambios: false, cambiadas: cambiadas }; })
      .catch((e) => {
        cache.ventas = previos;
        throw e;
      });
  }

  /* ============ FOTOS ============ */
  // El archivo va a Supabase Storage (no a la base de datos). En la tabla
  // solo guardamos su URL pública, que pesa unos pocos bytes. Así el test
  // descarga un JSON diminuto y las fotos las carga el navegador por su
  // cuenta, en paralelo y desde la CDN.

  function extensionDe(archivo) {
    const porTipo = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "image/avif": "avif", "image/gif": "gif"
    };
    if (porTipo[archivo.type]) return porTipo[archivo.type];
    const partes = (archivo.name || "").split(".");
    return partes.length > 1 ? partes.pop().toLowerCase() : "jpg";
  }

  function subirFoto(id, archivo) {
    const ruta = "perfume-" + Number(id) + "." + extensionDe(archivo);

    if (!configurada) {
      // Sin BD configurada: comportamiento anterior (base64 en el navegador).
      return new Promise((resolver, rechazar) => {
        const lector = new FileReader();
        lector.onload = () => resolver(String(lector.result));
        lector.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
        lector.readAsDataURL(archivo);
      }).then((dataUrl) => guardarCampo(id, "imagen", dataUrl).then(() => dataUrl));
    }

    return conTimeout(
      fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + ruta, {
        method: "POST",
        headers: cabeceras({ "Content-Type": archivo.type || "image/jpeg", "x-upsert": "true" }),
        body: archivo
      }).then((r) => {
        if (!r.ok) {
          return r.text().then((t) => { throw new Error("HTTP " + r.status + " " + t); });
        }
        // El ?v= evita que el navegador siga mostrando la foto anterior
        // en caché cuando reemplazas la de un mismo perfume.
        return (
          SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + ruta +
          "?v=" + Date.now()
        );
      }),
      30000 // subir un archivo tarda más que leer una fila
    ).then((url) => guardarCampo(id, "imagen", url).then(() => url));
  }

  function quitarFoto(id) {
    const anterior = cache.imagenes[Number(id)];
    const limpiarFila = () => guardarCampo(id, "imagen", null);

    if (!configurada || typeof anterior !== "string" || anterior.indexOf("/storage/v1/") === -1) {
      return limpiarFila();
    }

    const ruta = anterior.split("/" + BUCKET + "/")[1];
    const rutaLimpia = ruta ? ruta.split("?")[0] : null;
    if (!rutaLimpia) return limpiarFila();

    // Borramos el archivo del bucket para no dejar basura ocupando espacio.
    // Si ese borrado falla no es grave: lo importante es soltar la
    // referencia en la tabla, así que limpiamos la fila igual.
    return conTimeout(
      fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + rutaLimpia, {
        method: "DELETE",
        headers: cabeceras()
      }),
      TIMEOUT_MS
    )
      .catch((e) => console.warn("No se pudo borrar el archivo del bucket:", e))
      .then(limpiarFila);
  }

  /* ============ MIGRACIÓN DESDE LOCALSTORAGE ============ */
  // Cuenta cuántos cambios hay guardados solo en este navegador y que
  // todavía no existen en la nube, para poder ofrecer subirlos.

  function pendientesDeMigrar() {
    // Sin permiso de escritura no tiene sentido ofrecer subir nada: el
    // botón fallaría igual y solo añadiría ruido a la pantalla.
    if (!configurada || !sesionDeEscrituraActiva()) {
      return { total: 0, precios: 0, activos: 0, imagenes: 0 };
    }
    const local = leerTodoLS();
    let precios = 0, activos = 0, imagenes = 0;

    Object.keys(local.ventas).forEach((id) => {
      if (cache.ventas[Number(id)] === undefined) precios++;
    });
    Object.keys(local.activos).forEach((id) => {
      if (cache.activos[Number(id)] === undefined) activos++;
    });
    Object.keys(local.imagenes).forEach((id) => {
      if (cache.imagenes[Number(id)] === undefined) imagenes++;
    });

    return { total: precios + activos + imagenes, precios, activos, imagenes };
  }

  // Sube a la nube lo que solo existe en este navegador. Nunca pisa un
  // valor que ya esté en la base de datos: la nube siempre manda.
  function migrarDesdeLocalStorage() {
    if (!configurada) return Promise.resolve({ total: 0 });

    const local = leerTodoLS();
    const idsTocados = new Set();

    Object.keys(local.ventas).forEach((id) => {
      const n = Number(id);
      if (cache.ventas[n] === undefined) { cache.ventas[n] = local.ventas[id]; idsTocados.add(n); }
    });
    Object.keys(local.activos).forEach((id) => {
      const n = Number(id);
      if (cache.activos[n] === undefined) { cache.activos[n] = local.activos[id]; idsTocados.add(n); }
    });
    // Las fotos guardadas como base64 (data:) no se pueden mandar tal cual:
    // hay que convertirlas en archivo y subirlas al bucket.
    const fotosBase64 = [];
    Object.keys(local.imagenes).forEach((id) => {
      const n = Number(id);
      if (cache.imagenes[n] !== undefined) return;
      const valor = local.imagenes[id];
      if (typeof valor !== "string" || valor === "") return;
      if (valor.indexOf("data:") === 0) {
        fotosBase64.push({ id: n, dataUrl: valor });
      } else {
        cache.imagenes[n] = valor;
        idsTocados.add(n);
      }
    });

    const filas = Array.from(idsTocados).map((id) => filaCompleta(id));

    return enviarFilas(filas)
      .then(() => {
        // Las fotos se suben de una en una para no saturar la conexión.
        return fotosBase64.reduce(
          (cadena, foto) =>
            cadena.then(() =>
              fetch(foto.dataUrl)
                .then((r) => r.blob())
                .then((blob) => subirFoto(foto.id, blob))
                .catch((e) => console.warn("No se pudo migrar la foto " + foto.id + ":", e))
            ),
          Promise.resolve()
        );
      })
      .then(() => ({ total: filas.length + fotosBase64.length }));
  }

  /* ============ API PÚBLICA ============ */
  return {
    estaConfigurada: () => configurada,
    cargarOverrides: cargarOverrides,
    overrides: overrides,
    estaCargado: estaCargado,
    iniciarSesion: iniciarSesion,
    sesionDeEscrituraActiva: sesionDeEscrituraActiva,
    verificarEsquema: verificarEsquema,
    guardarCampo: guardarCampo,
    guardarVentasEnLote: guardarVentasEnLote,
    ventaIgualACosto: ventaIgualACosto,
    subirFoto: subirFoto,
    quitarFoto: quitarFoto,
    pendientesDeMigrar: pendientesDeMigrar,
    migrarDesdeLocalStorage: migrarDesdeLocalStorage
  };
})();
