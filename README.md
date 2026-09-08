# Klvro

Aplicación full-stack para un bot de Discord con dashboard web, Discord OAuth2, PostgreSQL externo y pagos.

## Hosting gratuito

La configuración de producción está preparada para:

- **Render Free**: web + API + proceso del bot.
- **Supabase Free**: PostgreSQL para sesiones, configuración, tickets, warnings, Anti-Raid y Premium.
- **Monitor HTTP gratuito**: una petición a `/health` de forma periódica para comprobar disponibilidad.

El proyecto **ya no crea una base de datos en Render**, así que el Blueprint no intenta contratar PostgreSQL de Render.

> Nota: un monitor externo puede generar tráfico periódico, pero los límites y políticas del plan gratuito del proveedor siguen aplicando. Si Render suspende el servicio por cuota mensual, un ping no puede evitarlo.

## Qué incluye

- Landing de `klvro.site` en español.
- Login real con Discord OAuth2 (`identify` + `guilds`).
- Lista real de servidores donde el usuario puede administrar.
- Detección de si Klvro ya está agregado al servidor.
- Dashboard conectado a PostgreSQL.
- Bienvenidas, autoroles, tickets, antispam y bloqueo de enlaces.
- Anti-Raid configurable:
  - detección de entradas masivas;
  - filtro por edad de cuenta;
  - lockdown automático;
  - protección de canales, roles, webhooks, bans y kicks;
  - detección de asignación de permisos peligrosos;
  - whitelist por usuario/rol;
  - alerta, contención, kick o ban;
  - historial de incidentes en PostgreSQL.
- Administración con `/ban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nick`, `/role`, `/say`, `/embed`, `/userinfo`, `/serverinfo` y `/antiraid`.
- Advertencias persistentes y timeout automático configurable.
- Stripe Checkout y PayPal para Premium.
- Helmet, cookies `httpOnly`, OAuth `state` y rate limiting.

## 1. Crear PostgreSQL gratis en Supabase

Crea un proyecto en Supabase y guarda la contraseña de la base de datos.

En el panel de Supabase busca la información de conexión de PostgreSQL y copia un **connection string**. Para una app alojada en Render conviene usar el connection pooler de Supabase cuando esté disponible.

Debe tener una forma parecida a:

```text
postgresql://USUARIO:PASSWORD@HOST:6543/postgres
```

Ese valor completo se colocará en Render como:

```text
DATABASE_URL
```

No publiques esa URL en GitHub. Contiene la contraseña de la base de datos.

Klvro crea automáticamente sus tablas al arrancar por primera vez.

## 2. Discord

Necesitas estas variables del Discord Developer Portal:

```text
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN
```

En **OAuth2 > Redirects** agrega:

```text
https://klvro.site/auth/discord/callback
```

En **Bot > Privileged Gateway Intents** activa:

- Server Members Intent
- Message Content Intent

Para Anti-Raid, Klvro necesita acceso al Audit Log y permisos suficientes para gestionar/moderar las acciones que quieras proteger. El rol del bot debe estar por encima de los roles que necesite retirar.

## 3. Render Free

El `render.yaml` está configurado con:

```text
plan: free
region: virginia
build: npm install && npm run build
start: npm start
health: /health
```

### Blueprint

1. En Render abre **New > Blueprint**.
2. Selecciona el repositorio de Klvro y la rama `main`.
3. Render detectará `render.yaml`.
4. En `DATABASE_URL`, pega el connection string de Supabase.
5. Completa Discord y, si vas a activar Premium, Stripe/PayPal.
6. Aplica el Blueprint.

Variables que te solicitará:

```text
DATABASE_URL
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
```

`SESSION_SECRET` es generado automáticamente por Render.

## 4. Monitor de disponibilidad

Klvro ya expone:

```text
GET /health
```

Cuando Render te entregue una URL, configura tu monitor HTTP para consultar:

```text
https://TU-SERVICIO.onrender.com/health
```

o, después de configurar el dominio:

```text
https://klvro.site/health
```

Un intervalo de aproximadamente 5 minutos es suficiente para monitorización normal. El endpoint devuelve JSON y no toca la base de datos, así que es muy ligero.

## 5. Dominio `klvro.site`

El Blueprint incluye `klvro.site` como dominio personalizado. Render mostrará los registros DNS necesarios. Una vez verificado, HTTPS se gestiona desde Render.

Antes de probar OAuth verifica:

```text
https://klvro.site/health
```

Debe responder con `ok: true`.

## Stripe

Después del despliegue crea un webhook en:

```text
https://klvro.site/api/webhooks/stripe
```

Eventos:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

Coloca el signing secret en `STRIPE_WEBHOOK_SECRET`.

## PayPal

Configura:

```text
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_MODE=sandbox
```

Cuando termines las pruebas cambia `PAYPAL_MODE` a `live` y usa credenciales Live.

## Desarrollo local

Para desarrollo local puedes usar PostgreSQL local o también Supabase.

```bash
npm install
npm run dev:server
```

En otra terminal:

```bash
npm run dev
```

Para probar producción:

```bash
npm run build
NODE_ENV=production npm start
```

## Seguridad

Nunca subas a GitHub:

- `.env`
- `DATABASE_URL`
- token del bot
- Discord Client Secret
- claves privadas de Stripe o PayPal

Antes de cobrar Premium publica términos, privacidad y política de reembolsos.
