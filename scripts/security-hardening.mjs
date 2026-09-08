import fs from 'node:fs';

const read = (url) => fs.readFileSync(url, 'utf8');
const write = (url, text) => fs.writeFileSync(url, text);
const root = new URL('./', import.meta.url);
const file = (relative) => new URL(`../${relative}`, root);

const indexPath = file('server/index.mjs');
const dbPath = file('server/db.mjs');
const paymentsPath = file('server/payments.mjs');

let index = read(indexPath);
let db = read(dbPath);

const paypalOnlyPayments = `import crypto from 'node:crypto';
import { grantPremium } from './db.mjs';
import { PLANS } from './plans.mjs';
import { sendPremiumThankYouEmail } from './mailer.mjs';

function appUrl(path = '/') {
  const base = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\\/$/, '');
  return \`\${base}\${path}\`;
}

export function getPlan(planId) {
  const id = String(planId || '');
  const plan = PLANS[id];
  if (!plan) {
    const error = new Error('Plan inválido.');
    error.status = 400;
    throw error;
  }
  return plan;
}

async function grantAndNotify({ userId, plan, provider, paymentId, email }) {
  const result = await grantPremium({
    userId,
    plan: plan.id,
    provider,
    paymentId,
    amount: plan.amount,
    currency: plan.currency,
    days: plan.days,
  });

  if (!result?.duplicate && email) {
    await sendPremiumThankYouEmail({
      to: email,
      plan,
      provider,
      amount: plan.amount,
      currency: plan.currency,
      days: plan.days,
    });
  }

  return result;
}

function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function paypalFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
}

async function paypalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const error = new Error('PayPal todavía no está configurado.');
    error.status = 503;
    throw error;
  }

  const auth = Buffer.from(\`\${process.env.PAYPAL_CLIENT_ID}:\${process.env.PAYPAL_CLIENT_SECRET}\`).toString('base64');
  const response = await paypalFetch(\`\${paypalBaseUrl()}/v1/oauth2/token\`, {
    method: 'POST',
    headers: {
      Authorization: \`Basic \${auth}\`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error_description || 'No se pudo autenticar con PayPal.');
    error.status = 502;
    throw error;
  }
  return data.access_token;
}

export async function createPayPalOrder({ userId, planId }) {
  if (!/^\\d{16,22}$/.test(String(userId || ''))) {
    const error = new Error('Usuario inválido.');
    error.status = 400;
    throw error;
  }

  const plan = getPlan(planId);
  const token = await paypalAccessToken();
  const response = await paypalFetch(\`\${paypalBaseUrl()}/v2/checkout/orders\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${token}\`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: appUrl('/billing/paypal/success'),
            cancel_url: appUrl('/?billing=cancelled'),
          },
        },
      },
      purchase_units: [
        {
          custom_id: \`\${userId}:\${plan.id}\`,
          description: plan.description,
          amount: {
            currency_code: plan.currency.toUpperCase(),
            value: (plan.amount / 100).toFixed(2),
          },
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'No se pudo crear la orden de PayPal.');
    error.status = 502;
    throw error;
  }

  const approve = data.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve');
  if (!approve?.href || !/^https:\\/\\/(www\\.)?paypal\\.com\\//i.test(approve.href)) {
    throw new Error('PayPal no devolvió un enlace de aprobación válido.');
  }

  return { orderId: data.id, url: approve.href };
}

function centsFromPayPal(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export async function capturePayPalOrder(orderId) {
  const safeOrderId = String(orderId || '');
  if (!/^[A-Z0-9-]{8,64}$/i.test(safeOrderId)) {
    const error = new Error('Orden de PayPal inválida.');
    error.status = 400;
    throw error;
  }

  const token = await paypalAccessToken();
  const currentResponse = await paypalFetch(\`\${paypalBaseUrl()}/v2/checkout/orders/\${encodeURIComponent(safeOrderId)}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  let order = await currentResponse.json();
  if (!currentResponse.ok) {
    const error = new Error(order.message || 'No se pudo consultar la orden de PayPal.');
    error.status = 502;
    throw error;
  }

  if (order.status !== 'COMPLETED') {
    const response = await paypalFetch(\`\${paypalBaseUrl()}/v2/checkout/orders/\${encodeURIComponent(safeOrderId)}/capture\`, {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': \`capture-\${safeOrderId}\`,
      },
      body: '{}',
    });

    order = await response.json();
    if (!response.ok) {
      const error = new Error(order.message || 'No se pudo capturar el pago de PayPal.');
      error.status = 502;
      throw error;
    }
  }

  if (order.status !== 'COMPLETED') {
    const error = new Error('El pago de PayPal todavía no está completado.');
    error.status = 400;
    throw error;
  }

  const purchaseUnit = order.purchase_units?.[0];
  const [userId, planId] = String(purchaseUnit?.custom_id || '').split(':');
  if (!/^\\d{16,22}$/.test(userId || '')) {
    throw new Error('La orden de PayPal no contiene un usuario válido.');
  }

  const plan = getPlan(planId);
  const capture = purchaseUnit?.payments?.captures?.find((item) => item.status === 'COMPLETED')
    || purchaseUnit?.payments?.captures?.[0];
  const paid = capture?.amount || purchaseUnit?.amount;
  const paidCurrency = String(paid?.currency_code || '').toUpperCase();
  const paidCents = centsFromPayPal(paid?.value);

  if (paidCurrency !== plan.currency.toUpperCase() || paidCents !== plan.amount) {
    const error = new Error('El importe confirmado por PayPal no coincide con el plan.');
    error.status = 400;
    throw error;
  }

  const captureId = String(capture?.id || order.id);
  const email = String(order.payer?.email_address || '').slice(0, 254) || null;
  const grant = await grantAndNotify({
    userId,
    plan,
    provider: 'paypal',
    paymentId: captureId,
    email,
  });

  return { userId, plan: plan.id, duplicate: Boolean(grant?.duplicate) };
}
`;

