/* ============================================================
   BUSCADOR DE PERFUMES PRO — app.js
   Navegación, ramificación dinámica y motor de Match %
   ============================================================ */

(function () {
  "use strict";

  /* ============ CONTACTO POR WHATSAPP ============ */
  // ⚠️ IMPORTANTE: reemplazar por el número real con código de país, sin
  // espacios ni símbolos (ej: "573001234567" para Colombia). Mientras este
  // placeholder siga aquí, los botones de contacto no funcionarán bien.
  const WHATSAPP_NUMERO = "573150124948";

  function generarLinkWhatsApp(mensaje) {
    const texto = encodeURIComponent(mensaje);
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${texto}`;
  }

  /* ============ DEFINICIÓN DEL FLUJO DE PREGUNTAS ============ */
  // Cada pregunta tiene una "clave" (campo de respuesta) y opciones.
  // La pregunta 2 tiene subpreguntas condicionadas por su respuesta.

  const PREGUNTA_1 = {
    clave: "tipo",
    numero: "1 de 7",
    titulo: "¿Para quién o qué estilo buscas?",
    opciones: [
      { valor: "Cualquiera", emoji: "🎲", titulo: "Me da igual la marca", desc: "Solo quiero oler brutal" },
      { valor: "Diseñador", emoji: "👑", titulo: "De marca famosa / Diseñador", desc: "Versace, Dior, CH, Chanel" },
      { valor: "Árabe", emoji: "🕌", titulo: "Árabes", desc: "Duraderos y económicos: Lattafa, Armaf, Afnan, Rasasi" },
      { valor: "Lujo", emoji: "💎", titulo: "Lujo / Exclusivos", desc: "Creed, Tom Ford, Parfums de Marly, Xerjoff" }
    ]
  };

  const PREGUNTA_2 = {
    clave: "aromaPrincipal",
    numero: "2 de 7",
    titulo: "¿A qué quieres oler principalmente?",
    opciones: [
      { valor: "Fresco", emoji: "🌊", titulo: "Acuático / Marino / Verde", desc: "" },
      { valor: "Cítrico", emoji: "🍋", titulo: "Cítrico / Chispeante", desc: "" },
      { valor: "Dulce / Gourmand", emoji: "🍦", titulo: "Dulce / Comestible / Postre", desc: "" },
      { valor: "Cálido / Especiado", emoji: "🍯", titulo: "Canela / Especias / Ámbar", desc: "" },
      { valor: "Madera", emoji: "🌲", titulo: "Maderas / Resinas / Especiada fuerte", desc: "" },
      { valor: "Cuero / Tabaco", emoji: "🚬", titulo: "Cuero / Tabaco / Ahumado", desc: "" },
      { valor: "Limpio y Suave", emoji: "🧼", titulo: "Jabón fino / Iris / Talco", desc: "" }
    ]
  };

  // Subpreguntas 2.5 — la clave siempre es "subAroma"
  const SUBPREGUNTAS = {
    Fresco: {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese frescor \u2192",
      opciones: [
        { valor: "Marina / Salada", emoji: "🏖️", titulo: "Marina / Salada", desc: "Notas marinas, sal de mar, brisa oceánica y algas" },
        { valor: "Menta / Té / Verde", emoji: "🌿", titulo: "Menta / Té / Verde", desc: "Menta helada, té verde, menta piperita y albahaca fresca" }
      ]
    },
    "Cítrico": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese cítrico \u2192",
      opciones: [
        { valor: "Cítrico puro", emoji: "🍋", titulo: "Cítrico puro", desc: "Bergamota de Calabria, limón italiano, mandarina y pomelo" },
        { valor: "Cítrico verde / aromático", emoji: "🌿", titulo: "Cítrico verde / aromático", desc: "Cítrico combinado con menta, salvia, romero o lavanda" }
      ]
    },
    "Dulce / Gourmand": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese dulzor \u2192",
      opciones: [
        { valor: "Vainilla / Caramelo", emoji: "🍨", titulo: "Vainilla / Caramelo", desc: "Vainilla bourbon, caramelo, haba tonka, praliné y chocolate" },
        { valor: "Frutal jugoso", emoji: "🍏", titulo: "Frutal jugoso", desc: "Manzana verde, mango, sandía, ciruela y toques acaramelados" }
      ]
    },
    "Cálido / Especiado": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese calor especiado \u2192",
      opciones: [
        { valor: "Miel / Canela", emoji: "🍯", titulo: "Miel / Canela", desc: "Canela de Ceilán, miel, licor de coñac, nuez moscada y cardamomo" },
        { valor: "Ámbar / Pimienta", emoji: "🌶️", titulo: "Ámbar / Pimienta", desc: "Ámbar cálido, pimienta negra, clavo de olor y azafrán" }
      ]
    },
    Madera: {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre esa madera \u2192",
      opciones: [
        { valor: "Madera suave / Cedro", emoji: "🪵", titulo: "Madera suave / Cedro", desc: "Cedro de Virginia, sándalo cremoso, vetiver y madera de guayaco" },
        { valor: "Oud exótico", emoji: "🔥", titulo: "Madera especiada fuerte", desc: "Madera intensa y ahumada, con incienso, mirra y resinas orientales" }
      ]
    },
    "Cuero / Tabaco": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese cuero/tabaco \u2192",
      opciones: [
        { valor: "Cuero elegante", emoji: "🧥", titulo: "Cuero elegante", desc: "Cuero toscano, gamuza suave, abedul y notas florales oscuras" },
        { valor: "Tabaco dulce", emoji: "🍂", titulo: "Tabaco dulce", desc: "Hoja de tabaco rubio, vainilla ahumada y tonka" }
      ]
    },
    "Limpio y Suave": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese aroma limpio \u2192",
      opciones: [
        { valor: "Jabón fino", emoji: "🧼", titulo: "Jabón fino", desc: "Lavanda, neroli, flor de azahar y musgo blanco" },
        { valor: "Iris elegante", emoji: "💄", titulo: "Iris elegante", desc: "Iris italiano suave, violeta, cacao y cuero delicado" }
      ]
    }
  };

  // Subpreguntas 2.6 — solo existen para algunas subfamilias (las más
  // grandes del catálogo). La clave siempre es "notaEspecifica".
  // Se indexan por el valor de subAroma elegido en el paso 2.5.
  const SUBSUBPREGUNTAS = {
    // ===== MADERA =====
    "Madera suave / Cedro": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre esa madera \u2192",
      opciones: [
        { valor: "cedro-citrico", emoji: "🍍", titulo: "Cítrico-amaderado", desc: "Con piña o bergamota en la apertura" },
        { valor: "cedro-seco", emoji: "🌲", titulo: "Amaderado seco puro", desc: "Sin cítrico dominante, más clásico" }
      ]
    },
    "Oud exótico": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre esa madera \u2192",
      opciones: [
        { valor: "fuerte-dulce", emoji: "🍯", titulo: "Con dulzura", desc: "Vainilla, praliné o ámbar suavizan la madera" },
        { valor: "fuerte-resinoso", emoji: "🔥", titulo: "Puro y resinoso", desc: "Incienso y resinas, más intenso y seco" }
      ]
    },
    // ===== DULCE / GOURMAND =====
    "Frutal jugoso": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese dulzor \u2192",
      opciones: [
        { valor: "frutal-tropical", emoji: "🍍", titulo: "Piña / tropical", desc: "Piña, mango y frutas tropicales dulces" },
        { valor: "frutal-citrico", emoji: "🍏", titulo: "Manzana / cítrico dulce", desc: "Manzana, cítricos y toques acaramelados" }
      ]
    },
    "Vainilla / Caramelo": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese dulzor \u2192",
      opciones: [
        { valor: "vainilla-especiada", emoji: "🌶️", titulo: "Vainilla con especias", desc: "Canela, cacao o cardamomo junto a la vainilla" },
        { valor: "vainilla-pura", emoji: "🍦", titulo: "Vainilla pura / almizclada", desc: "Vainilla suave, sin especias marcadas" }
      ]
    },
    // ===== CÁLIDO / ESPECIADO =====
    "Miel / Canela": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese calor \u2192",
      opciones: [
        { valor: "cafe-datiles", emoji: "☕", titulo: "Café / dátiles", desc: "Perfil árabe, con café o dátiles" },
        { valor: "canela-clasica", emoji: "🍂", titulo: "Canela clásica", desc: "Canela como protagonista, sin café" }
      ]
    },
    "Ámbar / Pimienta": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese calor \u2192",
      opciones: [
        { valor: "especiado-fresco", emoji: "🍊", titulo: "Especiado fresco", desc: "Con toronja o bergamota en la apertura" },
        { valor: "especiado-intenso", emoji: "🌶️", titulo: "Especiado intenso", desc: "Más denso y envolvente" }
      ]
    },
    // ===== FRESCO =====
    "Marina / Salada": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese frescor \u2192",
      opciones: [
        { valor: "marino-suave", emoji: "🌤️", titulo: "Marino suave", desc: "Ligero, ideal para uso diario" },
        { valor: "marino-intenso", emoji: "🌊", titulo: "Marino intenso", desc: "Más potente y envolvente" }
      ]
    },
    "Menta / Té / Verde": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese frescor \u2192",
      opciones: [
        { valor: "menta-dominante", emoji: "🌿", titulo: "Menta dominante", desc: "Menta helada muy presente" },
        { valor: "citrico-verde-suave", emoji: "🍋", titulo: "Cítrico verde suave", desc: "Verde y cítrico, sin tanta menta" }
      ]
    },
    // ===== CÍTRICO =====
    "Cítrico puro": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese cítrico \u2192",
      opciones: [
        { valor: "citrico-simple", emoji: "🍋", titulo: "Cítrico fresco simple", desc: "Directo, poca complejidad de fondo" },
        { valor: "citrico-flor-madera", emoji: "🌸", titulo: "Cítrico con flor y madera", desc: "Con más cuerpo floral o amaderado" }
      ]
    },
    // ===== CUERO / TABACO =====
    "Cuero elegante": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese cuero \u2192",
      opciones: [
        { valor: "cuero-fresco", emoji: "🍊", titulo: "Cuero fresco/cítrico", desc: "Con toques cítricos en la apertura" },
        { valor: "cuero-calido", emoji: "🔥", titulo: "Cuero cálido/especiado", desc: "Más denso, con especias o ámbar" }
      ]
    },
    "Tabaco dulce": {
      numero: "2.6 de 9",
      titulo: "Ya casi, una última precisión sobre ese tabaco \u2192",
      opciones: [
        { valor: "tabaco-cacao", emoji: "🍫", titulo: "Tabaco con cacao", desc: "Tabaco junto a cacao o chocolate" },
        { valor: "tabaco-miel", emoji: "🍯", titulo: "Tabaco con miel", desc: "Tabaco junto a miel o especias dulces" }
      ]
    }
  };

  const PREGUNTA_3 = {
    clave: "momento",
    numero: "3 de 7",
    titulo: "¿En qué momento lo vas a usar más?",
    opciones: [
      { valor: "Diario", emoji: "☀️", titulo: "Todos los días / Colegio / Trabajo", desc: "Versátil, fresco, firma personal" },
      { valor: "Citas", emoji: "🌙", titulo: "Salir de noche / Citas", desc: "Seductor, magnético, cercano" },
      { valor: "Fiesta", emoji: "🕺", titulo: "Fiesta / Discoteca", desc: "Proyección potente para llamar la atención a metros" },
      { valor: "Deporte", emoji: "🏋️", titulo: "Deporte / Días de intenso calor", desc: "Energizante, no atosiga" }
    ]
  };

  const PREGUNTA_4 = {
    clave: "clima",
    numero: "4 de 7",
    titulo: "¿Cómo es el clima donde vives o donde lo vas a usar?",
    opciones: [
      { valor: "Frío / Noche", emoji: "❄️", titulo: "Frío / Clima nocturno", desc: "Soporta aromas dulces, pesados y densos" },
      { valor: "Caliente / Sol", emoji: "☀️", titulo: "Caliente / Soleado", desc: "Requiere fragancias volátiles y muy frescas" },
      { valor: "Templado", emoji: "⛅", titulo: "Templado / Primavera", desc: "Aroma equilibrado para usar todo el año" }
    ]
  };

  const PREGUNTA_5 = {
    clave: "estilo",
    numero: "5 de 7",
    titulo: "¿Qué vibración o edad buscas transmitir?",
    opciones: [
      { valor: "Joven", emoji: "🧢", titulo: "Juvenil / Moderno", desc: "Llamativo, dulzón, divertido" },
      { valor: "Formal", emoji: "👔", titulo: "Maduro / Formal", desc: "Elegante, serio, masculino e imponente" },
      { valor: "Versátil", emoji: "⚡", titulo: "Sin edad / Todoterreno", desc: "Se adapta a cualquier perfil" }
    ]
  };

  const PREGUNTA_6 = {
    clave: "potencia",
    numero: "6 de 7",
    titulo: "¿Cuánto quieres que dure y se sienta (Estela / Proyección)?",
    opciones: [
      { valor: "Modo Bestia", emoji: "💥", titulo: "Modo Bestia", desc: "+12 horas, proyección gigante e invasiva" },
      { valor: "Normal", emoji: "⚖️", titulo: "Equilibrado", desc: "1 a 2 metros de ráfaga aromática" },
      { valor: "Suave", emoji: "🤫", titulo: "Íntimo", desc: "Aroma a flor de piel, solo para distancias cortas" }
    ]
  };

  const PREGUNTA_7 = {
    clave: "presupuesto",
    numero: "7 de 7",
    titulo: "¿Cuál es tu presupuesto aproximado?",
    opciones: [
      { valor: "Económico", emoji: "🟢", titulo: "Económico / Árabe baratísimo", desc: "$20 - $40 USD" },
      { valor: "Medio", emoji: "🟡", titulo: "Término medio / Diseñador estándar", desc: "$50 - $120 USD" },
      { valor: "Sin límite", emoji: "🔴", titulo: "Sin límite / Alta perfumería", desc: "$150+ USD" }
    ]
  };

  /* ============ ESTADO GLOBAL DE LA APP ============ */
  // El "camino" (path) de pasos se construye dinámicamente porque el paso 2.5
  // depende de la respuesta de la pregunta 2.
  const estado = {
    pasoActual: 0,          // índice dentro de `camino`
    camino: [PREGUNTA_1, PREGUNTA_2], // se completa dinámicamente
    respuestas: {}          // { tipo, aromaPrincipal, subAroma, momento, clima, estilo, potencia, presupuesto }
  };

  /* ============ OVERRIDES DEL CATÁLOGO (BASE DE DATOS) ============ */
  // El catálogo (catalogo.html) permite ajustar precios, subir fotos reales
  // y desactivar fragancias. Antes esos cambios vivían en el localStorage
  // del navegador del administrador, así que los visitantes nunca los veían.
  // Ahora viven en la base de datos y db.js los descarga UNA sola vez al
  // cargar la página, dejándolos en memoria.
  //
  // Por eso estas tres funciones siguen siendo síncronas y baratas: leen de
  // esa copia en memoria, no de la red. Se llaman muchas veces (en el motor
  // de Match y en cada casilla del Set Ocasión) y no cuestan nada.

  function overridesEnMemoria() {
    if (typeof PerfumesDB === "undefined") return { precios: {}, imagenes: {}, activos: {} };
    return PerfumesDB.overrides();
  }

  function leerOverridesPrecio() {
    return overridesEnMemoria().precios;
  }

  function precioVigente(perfume, overrides) {
    const guardado = overrides[perfume.id];
    return typeof guardado === "number" && !Number.isNaN(guardado)
      ? guardado
      : perfume.precioUSD;
  }

  function categoriaParaPrecio(precio) {
    if (precio <= RANGOS_PRECIO.Económico.max) return "Económico";
    if (precio <= RANGOS_PRECIO.Medio.max) return "Medio";
    return "Sin límite";
  }

  // Si en catalogo.html se subió una foto real para un perfume, usamos su
  // URL en vez de la imagen que trae data.js por defecto. La foto vive en
  // Storage: aquí solo viaja el texto de la URL, así que esto no hace la
  // descarga inicial más pesada.
  function leerOverridesImagen() {
    return overridesEnMemoria().imagenes;
  }

  function imagenVigente(perfume, overridesImg) {
    const guardada = overridesImg[perfume.id];
    return typeof guardada === "string" && guardada.trim() !== ""
      ? guardada
      : perfume.imagen;
  }

  // En catalogo.html se puede desactivar un perfume para que nunca salga
  // como resultado del test, sin borrarlo del catálogo. Solo se guardan los
  // que difieren de su valor por defecto en data.js, como { id: false }.
  function leerOverridesActivo() {
    return overridesEnMemoria().activos;
  }

  function estaActivo(perfume, overridesActivo) {
    const guardado = overridesActivo[perfume.id];
    return typeof guardado === "boolean" ? guardado : perfume.activo !== false;
  }

  /* ============ REFERENCIAS DOM ============ */
  const $ = (sel) => document.querySelector(sel);

  const pantallaInicio = $("#pantalla-inicio");
  const pantallaTest = $("#pantalla-test");
  const pantallaResultados = $("#pantalla-resultados");
  const pantallaSetOcasion = $("#pantalla-set-ocasion");

  const btnEmpezar = $("#btn-empezar");
  const btnAtras = $("#btn-atras");
  const btnSiguiente = $("#btn-siguiente");
  const btnReiniciar = $("#btn-reiniciar");

  const preguntaContenedor = $("#pregunta-contenedor");
  const progresoTexto = $("#progreso-texto");
  const progresoPorcentaje = $("#progreso-porcentaje");
  const progresoRelleno = $("#progreso-relleno");
  const tarjetasResultado = $("#tarjetas-resultado");
  const plantillaTarjeta = $("#plantilla-tarjeta");
  const zonaFormatos = $("#zona-formatos-formato");
  const contenidoSetOcasion = $("#contenido-set-ocasion");

  // El total de pasos visuales ya no es fijo: depende de si el camino
  // actual tiene subpregunta 2.5 (8 pasos) y/o 2.6 (9 pasos), o ninguna
  // de las dos todavía (7, mientras se responde la pregunta 2).
  function totalPasosVisuales() {
    return estado.camino.length - 1; // el camino tiene N nodos, pero P2.5/P2.6 comparten el número "2"
  }

  let avanceAutomaticoTimeout = null; // controla el avance automático tras seleccionar una opción

  /* ============ NAVEGACIÓN ============ */

  function irAPantalla(pantalla) {
    [pantallaInicio, pantallaTest, pantallaResultados, pantallaSetOcasion].forEach((p) =>
      p.classList.remove("activa")
    );
    pantalla.classList.add("activa");
    // El contenido de la pantalla (preguntas o tarjetas) ya debe estar
    // renderizado ANTES de llamar a esta función, para que el navegador
    // calcule el scroll sobre el layout final y no salte después.
    setTimeout(() => {
      pantalla.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function iniciarTest() {
    estado.pasoActual = 0;
    estado.camino = [PREGUNTA_1, PREGUNTA_2];
    estado.respuestas = {};
    renderizarPregunta();
    irAPantalla(pantallaTest);
  }

  function construirCaminoTrasPregunta2() {
    // Inserta la subpregunta 2.5 correspondiente justo después de la
    // pregunta 2. La 2.6 (si existe para esa subfamilia) se agrega más
    // adelante, cuando el usuario responda la 2.5 — ver
    // construirCaminoTrasSubpregunta().
    const aroma = estado.respuestas.aromaPrincipal;
    const sub = SUBPREGUNTAS[aroma];
    const subPregunta = {
      clave: "subAroma",
      numero: sub.numero,
      titulo: sub.titulo,
      opciones: sub.opciones
    };
    // camino: [P1, P2, SUB, P3, P4, P5, P6, P7]
    estado.camino = [
      PREGUNTA_1,
      PREGUNTA_2,
      subPregunta,
      PREGUNTA_3,
      PREGUNTA_4,
      PREGUNTA_5,
      PREGUNTA_6,
      PREGUNTA_7
    ];
    // Si ya había una respuesta de notaEspecifica de un camino anterior
    // (el usuario retrocedió y cambió de familia), la limpiamos.
    delete estado.respuestas.notaEspecifica;
  }

  function construirCaminoTrasSubpregunta() {
    // Si la subfamilia elegida tiene una pregunta 2.6 definida, la
    // insertamos justo después del nodo de subAroma (índice 2). Si no
    // existe (subfamilias pequeñas), el camino se queda en 8 pasos como
    // antes, sin pregunta extra.
    const sub = estado.respuestas.subAroma;
    const subsub = SUBSUBPREGUNTAS[sub];

    // Reconstruimos el camino desde cero para no duplicar el nodo si el
    // usuario va y viene entre subfamilias distintas.
    const aroma = estado.respuestas.aromaPrincipal;
    const spCfg = SUBPREGUNTAS[aroma];
    const subPregunta = {
      clave: "subAroma",
      numero: spCfg.numero,
      titulo: spCfg.titulo,
      opciones: spCfg.opciones
    };

    const nuevoCamino = [PREGUNTA_1, PREGUNTA_2, subPregunta];

    if (subsub) {
      nuevoCamino.push({
        clave: "notaEspecifica",
        numero: subsub.numero,
        titulo: subsub.titulo,
        opciones: subsub.opciones
      });
    } else {
      delete estado.respuestas.notaEspecifica;
    }

    nuevoCamino.push(PREGUNTA_3, PREGUNTA_4, PREGUNTA_5, PREGUNTA_6, PREGUNTA_7);
    estado.camino = nuevoCamino;
  }

  function renderizarPregunta() {
    const pregunta = estado.camino[estado.pasoActual];
    const respuestaActual = estado.respuestas[pregunta.clave];

    // Indicador de progreso: "Paso X de N", donde N depende del camino real
    const pasoVisual = calcularPasoVisual();
    const totalVisual = totalPasosVisuales();
    progresoTexto.textContent = `Paso ${pasoVisual} de ${totalVisual}`;
    const pct = Math.round((pasoVisual / totalVisual) * 100);
    progresoPorcentaje.textContent = `${pct}%`;
    progresoRelleno.style.width = `${pct}%`;

    // Render de la pregunta
    preguntaContenedor.innerHTML = "";

    const numeroEl = document.createElement("p");
    numeroEl.className = "pregunta-numero";
    numeroEl.textContent = `Pregunta ${pregunta.numero}`;

    const tituloEl = document.createElement("h2");
    tituloEl.className = "pregunta-titulo";
    tituloEl.textContent = pregunta.titulo;

    const gridEl = document.createElement("div");
    gridEl.className = "opciones-grid";
    gridEl.setAttribute("role", "radiogroup");
    gridEl.setAttribute("aria-label", pregunta.titulo);

    pregunta.opciones.forEach((opcion) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opcion";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", opcion.valor === respuestaActual ? "true" : "false");
      if (opcion.valor === respuestaActual) btn.classList.add("seleccionada");

      const emojiEl = document.createElement("span");
      emojiEl.className = "opcion-emoji";
      emojiEl.textContent = opcion.emoji;
      emojiEl.setAttribute("aria-hidden", "true");

      const textoWrap = document.createElement("span");
      textoWrap.className = "opcion-texto";

      const tituloOpcion = document.createElement("span");
      tituloOpcion.className = "opcion-titulo";
      tituloOpcion.textContent = opcion.titulo;
      textoWrap.appendChild(tituloOpcion);

      if (opcion.desc) {
        const descOpcion = document.createElement("span");
        descOpcion.className = "opcion-desc";
        descOpcion.textContent = opcion.desc;
        textoWrap.appendChild(descOpcion);
      }

      btn.appendChild(emojiEl);
      btn.appendChild(textoWrap);

      btn.addEventListener("click", () => seleccionarOpcion(pregunta.clave, opcion.valor));

      gridEl.appendChild(btn);
    });

    preguntaContenedor.appendChild(numeroEl);
    preguntaContenedor.appendChild(tituloEl);
    preguntaContenedor.appendChild(gridEl);

    actualizarBotonesNav();
  }

  function calcularPasoVisual() {
    // Preguntas 1 y 2 siempre son los primeros dos nodos del camino.
    const idx = estado.pasoActual;
    if (idx <= 1) return idx + 1;

    // A partir de aquí, el camino puede tener 0, 1 o 2 nodos extra antes
    // de llegar a la Pregunta 3 (subAroma en el índice 2, y notaEspecifica
    // en el índice 3 si existe). Todos esos nodos "extra" se muestran
    // como parte del paso 2 en el indicador, y el resto de preguntas se
    // corre según cuántos nodos extra haya.
    const tieneSubAroma = estado.camino[2] && estado.camino[2].clave === "subAroma";
    const tieneNotaEspecifica = estado.camino[3] && estado.camino[3].clave === "notaEspecifica";
    const nodosExtra = (tieneSubAroma ? 1 : 0) + (tieneNotaEspecifica ? 1 : 0);

    if (idx <= 1 + nodosExtra) return 2; // subAroma y/o notaEspecifica muestran "2"
    return idx - nodosExtra;
  }

  function seleccionarOpcion(clave, valor) {
    estado.respuestas[clave] = valor;

    // Si acabamos de responder la pregunta 2, construir el camino con la subpregunta 2.5 correcta
    if (clave === "aromaPrincipal") {
      construirCaminoTrasPregunta2();
    }

    // Si acabamos de responder la subpregunta 2.5, insertar (o no) la 2.6
    // según corresponda a esa subfamilia.
    if (clave === "subAroma") {
      construirCaminoTrasSubpregunta();
    }

    renderizarPregunta();

    // Avance automático: dejamos un instante para que se vea la opción
    // resaltada como seleccionada, y luego pasamos solos al siguiente paso
    // (o a resultados si era la última pregunta).
    clearTimeout(avanceAutomaticoTimeout);
    avanceAutomaticoTimeout = setTimeout(() => {
      irSiguiente();
    }, 380);
  }

  function actualizarBotonesNav() {
    const pregunta = estado.camino[estado.pasoActual];
    const respondida = Boolean(estado.respuestas[pregunta.clave]);
    btnSiguiente.disabled = !respondida;
    btnAtras.disabled = estado.pasoActual === 0;

    const esUltimoPaso = estado.pasoActual === estado.camino.length - 1;
    btnSiguiente.innerHTML = esUltimoPaso
      ? "Ver mis resultados <span class='flecha'>✦</span>"
      : "Siguiente <span class='flecha'>→</span>";
  }

  function irSiguiente() {
    clearTimeout(avanceAutomaticoTimeout);
    const esUltimoPaso = estado.pasoActual === estado.camino.length - 1;
    if (esUltimoPaso) {
      mostrarResultados();
      return;
    }
    estado.pasoActual += 1;
    renderizarPregunta();
  }

  function irAtras() {
    clearTimeout(avanceAutomaticoTimeout);
    if (estado.pasoActual === 0) return;
    estado.pasoActual -= 1;
    renderizarPregunta();
  }

  /* ============ MOTOR DE RECOMENDACIÓN (MATCH %) ============ */

  // El presupuesto elegido en la pregunta 7 define cuánto está dispuesto a
  // pagar el usuario COMO MÁXIMO. "Económico" solo debe mostrar perfumes
  // económicos; "Medio" acepta económico + medio (no obliga a gastar más
  // de lo pedido); "Sin límite" acepta cualquier precio. Así el presupuesto
  // actúa como FILTRO real, no solo como un bonus de puntos que un perfume
  // caro podía compensar con otras coincidencias.
  //
  // La categoría de precio se recalcula a partir del precio VIGENTE (con
  // los ajustes hechos en el catálogo), no del precioUSD original de
  // data.js, para que subir o bajar precios en el catálogo cambie de
  // verdad qué perfumes caben en cada presupuesto.
  const ORDEN_PRESUPUESTO = ["Económico", "Medio", "Sin límite"];

  function presupuestoCompatible(categoriaPerfume, presupuestoElegido) {
    const techoUsuario = ORDEN_PRESUPUESTO.indexOf(presupuestoElegido);
    const nivelPerfume = ORDEN_PRESUPUESTO.indexOf(categoriaPerfume);
    // El perfume es compatible si su nivel de precio no supera el techo elegido.
    return nivelPerfume <= techoUsuario;
  }

  function calcularScore(perfume, categoriaPerfume, r) {
    let score = 0;

    // Familia Olfativa Principal (Paso 2): +25
    if (perfume.aromaPrincipal === r.aromaPrincipal) score += 25;

    // Sub-aroma (Paso 2.5): +15
    if (perfume.subAroma === r.subAroma) score += 15;

    // Nota específica (Paso 2.6, solo cuando existe en el camino): +15
    if (r.notaEspecifica && perfume.notaEspecifica === r.notaEspecifica) score += 15;

    // Tipo/Marca (Paso 1): +15 (o si eligió "Cualquiera")
    if (r.tipo === "Cualquiera" || perfume.tipo === r.tipo) score += 15;

    // Ocasión / Momento (Paso 3): +12
    if (perfume.momento === r.momento) score += 12;

    // Clima (Paso 4): +10
    if (perfume.clima === r.clima) score += 10;

    // Estilo/Edad (Paso 5): +5
    if (perfume.estilo === r.estilo) score += 5;

    // Presupuesto exacto (Paso 7): +3 (o si eligió "Sin límite")
    if (r.presupuesto === "Sin límite" || categoriaPerfume === r.presupuesto) score += 3;

    return score; // máximo teórico: 100 (o 85 si el camino no tuvo Paso 2.6)
  }

  function obtenerTop4() {
    const r = estado.respuestas;
    const overrides = leerOverridesPrecio();
    const overridesImg = leerOverridesImagen();
    const overridesActivo = leerOverridesActivo();

    // 0. Solo consideramos perfumes activados (los desactivados desde el
    //    catálogo nunca deben aparecer como resultado del test).
    const soloActivos = PERFUMES.filter((p) => estaActivo(p, overridesActivo));

    // 1. Calculamos el precio vigente y la categoría de cada perfume, y
    //    filtramos por presupuesto usando esa categoría dinámica.
    const conPrecioVigente = soloActivos.map((p) => {
      const precio = precioVigente(p, overrides);
      return { perfume: p, precio, categoria: categoriaParaPrecio(precio) };
    });

    const dentroDePresupuesto = conPrecioVigente.filter((item) =>
      presupuestoCompatible(item.categoria, r.presupuesto)
    );

    // 2. Puntuamos solo dentro de ese subconjunto ya filtrado.
    const puntuados = dentroDePresupuesto.map((item) => ({
      ...item,
      score: calcularScore(item.perfume, item.categoria, r)
    }));

    puntuados.sort((a, b) => b.score - a.score);

    // 3. Tomamos los 4 mejores DENTRO del presupuesto vigente.
    const top4 = puntuados.slice(0, 4);

    // El % de Match mostrado es el score REAL calculado arriba, sin piso
    // artificial. El precio e imagen mostrados son los vigentes (con
    // ajustes del catálogo aplicados), no los originales de data.js.
    return top4.map((item) => ({
      ...item.perfume,
      precioUSD: item.precio,
      imagen: imagenVigente(item.perfume, overridesImg),
      matchPct: Math.min(100, item.score)
    }));
  }

  /* ============ RENDER DE RESULTADOS ============ */

  // Las notas en data.js vienen como "salida / corazón / fondo" separadas
  // por "/". Las partimos para mostrarlas como 3 filas etiquetadas en vez
  // de un párrafo corrido, así se leen de un vistazo.
  const ETIQUETAS_NOTAS = ["Salida", "Corazón", "Fondo"];

  function renderizarNotas(nodo, textoNotas) {
    const contenedor = nodo.querySelector('[data-campo="notas"]');
    contenedor.innerHTML = "";

    const partes = (textoNotas || "")
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);

    // Si por algún motivo no vienen las 3 partes esperadas, mostramos el
    // texto tal cual, sin romper el render.
    if (partes.length !== 3) {
      const fila = document.createElement("p");
      fila.className = "notas-fila-simple";
      fila.textContent = textoNotas || "";
      contenedor.appendChild(fila);
      return;
    }

    partes.forEach((parte, i) => {
      const fila = document.createElement("div");
      fila.className = "notas-fila";

      const etiqueta = document.createElement("span");
      etiqueta.className = "notas-fila-etiqueta";
      etiqueta.textContent = ETIQUETAS_NOTAS[i];

      const valor = document.createElement("span");
      valor.className = "notas-fila-valor";
      valor.textContent = parte;

      fila.appendChild(etiqueta);
      fila.appendChild(valor);
      contenedor.appendChild(fila);
    });
  }

  // Único punto del test que necesita esperar a la base de datos. La
  // descarga arrancó al cargar la página, así que cuando el usuario termina
  // las 7 preguntas los datos llevan rato en memoria y esto no espera nada.
  // El caso lento solo ocurre si respondió todo en un par de segundos.
  function mostrarResultados() {
    if (typeof PerfumesDB === "undefined" || PerfumesDB.estaCargado()) {
      pintarResultados();
      return;
    }
    tarjetasResultado.innerHTML =
      '<p class="resultados-vacio">Calculando tus coincidencias…</p>';
    zonaFormatos.innerHTML = "";
    irAPantalla(pantallaResultados);
    PerfumesDB.cargarOverrides().then(pintarResultados);
  }

  function pintarResultados() {
    const top4 = obtenerTop4();

    tarjetasResultado.innerHTML = "";

    // Caso límite: si se desactivaron demasiados perfumes desde el catálogo,
    // puede que no quede ninguno dentro del presupuesto elegido. Avisamos
    // en vez de dejar la pantalla vacía sin explicación.
    if (top4.length === 0) {
      const aviso = document.createElement("p");
      aviso.className = "resultados-vacio";
      aviso.textContent =
        "No encontramos fragancias activas dentro de ese presupuesto. Prueba con un presupuesto mayor o revisa el catálogo para reactivar más perfumes.";
      tarjetasResultado.appendChild(aviso);
      irAPantalla(pantallaResultados);
      return;
    }

    top4.forEach((perfume) => {
      const nodo = plantillaTarjeta.content.cloneNode(true);
      const articulo = nodo.querySelector(".tarjeta-perfume");

      const imgEl = nodo.querySelector('[data-campo="imagen"]');
      imgEl.src = perfume.imagen;
      imgEl.alt = `Frasco de ${perfume.nombre}`;
      imgEl.addEventListener("error", function manejarError() {
        imgEl.removeEventListener("error", manejarError);
        imgEl.src = FALLBACK_IMG;
      });

      nodo.querySelector('[data-campo="match"]').textContent = `${perfume.matchPct}% Match`;
      nodo.querySelector('[data-campo="nombre"]').textContent = perfume.nombre;
      nodo.querySelector('[data-campo="tipo"]').textContent = perfume.tipo;
      nodo.querySelector('[data-campo="aroma"]').textContent = perfume.aromaPrincipal;
      nodo.querySelector('[data-campo="subaroma"]').textContent = perfume.subAroma;
      nodo.querySelector('[data-campo="momento"]').textContent = perfume.momento;
      nodo.querySelector('[data-campo="clima"]').textContent = perfume.clima;
      nodo.querySelector('[data-campo="estilo"]').textContent = perfume.estilo;
      nodo.querySelector('[data-campo="potencia"]').textContent = perfume.potencia;
      nodo.querySelector('[data-campo="precio"]').textContent = perfume.presupuesto;

      renderizarNotas(nodo, perfume.notas);

      articulo.addEventListener("click", () => seleccionarPerfumeResultado(perfume, articulo));

      tarjetasResultado.appendChild(nodo);
    });

    zonaFormatos.innerHTML = "";
    irAPantalla(pantallaResultados);
  }

  /* ============ SET OCASIÓN: elegir formato tras seleccionar un resultado ============ */

  function seleccionarPerfumeResultado(perfume, articuloEl) {
    estadoSetOcasion.perfumeSeleccionado = perfume;

    tarjetasResultado.querySelectorAll(".tarjeta-perfume").forEach((a) => a.classList.remove("seleccionada"));
    articuloEl.classList.add("seleccionada");

    const linkProbar = generarLinkWhatsApp(
      `Hola, quiero pedir el decant de 5ml de ${perfume.nombre} 🧪`
    );
    const linkBotella = generarLinkWhatsApp(
      `Hola, quiero pedir la botella completa de ${perfume.nombre} 🍾`
    );

    zonaFormatos.innerHTML = `
      <div class="formatos-desplegados">
        <p class="formatos-titulo-llamativo">✨ Tu fragancia ideal te espera — elige cómo la quieres</p>
        <div class="formatos-opciones">
          <div class="formato-card" id="btn-formato-probar">
            <div class="formato-emoji">🧪</div>
            <div class="formato-titulo">Probar</div>
            <div class="formato-desc">Decant de 5ml de esta fragancia</div>
          </div>
          <div class="formato-card destacada" id="btn-formato-set">
            <div class="formato-emoji">🎁</div>
            <div class="formato-titulo">Set Ocasión</div>
            <div class="formato-desc">3 decants de 5ml para cada momento</div>
          </div>
          <div class="formato-card" id="btn-formato-botella">
            <div class="formato-emoji">🍾</div>
            <div class="formato-titulo">Botella</div>
            <div class="formato-desc">El frasco completo</div>
          </div>
        </div>
        <div id="zona-detalle-formato"></div>
      </div>
    `;

    function renderDetalleCompra(etiquetaFormato) {
      const zonaDetalle = $("#zona-detalle-formato");
      const link = etiquetaFormato === "5ML" ? linkProbar : linkBotella;
      zonaDetalle.innerHTML = `
        <div class="detalle-compra-card">
          <div class="detalle-compra-imagen-wrap">
            <span class="detalle-compra-etiqueta">${etiquetaFormato === "5ML" ? "5 ML" : "BOTELLA COMPLETA"}</span>
            <img class="detalle-compra-imagen" id="detalle-compra-img" alt="Frasco de ${perfume.nombre}" />
          </div>
          <h3 class="detalle-compra-nombre">${perfume.nombre}</h3>
          <a href="${link}" target="_blank" rel="noopener" class="boton boton-primario detalle-compra-contacto">
            💬 Contáctanos
          </a>
        </div>
      `;
      const img = $("#detalle-compra-img");
      img.src = perfume.imagen;
      img.addEventListener("error", function manejarError() {
        img.removeEventListener("error", manejarError);
        img.src = FALLBACK_IMG;
      });
      setTimeout(() => {
        if (zonaDetalle && typeof zonaDetalle.scrollIntoView === "function") {
          zonaDetalle.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 50);
    }

    $("#btn-formato-set").addEventListener("click", () => {
      renderSetOcasion();
      irAPantalla(pantallaSetOcasion);
    });
    $("#btn-formato-probar").addEventListener("click", () => renderDetalleCompra("5ML"));
    $("#btn-formato-botella").addEventListener("click", () => renderDetalleCompra("BOTELLA"));

    setTimeout(() => {
      if (zonaFormatos && typeof zonaFormatos.scrollIntoView === "function") {
        zonaFormatos.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 50);
  }

  /* ============ SET OCASIÓN: motor y flujo completo ============ */

  const CASILLAS_SET_OCASION = [
    { id: "calido", etiqueta: "Clima cálido / Día", emoji: "☀️", climaValor: "Caliente / Sol" },
    { id: "frio", etiqueta: "Clima frío / Noche", emoji: "❄️", climaValor: "Frío / Noche" },
    { id: "libre", etiqueta: "Ocasión libre / Fin de semana", emoji: "🎲", climaValor: "Templado" },
  ];

  function mapearClimaACasillaSet(climaPerfume) {
    if (climaPerfume === "Caliente / Sol") return "calido";
    if (climaPerfume === "Frío / Noche") return "frio";
    return "libre";
  }

  // Para "Clima cálido / Día" solo dejamos familias frescas y ligeras. Para
  // "Frío / Noche" solo las que el catálogo respalda con datos reales.
  // "Ocasión libre" no pasa por preguntas de aroma (ver renderListaVersatiles).
  const AROMAS_PERMITIDOS_SET_OCASION = {
    "Caliente / Sol": ["Cítrico", "Fresco"],
    "Frío / Noche": ["Cálido / Especiado", "Madera", "Cuero / Tabaco", "Dulce / Gourmand"],
    Templado: null,
  };

  function preguntaAromaFiltradaSet(climaValor) {
    const permitidos = AROMAS_PERMITIDOS_SET_OCASION[climaValor];
    const opciones = PREGUNTA_2.opciones.filter((op) =>
      permitidos ? permitidos.includes(op.valor) : true
    );
    return { titulo: PREGUNTA_2.titulo, opciones };
  }

  const estadoSetOcasion = {
    perfumeSeleccionado: null,
    porCasilla: {},
    filtroTipoLibre: "Todos",
  };
  let respuestasCasillaTemp = {};

  function buscarMejorMatchSet(filtros) {
    let mejorScore = -1;
    let empatados = [];
    PERFUMES.forEach((p) => {
      if (!estaActivo(p, leerOverridesActivo())) return;
      let score = 0;
      if (filtros.aromaPrincipal && p.aromaPrincipal === filtros.aromaPrincipal) score += 22;
      if (filtros.subAroma && p.subAroma === filtros.subAroma) score += 13;
      if (filtros.notaEspecifica && p.notaEspecifica === filtros.notaEspecifica) score += 12;
      if (filtros.tipo === "Cualquiera") score += 13;
      else if (filtros.tipo && p.tipo === filtros.tipo) score += 13;
      if (filtros.clima && p.clima === filtros.clima) score += 15;
      if (filtros.estilo && p.estilo === filtros.estilo) score += 9;
      if (filtros.potencia && p.potencia === filtros.potencia) score += 4;
      if (filtros.presupuesto === "Sin límite" || filtros.presupuesto === p.presupuesto) score += 2;

      if (score > mejorScore) {
        mejorScore = score;
        empatados = [p];
      } else if (score === mejorScore) {
        empatados.push(p);
      }
    });
    if (empatados.length === 0) return null;
    return empatados[Math.floor(Math.random() * empatados.length)];
  }

  function renderSetOcasion() {
    // Llenamos la casilla correspondiente al perfume que el usuario eligió
    // en el Top4, si esa casilla todavía no tenía nada.
    const p = estadoSetOcasion.perfumeSeleccionado;
    if (p) {
      const casillaDelElegido = mapearClimaACasillaSet(p.clima);
      if (!estadoSetOcasion.porCasilla[casillaDelElegido]) {
        estadoSetOcasion.porCasilla[casillaDelElegido] = p;
      }
    }

    contenidoSetOcasion.innerHTML = `
      <button class="btn-volver-setocasion" id="btn-volver-a-resultados">← Volver al resultado</button>
      <h2 class="set-ocasion-titulo">Arma tu Set Ocasión</h2>
      <p class="set-ocasion-sub">Un decant de 5ml para cada momento. Completa las que faltan.</p>
      <div class="casillas-set-ocasion" id="lista-casillas-set"></div>
      <div id="zona-contacto-set"></div>
    `;
    $("#btn-volver-a-resultados").addEventListener("click", () => irAPantalla(pantallaResultados));
    renderCasillasSet();

    // El botón de contacto para pedir el set completo solo aparece cuando
    // las 3 casillas ya tienen un perfume asignado.
    const completas = CASILLAS_SET_OCASION.every((cfg) => estadoSetOcasion.porCasilla[cfg.id]);
    if (completas) {
      const nombres = CASILLAS_SET_OCASION.map((cfg) => estadoSetOcasion.porCasilla[cfg.id].nombre);
      const mensaje = `Hola, quiero pedir mi Set Ocasión con estos 3 decants de 5ml: ${nombres.join(", ")} 🎁`;
      const zonaContacto = $("#zona-contacto-set");
      zonaContacto.innerHTML = `
        <a href="${generarLinkWhatsApp(mensaje)}" target="_blank" rel="noopener" class="boton boton-primario detalle-compra-contacto" style="margin-top:22px;">
          💬 Contáctanos para pedir tu Set Ocasión
        </a>
      `;
    }
  }

  function imgConFallbackSet(perfume, clase) {
    const img = document.createElement("img");
    img.className = clase;
    img.src = perfume.imagen;
    img.alt = `Frasco de ${perfume.nombre}`;
    img.addEventListener("error", function manejarError() {
      img.removeEventListener("error", manejarError);
      img.src = FALLBACK_IMG;
    });
    return img;
  }

  function renderCasillasSet() {
    const cont = $("#lista-casillas-set");
    cont.innerHTML = "";
    CASILLAS_SET_OCASION.forEach((cfg) => {
      const perfume = estadoSetOcasion.porCasilla[cfg.id];
      const div = document.createElement("div");

      if (perfume) {
        div.className = "casilla-set llena";
        const iconoSlot = document.createElement("div");
        iconoSlot.className = "casilla-set-icono";
        iconoSlot.appendChild(imgConFallbackSet(perfume, ""));

        const info = document.createElement("div");
        info.className = "casilla-set-info";
        info.innerHTML = `
          <div class="casilla-set-etiqueta">${cfg.etiqueta}</div>
          <p class="casilla-set-nombre">${perfume.nombre}</p>
          <div class="casilla-set-notas">${perfume.notas}</div>
        `;

        const check = document.createElement("div");
        check.className = "casilla-set-check";
        check.textContent = "✓";

        div.appendChild(iconoSlot);
        div.appendChild(info);
        div.appendChild(check);
      } else {
        div.className = "casilla-set vacia";
        div.innerHTML = `
          <div class="casilla-set-icono">${cfg.emoji}</div>
          <div class="casilla-set-info">
            <div class="casilla-set-etiqueta">${cfg.etiqueta}</div>
            <div class="casilla-set-vacio-texto">Toca para completar esta casilla</div>
          </div>
          <div class="casilla-set-cta">Completar →</div>
        `;
        div.addEventListener("click", () => iniciarPreguntasCasillaSet(cfg));
      }
      cont.appendChild(div);
    });
  }

  function iniciarPreguntasCasillaSet(cfg) {
    respuestasCasillaTemp = { clima: cfg.climaValor };
    if (cfg.id === "libre") {
      renderListaVersatilesSet(cfg);
    } else {
      renderPreguntaMarcaSet(cfg);
    }
  }

  function renderListaVersatilesSet(cfg) {
    const overridesActivo = leerOverridesActivo();
    const todos = PERFUMES.filter((p) => estaActivo(p, overridesActivo) && p.clima === "Templado");
    const filtro = estadoSetOcasion.filtroTipoLibre;
    const candidatos = filtro === "Todos" ? todos : todos.filter((p) => p.tipo === filtro);

    contenidoSetOcasion.innerHTML = `
      <button class="btn-volver-setocasion" id="btn-volver-casillas-libre">← Volver</button>
      <h3 class="setocasion-pregunta-titulo" style="margin-bottom:6px;">Elige uno para probar</h3>
      <p class="set-ocasion-sub" style="margin-bottom:16px;">Estos son versátiles: funcionan casi para cualquier ocasión o clima.</p>
      <div class="setocasion-filtro-chips" id="filtro-chips-set"></div>
      <div class="setocasion-opciones" id="lista-versatiles-set"></div>
    `;
    $("#btn-volver-casillas-libre").addEventListener("click", renderSetOcasion);

    const chipsCont = $("#filtro-chips-set");
    ["Todos", "Diseñador", "Árabe", "Lujo"].forEach((tipo) => {
      const chip = document.createElement("button");
      chip.className = "setocasion-filtro-chip" + (tipo === filtro ? " activo" : "");
      chip.textContent = tipo;
      chip.addEventListener("click", () => {
        estadoSetOcasion.filtroTipoLibre = tipo;
        renderListaVersatilesSet(cfg);
      });
      chipsCont.appendChild(chip);
    });

    const cont = $("#lista-versatiles-set");
    candidatos.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = "setocasion-opcion-btn";
      btn.appendChild(imgConFallbackSet(p, "setocasion-opcion-imagen"));
      const span = document.createElement("span");
      span.innerHTML = `<span class="setocasion-opcion-titulo">${p.nombre}</span><div class="casilla-set-notas" style="margin-top:6px;">${p.notas}</div>`;
      btn.appendChild(span);
      btn.addEventListener("click", () => {
        estadoSetOcasion.porCasilla[cfg.id] = p;
        renderSetOcasion();
      });
      cont.appendChild(btn);
    });
  }

  function renderOpcionesSet(titulo, pasoTexto, opciones, onSelect, onVolver, idBotonVolver) {
    contenidoSetOcasion.innerHTML = `
      <button class="btn-volver-setocasion" id="${idBotonVolver}">← Volver</button>
      <div class="setocasion-paso-indicador">${pasoTexto}</div>
      <h3 class="setocasion-pregunta-titulo">${titulo}</h3>
      <div class="setocasion-opciones" id="setocasion-opciones-actual"></div>
    `;
    $(`#${idBotonVolver}`).addEventListener("click", onVolver);
    const cont = $("#setocasion-opciones-actual");
    opciones.forEach((op) => {
      const btn = document.createElement("button");
      btn.className = "setocasion-opcion-btn";
      btn.innerHTML = `<span class="setocasion-opcion-emoji">${op.emoji}</span><span><span class="setocasion-opcion-titulo">${op.titulo}</span>${op.desc ? `<br><span class="setocasion-opcion-desc">${op.desc}</span>` : ""}</span>`;
      btn.addEventListener("click", () => onSelect(op.valor));
      cont.appendChild(btn);
    });
  }

  function renderPreguntaMarcaSet(cfg) {
    renderOpcionesSet(
      PREGUNTA_1.titulo,
      `${cfg.etiqueta} · Pregunta 1 de 5`,
      PREGUNTA_1.opciones,
      (valor) => {
        respuestasCasillaTemp.tipo = valor;
        renderPreguntaAromaSet(cfg);
      },
      renderSetOcasion,
      "btn-volver-casillas-set"
    );
  }

  function renderPreguntaAromaSet(cfg) {
    const preguntaAroma = preguntaAromaFiltradaSet(cfg.climaValor);
    renderOpcionesSet(
      preguntaAroma.titulo,
      `${cfg.etiqueta} · Pregunta 2 de 5`,
      preguntaAroma.opciones,
      (valor) => {
        respuestasCasillaTemp.aromaPrincipal = valor;
        renderSubpreguntaSet(cfg);
      },
      () => renderPreguntaMarcaSet(cfg),
      "btn-volver-marca-set"
    );
  }

  function renderSubpreguntaSet(cfg) {
    const sub = SUBPREGUNTAS[respuestasCasillaTemp.aromaPrincipal];
    renderOpcionesSet(
      sub.titulo,
      `${cfg.etiqueta} · Pregunta 3 de 5`,
      sub.opciones,
      (valor) => {
        respuestasCasillaTemp.subAroma = valor;
        delete respuestasCasillaTemp.notaEspecifica;
        const subsub = SUBSUBPREGUNTAS[valor];
        if (subsub) {
          renderNotaEspecificaSet(cfg, subsub);
        } else {
          renderVibraSet(cfg);
        }
      },
      () => renderPreguntaAromaSet(cfg),
      "btn-volver-sub-set"
    );
  }

  function renderNotaEspecificaSet(cfg, subsub) {
    renderOpcionesSet(
      subsub.titulo,
      `${cfg.etiqueta} · Pregunta 4 de 6`,
      subsub.opciones,
      (valor) => {
        respuestasCasillaTemp.notaEspecifica = valor;
        renderVibraSet(cfg);
      },
      () => renderSubpreguntaSet(cfg),
      "btn-volver-notaesp-set"
    );
  }

  function renderVibraSet(cfg) {
    const huboNotaEspecifica = respuestasCasillaTemp.notaEspecifica !== undefined;
    renderOpcionesSet(
      PREGUNTA_5.titulo,
      `${cfg.etiqueta} · Pregunta ${huboNotaEspecifica ? "5 de 6" : "4 de 5"}`,
      PREGUNTA_5.opciones,
      (valor) => {
        respuestasCasillaTemp.estilo = valor;
        renderPotenciaSet(cfg);
      },
      () => {
        if (huboNotaEspecifica) {
          renderNotaEspecificaSet(cfg, SUBSUBPREGUNTAS[respuestasCasillaTemp.subAroma]);
        } else {
          renderSubpreguntaSet(cfg);
        }
      },
      "btn-volver-vibra-set"
    );
  }

  function renderPotenciaSet(cfg) {
    const huboNotaEspecifica = respuestasCasillaTemp.notaEspecifica !== undefined;
    renderOpcionesSet(
      PREGUNTA_6.titulo,
      `${cfg.etiqueta} · Pregunta ${huboNotaEspecifica ? "6 de 6" : "5 de 5"}`,
      PREGUNTA_6.opciones,
      (valor) => {
        respuestasCasillaTemp.potencia = valor;
        renderPresupuestoSet(cfg);
      },
      () => renderVibraSet(cfg),
      "btn-volver-potencia-set"
    );
  }

  function renderPresupuestoSet(cfg) {
    renderOpcionesSet(
      PREGUNTA_7.titulo,
      `${cfg.etiqueta} · Última pregunta`,
      PREGUNTA_7.opciones,
      (valor) => {
        respuestasCasillaTemp.presupuesto = valor;
        const match = buscarMejorMatchSet(respuestasCasillaTemp);
        estadoSetOcasion.porCasilla[cfg.id] = match;
        renderSetOcasion();
      },
      () => renderPotenciaSet(cfg),
      "btn-volver-presupuesto-set"
    );
  }

  /* ============ EVENT LISTENERS GLOBALES ============ */

  btnEmpezar.addEventListener("click", iniciarTest);
  btnSiguiente.addEventListener("click", irSiguiente);
  btnAtras.addEventListener("click", irAtras);
  btnReiniciar.addEventListener("click", iniciarTest);

  const linkContactoInicio = $("#link-contacto-inicio");
  if (linkContactoInicio) {
    linkContactoInicio.href = generarLinkWhatsApp(
      "Hola, tengo dudas sobre el Buscador de Perfumes Pro 🙂"
    );
  }

  // Arrancamos la descarga de los overrides de inmediato, sin bloquear
  // nada: mientras el visitante lee la portada y responde las preguntas,
  // los datos van llegando en segundo plano. Para cuando se calcula el
  // Top 4 ya están en memoria, así que el test no se siente más lento.
  if (typeof PerfumesDB !== "undefined") {
    PerfumesDB.cargarOverrides();
  }

  // Al cargar, aseguramos que la pantalla de inicio esté activa
  irAPantalla(pantallaInicio);
})();
