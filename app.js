/* ============================================================
   BUSCADOR DE PERFUMES PRO — app.js
   Navegación, ramificación dinámica y motor de Match %
   ============================================================ */

(function () {
  "use strict";

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
      { valor: "Madera", emoji: "🌲", titulo: "Maderas / Resinas / Oud", desc: "" },
      { valor: "Cuero / Tabaco", emoji: "🚬", titulo: "Cuero / Tabaco / Ahumado", desc: "" },
      { valor: "Limpio / Empolvado", emoji: "🧼", titulo: "Jabón fino / Iris / Talco", desc: "" }
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
        { valor: "Piña / Frutal ahumado", emoji: "🍍", titulo: "Piña / Frutal ahumado", desc: "Piña jugosa, bergamota, grosella negra y abedul ahumado" }
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
        { valor: "Oud exótico", emoji: "🕌", titulo: "Oud exótico", desc: "Oud camboyano, incienso, mirra y resinas orientales" }
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
    "Limpio / Empolvado": {
      numero: "2.5 de 7",
      titulo: "Perfecto, un poco más de detalle sobre ese aroma limpio \u2192",
      opciones: [
        { valor: "Jabón fino", emoji: "🧼", titulo: "Jabón fino", desc: "Lavanda, neroli, flor de azahar y musgo blanco" },
        { valor: "Iris elegante", emoji: "💄", titulo: "Iris elegante", desc: "Iris italiano empolvado, violeta, cacao y cuero suave" }
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

  /* ============ PRECIOS AJUSTADOS DESDE EL CATÁLOGO ============ */
  // El catálogo (catalogo.html) permite subir/bajar precios global o
  // individualmente y los guarda en localStorage. Aquí los leemos para
  // que el test use siempre el precio vigente, no el original de data.js.
  const CLAVE_STORAGE_PRECIOS = "perfumesPro_preciosOverride";

  function leerOverridesPrecio() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE_PRECIOS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
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

  /* ============ FOTOS REALES PEGADAS DESDE EL CATÁLOGO ============ */
  // Igual mecanismo que el precio: si en catalogo.html se pegó la URL de
  // una foto real para un perfume, la usamos aquí en vez del ícono
  // generado que trae data.js por defecto.
  const CLAVE_STORAGE_IMAGENES = "perfumesPro_imagenesOverride";

  function leerOverridesImagen() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE_IMAGENES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function imagenVigente(perfume, overridesImg) {
    const guardada = overridesImg[perfume.id];
    return typeof guardada === "string" && guardada.trim() !== ""
      ? guardada
      : perfume.imagen;
  }

  /* ============ PERFUMES ACTIVADOS / DESACTIVADOS DESDE EL CATÁLOGO ============ */
  // En catalogo.html se puede desactivar un perfume para que nunca salga
  // como resultado del test, sin borrarlo del catálogo. Guardamos solo los
  // que fueron cambiados respecto a su valor por defecto (activo: true en
  // data.js), como un mapa { id: false }.
  const CLAVE_STORAGE_ACTIVOS = "perfumesPro_activosOverride";

  function leerOverridesActivo() {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE_ACTIVOS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
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

  const TOTAL_PASOS_VISUALES = 7; // para el indicador "Paso X de 7", aunque el camino real tenga 8 nodos (2.5)

  let avanceAutomaticoTimeout = null; // controla el avance automático tras seleccionar una opción

  /* ============ NAVEGACIÓN ============ */

  function irAPantalla(pantalla) {
    [pantallaInicio, pantallaTest, pantallaResultados].forEach((p) =>
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
    // Inserta la subpregunta correspondiente justo después de la pregunta 2
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
  }

  function renderizarPregunta() {
    const pregunta = estado.camino[estado.pasoActual];
    const respuestaActual = estado.respuestas[pregunta.clave];

    // Indicador de progreso: mapeamos el paso real a un "paso visual" de 7
    const pasoVisual = calcularPasoVisual();
    progresoTexto.textContent = `Paso ${pasoVisual} de ${TOTAL_PASOS_VISUALES}`;
    const pct = Math.round((pasoVisual / TOTAL_PASOS_VISUALES) * 100);
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
    // Pasos 0,1 -> visual 1,2. Si estamos en la subpregunta (índice 2 cuando existe), sigue siendo "2".
    // A partir de ahí, el índice real se corre +1 respecto al visual (por el nodo de subpregunta).
    const idx = estado.pasoActual;
    if (idx <= 1) return idx + 1; // preguntas 1 y 2
    if (estado.camino.length === 8) {
      if (idx === 2) return 2; // subpregunta 2.5 sigue mostrando "2"
      return idx; // idx=3->3, 4->4, 5->5, 6->6, 7->7
    }
    return idx + 1;
  }

  function seleccionarOpcion(clave, valor) {
    estado.respuestas[clave] = valor;

    // Si acabamos de responder la pregunta 2, construir el camino con la subpregunta correcta
    if (clave === "aromaPrincipal") {
      construirCaminoTrasPregunta2();
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

    // Familia Olfativa Principal (Paso 2): +30
    if (perfume.aromaPrincipal === r.aromaPrincipal) score += 30;

    // Nota / Sub-aroma específico (Paso 2.5): +20
    if (perfume.subAroma === r.subAroma) score += 20;

    // Tipo/Marca (Paso 1): +15 (o si eligió "Cualquiera")
    if (r.tipo === "Cualquiera" || perfume.tipo === r.tipo) score += 15;

    // Ocasión / Momento (Paso 3): +15
    if (perfume.momento === r.momento) score += 15;

    // Clima (Paso 4): +10
    if (perfume.clima === r.clima) score += 10;

    // Estilo/Edad (Paso 5): +5
    if (perfume.estilo === r.estilo) score += 5;

    // Presupuesto exacto (Paso 7): +5 (o si eligió "Sin límite")
    if (r.presupuesto === "Sin límite" || categoriaPerfume === r.presupuesto) score += 5;

    return score; // máximo teórico: 100
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

  function mostrarResultados() {
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

      tarjetasResultado.appendChild(nodo);
    });

    irAPantalla(pantallaResultados);
  }

  /* ============ EVENT LISTENERS GLOBALES ============ */

  btnEmpezar.addEventListener("click", iniciarTest);
  btnSiguiente.addEventListener("click", irSiguiente);
  btnAtras.addEventListener("click", irAtras);
  btnReiniciar.addEventListener("click", iniciarTest);

  // Al cargar, aseguramos que la pantalla de inicio esté activa
  irAPantalla(pantallaInicio);
})();
