// ============================================================
//  estado-orden
//  Buscador de Perfumes Pro — Kaiketek
//
//  QUE HACE
//    Le dice a la pantalla de confirmación si un pedido ya quedó pagado,
//    sin exponer la tabla `ordenes` completa al navegador.
//
//    Solo devuelve lo que el cliente necesita ver: estado del pago, total,
//    plazo de envío y el resumen de fragancias. Nunca nombre, dirección ni
//    email — aunque alguien más consiguiera este orden_id (es un uuid, no
//    es adivinable), no vería datos personales de otra persona.
//
//  ENTRADA (POST, JSON)  { ordenId: string }
//
//  SALIDA (JSON)
//    { encontrada: true, estadoPago, totalUsd, plazoEnvioDias, conflictoStock, items }
//    { encontrada: false }
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { cabecerasCors, respuestaJson } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecerasCors(origen) });
  }
  if (req.method !== "POST") {
    return respuestaJson({ error: "método no soportado" }, { status: 405 }, origen);
  }

  let cuerpo: { ordenId?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return respuestaJson({ error: "json-invalido" }, { status: 400 }, origen);
  }

  const ordenId = typeof cuerpo.ordenId === "string" ? cuerpo.ordenId : "";
  if (!ordenId) {
    return respuestaJson({ error: "falta-orden-id" }, { status: 400 }, origen);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: orden } = await supabase
    .from("ordenes")
    .select("estado_pago, total_usd, plazo_envio_dias, conflicto_stock")
    .eq("id", ordenId)
    .single();

  if (!orden) {
    return respuestaJson({ encontrada: false }, { status: 200 }, origen);
  }

  const { data: items } = await supabase
    .from("orden_items")
    .select("nombre_perfume, cantidad, precio_unitario_usd")
    .eq("orden_id", ordenId);

  return respuestaJson(
    {
      encontrada: true,
      estadoPago: orden.estado_pago,
      totalUsd: orden.total_usd,
      plazoEnvioDias: orden.plazo_envio_dias,
      conflictoStock: orden.conflicto_stock,
      items: (items || []).map((i) => ({
        nombre: i.nombre_perfume,
        cantidad: i.cantidad,
        precioUnitarioUsd: i.precio_unitario_usd
      }))
    },
    { status: 200 },
    origen
  );
});
