import {
  AuditLogEvent,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildSettings, logAntiRaidIncident } from './db.mjs';

const joinBuckets = new Map();
const actionBuckets = new Map();
const lockdowns = new Map();
const punishedExecutors = new Map();

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
];

export function antiRaidCommandBuilder() {
  return new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Consulta o controla la protección Anti-Raid de Klvro.')
    .addSubcommand((s) => s.setName('status').setDescription('Muestra el estado y los límites actuales.'))
    .addSubcommand((s) => s.setName('lockdown').setDescription('Activa manualmente el modo de protección reforzada.'))
    .addSubcommand((s) => s.setName('unlock').setDescription('Desactiva el lockdown manualmente.'));
}

export function setupAntiRaid(client) {
  client.on('guildMemberAdd', (member) => protectJoin(member).catch((error) => console.error('[Klvro] antiRaid join:', error)));

  client.on('channelCreate', (channel) => {
    if (!channel.guild || channel.isThread?.()) return;
    inspectAuditAction(channel.guild, 'channel_create', AuditLogEvent.ChannelCreate, channel.id, (s) => s.protectChannels)
      .catch((error) => console.error('[Klvro] antiRaid channelCreate:', error));
  });

  client.on('channelDelete', (channel) => {
    if (!channel.guild || channel.isThread?.()) return;
    inspectAuditAction(channel.guild, 'channel_delete', AuditLogEvent.ChannelDelete, channel.id, (s) => s.protectChannels)
      .catch((error) => console.error('[Klvro] antiRaid channelDelete:', error));
  });

  client.on('roleCreate', (role) => {
    inspectAuditAction(role.guild, 'role_create', AuditLogEvent.RoleCreate, role.id, (s) => s.protectRoles)
      .catch((error) => console.error('[Klvro] antiRaid roleCreate:', error));
  });

  client.on('roleDelete', (role) => {
    inspectAuditAction(role.guild, 'role_delete', AuditLogEvent.RoleDelete, role.id, (s) => s.protectRoles)
      .catch((error) => console.error('[Klvro] antiRaid roleDelete:', error));
  });

  client.on('roleUpdate', (oldRole, newRole) => {
    const gainedDangerousPermission = DANGEROUS_PERMISSIONS.some((permission) => !oldRole.permissions.has(permission) && newRole.permissions.has(permission));
    if (!gainedDangerousPermission) return;
    inspectAuditAction(newRole.guild, 'dangerous_role_update', AuditLogEvent.RoleUpdate, newRole.id, (s) => s.protectDangerousRoles)
      .catch((error) => console.error('[Klvro] antiRaid roleUpdate:', error));
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const dangerousAdded = addedRoles.some((role) => DANGEROUS_PERMISSIONS.some((permission) => role.permissions.has(permission)));
    if (!dangerousAdded) return;
    inspectAuditAction(newMember.guild, 'dangerous_role_grant', AuditLogEvent.MemberRoleUpdate, newMember.id, (s) => s.protectDangerousRoles)
      .catch((error) => console.error('[Klvro] antiRaid memberRoleUpdate:', error));
  });

  client.on('guildBanAdd', (ban) => {
    inspectAuditAction(ban.guild, 'member_ban', AuditLogEvent.MemberBanAdd, ban.user.id, (s) => s.protectBans)
      .catch((error) => console.error('[Klvro] antiRaid guildBanAdd:', error));
  });

  client.on('guildMemberRemove', (member) => {
    setTimeout(() => {
      inspectAuditAction(member.guild, 'member_kick', AuditLogEvent.MemberKick, member.id, (s) => s.protectKicks)
        .catch((error) => console.error('[Klvro] antiRaid guildMemberRemove:', error));
    }, 700);
  });

  client.on('webhookUpdate', (channel) => {
    inspectWebhookAction(channel.guild)
      .catch((error) => console.error('[Klvro] antiRaid webhookUpdate:', error));
  });
}

