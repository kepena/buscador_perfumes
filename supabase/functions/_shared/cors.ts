// Cabeceras CORS compartidas por las funciones que llama el navegador
// directamente (crear-checkout, estado-orden). webhook-stripe no las
// necesita: a esa la llama Stripe desde su servidor, no un navegador.
//
// El sitio vive en un solo dominio fijo, así que se restringe a ese
// origen en vez de "*" — no hay necesidad de aceptar llamadas desde
// cualquier sitio a una función que crea sesiones de pago reales.
const ORIGENES_PERMITIDOS = [
  "https://buscadorperfumes.kaiketek.com",
  // Para probar en local antes de publicar cambios.
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

export function cabecerasCors(origen: string | null): Record<string, string> {
  const permitido = origen && ORIGENES_PERMITIDOS.indexOf(origen) !== -1
    ? origen
    : ORIGENES_PERMITIDOS[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

export function respuestaJson(body: unknown, init: ResponseInit, origen: string | null): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...cabecerasCors(origen),
      ...(init.headers || {})
    }
  });
}
