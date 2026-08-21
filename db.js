/* ============================================================
   BUSCADOR DE PERFUMES PRO — db.js
   Capa de acceso a la base de datos externa (Supabase).

   Guarda y lee los 3 overrides que antes vivían en localStorage:
     · precio editado      -> columna precio_usd
     · activo/desactivado  -> columna activo
     · foto real subida    -> columna imagen_url (el archivo va a Storage)

   Este archivo NO toca data.js: el array PERFUMES sigue siendo la
   fuente de verdad del catálogo y se sigue actualizando por Git.
   Aquí solo viven las diferencias respecto a esos valores originales.

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
  const SUPABASE_URL = "";
  const SUPABASE_KEY = "";

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
    precios: "perfumesPro_preciosOverride",
    imagenes: "perfumesPro_imagenesOverride",
    activos: "perfumesPro_activosOverride"
  };

  const configurada = SUPABASE_URL !== "" && SUPABASE_KEY !== "";

  /* ============ CACHÉ EN MEMORIA ============ */
  // El test público lee estos overrides muchas veces (al calcular el Top 4,
  // en cada casilla del Set Ocasión...). Consultar la red cada vez lo haría
  // lento, así que descargamos UNA sola vez y servimos desde memoria.

  let cache = { precios: {}, imagenes: {}, activos: {} };
  let cargado = false;
  let promesaEnCurso = null;

  function cacheVacia() {
    return { precios: {}, imagenes: {}, activos: {} };
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
    const h = Object.assign(
      {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + (tokenGuardado() || SUPABASE_KEY)
      },
      extra || {}
    );
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
    return {
      precios: leerLS(LS.precios),
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
    escribirLS(LS.precios, datos.precios);
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
      if (fila.precio_usd !== null && fila.precio_usd !== undefined) {
        datos.precios[id] = Number(fila.precio_usd);
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

    const url =
      SUPABASE_URL + "/rest/v1/" + TABLA + "?select=id,precio_usd,activo,imagen_url";

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

  function iniciarSesion(password) {
    if (!configurada) return Promise.resolve(false);

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
          return true;
        }
        return false;
      })
      .catch((e) => {
        console.warn("No se pudo iniciar sesión de escritura:", e);
        return false;
      });
  }

  function sesionDeEscrituraActiva() {
    return tokenGuardado() !== null;
  }

  /* ============ ESCRITURA ============ */

  // Manda SIEMPRE la fila completa (precio + activo + imagen) para que
  // no haya ambigüedad: guardar un precio nuevo nunca puede borrar por
  // accidente la foto que ya estaba guardada.
  function filaCompleta(id) {
    const idNum = Number(id);
    const precio = cache.precios[idNum];
    const activo = cache.activos[idNum];
    const imagen = cache.imagenes[idNum];
    return {
      id: idNum,
      precio_usd: typeof precio === "number" ? precio : null,
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
  // al instante) y después manda el cambio a la nube. Si el envío falla,
  // quien llama recibe el error y puede avisar en pantalla.
  function guardarCampo(id, campo, valor) {
    const idNum = Number(id);
    const mapa = { precio: "precios", activo: "activos", imagen: "imagenes" };
    const destino = mapa[campo];
    if (!destino) return Promise.reject(new Error("Campo desconocido: " + campo));

    if (valor === null || valor === undefined || valor === "") {
      delete cache[destino][idNum];
    } else {
      cache[destino][idNum] = valor;
    }

    guardarTodoLS(cache); // respaldo local, por si la red falla
    return enviarFilas([filaCompleta(idNum)]);
  }

  // Para el ajuste global por porcentaje: un solo viaje a la red con
  // las 143 filas, en vez de 143 peticiones sueltas.
  function guardarPreciosEnLote(mapaPrecios) {
    Object.keys(mapaPrecios).forEach((id) => {
      cache.precios[Number(id)] = mapaPrecios[id];
    });
    guardarTodoLS(cache);
    const filas = Object.keys(mapaPrecios).map((id) => filaCompleta(id));
    return enviarFilas(filas);
  }

  // Restablecer precios: deja imagen y activo intactos, solo borra precio.
  function restablecerPrecios() {
    const ids = Object.keys(cache.precios).map(Number);
    cache.precios = {};
    guardarTodoLS(cache);
    if (ids.length === 0) return Promise.resolve(true);
    return enviarFilas(ids.map((id) => filaCompleta(id)));
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
    if (!configurada) return { total: 0, precios: 0, activos: 0, imagenes: 0 };
    const local = leerTodoLS();
    let precios = 0, activos = 0, imagenes = 0;

    Object.keys(local.precios).forEach((id) => {
      if (cache.precios[Number(id)] === undefined) precios++;
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

    Object.keys(local.precios).forEach((id) => {
      const n = Number(id);
      if (cache.precios[n] === undefined) { cache.precios[n] = local.precios[id]; idsTocados.add(n); }
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
    guardarCampo: guardarCampo,
    guardarPreciosEnLote: guardarPreciosEnLote,
    restablecerPrecios: restablecerPrecios,
    subirFoto: subirFoto,
    quitarFoto: quitarFoto,
    pendientesDeMigrar: pendientesDeMigrar,
    migrarDesdeLocalStorage: migrarDesdeLocalStorage
  };
})();