export async function handleAntiRaidCommand(interaction) {
  if (interaction.commandName !== 'antiraid') return false;
  const settings = await getGuildSettings(interaction.guild.id);
  const config = settings.antiRaid;
  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const profile = effectiveProfile(config);
    const activeUntil = lockdowns.get(interaction.guild.id) || 0;
    const embed = new EmbedBuilder()
      .setTitle('Klvro Anti-Raid')
      .setColor(config.enabled ? 0x57f287 : 0xed4245)
      .addFields(
        { name: 'Estado', value: config.enabled ? '✅ Activo' : '❌ Desactivado', inline: true },
        { name: 'Modo', value: String(config.mode || 'normal'), inline: true },
        { name: 'Lockdown', value: activeUntil > Date.now() ? `Activo hasta <t:${Math.floor(activeUntil / 1000)}:R>` : 'Inactivo', inline: true },
        { name: 'Entradas', value: `${profile.joinThreshold} en ${profile.joinWindowSeconds}s`, inline: true },
        { name: 'Acciones administrativas', value: `${profile.actionThreshold} en ${profile.actionWindowSeconds}s`, inline: true },
        { name: 'Respuesta al atacante', value: String(config.executorAction || 'strip'), inline: true },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'Necesitas **Administrar servidor** para cambiar el lockdown.', ephemeral: true });
    return true;
  }

  if (!config.enabled) {
    await interaction.reply({ content: 'Primero activa Anti-Raid desde la dashboard.', ephemeral: true });
    return true;
  }

  if (sub === 'lockdown') {
    await activateLockdown(interaction.guild, settings, 'Activado manualmente', interaction.user.id);
    await interaction.reply({ content: `🛡️ Lockdown activado por ${config.lockdownMinutes || 5} minuto(s).`, ephemeral: true });
    return true;
  }

  if (sub === 'unlock') {
    lockdowns.delete(interaction.guild.id);
    await securityLog(interaction.guild, settings, 'Lockdown desactivado', `Desactivado manualmente por <@${interaction.user.id}>.`);
    await interaction.reply({ content: '✅ Lockdown desactivado.', ephemeral: true });
    return true;
  }

  return true;
}

export function isAntiRaidLockdown(guildId) {
  const until = lockdowns.get(guildId) || 0;
  if (until <= Date.now()) {
    lockdowns.delete(guildId);
    return false;
  }
  return true;
}

async function protectJoin(member) {
  const settings = await getGuildSettings(member.guild.id);
  const config = settings.antiRaid;
  if (!settings.general?.enabled || !config?.enabled || !config.joinProtection || member.user.bot) return;

  const profile = effectiveProfile(config);
  const key = member.guild.id;
  const now = Date.now();
  const recent = (joinBuckets.get(key) || []).filter((entry) => now - entry.joinedAt <= profile.joinWindowSeconds * 1000);
  recent.push({ memberId: member.id, joinedAt: now, createdAt: member.user.createdTimestamp });
  joinBuckets.set(key, recent);

  if (isAntiRaidLockdown(member.guild.id) && isYoungAccount(member.user.createdTimestamp, config.accountAgeHours)) {
    await enforceJoinAction(member, config.joinAction, 'Klvro Anti-Raid: lockdown activo');
    await recordIncident(member.guild.id, member.id, 'lockdown_join_block', config.joinAction, { accountCreatedAt: member.user.createdTimestamp });
    return;
  }

  if (recent.length < profile.joinThreshold) return;

  if (config.autoLockdown) {
    await activateLockdown(member.guild, settings, `Ráfaga de ${recent.length} entradas en ${profile.joinWindowSeconds}s`, null);
  }

  const suspicious = recent.filter((entry) => isYoungAccount(entry.createdAt, config.accountAgeHours));
  let acted = 0;
  for (const entry of suspicious) {
    const target = await member.guild.members.fetch(entry.memberId).catch(() => null);
    if (!target || target.user.bot) continue;
    const ok = await enforceJoinAction(target, config.joinAction, 'Klvro Anti-Raid: entrada sospechosa durante raid');
    if (ok) acted += 1;
  }

  await securityLog(member.guild, settings, 'Raid de entradas detectado', `Se detectaron **${recent.length} entradas** en ${profile.joinWindowSeconds}s. Cuentas nuevas afectadas: **${acted}**.`);
  await recordIncident(member.guild.id, null, 'join_raid', config.joinAction, { joins: recent.length, suspicious: suspicious.length, acted });
  joinBuckets.set(key, []);
}