write(paymentsPath, paypalOnlyPayments);

// Remove Stripe from the backend completely. The site is PayPal-only.
index = index.replace(
  /import \{\s*capturePayPalOrder,\s*createPayPalOrder,\s*createStripeCheckout,\s*finalizeStripeSession,\s*stripe,\s*\} from '\.\/payments\.mjs';/m,
  "import { capturePayPalOrder, createPayPalOrder } from './payments.mjs';"
);
index = index.replace(
  /const stripeWebhook = express\.raw\(\{ type: 'application\/json' \}\);\napp\.post\('\/api\/webhooks\/stripe', stripeWebhook, async \(req, res\) => \{[\s\S]*?\n\}\);\n\n/,
  ''
);
index = index.replace(
  /app\.post\('\/api\/billing\/stripe', requireAuth, async \(req, res, next\) => \{[\s\S]*?\n\}\);\n\n/,
  ''
);
index = index.replace(
  /app\.get\('\/billing\/stripe\/success', async \(req, res\) => \{[\s\S]*?\n\}\);\n\n/,
  ''
);

// Refuse weak production session secrets.
if (!index.includes('const sessionSecret = process.env.SESSION_SECRET;')) {
  index = index.replace(
    'const PgSession = connectPgSimple(session);\n\napp.set',
    `const PgSession = connectPgSimple(session);\nconst sessionSecret = process.env.SESSION_SECRET;\nif (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 32)) {\n  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción.');\n}\n\napp.set`
  );
}
index = index.replace(
  "secret: process.env.SESSION_SECRET || 'dev-only-change-me',",
  "secret: sessionSecret || crypto.randomBytes(32).toString('hex'),"
);
if (!index.includes("priority: 'high'")) {
  index = index.replace("sameSite: 'lax',\n    maxAge:", "sameSite: 'lax',\n    priority: 'high',\n    maxAge:");
}

// CSRF / cross-site request protection and tighter billing throttling.
if (!index.includes('function requireSameOrigin(req, res, next)')) {
  index = index.replace(
    "app.use('/api', apiLimiter);\napp.use('/auth', authLimiter);",
    `app.use('/api', apiLimiter);\napp.use('/auth', authLimiter);\n\nconst billingLimiter = rateLimit({\n  windowMs: 10 * 60_000,\n  limit: 20,\n  standardHeaders: 'draft-7',\n  legacyHeaders: false,\n});\napp.use('/api/billing/paypal', billingLimiter);\n\nfunction requireSameOrigin(req, res, next) {\n  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();\n\n  const origin = req.get('origin');\n  const secFetchSite = req.get('sec-fetch-site');\n  let expected = null;\n  try { expected = new URL(process.env.PUBLIC_URL || 'http://localhost:3000').origin; } catch {}\n\n  if (origin && expected && origin !== expected) {\n    return res.status(403).json({ error: 'Solicitud de origen no permitido.' });\n  }\n  if (secFetchSite && !['same-origin', 'none'].includes(secFetchSite)) {\n    return res.status(403).json({ error: 'Solicitud entre sitios bloqueada.' });\n  }\n  if (process.env.NODE_ENV === 'production' && !origin && !secFetchSite) {\n    return res.status(403).json({ error: 'No se pudo validar el origen de la solicitud.' });\n  }\n  next();\n}\n\napp.use('/api', requireSameOrigin);\napp.use('/auth/logout', requireSameOrigin);\napp.use('/api', (req, res, next) => {\n  if (req.session?.user?.id) res.setHeader('Cache-Control', 'no-store');\n  next();\n});`
  );
}

