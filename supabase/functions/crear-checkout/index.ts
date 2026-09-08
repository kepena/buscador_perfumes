// ============================================================
//  crear-checkout
//  Buscador de Perfumes Pro — Kaiketek
//
//  QUE HACE
//    Recibe el carrito del navegador (solo ids y cantidades — nunca un
//    precio) y los datos de envío, y:
//
//      1. Recalcula el precio real de cada fragancia contra la base de
//         datos: costo_usd × (1 + margen_botella), en USD. El navegador
//         nunca decide cuánto se cobra.
//      2. Descarta lo que ya no se puede vender (agotado, sin costo
//         cargado, o sin suficiente stock si es "en_stock").
//      3. Crea la orden en Supabase (estado 'pendiente') con lo que sí se
//         puede vender.
//      4. Crea la sesión de Stripe Checkout (tarjeta + PayPal) por ese
//         total y devuelve la URL para redirigir al cliente.
//
//  POR QUE UNA EDGE FUNCTION Y NO TODO EN EL NAVEGADOR
//    Si el precio se calculara en el navegador, cualquiera podría abrir la
//    consola y cambiarlo antes de pagar. Aquí el total sale siempre de lo
//    que dice la base de datos en el momento de pagar, no de lo que el
//    carrito dice que cuesta.
//
//  ENTRADA (POST, JSON)
//    {
//      items: [{ id: number, nombre: string, cantidad: number }, ...],
//      envio: {
//        nombre: string, email: string, direccion: string,
//        ciudad: string, estado: string, codigoPostal: string
//      }
//    }
//
//    "nombre" en cada item es SOLO para guardar un resumen legible del
//    pedido (orden_items.nombre_perfume) — no participa en el precio. Si
//    alguien lo manda distinto al real, lo único que pasa es que su propio
//    pedido queda mal etiquetado en el panel de Kike; no cambia lo que se
//    cobra ni a quién.
//
//  SALIDA (JSON)
//    {
//      url: string | null,       // sesión de Stripe Checkout, o null si no quedó nada comprable
//      ordenId: string | null,
//      rechazados: [{ id, motivo }]   // ítems que se quitaron y por qué
//    }
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { cabecerasCors, respuestaJson } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

// Mismo dominio que CNAME/db.js. No es secreto, así que va fijo aquí en
// vez de pedirle a Kike que configure una variable más.
const SITE_URL = "https://buscadorperfumes.kaiketek.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient()
    })
  : null;

