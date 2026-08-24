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

  // Los cortes de presupuesto (hasta cuánto es "Económico", hasta cuánto
  // "Medio") se guardan en una fila reservada de la misma tabla, con id 0.
  // No existe ninguna fragancia con id 0, así que no choca con nada, y
  // evita tener que crear una tabla aparte solo para dos números.
  const ID_CONFIGURACION = 0;

  // Tabla de parámetros del cálculo de precios. Vive aparte porque no son
  // datos de una fragancia sino del negocio entero.
  const TABLA_CONFIG = "configuracion";

  // Valores por defecto si la tabla todavía no existe o está vacía. Están
  // aquí y no repartidos por el código para poder verlos todos juntos.
  const CONFIG_DEFECTO = {
    trm: 4000,                 // pesos por dólar
    factor_importacion: 1.2,   // flete + aduana + comisiones
    multiplicador_decant: 3,   // recupera el frasco en ~7 de 18 decants
    costo_vial_cop: 3000,      // atomizador + etiqueta + tiempo
    merma: 0.08,               // se pierde al trasvasar
    margen_botella: 0.4,       // sobre el costo real puesto en Colombia
    descuento_set: 0.1,        // por llevar los tres decants
    minimo_decant_cop: 15000,  // piso comercial
    ml_decant: 5               // tamaño del decant
  };
  const BUCKET = "fotos-perfumes";
  const TIMEOUT_MS = 6000; // si la BD no responde, seguimos sin ella
  const CLAVE_TOKEN = "perfumesPro_tokenEscritura";
  // Supabase caduca el token de escritura al cabo de una hora. Guardamos
  // también el de refresco para poder renovarlo sin volver a pedir la
  // contraseña: si no, a mitad de trabajo el panel empieza a rechazar todo
  // sin explicación, porque el recuadro verde de "conectado" se pintó al
  // entrar y ya no vuelve a comprobarse.
  const CLAVE_REFRESCO = "perfumesPro_refrescoEscritura";
  // La define auth-catalogo.js. Aquí se limpia cuando la sesión muere, para
  // que recargar vuelva a pedir la contraseña. Sin eso, recargar te devuelve
  // al panel "desbloqueado" pero sin permiso de escritura: todo falla igual
  // y no hay forma de arreglarlo desde la pantalla.
  const CLAVE_DESBLOQUEADO = "perfumesPro_catalogoDesbloqueado";

  // Claves de localStorage originales. Se mantienen como respaldo para
  // que el sitio funcione si la BD no está configurada todavía, y para
  // poder migrar a la nube lo que ya tengas guardado en este navegador.
  const LS = {
    costos: "perfumesPro_costos",
    ventas: "perfumesPro_ventas",
    imagenes: "perfumesPro_imagenesOverride",
    activos: "perfumesPro_activosOverride",
    volumenes: "perfumesPro_volumenes",
    verificados: "perfumesPro_verificados",
    decants: "perfumesPro_decants",
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
  let config = Object.assign({}, CONFIG_DEFECTO);
  // Distingue "la base de datos respondió y no hay precios" de "no pudimos
  // leer la base de datos". Sin esa distinción, una caída de Supabase
  // dejaría el test sin ninguna fragancia que ofrecer.
  let cargaFallida = false;
  let cargado = false;
  let promesaEnCurso = null;

  function cacheVacia() {
    return { costos: {}, ventas: {}, imagenes: {}, activos: {}, volumenes: {}, verificados: {}, decants: {}, rangos: null };
  }

  // Qué columnas tiene de verdad la tabla. Se aprende de la primera carga:
  // las filas que devuelve Supabase traen una llave por columna existente.
  //
  // Sirve para no mandar en cada guardado una columna que todavía no se ha
  // creado. Sin esto, añadir una columna nueva al código rompe TODAS las
  // escrituras (la base rechaza la fila entera con PGRST204) hasta que se
  // ejecute la carga SQL correspondiente.
  let columnasConocidas = null;

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

  // Para consultas que solo leen. La lectura es pública, así que no hace
  // falta el token — y mandarlo sería contraproducente: uno vencido hace
  // que Supabase responda 401 a una consulta que habría funcionado sin él,
  // y quien la llama acaba culpando a la base de datos de algo que no pasa.
  function cabecerasPublicas() {
    return { apikey: SUPABASE_KEY };
  }

  /* ============ VIDA DE LA SESIÓN DE ESCRITURA ============ */

  function guardarTokens(data) {
    try {
      if (data && data.access_token) sessionStorage.setItem(CLAVE_TOKEN, data.access_token);
      if (data && data.refresh_token) sessionStorage.setItem(CLAVE_REFRESCO, data.refresh_token);
    } catch (e) { /* sesión sin storage: seguimos sin persistir */ }
  }

  // Se llama cuando la base rechaza una escritura por permiso y el refresco
  // tampoco funciona. Borra las tres llaves a la vez: dejar el "desbloqueado"
  // sin el token es justo el estado que deja el panel abierto pero inútil.
  function cerrarSesionDeEscritura() {
    try {
      sessionStorage.removeItem(CLAVE_TOKEN);
      sessionStorage.removeItem(CLAVE_REFRESCO);
      sessionStorage.removeItem(CLAVE_DESBLOQUEADO);
    } catch (e) { /* nada que limpiar */ }
    if (typeof window !== "undefined" && typeof window.PerfumesPanelEstado === "function") {
      window.PerfumesPanelEstado({ ok: false, motivo: "sesion-vencida" });
    }
  }

  // Renueva el token con el de refresco. Devuelve true si lo consiguió.
  function refrescarSesion() {
    if (!configurada) return Promise.resolve(false);
    let refresco = null;
    try {
      refresco = sessionStorage.getItem(CLAVE_REFRESCO);
    } catch (e) { /* sin storage no hay nada que refrescar */ }
    if (!refresco) return Promise.resolve(false);

    return conTimeout(
      fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresco })
      }).then((r) => r.json()),
      TIMEOUT_MS
    )
      .then((data) => {
        if (data && data.access_token) {
          guardarTokens(data);
          return true;
        }
        return false;
      })
      .catch(() => false);
  }

  // Envoltorio de toda escritura: si la base la rechaza por permiso, renueva
  // la sesión y la repite UNA vez. Solo si eso falla se da la sesión por
  // muerta. Así una hora de trabajo no se pierde por un token caducado.
  function conSesionViva(hacerPeticion) {
    return hacerPeticion().then((r) => {
      if (r.status !== 401 && r.status !== 403) return r;
      return refrescarSesion().then((renovada) => {
        if (!renovada) {
          cerrarSesionDeEscritura();
          return r;
        }
        return hacerPeticion().then((r2) => {
          // Renovamos y aun así nos rechaza: no era el token, es que este
          // usuario no tiene permiso de escritura en la tabla.
          if (r2.status === 401 || r2.status === 403) cerrarSesionDeEscritura();
          return r2;
        });
      });
    });
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
    // Devolvemos la misma forma que cacheVacia(). Cuando faltaban las
    // llaves de volumen y verificado, cualquier acceso a ellas tras una
    // carga fallida lanzaba una excepción que rompía la pantalla entera.
    return Object.assign(cacheVacia(), {
      costos: leerLS(LS.costos),
      ventas: ventas,
      imagenes: leerLS(LS.imagenes),
      activos: leerLS(LS.activos),
      volumenes: leerLS(LS.volumenes),
      verificados: leerLS(LS.verificados),
      decants: leerLS(LS.decants)
    });
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
    escribirLS(LS.volumenes, datos.volumenes);
    escribirLS(LS.verificados, datos.verificados);
    escribirLS(LS.decants, datos.decants);
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

      // La fila reservada no es una fragancia: lleva los cortes de
      // presupuesto en las mismas dos columnas de precio.
      if (id === ID_CONFIGURACION) {
        const maxEco = Number(fila.costo_usd);
        const maxMedio = Number(fila.venta_usd);
        if (maxEco > 0 && maxMedio > maxEco) {
          datos.rangos = { maxEconomico: maxEco, maxMedio: maxMedio };
        }
        return;
      }
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
      if (fila.volumen_ml !== null && fila.volumen_ml !== undefined) {
        datos.volumenes[id] = Number(fila.volumen_ml);
      }
      // Marca de revisión: hasta que se apruebe, el panel muestra el
      // volumen y el precio como sugeridos, no como confirmados.
      datos.verificados[id] = fila.verificado === true;
      // Disponible en decants. Solo un false explícito lo desactiva: si la
      // columna todavía no existe, o la fila la trae vacía, la fragancia se
      // sigue ofreciendo en decant como hasta ahora.
      datos.decants[id] = fila.decant !== false;
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

    // Los parámetros de precio se piden a la vez que los overrides: son una
    // sola tabla diminuta y así el test no hace dos viajes seguidos.
    const urlConfig = SUPABASE_URL + "/rest/v1/" + TABLA_CONFIG + "?select=*";

    promesaEnCurso = conTimeout(
      Promise.all([
        fetch(url, { headers: cabeceras() }).then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }),
        // Si la tabla de configuración no existe todavía, seguimos con los
        // valores por defecto en vez de dejar el sitio sin precios.
        fetch(urlConfig, { headers: cabeceras() })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      ]),
      TIMEOUT_MS
    )
      .then((respuestas) => {
        const filas = respuestas[0];
        // Cualquier fila sirve para saber qué columnas existen: Supabase
        // devuelve una llave por columna, aunque venga vacía.
        if (Array.isArray(filas) && filas.length > 0 && filas[0]) {
          columnasConocidas = Object.keys(filas[0]);
        }
        cache = filasAMapas(Array.isArray(filas) ? filas : []);
        config = Object.assign({}, CONFIG_DEFECTO);
        (Array.isArray(respuestas[1]) ? respuestas[1] : []).forEach((fila) => {
          if (fila && fila.clave !== undefined && fila.valor !== null) {
            config[fila.clave] = Number(fila.valor);
          }
        });
        cargado = true;
        cargaFallida = false;
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
        cargaFallida = true;
        promesaEnCurso = null;
        return cache;
      });

    return promesaEnCurso;
  }

  // Cortes de presupuesto vigentes. Si nunca se han configurado desde el
  // panel, se usan los que trae RANGOS_PRECIO en data.js.
  function rangos() {
    if (cache.rangos) return cache.rangos;
    if (typeof RANGOS_PRECIO !== "undefined") {
      return {
        maxEconomico: RANGOS_PRECIO["Económico"].max,
        maxMedio: RANGOS_PRECIO.Medio.max
      };
    }
    return { maxEconomico: 45, maxMedio: 110 };
  }

  function guardarRangos(maxEconomico, maxMedio) {
    const previos = cache.rangos;
    cache.rangos = { maxEconomico: maxEconomico, maxMedio: maxMedio };
    return enviarFilas([
      {
        id: ID_CONFIGURACION,
        costo_usd: maxEconomico,
        venta_usd: maxMedio,
        activo: null,
        imagen_url: null
      }
    ]).catch((e) => {
      cache.rangos = previos;
      throw e;
    });
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
          guardarTokens(data);
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

  /* ============ CÁLCULO DE PRECIOS ============ */
  // El costo se paga en dólares y la venta se hace en pesos, así que todo
  // pasa primero por el costo real puesto en Colombia:
  //
  //   COSTO_REAL_COP = costo_usd × factor_importación × TRM
  //
  // Sobre esa base:
  //   BOTELLA = COSTO_REAL_COP × (1 + margen_botella)
  //   DECANT  = (COSTO_REAL_COP ÷ volumen) × ml_decant × multiplicador + vial
  //
  // El multiplicador es, en la práctica, la velocidad de recuperación: con
  // 3 el frasco se paga con ~7 de los ~18 decants que salen de él, y esa
  // proporción se mantiene igual para un árabe de $30 que para un Creed de
  // $325, porque el cálculo parte del costo de cada uno.

  function parametros() {
    return config;
  }

  function guardarParametro(clave, valor) {
    const previo = config[clave];
    config[clave] = Number(valor);

    if (!configurada) return Promise.resolve(true);

    return conTimeout(
      conSesionViva(() => fetch(SUPABASE_URL + "/rest/v1/" + TABLA_CONFIG, {
        method: "POST",
        headers: cabeceras({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify([{ clave: clave, valor: Number(valor) }])
      })).then((r) => {
        if (!r.ok) {
          return r.text().then((t) => {
            throw new Error("HTTP " + r.status + " " + t);
          });
        }
        return true;
      }),
      TIMEOUT_MS
    ).catch((e) => {
      config[clave] = previo;
      throw e;
    });
  }

  // Estos accesores no deben lanzar nunca: se llaman desde el render del
  // test público, y una excepción aquí deja al visitante sin las opciones
  // de compra. Ante cualquier duda devuelven "no hay dato".
  function volumenDe(id) {
    const mapa = cache.volumenes || {};
    const v = mapa[Number(id)];
    return typeof v === "number" && v > 0 ? v : null;
  }

  function estaVerificado(id) {
    return (cache.verificados || {})[Number(id)] === true;
  }

  // Si una fragancia se ofrece en decant o solo en frasco completo. Ante la
  // duda (base sin cargar, columna sin crear) decimos que sí: es como
  // funcionaba el sitio antes de que existiera esta opción, y equivocarse
  // hacia "sí" solo cuesta una conversación por WhatsApp, mientras que
  // equivocarse hacia "no" esconde el producto más vendido.
  function hayDecant(id) {
    return (cache.decants || {})[Number(id)] !== false;
  }

  // Redondeo a miles: un precio de 58.734 no se cobra, se cobra 59.000.
  function redondearCOP(n) {
    return Math.round(n / 1000) * 1000;
  }

  // Devuelve null si falta el costo o el volumen: sin esos dos datos no hay
  // precio que calcular, y es preferible no mostrar nada a mostrar un número
  // inventado.
  // Precio de un decant del tamaño que sea. El vial y su trabajo se cobran
  // UNA vez, no por cada 5 ml: por eso un decant de 10 ml sale más barato
  // que dos de 5 ml, que es justo lo que lo hace atractivo cuando hay que
  // completar los 15 ml del Set con menos de tres fragancias.
  //
  // El piso comercial sí escala con el tamaño: si 5 ml no se venden por
  // menos de $15.000, 10 ml no pueden venderse por menos de $30.000.
  function precioDecantMl(id, ml) {
    const costoUsd = (cache.costos || {})[Number(id)];
    const volumen = volumenDe(id);
    const mililitros = Number(ml);
    if (typeof costoUsd !== "number" || volumen === null) return null;
    if (!(mililitros > 0)) return null;

    const c = config;
    const costoRealCop = costoUsd * c.factor_importacion * c.trm;
    const bruto = (costoRealCop / volumen) * mililitros * c.multiplicador_decant + c.costo_vial_cop;
    const piso = c.minimo_decant_cop * (mililitros / c.ml_decant);
    return Math.max(redondearCOP(piso), redondearCOP(bruto));
  }

  function preciosDe(id) {
    const costoUsd = (cache.costos || {})[Number(id)];
    const volumen = volumenDe(id);
    if (typeof costoUsd !== "number" || volumen === null) return null;

    const c = config;
    const costoRealCop = costoUsd * c.factor_importacion * c.trm;

    const decant = precioDecantMl(id, c.ml_decant);
    const botella = redondearCOP(costoRealCop * (1 + c.margen_botella));

    // Cuántos decants aprovechables salen del frasco, descontando la merma.
    const decantsUtiles = Math.floor((volumen * (1 - c.merma)) / c.ml_decant);
    const paraRecuperar = decant > 0 ? Math.ceil(costoRealCop / decant) : 0;

    return {
      costoRealCop: Math.round(costoRealCop),
      decantCop: decant,
      botellaCop: botella,
      volumenMl: volumen,
      decantsUtiles: decantsUtiles,
      decantsParaRecuperar: paraRecuperar,
      verificado: estaVerificado(id),
      hayDecant: hayDecant(id)
    };
  }

  // El Set son 15 ml repartidos entre fragancias distintas, así que su
  // precio se arma sumando cada decant y aplicando el descuento por
  // llevarlos juntos.
  //
  // Acepta ids sueltos (tres decants de 5 ml, el caso normal) o piezas
  // { id, ml } para cuando hay que completar los 15 ml con menos de tres
  // fragancias, porque no todas se ofrecen en decant.
  function precioSet(piezas) {
    let suma = 0;
    let completo = true;
    piezas.forEach((pieza) => {
      const esPieza = pieza && typeof pieza === "object";
      const id = esPieza ? pieza.id : pieza;
      const ml = esPieza && pieza.ml ? pieza.ml : config.ml_decant;
      const precio = precioDecantMl(id, ml);
      if (precio === null) { completo = false; return; }
      suma += precio;
    });
    if (!completo || suma === 0) return null;
    return {
      sinDescuento: redondearCOP(suma),
      total: redondearCOP(suma * (1 - config.descuento_set)),
      descuentoPct: Math.round(config.descuento_set * 100)
    };
  }

  function formatearCOP(n) {
    if (typeof n !== "number") return "";
    return "$" + Math.round(n).toLocaleString("es-CO");
  }

  /* ============ COMPROBACIÓN DEL ESQUEMA ============ */
  // Pregunta a la base de datos si ya existen las columnas del modelo de
  // dos precios. Sin ellas TODA escritura se rechaza con un error 400, y
  // desde el panel eso se vive como "el botón no hace nada": conviene
  // detectarlo al entrar y decirlo, en vez de fallar en cada intento.

  // Se comprueban los dos grupos de columnas por separado porque cada uno
  // viene de una carga distinta, y saber cuál falta es lo que permite decir
  // qué hay que ejecutar. Antes solo se miraba el primero: si faltaba el
  // segundo, el panel decía "conectado" y cada guardado de volumen se
  // revertía sin explicación.
  const GRUPOS_COLUMNAS = [
    { clave: "precios", columnas: "costo_usd,venta_usd" },
    { clave: "volumen", columnas: "volumen_ml,verificado" },
    { clave: "decant", columnas: "decant" }
  ];

  function verificarEsquema() {
    if (!configurada) return Promise.resolve({ ok: false, motivo: "sin-configurar" });

    // Sin token a propósito: preguntar qué columnas hay es una lectura, y la
    // lectura es pública. Con el token puesto, uno vencido devolvía 401 y el
    // panel lo leía como "faltan las columnas de costo y venta", mandando a
    // ejecutar un SQL que ya estaba ejecutado.
    const pruebas = GRUPOS_COLUMNAS.map((grupo) =>
      fetch(SUPABASE_URL + "/rest/v1/" + TABLA + "?select=" + grupo.columnas + "&limit=1", {
        headers: cabecerasPublicas()
      }).then((r) => (r.ok ? null : r.text().then((t) => ({ grupo: grupo.clave, detalle: t }))))
    );

    return conTimeout(Promise.all(pruebas), TIMEOUT_MS)
      .then((resultados) => {
        const faltan = resultados.filter(Boolean);
        if (faltan.length === 0) return { ok: true };
        return {
          ok: false,
          motivo: "faltan-columnas",
          grupos: faltan.map((f) => f.grupo),
          detalle: faltan[0].detalle
        };
      })
      .catch((e) => {
        console.warn("No se pudo verificar el esquema:", e);
        return { ok: false, motivo: "sin-red" };
      });
  }

  // Igual que con las columnas: si el bucket de fotos no existe, cada
  // subida falla con "Bucket not found" y desde el panel se vive como que
  // el botón de foto está roto. Lo comprobamos al entrar.
  //
  // Consultamos un archivo que no existe: si el bucket falta, Supabase
  // responde "Bucket not found"; si el bucket está, responde que el objeto
  // no existe, que es justo lo que queremos comprobar.
  function verificarBucket() {
    if (!configurada) return Promise.resolve({ ok: false, motivo: "sin-configurar" });

    // Preguntamos por el bucket en sí, no por un archivo. Así distinguimos
    // tres situaciones que dan síntomas parecidos pero se arreglan distinto:
    // que no exista, que exista pero no sea público (se sube la foto y los
    // visitantes no la ven), y que falten los permisos de escritura.
    return conTimeout(
      fetch(SUPABASE_URL + "/storage/v1/bucket/" + BUCKET, { headers: cabeceras() }).then((r) => {
        if (r.ok) {
          return r.json().then((info) => {
            if (info && info.public === false) {
              return { ok: false, motivo: "bucket-privado" };
            }
            return { ok: true };
          });
        }
        if (r.status === 404) return { ok: false, motivo: "sin-bucket" };
        // 401/403: el bucket puede existir, pero no podemos consultarlo.
        // Caemos a la comprobación por URL pública, que no necesita permiso.
        return fetch(
          SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/__comprobacion__",
          { headers: { apikey: SUPABASE_KEY } }
        ).then((r2) => {
          if (r2.ok) return { ok: true };
          return r2.text().then((t) => {
            const texto = String(t || "").toLowerCase();
            if (texto.indexOf("bucket not found") !== -1 || texto.indexOf("nosuchbucket") !== -1) {
              return { ok: false, motivo: "sin-bucket", detalle: t };
            }
            // "Object not found" significa que el bucket sí está.
            return { ok: true };
          });
        });
      }),
      TIMEOUT_MS
    ).catch((e) => {
      console.warn("No se pudo verificar el bucket:", e);
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
    const fila = {
      id: idNum,
      costo_usd: typeof costo === "number" ? costo : null,
      venta_usd: typeof venta === "number" ? venta : null,
      volumen_ml: typeof cache.volumenes[idNum] === "number" ? cache.volumenes[idNum] : null,
      verificado: cache.verificados[idNum] === true,
      decant: cache.decants[idNum] !== false,
      activo: typeof activo === "boolean" ? activo : null,
      imagen_url: typeof imagen === "string" && imagen !== "" ? imagen : null
    };

    // Quitamos las columnas que la tabla todavía no tiene. Mandarlas haría
    // que la base rechazara la fila entera, así que el guardado de un precio
    // fallaría por culpa de una columna que no tiene nada que ver con él.
    if (columnasConocidas) {
      Object.keys(fila).forEach((columna) => {
        if (columna !== "id" && columnasConocidas.indexOf(columna) === -1) {
          delete fila[columna];
        }
      });
    }
    return fila;
  }

  function enviarFilas(filas) {
    if (filas.length === 0) return Promise.resolve(true);

    if (!configurada) {
      guardarTodoLS(cache);
      return Promise.resolve(true);
    }

    return conTimeout(
      conSesionViva(() => fetch(SUPABASE_URL + "/rest/v1/" + TABLA, {
        method: "POST",
        headers: cabeceras({
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify(filas)
      })).then((r) => {
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
    const mapa = {
      costo: "costos", venta: "ventas", activo: "activos",
      imagen: "imagenes", volumen: "volumenes", verificado: "verificados",
      decant: "decants"
    };
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
      conSesionViva(() => fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + ruta, {
        method: "POST",
        headers: cabeceras({ "Content-Type": archivo.type || "image/jpeg", "x-upsert": "true" }),
        body: archivo
      })).then((r) => {
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
      conSesionViva(() => fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + rutaLimpia, {
        method: "DELETE",
        headers: cabeceras()
      })),
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
    cerrarSesionDeEscritura: cerrarSesionDeEscritura,
    verificarEsquema: verificarEsquema,
    verificarBucket: verificarBucket,
    rangos: rangos,
    guardarRangos: guardarRangos,
    parametros: parametros,
    guardarParametro: guardarParametro,
    preciosDe: preciosDe,
    precioSet: precioSet,
    precioDecantMl: precioDecantMl,
    volumenDe: volumenDe,
    estaVerificado: estaVerificado,
    hayDecant: hayDecant,
    huboFalloDeCarga: function () { return cargaFallida; },
    formatearCOP: formatearCOP,
    guardarCampo: guardarCampo,
    guardarVentasEnLote: guardarVentasEnLote,
    ventaIgualACosto: ventaIgualACosto,
    subirFoto: subirFoto,
    quitarFoto: quitarFoto,
    pendientesDeMigrar: pendientesDeMigrar,
    migrarDesdeLocalStorage: migrarDesdeLocalStorage
  };
})();