// Reject malformed Discord snowflakes before they reach auth/DB logic.
if (!index.includes("app.param('guildId'")) {
  index = index.replace(
    'function requireAuth(req, res, next) {',
    `app.param('guildId', (req, res, next, value) => {\n  if (!/^\\d{16,22}$/.test(String(value || ''))) {\n    return res.status(400).json({ error: 'ID de servidor inválido.' });\n  }\n  next();\n});\n\nfunction requireAuth(req, res, next) {`
  );
}

// Rotate the session ID after successful OAuth to prevent session fixation.
if (!index.includes('function regenerateSession(req)')) {
  index = index.replace(
    'async function refreshDiscordToken(req) {',
    `function regenerateSession(req) {\n  return new Promise((resolve, reject) => {\n    req.session.regenerate((error) => error ? reject(error) : resolve());\n  });\n}\n\nasync function refreshDiscordToken(req) {`
  );
}
if (!index.includes('await regenerateSession(req);')) {
  index = index.replace('    req.session.user = {', '    await regenerateSession(req);\n\n    req.session.user = {');
}

// Permission cache is short-lived; all writes re-check Discord live and fail closed.
if (index.includes('function decorateManageableGuilds(guilds)') && !index.includes('MANAGEABLE_GUILDS_TTL_MS')) {
  index = index.replace(
    'function decorateManageableGuilds(guilds) {',
    'const MANAGEABLE_GUILDS_TTL_MS = 2 * 60_000;\n\nfunction decorateManageableGuilds(guilds) {'
  );
}
index = index.replace(
`  if (!force && Array.isArray(req.session.manageableGuilds)) {
    return decorateManageableGuilds(req.session.manageableGuilds);
  }`,
`  const cacheFresh = Array.isArray(req.session.manageableGuilds)
    && Number.isFinite(req.session.manageableGuildsFetchedAt)
    && Date.now() - req.session.manageableGuildsFetchedAt < MANAGEABLE_GUILDS_TTL_MS;
  if (!force && cacheFresh) {
    return decorateManageableGuilds(req.session.manageableGuilds);
  }`
);
index = index.replace(
`  if (!response.ok) {
    if (Array.isArray(req.session.manageableGuilds)) {
      return decorateManageableGuilds(req.session.manageableGuilds);
    }
    throw new Error('No se pudieron obtener los servidores de Discord.');
  }`,
`  if (!response.ok) {
    if (!force && cacheFresh) {
      return decorateManageableGuilds(req.session.manageableGuilds);
    }
    const error = new Error('No se pudieron verificar tus permisos de Discord.');
    error.status = 502;
    throw error;
  }`
);
index = index.replace(
  '  req.session.manageableGuilds = manageable;\n  return decorateManageableGuilds(manageable);',
  '  req.session.manageableGuilds = manageable;\n  req.session.manageableGuildsFetchedAt = Date.now();\n  return decorateManageableGuilds(manageable);'
);
index = index.replace(
  '    const guilds = await fetchManageableGuilds(req);\n    const guild = guilds.find((item) => item.id === req.params.guildId);',
  "    const force = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);\n    const guilds = await fetchManageableGuilds(req, { force });\n    const guild = guilds.find((item) => item.id === req.params.guildId);"
);

// Do not echo internal exception messages from redirect helpers.
index = index.replace("res.status(503).send(error.message);", "res.status(503).send('No se pudo crear la invitación de Discord.');");

// Safer deep merge to block prototype pollution from malformed stored/config objects.
const unsafeMerge = `function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object') {
      out[key] = mergeDeep(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}`;
const safeMerge = `const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeDeep(base, patch) {
  const out = isPlainObject(base) ? { ...base } : {};
  if (!isPlainObject(patch)) return out;

  for (const [key, value] of Object.entries(patch)) {
    if (BLOCKED_OBJECT_KEYS.has(key)) continue;
    const current = out[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      out[key] = mergeDeep(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}`;
if (db.includes(unsafeMerge)) db = db.replace(unsafeMerge, safeMerge);

if (!db.includes('statement_timeout: 10_000')) {
  db = db.replace(
    '  connectionTimeoutMillis: 10_000,\n  allowExitOnIdle: false,',
    '  connectionTimeoutMillis: 10_000,\n  statement_timeout: 10_000,\n  query_timeout: 12_000,\n  allowExitOnIdle: false,'
  );
}

write(indexPath, index);
write(dbPath, db);
console.log('[Klvro] Security hardening applied.');