type ItemPedido = { id: number; nombre: string; cantidad: number };
type DatosEnvio = {
  nombre: string; email: string; direccion: string;
  ciudad: string; estado: string; codigoPostal: string;
};

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function envioValido(envio: DatosEnvio | undefined): envio is DatosEnvio {
  if (!envio) return false;
  const campos = [envio.nombre, envio.email, envio.direccion, envio.ciudad, envio.estado, envio.codigoPostal];
  if (campos.some((c) => typeof c !== "string" || c.trim() === "")) return false;
  // Validación liviana: la fuerte ya pasó en el formulario del navegador.
  // Esta es la última línea de defensa, no la experiencia de usuario.
  if (!/^\d{5}(-\d{4})?$/.test(envio.codigoPostal.trim())) return false;
  if (!/^\S+@\S+\.\S+$/.test(envio.email.trim())) return false;
  return true;
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") {
    return respuestaJson({ error: "método no soportado" }, { status: 405 }, origen);
  }
  if (!stripe) {
    // Stripe todavía no está configurado (falta STRIPE_SECRET_KEY como
    // secreto de la función). El frontend no debería ni mostrar el botón
    // de pagar mientras configuracion.pagos_habilitados esté en 0, pero
    // si algo llega igual, se responde con un error claro en vez de un
    // 500 críptico.
    return respuestaJson(
      { error: "pagos-no-configurados", mensaje: "El checkout todavía no está activado." },
      { status: 503 },
      origen
    );
  }

  let cuerpo: { items?: ItemPedido[]; envio?: DatosEnvio };
  try {
    cuerpo = await req.json();
  } catch {
    return respuestaJson({ error: "json-invalido" }, { status: 400 }, origen);
  }

  const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  if (items.length === 0) {
    return respuestaJson({ error: "carrito-vacio" }, { status: 400 }, origen);
  }
  if (!envioValido(cuerpo.envio)) {
    return respuestaJson({ error: "envio-invalido" }, { status: 400 }, origen);
  }
  const envio = cuerpo.envio as DatosEnvio;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const ids = items.map((i) => Number(i.id)).filter((id) => Number.isFinite(id));
  const [{ data: filas, error: errorFilas }, { data: configFilas, error: errorConfig }] = await Promise.all([
    supabase
      .from("perfume_overrides")
      .select("id, costo_usd, activo, estado_stock, cantidad_stock")
      .in("id", ids),
    supabase.from("configuracion").select("clave, valor").eq("clave", "margen_botella")
  ]);

  if (errorFilas || errorConfig) {
    return respuestaJson({ error: "error-base-de-datos" }, { status: 502 }, origen);
  }

  const margenBotella = configFilas && configFilas[0] ? Number(configFilas[0].valor) : 0.4;
  const filasPorId = new Map((filas || []).map((f) => [Number(f.id), f]));

  const validos: Array<ItemPedido & { precioUnitarioUsd: number; estadoStock: string }> = [];
  const rechazados: Array<{ id: number; motivo: string }> = [];

  for (const item of items) {
    const id = Number(item.id);
    const cantidad = Number(item.cantidad);
    const fila = filasPorId.get(id);

    if (!fila) { rechazados.push({ id, motivo: "no-existe" }); continue; }
    // activo=false es el único caso que bloquea; true o null (sin marcar
    // en la base) se trata como activa, igual que el resto del proyecto.
    if (fila.activo === false) { rechazados.push({ id, motivo: "desactivada" }); continue; }
    if (!(cantidad > 0)) { rechazados.push({ id, motivo: "cantidad-invalida" }); continue; }
    if (typeof fila.costo_usd !== "number") { rechazados.push({ id, motivo: "sin-precio" }); continue; }

    const estadoStock = fila.estado_stock || "bajo_pedido";
    if (estadoStock === "agotado") { rechazados.push({ id, motivo: "agotado" }); continue; }
    if (estadoStock === "en_stock" && (fila.cantidad_stock || 0) < cantidad) {
      rechazados.push({ id, motivo: "stock-insuficiente" });
      continue;
    }

    validos.push({
      id,
      nombre: String(item.nombre || "Fragancia " + id).slice(0, 200),
      cantidad,
      precioUnitarioUsd: redondear2(fila.costo_usd * (1 + margenBotella)),
      estadoStock
    });
  }

  if (validos.length === 0) {
    return respuestaJson({ url: null, ordenId: null, rechazados }, { status: 200 }, origen);
  }

  const totalUsd = redondear2(validos.reduce((s, v) => s + v.precioUnitarioUsd * v.cantidad, 0));
  const plazoEnvioDias = validos.some((v) => v.estadoStock !== "en_stock") ? "7-10" : "2";

  const { data: orden, error: errorOrden } = await supabase
    .from("ordenes")
    .insert({
      email_cliente: envio.email.trim(),
      nombre_cliente: envio.nombre.trim(),
      direccion: envio.direccion.trim(),
      ciudad: envio.ciudad.trim(),
      estado_direccion: envio.estado.trim(),
      codigo_postal: envio.codigoPostal.trim(),
      total_usd: totalUsd,
      plazo_envio_dias: plazoEnvioDias
    })
    .select("id")
    .single();

  if (errorOrden || !orden) {
    return respuestaJson({ error: "no-se-pudo-crear-la-orden" }, { status: 502 }, origen);
  }

  const { error: errorItems } = await supabase.from("orden_items").insert(
    validos.map((v) => ({
      orden_id: orden.id,
      perfume_id: v.id,
      nombre_perfume: v.nombre,
      cantidad: v.cantidad,
      precio_unitario_usd: v.precioUnitarioUsd,
      estado_stock_al_comprar: v.estadoStock
    }))
  );

  if (errorItems) {
    return respuestaJson({ error: "no-se-pudo-crear-la-orden" }, { status: 502 }, origen);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "paypal"],
    customer_email: envio.email.trim(),
    line_items: validos.map((v) => ({
      quantity: v.cantidad,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(v.precioUnitarioUsd * 100),
        product_data: { name: v.nombre }
      }
    })),
    success_url: `${SITE_URL}/?orden_id=${orden.id}&pago=exitoso`,
    cancel_url: `${SITE_URL}/?carrito=cancelado`,
    metadata: { orden_id: orden.id }
  });

  await supabase.from("ordenes").update({ stripe_session_id: session.id }).eq("id", orden.id);

  return respuestaJson({ url: session.url, ordenId: orden.id, rechazados }, { status: 200 }, origen);
});
