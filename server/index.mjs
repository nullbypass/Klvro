import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ChannelType } from 'discord.js';
import {
  getGuildSettings,
  getPremiumAccess,
  initDb,
  pool,
  saveGuildSettings,
  upsertUser,
} from './db.mjs';
import {
  bot,
  botHasGuild,
  botIsReady,
  buildInviteUrl,
  canManageGuild,
  getGuildChannelsAndRoles,
  startBot,
} from './discord.mjs';
import {
  capturePayPalOrder,
  createPayPalOrder,
  createStripeCheckout,
  finalizeStripeSession,
  stripe,
} from './payments.mjs';
import { publicPlans } from './plans.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const app = express();
const PgSession = connectPgSimple(session);

app.set('trust proxy', 1);

const stripeWebhook = express.raw({ type: 'application/json' });
app.post('/api/webhooks/stripe', stripeWebhook, async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe no configurado.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook inválido: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await finalizeStripeSession(event.data.object.id);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('[Klvro] Stripe webhook:', error);
    return res.status(500).json({ error: 'No se pudo procesar el webhook.' });
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  name: 'klvro.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
}));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);
app.use('/auth', authLimiter);

function publicUrl(pathname = '') {
  const base = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${pathname}`;
}

function discordRedirectUri() {
  return process.env.DISCORD_REDIRECT_URI || publicUrl('/auth/discord/callback');
}

function requireAuth(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  next();
}

async function refreshDiscordToken(req) {
  const oauth = req.session.discord;
  if (!oauth?.refreshToken) throw new Error('La sesión de Discord no tiene refresh token.');
  if (oauth.expiresAt && oauth.expiresAt > Date.now() + 60_000) return oauth.accessToken;

  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: oauth.refreshToken,
  });

  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || 'Discord rechazó la renovación de sesión.');

  req.session.discord = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || oauth.refreshToken,
    expiresAt: Date.now() + (token.expires_in * 1000),
  };
  return token.access_token;
}

async function fetchManageableGuilds(req) {
  const accessToken = await refreshDiscordToken(req);
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true&limit=200', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('No se pudieron obtener los servidores de Discord.');
  const guilds = await response.json();

  return guilds
    .filter(canManageGuild)
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      permissions: guild.permissions,
      memberCount: guild.approximate_member_count ?? null,
      presenceCount: guild.approximate_presence_count ?? null,
      icon: guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : null,
      botAdded: botHasGuild(guild.id),
    }));
}

async function requireGuildAccess(req, res, next) {
  try {
    const guilds = await fetchManageableGuilds(req);
    const guild = guilds.find((item) => item.id === req.params.guildId);
    if (!guild) return res.status(403).json({ error: 'No tienes permiso para administrar este servidor.' });
    req.manageableGuild = guild;
    next();
  } catch (error) {
    next(error);
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, botReady: botIsReady(), timestamp: new Date().toISOString() });
});

app.get('/auth/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.status(503).send('Discord OAuth todavía no está configurado.');
  }

  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: discordRedirectUri(),
    scope: 'identify guilds',
    state,
    prompt: 'consent',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/discord/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send('La validación de seguridad OAuth falló. Intenta iniciar sesión otra vez.');
    }
    delete req.session.oauthState;

    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: discordRedirectUri(),
    });

    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error_description || 'Discord rechazó el código OAuth.');

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = await userResponse.json();
    if (!userResponse.ok) throw new Error('No se pudo leer el perfil de Discord.');

    req.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : null,
    };
    req.session.discord = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + (token.expires_in * 1000),
    };

    await upsertUser(user);
    req.session.save(() => res.redirect('/app'));
  } catch (error) {
    next(error);
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('klvro.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', async (req, res, next) => {
  try {
    if (!req.session.user?.id) return res.json({ authenticated: false, user: null, premium: null });
    const premium = await getPremiumAccess(req.session.user.id);
    res.json({ authenticated: true, user: req.session.user, premium });
  } catch (error) {
    next(error);
  }
});

app.get('/api/status', (_req, res) => {
  res.json({
    botReady: botIsReady(),
    guildCount: botIsReady() ? bot.guilds.cache.size : 0,
    latency: botIsReady() ? Math.max(0, Math.round(bot.ws.ping)) : null,
  });
});

app.get('/api/guilds', requireAuth, async (req, res, next) => {
  try {
    res.json({ guilds: await fetchManageableGuilds(req) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/discord/invite', (req, res) => {
  try {
    res.redirect(buildInviteUrl(req.query.guildId ? String(req.query.guildId) : undefined));
  } catch (error) {
    res.status(503).send(error.message);
  }
});

app.get('/api/guilds/:guildId/settings', requireAuth, requireGuildAccess, async (req, res, next) => {
  try {
    const settings = await getGuildSettings(req.params.guildId);
    res.json({ guild: req.manageableGuild, settings });
  } catch (error) {
    next(error);
  }
});

app.put('/api/guilds/:guildId/settings', requireAuth, requireGuildAccess, async (req, res, next) => {
  try {
    const settings = sanitizeSettings(req.body?.settings ?? req.body);
    const saved = await saveGuildSettings(req.params.guildId, settings, req.session.user.id);
    res.json({ ok: true, settings: saved });
  } catch (error) {
    next(error);
  }
});

app.get('/api/guilds/:guildId/resources', requireAuth, requireGuildAccess, async (req, res, next) => {
  try {
    if (!botHasGuild(req.params.guildId)) {
      return res.status(409).json({ error: 'Primero añade Klvro a este servidor.' });
    }
    const resources = await getGuildChannelsAndRoles(req.params.guildId);
    res.json(resources);
  } catch (error) {
    next(error);
  }
});

app.get('/api/billing/plans', (_req, res) => {
  res.json({ plans: publicPlans() });
});

app.get('/api/billing/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ premium: await getPremiumAccess(req.session.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/stripe', requireAuth, async (req, res, next) => {
  try {
    const url = await createStripeCheckout({ userId: req.session.user.id, planId: req.body.plan });
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/paypal', requireAuth, async (req, res, next) => {
  try {
    const order = await createPayPalOrder({ userId: req.session.user.id, planId: req.body.plan });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.get('/billing/stripe/success', async (req, res) => {
  try {
    if (!req.query.session_id) return res.redirect('/?billing=error');
    await finalizeStripeSession(String(req.query.session_id));
    return res.redirect('/?billing=success');
  } catch (error) {
    console.error('[Klvro] Stripe success:', error);
    return res.redirect('/?billing=error');
  }
});

app.get('/billing/paypal/success', async (req, res) => {
  try {
    if (!req.query.token) return res.redirect('/?billing=error');
    await capturePayPalOrder(String(req.query.token));
    return res.redirect('/?billing=success');
  } catch (error) {
    console.error('[Klvro] PayPal success:', error);
    return res.redirect('/?billing=error');
  }
});

function sanitizeSettings(input) {
  const body = input && typeof input === 'object' ? input : {};
  const bool = (value) => Boolean(value);
  const str = (value, max = 2000) => String(value ?? '').slice(0, max);
  const id = (value) => {
    const text = String(value ?? '');
    return /^\d{16,22}$/.test(text) ? text : '';
  };
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  };
  const ids = (value) => {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/);
    return [...new Set(list.map((item) => String(item).trim()).filter((item) => /^\d{16,22}$/.test(item)))].slice(0, 50);
  };

  return {
    general: {
      enabled: bool(body.general?.enabled),
      prefix: str(body.general?.prefix || '!', 5),
      language: ['Español', 'English'].includes(body.general?.language) ? body.general.language : 'Español',
      timezone: str(body.general?.timezone || 'America/Santo_Domingo', 80),
      activity: str(body.general?.activity || 'Klvro', 100),
    },
    welcome: {
      enabled: bool(body.welcome?.enabled),
      channelId: id(body.welcome?.channelId),
      message: str(body.welcome?.message, 1900),
      dm: bool(body.welcome?.dm),
    },
    tickets: {
      enabled: bool(body.tickets?.enabled),
      categoryId: id(body.tickets?.categoryId),
      staffRoleId: id(body.tickets?.staffRoleId),
      logChannelId: id(body.tickets?.logChannelId),
      transcript: bool(body.tickets?.transcript),
    },
    moderation: {
      enabled: bool(body.moderation?.enabled),
      antiSpam: bool(body.moderation?.antiSpam),
      antiLinks: bool(body.moderation?.antiLinks),
      logChannelId: id(body.moderation?.logChannelId),
      muteRoleId: id(body.moderation?.muteRoleId),
    },
    antiRaid: {
      enabled: bool(body.antiRaid?.enabled),
      mode: ['normal', 'strict', 'custom'].includes(body.antiRaid?.mode) ? body.antiRaid.mode : 'normal',
      joinProtection: bool(body.antiRaid?.joinProtection),
      joinThreshold: number(body.antiRaid?.joinThreshold, 8, 2, 100),
      joinWindowSeconds: number(body.antiRaid?.joinWindowSeconds, 10, 2, 120),
      accountAgeHours: number(body.antiRaid?.accountAgeHours, 24, 0, 8760),
      joinAction: ['none', 'kick', 'ban'].includes(body.antiRaid?.joinAction) ? body.antiRaid.joinAction : 'kick',
      autoLockdown: bool(body.antiRaid?.autoLockdown),
      lockdownMinutes: number(body.antiRaid?.lockdownMinutes, 5, 1, 60),
      protectChannels: bool(body.antiRaid?.protectChannels),
      protectRoles: bool(body.antiRaid?.protectRoles),
      protectBans: bool(body.antiRaid?.protectBans),
      protectKicks: bool(body.antiRaid?.protectKicks),
      protectWebhooks: bool(body.antiRaid?.protectWebhooks),
      protectDangerousRoles: bool(body.antiRaid?.protectDangerousRoles),
      actionThreshold: number(body.antiRaid?.actionThreshold, 3, 1, 50),
      actionWindowSeconds: number(body.antiRaid?.actionWindowSeconds, 10, 2, 120),
      executorAction: ['alert', 'strip', 'kick', 'ban'].includes(body.antiRaid?.executorAction) ? body.antiRaid.executorAction : 'strip',
      logChannelId: id(body.antiRaid?.logChannelId),
      trustedRoleId: id(body.antiRaid?.trustedRoleId),
      trustedUserIds: ids(body.antiRaid?.trustedUserIds),
    },
    administration: {
      enabled: bool(body.administration?.enabled),
      logChannelId: id(body.administration?.logChannelId),
      defaultTimeoutMinutes: number(body.administration?.defaultTimeoutMinutes, 10, 1, 40320),
      warnLimit: number(body.administration?.warnLimit, 3, 1, 20),
      autoTimeoutOnWarnLimit: bool(body.administration?.autoTimeoutOnWarnLimit),
      requireReason: bool(body.administration?.requireReason),
    },
    autoroles: {
      enabled: bool(body.autoroles?.enabled),
      roleId: id(body.autoroles?.roleId),
      bots: bool(body.autoroles?.bots),
    },
    logs: {
      enabled: bool(body.logs?.enabled),
      channelId: id(body.logs?.channelId),
      messages: bool(body.logs?.messages),
      members: bool(body.logs?.members),
      voice: bool(body.logs?.voice),
    },
    commands: {
      enabled: bool(body.commands?.enabled),
      slash: bool(body.commands?.slash),
      legacyPrefix: bool(body.commands?.legacyPrefix),
    },
  };
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir, { maxAge: '1h', etag: true }));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error('[Klvro] Error:', error);
  const status = Number(error.status) || 500;
  res.status(status).json({
    error: status >= 500 ? 'Ocurrió un error interno.' : error.message,
    ...(process.env.NODE_ENV !== 'production' && { detail: error.message }),
  });
});

const port = Number(process.env.PORT || 3000);

try {
  await initDb();
  await startBot().catch((error) => console.error('[Klvro] Bot no pudo iniciar:', error));
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Klvro] Web escuchando en 0.0.0.0:${port}`);
  });
} catch (error) {
  console.error('[Klvro] No se pudo iniciar:', error);
  process.exit(1);
}