async function inspectAuditAction(guild, type, auditType, targetId, protectionSelector) {
  const settings = await getGuildSettings(guild.id);
  const config = settings.antiRaid;
  if (!settings.general?.enabled || !config?.enabled || !protectionSelector(config)) return;

  await delay(550);
  const entry = await findAuditEntry(guild, auditType, targetId);
  if (!entry?.executorId) return;
  await registerExecutorAction(guild, settings, entry.executorId, type, targetId);
}

async function inspectWebhookAction(guild) {
  const settings = await getGuildSettings(guild.id);
  const config = settings.antiRaid;
  if (!settings.general?.enabled || !config?.enabled || !config.protectWebhooks) return;

  await delay(600);
  const types = [AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookUpdate, AuditLogEvent.WebhookDelete];
  for (const auditType of types) {
    const entry = await findAuditEntry(guild, auditType, null);
    if (entry?.executorId) {
      await registerExecutorAction(guild, settings, entry.executorId, 'webhook_change', entry.target?.id || null);
      return;
    }
  }
}

async function registerExecutorAction(guild, settings, executorId, type, targetId) {
  const config = settings.antiRaid;
  if (await isTrustedExecutor(guild, executorId, config)) return;

  const profile = effectiveProfile(config);
  const now = Date.now();
  const key = `${guild.id}:${executorId}`;
  const recent = (actionBuckets.get(key) || []).filter((entry) => now - entry.at <= profile.actionWindowSeconds * 1000);
  recent.push({ at: now, type, targetId });
  actionBuckets.set(key, recent);

  const threshold = isAntiRaidLockdown(guild.id) ? 1 : profile.actionThreshold;
  if (recent.length < threshold) return;

  const punishKey = `${guild.id}:${executorId}`;
  const lastPunish = punishedExecutors.get(punishKey) || 0;
  if (now - lastPunish < 60_000) return;
  punishedExecutors.set(punishKey, now);

  if (config.autoLockdown) {
    await activateLockdown(guild, settings, `${recent.length} acciones sensibles en ${profile.actionWindowSeconds}s`, executorId);
  }

  const actionTaken = await punishExecutor(guild, executorId, config.executorAction, recent);
  const summary = recent.slice(-6).map((entry) => entry.type).join(', ');
  await securityLog(guild, settings, 'Actividad administrativa sospechosa', `Ejecutor: <@${executorId}>\nEventos: **${recent.length}** en ${profile.actionWindowSeconds}s\nTipos: ${summary}\nRespuesta: **${actionTaken}**`);
  await recordIncident(guild.id, executorId, 'admin_raid', actionTaken, { events: recent });
  actionBuckets.set(key, []);
}

async function punishExecutor(guild, executorId, requestedAction, events) {
  if (executorId === guild.ownerId || executorId === guild.client.user?.id) return 'ignorado (protegido)';
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return 'alerta (miembro no disponible)';

  const action = requestedAction || 'strip';
  const reason = `Klvro Anti-Raid: ${events.length} acciones sensibles detectadas`;

  if (action === 'alert') return 'solo alerta';
  if (action === 'ban') {
    if (!member.bannable) return 'ban falló por jerarquía';
    await member.ban({ reason }).catch(() => null);
    return 'baneado';
  }
  if (action === 'kick') {
    if (!member.kickable) return 'kick falló por jerarquía';
    await member.kick(reason).catch(() => null);
    return 'expulsado';
  }

  const removable = member.roles.cache.filter((role) =>
    role.id !== guild.roles.everyone.id &&
    role.editable &&
    DANGEROUS_PERMISSIONS.some((permission) => role.permissions.has(permission))
  );

  if (removable.size) {
    await member.roles.remove([...removable.keys()], reason).catch(() => null);
  }
  if (member.moderatable) {
    await member.timeout(60 * 60_000, reason).catch(() => null);
  }
  return removable.size ? `roles peligrosos retirados (${removable.size}) + timeout` : 'timeout / contención';
}

