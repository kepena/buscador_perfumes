# Edge Functions — carrito y checkout con Stripe

Tres funciones, todas en `supabase/functions/`:

- **crear-checkout** — recibe el carrito, valida precio y stock contra la
  base de datos, y crea la sesión de pago de Stripe.
- **webhook-stripe** — Stripe le avisa aquí cuando un pago se completó;
  marca la orden como pagada y descuenta stock.
- **estado-orden** — lectura mínima para la pantalla de confirmación del
  cliente (no expone nombre/dirección/email).

## Antes de desplegar (prerrequisitos de Kike)

1. Migrar la cuenta de PayPal de personal a Business.
2. Crear la cuenta de Stripe y activar PayPal como método de pago dentro
   de Stripe.
3. Sacar del dashboard de Stripe: `publishable key`, `secret key`, y (tras
   crear el webhook, ver abajo) el `webhook signing secret`.

## Cómo se despliega

Necesitas el [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
y logueado (`supabase login`), con el proyecto ya vinculado
(`supabase link --project-ref evqifaeeamvrttuildkz`).

```bash
# 1) Cargar los secretos (una sola vez; se pueden actualizar después)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 2) Desplegar las tres funciones
supabase functions deploy crear-checkout
supabase functions deploy estado-orden
supabase functions deploy webhook-stripe
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **no** hay que configurarlos:
Supabase los inyecta solo en cada Edge Function.

`supabase/config.toml` ya marca `webhook-stripe` con `verify_jwt = false`
(Stripe no manda el token que Supabase exige por defecto) — el CLI lo lee
solo al desplegar, no hace falta pasar ninguna bandera aparte.

## Conectar el webhook en Stripe

Dashboard de Stripe → Developers → Webhooks → **Add endpoint**:

- URL: `https://evqifaeeamvrttuildkz.supabase.co/functions/v1/webhook-stripe`
- Evento a escuchar: `checkout.session.completed`

Al crearlo, Stripe muestra el "Signing secret" (`whsec_...`) — ese es el
`STRIPE_WEBHOOK_SECRET` del paso 1.

## Activar el checkout en el sitio

Con las tres funciones desplegadas y el webhook conectado, entra a
`catalogo.html` y activa el interruptor de pagos (`pagos_habilitados`).
Mientras esté apagado, el sitio se comporta exactamente igual que antes de
esta feature — el carrito no aparece en ningún lado.

## Probar antes de activar en producción

Usa las llaves de **modo test** de Stripe (`sk_test_...` / `whsec_...` del
webhook en modo test) y tarjetas de prueba
(`4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC) antes de
cambiar a las llaves reales.
