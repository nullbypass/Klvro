import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const DEFAULT_SETTINGS = {
  general: {
    enabled: true,
    prefix: '!',
    language: 'Español',
    timezone: 'America/Santo_Domingo',
    activity: 'Klvro',
  },
  welcome: {
    enabled: false,
    channelId: '',
    message: 'Bienvenido {user} a {server}. Ya somos {memberCount} miembros.',
    dm: false,
  },
  tickets: {
    enabled: false,
    categoryId: '',
    staffRoleId: '',
    logChannelId: '',
    transcript: true,
  },
  moderation: {
    enabled: false,
    antiSpam: false,
    antiLinks: false,
    logChannelId: '',
    muteRoleId: '',
  },
  antiRaid: {
    enabled: false,
    mode: 'normal',
    joinProtection: true,
    joinThreshold: 8,
    joinWindowSeconds: 10,
    accountAgeHours: 24,
    joinAction: 'kick',
    autoLockdown: true,
    lockdownMinutes: 5,
    protectChannels: true,
    protectRoles: true,
    protectBans: true,
    protectKicks: true,
    protectWebhooks: true,
    protectDangerousRoles: true,
    actionThreshold: 3,
    actionWindowSeconds: 10,
    executorAction: 'strip',
    logChannelId: '',
    trustedRoleId: '',
    trustedUserIds: [],
  },
  administration: {
    enabled: true,
    logChannelId: '',
    defaultTimeoutMinutes: 10,
    warnLimit: 3,
    autoTimeoutOnWarnLimit: true,
    requireReason: true,
  },
  autoroles: {
    enabled: false,
    roleId: '',
    bots: false,
  },
  logs: {
    enabled: false,
    channelId: '',
    messages: true,
    members: true,
    voice: false,
  },
  commands: {
    enabled: true,
    slash: true,
    legacyPrefix: false,
  },
};

export function defaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      global_name TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      settings JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT UNIQUE NOT NULL,
      opener_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS tickets_guild_opener_idx
      ON tickets (guild_id, opener_id, status);

    CREATE TABLE IF NOT EXISTS moderation_warnings (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS moderation_warnings_lookup_idx
      ON moderation_warnings (guild_id, user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS anti_raid_incidents (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      executor_id TEXT,
      incident_type TEXT NOT NULL,
      action_taken TEXT,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS anti_raid_incidents_guild_idx
      ON anti_raid_incidents (guild_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS premium_access (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_payment_id TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_receipts (
      provider TEXT NOT NULL,
      provider_payment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, provider_payment_id)
    );
  `);
}

export async function upsertUser(user) {
  await pool.query(
    `INSERT INTO users (id, username, global_name, avatar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       global_name = EXCLUDED.global_name,
       avatar = EXCLUDED.avatar,
       updated_at = NOW()`,
    [user.id, user.username, user.global_name ?? null, user.avatar ?? null]
  );
}

function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object') {
      out[key] = mergeDeep(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function getGuildSettings(guildId) {
  const { rows } = await pool.query('SELECT settings FROM guild_settings WHERE guild_id = $1', [guildId]);
  return rows[0] ? mergeDeep(defaultSettings(), rows[0].settings) : defaultSettings();
}

export async function saveGuildSettings(guildId, settings, userId) {
  const clean = mergeDeep(defaultSettings(), settings);
  await pool.query(
    `INSERT INTO guild_settings (guild_id, settings, updated_by)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (guild_id) DO UPDATE SET
       settings = EXCLUDED.settings,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [guildId, JSON.stringify(clean), userId]
  );
  return clean;
}

export async function createTicketRecord({ guildId, channelId, openerId }) {
  const { rows } = await pool.query(
    `INSERT INTO tickets (guild_id, channel_id, opener_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [guildId, channelId, openerId]
  );
  return rows[0];
}

export async function findOpenTicket(guildId, openerId) {
  const { rows } = await pool.query(
    `SELECT * FROM tickets
     WHERE guild_id = $1 AND opener_id = $2 AND status = 'open'
     ORDER BY created_at DESC LIMIT 1`,
    [guildId, openerId]
  );
  return rows[0] ?? null;
}

export async function findTicketByChannel(channelId) {
  const { rows } = await pool.query(
    `SELECT * FROM tickets WHERE channel_id = $1 AND status = 'open' LIMIT 1`,
    [channelId]
  );
  return rows[0] ?? null;
}

export async function closeTicketRecord(channelId) {
  await pool.query(
    `UPDATE tickets SET status = 'closed', closed_at = NOW()
     WHERE channel_id = $1 AND status = 'open'`,
    [channelId]
  );
}

export async function addWarning({ guildId, userId, moderatorId, reason }) {
  const { rows } = await pool.query(
    `INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [guildId, userId, moderatorId, reason]
  );
  return rows[0];
}

export async function listWarnings(guildId, userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));
  const { rows } = await pool.query(
    `SELECT id, moderator_id, reason, created_at
     FROM moderation_warnings
     WHERE guild_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [guildId, userId, safeLimit]
  );
  return rows;
}

export async function countWarnings(guildId, userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM moderation_warnings
     WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );
  return rows[0]?.count ?? 0;
}

export async function clearWarnings(guildId, userId) {
  const result = await pool.query(
    `DELETE FROM moderation_warnings WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );
  return result.rowCount;
}

export async function logAntiRaidIncident({ guildId, executorId = null, type, actionTaken = null, details = {} }) {
  await pool.query(
    `INSERT INTO anti_raid_incidents (guild_id, executor_id, incident_type, action_taken, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [guildId, executorId, type, actionTaken, JSON.stringify(details)]
  );
}

export async function getPremiumAccess(userId) {
  const { rows } = await pool.query(
    `SELECT plan, provider, expires_at
     FROM premium_access
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function grantPremium({ userId, plan, provider, paymentId, amount, currency, days }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const receipt = await client.query(
      `INSERT INTO payment_receipts (provider, provider_payment_id, user_id, plan, amount, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (provider, provider_payment_id) DO NOTHING
       RETURNING provider_payment_id`,
      [provider, paymentId, userId, plan, amount, currency]
    );

    if (receipt.rowCount === 0) {
      await client.query('ROLLBACK');
      return { duplicate: true };
    }

    await client.query(
      `INSERT INTO premium_access (user_id, plan, provider, provider_payment_id, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         provider = EXCLUDED.provider,
         provider_payment_id = EXCLUDED.provider_payment_id,
         expires_at = GREATEST(premium_access.expires_at, NOW()) + ($5 || ' days')::interval,
         updated_at = NOW()`,
      [userId, plan, provider, paymentId, String(days)]
    );

    await client.query('COMMIT');
    return { duplicate: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