async function enforceJoinAction(member, action, reason) {
  if (action === 'none') return false;
  if (action === 'ban') {
    if (!member.bannable) return false;
    await member.ban({ reason }).catch(() => null);
    return true;
  }
  if (!member.kickable) return false;
  await member.kick(reason).catch(() => null);
  return true;
}

async function activateLockdown(guild, settings, reason, executorId) {
  const minutes = Math.max(1, Math.min(60, Number(settings.antiRaid?.lockdownMinutes) || 5));
  const until = Date.now() + minutes * 60_000;
  const previous = lockdowns.get(guild.id) || 0;
  lockdowns.set(guild.id, Math.max(previous, until));
  await securityLog(guild, settings, '🛡️ Anti-Raid Lockdown', `${reason}\nProtección reforzada durante **${minutes} minuto(s)**.${executorId ? `\nEjecutor detectado: <@${executorId}>` : ''}`);
  await recordIncident(guild.id, executorId, 'lockdown', 'activated', { minutes, reason });
}

async function isTrustedExecutor(guild, executorId, config) {
  if (!executorId) return false;
  if (executorId === guild.ownerId || executorId === guild.client.user?.id) return true;
  if ((config.trustedUserIds || []).includes(executorId)) return true;
  if (!config.trustedRoleId) return false;
  const member = await guild.members.fetch(executorId).catch(() => null);
  return Boolean(member?.roles.cache.has(config.trustedRoleId));
}

async function findAuditEntry(guild, auditType, targetId) {
  const logs = await guild.fetchAuditLogs({ type: auditType, limit: 6 }).catch(() => null);
  if (!logs) return null;
  const now = Date.now();
  return logs.entries.find((entry) => {
    if (now - entry.createdTimestamp > 8_000) return false;
    if (targetId && entry.target?.id !== targetId) return false;
    return true;
  }) || null;
}

function effectiveProfile(config) {
  const mode = config.mode || 'normal';
  if (mode === 'strict') {
    return {
      joinThreshold: Math.min(Number(config.joinThreshold) || 8, 5),
      joinWindowSeconds: Math.max(Number(config.joinWindowSeconds) || 10, 12),
      actionThreshold: Math.min(Number(config.actionThreshold) || 3, 2),
      actionWindowSeconds: Math.max(Number(config.actionWindowSeconds) || 10, 12),
    };
  }
  if (mode === 'normal') {
    return {
      joinThreshold: Number(config.joinThreshold) || 8,
      joinWindowSeconds: Number(config.joinWindowSeconds) || 10,
      actionThreshold: Number(config.actionThreshold) || 3,
      actionWindowSeconds: Number(config.actionWindowSeconds) || 10,
    };
  }
  return {
    joinThreshold: Number(config.joinThreshold) || 8,
    joinWindowSeconds: Number(config.joinWindowSeconds) || 10,
    actionThreshold: Number(config.actionThreshold) || 3,
    actionWindowSeconds: Number(config.actionWindowSeconds) || 10,
  };
}

function isYoungAccount(createdTimestamp, ageHours) {
  const hours = Math.max(0, Number(ageHours) || 0);
  if (!hours) return false;
  return Date.now() - createdTimestamp < hours * 60 * 60_000;
}

async function securityLog(guild, settings, title, description) {
  const channelId = settings.antiRaid?.logChannelId || settings.administration?.logChannelId || settings.moderation?.logChannelId || settings.logs?.channelId;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({
    embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(0xed4245).setTimestamp()],
    allowedMentions: { parse: [] },
  }).catch(() => null);
}

async function recordIncident(guildId, executorId, type, actionTaken, details) {
  await logAntiRaidIncident({ guildId, executorId, type, actionTaken, details }).catch(() => null);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
