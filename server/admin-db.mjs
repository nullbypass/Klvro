import crypto from 'node:crypto';
import { pool } from './db.mjs';

export async function initAdminDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_bans (
      user_id TEXT PRIMARY KEY,
      reason TEXT NOT NULL DEFAULT '',
      banned_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS admin_actions_created_idx
      ON admin_actions (created_at DESC);
    CREATE INDEX IF NOT EXISTS admin_actions_target_idx
      ON admin_actions (target_user_id, created_at DESC);
  `);
}

export async function getUserBan(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, reason, banned_by, created_at
     FROM user_bans
     WHERE user_id = $1
     LIMIT 1`,
    [String(userId)]
  );
  return rows[0] ?? null;
}

export async function banUser({ userId, adminId, reason = '' }) {
  const cleanReason = String(reason || '').trim().slice(0, 500);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO user_bans (user_id, reason, banned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         reason = EXCLUDED.reason,
         banned_by = EXCLUDED.banned_by,
         created_at = NOW()
       RETURNING user_id, reason, banned_by, created_at`,
      [String(userId), cleanReason, String(adminId)]
    );
    await client.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action, details)
       VALUES ($1, $2, 'ban', $3::jsonb)`,
      [String(adminId), String(userId), JSON.stringify({ reason: cleanReason })]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function unbanUser({ userId, adminId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM user_bans WHERE user_id = $1', [String(userId)]);
    await client.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action, details)
       VALUES ($1, $2, 'unban', $3::jsonb)`,
      [String(adminId), String(userId), JSON.stringify({ existed: result.rowCount > 0 })]
    );
    await client.query('COMMIT');
    return { unbanned: result.rowCount > 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function grantManualPremium({ userId, adminId, plan, days }) {
  const paymentId = `admin-${crypto.randomUUID()}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO premium_access (user_id, plan, provider, provider_payment_id, expires_at)
       VALUES ($1, $2, 'admin', $3, NOW() + ($4 || ' days')::interval)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         provider = 'admin',
         provider_payment_id = EXCLUDED.provider_payment_id,
         expires_at = GREATEST(premium_access.expires_at, NOW()) + ($4 || ' days')::interval,
         updated_at = NOW()
       RETURNING user_id, plan, provider, expires_at`,
      [String(userId), String(plan), paymentId, String(days)]
    );
    await client.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action, details)
       VALUES ($1, $2, 'premium_grant', $3::jsonb)`,
      [String(adminId), String(userId), JSON.stringify({ plan, days })]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function searchAdminUsers(search = '', limit = 40) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 40));
  const term = String(search || '').trim().slice(0, 80);
  const params = [];
  let where = '';
  if (term) {
    params.push(`%${term}%`);
    where = `WHERE u.id ILIKE $1 OR u.username ILIKE $1 OR COALESCE(u.global_name, '') ILIKE $1`;
  }
  params.push(safeLimit);
  const limitParam = `$${params.length}`;

  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.global_name,
       u.avatar,
       u.created_at,
       b.reason AS ban_reason,
       b.created_at AS banned_at,
       p.plan AS premium_plan,
       p.provider AS premium_provider,
       p.expires_at AS premium_expires_at
     FROM users u
     LEFT JOIN user_bans b ON b.user_id = u.id
     LEFT JOIN premium_access p ON p.user_id = u.id AND p.expires_at > NOW()
     ${where}
     ORDER BY u.updated_at DESC
     LIMIT ${limitParam}`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    globalName: row.global_name,
    avatar: row.avatar,
    createdAt: row.created_at,
    banned: Boolean(row.banned_at),
    banReason: row.ban_reason || '',
    bannedAt: row.banned_at,
    premium: row.premium_plan ? {
      plan: row.premium_plan,
      provider: row.premium_provider,
      expiresAt: row.premium_expires_at,
    } : null,
  }));
}

export async function getAdminOverview() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM user_bans) AS bans,
      (SELECT COUNT(*)::int FROM premium_access WHERE expires_at > NOW()) AS premium
  `);
  return rows[0] || { users: 0, bans: 0, premium: 0 };
}

export async function listAdminActions(limit = 30) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const { rows } = await pool.query(
    `SELECT a.id, a.admin_id, a.target_user_id, a.action, a.details, a.created_at,
            u.username, u.global_name
     FROM admin_actions a
     LEFT JOIN users u ON u.id = a.target_user_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows.map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    targetUserId: row.target_user_id,
    action: row.action,
    details: row.details || {},
    createdAt: row.created_at,
    username: row.username,
    globalName: row.global_name,
  }));
}
