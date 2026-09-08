// ============================================================
//  webhook-stripe
//  Buscador de Perfumes Pro — Kaiketek
//
//  QUE HACE
//    Recibe la confirmación de pago que manda Stripe (evento
//    checkout.session.completed), marca la orden como pagada y descuenta
//    el stock de cada fragancia comprada.
//
//    Esta es la pieza que hace que el pago sea de verdad automático: el
//    cliente no depende de que alguien revise a mano que la plata llegó,
//    y el pedido queda marcado como pagado del lado del servidor aunque
//    el navegador del cliente se cierre a mitad de camino.
//
//  SEGURIDAD
//    Verifica la firma de Stripe (STRIPE_WEBHOOK_SECRET) antes de tocar
//    nada. Sin una firma válida, cualquiera podría llamar a esta URL y
//    marcar pedidos como pagados sin haber pagado.
//
//  IDEMPOTENCIA
//    Stripe reintenta un webhook si no recibe 200 a tiempo. Si la orden ya
//    está 'pagado', el evento se responde 200 sin volver a descontar
//    stock — si no, un reintento normal de Stripe descontaría dos veces.
//
//  CONFIGURACIÓN EN STRIPE
//    Dashboard de Stripe -> Developers -> Webhooks -> Add endpoint
//      URL:    https://evqifaeeamvrttuildkz.supabase.co/functions/v1/webhook-stripe
//      Evento: checkout.session.completed
//    El "Signing secret" que Stripe muestra ahí es STRIPE_WEBHOOK_SECRET.
//
//  DESPLIEGUE
//    Esta función se despliega con verify_jwt = false (ver
//    supabase/config.toml): Stripe no manda el token que Supabase exige
//    por defecto, así que exigirlo dejaría todo evento en 401 antes de
//    que el código de aquí abajo alcance a correr.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient()
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("método no soportado", { status: 405 });
  }

  const firma = req.headers.get("stripe-signature");
  const cuerpoCrudo = await req.text();

  let evento: Stripe.Event;
  try {
    // constructEventAsync (en vez de la versión síncrona) porque Deno no
    // tiene el módulo "crypto" de Node: se verifica con SubtleCrypto.
    evento = await stripe.webhooks.constructEventAsync(
      cuerpoCrudo,
      firma || "",
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    console.warn("Firma de webhook inválida:", err);
    return new Response("firma inválida", { status: 400 });
  }

  if (evento.type !== "checkout.session.completed") {
    // No es el evento que nos interesa; se responde 200 igual para que
    // Stripe no siga reintentando algo que nunca vamos a procesar.
    return new Response("ok", { status: 200 });
  }

  const session = evento.data.object as Stripe.Checkout.Session;
  const ordenId = session.metadata?.orden_id;
  if (!ordenId) {
    console.warn("Sesión de Stripe sin metadata.orden_id:", session.id);
    return new Response("sin orden_id", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: orden, error: errorOrden } = await supabase
    .from("ordenes")
    .select("id, estado_pago")
    .eq("id", ordenId)
    .single();

  if (errorOrden || !orden) {
    console.warn("Orden no encontrada para el webhook:", ordenId, errorOrden);
    return new Response("orden no encontrada", { status: 200 });
  }

  if (orden.estado_pago === "pagado") {
    // Reintento de Stripe sobre un evento que ya procesamos. Nada que hacer.
    return new Response("ya procesada", { status: 200 });
  }

  const { data: renglones } = await supabase
    .from("orden_items")
    .select("perfume_id, cantidad, estado_stock_al_comprar")
    .eq("orden_id", ordenId);

  let huboConflicto = false;

  for (const renglon of renglones || []) {
    if (renglon.estado_stock_al_comprar !== "en_stock") continue;

    // Descuento simple (leer, restar, guardar). No es perfectamente atómico
    // ante dos compras casi simultáneas del último frasco disponible — eso
    // ya se aceptó en el spec: el segundo pago igual queda confirmado, y
    // el conflicto se marca para que Kike lo resuelva a mano en vez de
    // cancelar un pago que ya se cobró.
    const { data: fila } = await supabase
      .from("perfume_overrides")
      .select("cantidad_stock")
      .eq("id", renglon.perfume_id)
      .single();

    const cantidadActual = fila ? Number(fila.cantidad_stock) || 0 : 0;
    const nuevaCantidad = cantidadActual - renglon.cantidad;

    if (nuevaCantidad < 0) huboConflicto = true;

    await supabase
      .from("perfume_overrides")
      .update({
        cantidad_stock: Math.max(nuevaCantidad, 0),
        // Se acabó la unidad lista para envío en 2 días: pasa a bajo
        // pedido (Jomashop la sigue consiguiendo), no a agotado.
        estado_stock: nuevaCantidad <= 0 ? "bajo_pedido" : "en_stock"
      })
      .eq("id", renglon.perfume_id);
  }

  await supabase
    .from("ordenes")
    .update({
      estado_pago: "pagado",
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      conflicto_stock: huboConflicto
    })
    .eq("id", ordenId);

  return new Response("ok", { status: 200 });
});
