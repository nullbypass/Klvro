# Klvro

Aplicación full-stack para un bot de Discord con dashboard web, Discord OAuth2, PostgreSQL y pagos.

## Qué incluye

- Landing de `klvro.site` en español.
- Login real con Discord OAuth2 (`identify` + `guilds`).
- Lista real de servidores donde el usuario puede administrar.
- Detección de si Klvro ya está agregado al servidor.
- Invitación real del bot con permisos necesarios.
- Dashboard conectado a PostgreSQL.
- Canales y roles obtenidos directamente desde Discord.
- Módulos funcionales:
  - Bienvenidas y DM opcional.
  - Autoroles.
  - Tickets con `/ticketpanel`, botón para abrir ticket y `/close`.
  - Antispam.
  - Bloqueo de enlaces.
  - Logs de miembros, mensajes eliminados y canales de voz.
  - Slash commands `/ping`, `/panel`, `/ticketpanel` y `/close`.
  - Comandos antiguos opcionales `!ping` y `!panel` usando el prefijo configurado.
- Premium de 30 días:
  - Lite: US$2.99.
  - Pro: US$5.99.
  - PayPal con Orders v2.
  - Tarjeta con Stripe Checkout.
- Sesiones persistentes en PostgreSQL.
- Helmet, cookies `httpOnly`, OAuth `state` y rate limiting.
- `render.yaml` listo para Render.

## Arquitectura

En producción se usa **un único Web Service de Render**:

1. Render ejecuta `npm install && npm run build`.
2. Vite genera `dist/`.
3. Express sirve el frontend de `dist/` y todas las rutas `/api`, `/auth` y `/billing`.
4. El mismo proceso mantiene la conexión Gateway del bot de Discord.
5. PostgreSQL guarda sesiones, configuraciones, tickets y Premium.

Esto evita CORS y permite usar el mismo dominio `https://klvro.site` para todo.

## Variables de entorno

Copia `.env.example` a `.env` para desarrollo.

### Discord

Desde el Discord Developer Portal necesitas:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`

En **OAuth2 > Redirects** agrega exactamente:

```text
https://klvro.site/auth/discord/callback
```

Para desarrollo también puedes agregar:

```text
http://localhost:3000/auth/discord/callback
```

En **Bot > Privileged Gateway Intents** activa:

- Server Members Intent
- Message Content Intent

Klvro usa `GuildVoiceStates`, que no es privilegiado.

`REGISTER_COMMANDS=true` registra los slash commands al iniciar el servicio.

## Stripe para tarjetas

1. Crea una cuenta de Stripe.
2. Copia tu Secret Key a `STRIPE_SECRET_KEY`.
3. Después de tener Klvro desplegado, crea un webhook apuntando a:

```text
https://klvro.site/api/webhooks/stripe
```

Escucha al menos:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

4. Copia el signing secret del webhook a `STRIPE_WEBHOOK_SECRET`.

No necesitas crear productos o precios manualmente: el backend crea el precio del pago al abrir Checkout.

## PayPal

1. En PayPal Developer crea una REST App.
2. Coloca Client ID y Secret en:

```text
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
```

Mientras pruebas usa:

```text
PAYPAL_MODE=sandbox
```

Cuando ya hayas probado los pagos y uses credenciales Live cambia a:

```text
PAYPAL_MODE=live
```

Klvro crea la orden en el servidor, manda al usuario a PayPal y captura el pago cuando PayPal regresa al sitio.

## Subir a Render con Blueprint

El proyecto incluye `render.yaml`.

1. Sube esta carpeta completa a GitHub.
2. En Render pulsa **New > Blueprint**.
3. Conecta el repositorio.
4. Render detectará `render.yaml`.
5. Durante la creación te pedirá los secretos marcados con `sync: false`:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_BOT_TOKEN`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
6. Render crea el Web Service y PostgreSQL automáticamente.

El Blueprint usa el plan de Web Service `0.5c-512mb` y PostgreSQL `0.1c-256mb`. Es intencional: el bot necesita un proceso que permanezca encendido. Un Web Service gratuito puede apagarse por inactividad y dejaría el bot offline.

## Dominio klvro.site

El Blueprint solicita el dominio `klvro.site`. Render te mostrará los registros DNS que debes configurar en el proveedor donde compraste el dominio.

Después de que el dominio quede verificado, Render gestiona HTTPS automáticamente.

Antes de probar OAuth confirma que esta URL abre correctamente:

```text
https://klvro.site/health
```

Debe devolver JSON con `ok: true`.

## Desarrollo local

Necesitas Node.js 20+ y PostgreSQL.

Instala dependencias:

```bash
npm install
```

Terminal 1, backend:

```bash
npm run dev:server
```

Terminal 2, frontend:

```bash
npm run dev
```

Vite corre en `http://localhost:5173` y hace proxy al backend en `http://localhost:3000`.

Para probar el build de producción:

```bash
npm run build
NODE_ENV=production npm start
```

Luego abre `http://localhost:3000`.

## Importante antes de abrir Klvro al público

- Cambia PayPal de Sandbox a Live solo después de probarlo.
- Usa las claves Live correctas de Stripe.
- Prueba pagos pequeños antes de anunciar Premium.
- No publiques `.env`, tokens, Client Secrets ni claves privadas en GitHub.
- Revisa la política de privacidad, términos y política de reembolsos antes de cobrar a usuarios.
- Mantén el bot en un plan de Render que no se suspenda por inactividad.
