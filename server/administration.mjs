import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  addWarning,
  clearWarnings,
  countWarnings,
  getGuildSettings,
  listWarnings,
} from './db.mjs';

const ADMIN_COMMAND_NAMES = new Set([
  'ban', 'kick', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings',
  'purge', 'slowmode', 'lock', 'unlock', 'nick', 'role', 'say', 'embed',
  'userinfo', 'serverinfo',
]);

export function administrationCommandBuilders() {
  return [
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Banea a un usuario del servidor.')
      .addUserOption((o) => o.setName('usuario').setDescription('Usuario a banear').setRequired(true))
      .addStringOption((o) => o.setName('motivo').setDescription('Motivo del ban').setMaxLength(400))
      .addIntegerOption((o) => o.setName('borrar_dias').setDescription('Días de mensajes a borrar').setMinValue(0).setMaxValue(7)),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Expulsa a un miembro del servidor.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro a expulsar').setRequired(true))
      .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setMaxLength(400)),
    new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Silencia temporalmente a un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
      .addIntegerOption((o) => o.setName('minutos').setDescription('Duración en minutos').setMinValue(1).setMaxValue(40320))
      .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setMaxLength(400)),
    new SlashCommandBuilder()
      .setName('untimeout')
      .setDescription('Quita el timeout a un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
      .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setMaxLength(400)),
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Añade una advertencia a un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
      .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setMaxLength(400)),
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Muestra las advertencias de un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true)),
    new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('Borra todas las advertencias de un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true)),
    new SlashCommandBuilder()
      .setName('purge')
      .setDescription('Borra varios mensajes del canal actual.')
      .addIntegerOption((o) => o.setName('cantidad').setDescription('Cantidad de mensajes').setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('Configura el modo lento del canal actual.')
      .addIntegerOption((o) => o.setName('segundos').setDescription('0 para desactivar').setRequired(true).setMinValue(0).setMaxValue(21600)),
    new SlashCommandBuilder().setName('lock').setDescription('Bloquea el envío de mensajes en el canal actual.'),
    new SlashCommandBuilder().setName('unlock').setDescription('Desbloquea el canal actual.'),
    new SlashCommandBuilder()
      .setName('nick')
      .setDescription('Cambia el apodo de un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
      .addStringOption((o) => o.setName('apodo').setDescription('Nuevo apodo; vacío para quitar').setMaxLength(32)),
    new SlashCommandBuilder()
      .setName('role')
      .setDescription('Añade o quita un rol a un miembro.')
      .addSubcommand((s) => s.setName('add').setDescription('Añadir rol')
        .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)))
      .addSubcommand((s) => s.setName('remove').setDescription('Quitar rol')
        .addUserOption((o) => o.setName('usuario').setDescription('Miembro').setRequired(true))
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true))),
    new SlashCommandBuilder()
      .setName('say')
      .setDescription('Hace que Klvro envíe un mensaje.')
      .addStringOption((o) => o.setName('mensaje').setDescription('Contenido').setRequired(true).setMaxLength(1900)),
    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Envía un embed sencillo.')
      .addStringOption((o) => o.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(250))
      .addStringOption((o) => o.setName('descripcion').setDescription('Descripción').setRequired(true).setMaxLength(3900)),
    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Muestra información de un miembro.')
      .addUserOption((o) => o.setName('usuario').setDescription('Usuario; por defecto tú')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Muestra información del servidor.'),
  ];
}

export async function handleAdministrationCommand(interaction) {
  if (!ADMIN_COMMAND_NAMES.has(interaction.commandName)) return false;

  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings.administration?.enabled) {
    await interaction.reply({ content: 'El módulo de administración está desactivado desde la dashboard.', ephemeral: true });
    return true;
  }

  switch (interaction.commandName) {
    case 'ban': return handleBan(interaction, settings);
    case 'kick': return handleKick(interaction, settings);
    case 'timeout': return handleTimeout(interaction, settings);
    case 'untimeout': return handleUntimeout(interaction, settings);
    case 'warn': return handleWarn(interaction, settings);
    case 'warnings': return handleWarnings(interaction);
    case 'clearwarnings': return handleClearWarnings(interaction, settings);
    case 'purge': return handlePurge(interaction, settings);
    case 'slowmode': return handleSlowmode(interaction, settings);
    case 'lock': return handleLock(interaction, settings, false);
    case 'unlock': return handleLock(interaction, settings, true);
    case 'nick': return handleNick(interaction, settings);
    case 'role': return handleRole(interaction, settings);
    case 'say': return handleSay(interaction, settings);
    case 'embed': return handleEmbed(interaction, settings);
    case 'userinfo': return handleUserInfo(interaction);
    case 'serverinfo': return handleServerInfo(interaction);
    default: return false;
  }
}

function hasPerm(interaction, permission) {
  return interaction.memberPermissions?.has(permission);
}

async function deny(interaction, permissionName) {
  await interaction.reply({ content: `Necesitas el permiso **${permissionName}** para usar este comando.`, ephemeral: true });
  return true;
}

function reasonFor(interaction, settings, fallback) {
  const reason = interaction.options.getString('motivo')?.trim();
  if (reason) return reason;
  if (settings.administration?.requireReason) return null;
  return fallback;
}

async function fetchMember(interaction, user) {
  return interaction.guild.members.fetch(user.id).catch(() => null);
}

async function handleBan(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.BanMembers)) return deny(interaction, 'Banear miembros');
  const user = interaction.options.getUser('usuario', true);
  const reason = reasonFor(interaction, settings, 'Sin motivo especificado');
  if (!reason) return interaction.reply({ content: 'Debes indicar un motivo para esta acción.', ephemeral: true }).then(() => true);
  if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) {
    await interaction.reply({ content: 'No puedes banear a ese usuario.', ephemeral: true });
    return true;
  }
  const days = interaction.options.getInteger('borrar_dias') ?? 0;
  await interaction.guild.members.ban(user.id, { reason: `${reason} | Por ${interaction.user.tag}`, deleteMessageSeconds: days * 86400 });
  await interaction.reply({ content: `✅ ${user.tag} fue baneado.`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Ban', `${interaction.user.tag} baneó a ${user.tag}.\nMotivo: ${reason}`);
  return true;
}

async function handleKick(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.KickMembers)) return deny(interaction, 'Expulsar miembros');
  const user = interaction.options.getUser('usuario', true);
  const member = await fetchMember(interaction, user);
  const reason = reasonFor(interaction, settings, 'Sin motivo especificado');
  if (!reason) return interaction.reply({ content: 'Debes indicar un motivo para esta acción.', ephemeral: true }).then(() => true);
  if (!member?.kickable) {
    await interaction.reply({ content: 'No puedo expulsar a ese miembro. Revisa la jerarquía de roles.', ephemeral: true });
    return true;
  }
  await member.kick(`${reason} | Por ${interaction.user.tag}`);
  await interaction.reply({ content: `✅ ${user.tag} fue expulsado.`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Kick', `${interaction.user.tag} expulsó a ${user.tag}.\nMotivo: ${reason}`);
  return true;
}

async function handleTimeout(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ModerateMembers)) return deny(interaction, 'Moderar miembros');
  const user = interaction.options.getUser('usuario', true);
  const member = await fetchMember(interaction, user);
  const minutes = interaction.options.getInteger('minutos') ?? settings.administration.defaultTimeoutMinutes ?? 10;
  const reason = reasonFor(interaction, settings, 'Timeout administrativo');
  if (!reason) return interaction.reply({ content: 'Debes indicar un motivo para esta acción.', ephemeral: true }).then(() => true);
  if (!member?.moderatable) {
    await interaction.reply({ content: 'No puedo aplicar timeout a ese miembro. Revisa la jerarquía de roles.', ephemeral: true });
    return true;
  }
  await member.timeout(minutes * 60_000, `${reason} | Por ${interaction.user.tag}`);
  await interaction.reply({ content: `✅ ${user.tag} recibió timeout por ${minutes} minuto(s).`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Timeout', `${interaction.user.tag} aplicó ${minutes} min a ${user.tag}.\nMotivo: ${reason}`);
  return true;
}

async function handleUntimeout(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ModerateMembers)) return deny(interaction, 'Moderar miembros');
  const user = interaction.options.getUser('usuario', true);
  const member = await fetchMember(interaction, user);
  const reason = reasonFor(interaction, settings, 'Timeout retirado');
  if (!reason) return interaction.reply({ content: 'Debes indicar un motivo para esta acción.', ephemeral: true }).then(() => true);
  if (!member?.moderatable) {
    await interaction.reply({ content: 'No puedo modificar a ese miembro.', ephemeral: true });
    return true;
  }
  await member.timeout(null, `${reason} | Por ${interaction.user.tag}`);
  await interaction.reply({ content: `✅ Timeout retirado a ${user.tag}.`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Timeout retirado', `${interaction.user.tag} retiró el timeout a ${user.tag}.`);
  return true;
}

async function handleWarn(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ModerateMembers)) return deny(interaction, 'Moderar miembros');
  const user = interaction.options.getUser('usuario', true);
  const reason = reasonFor(interaction, settings, 'Advertencia administrativa');
  if (!reason) return interaction.reply({ content: 'Debes indicar un motivo para esta acción.', ephemeral: true }).then(() => true);
  if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) {
    await interaction.reply({ content: 'No puedes advertir a ese usuario.', ephemeral: true });
    return true;
  }

  await addWarning({ guildId: interaction.guild.id, userId: user.id, moderatorId: interaction.user.id, reason });
  const total = await countWarnings(interaction.guild.id, user.id);
  let timeoutText = '';
  if (settings.administration.autoTimeoutOnWarnLimit && total >= settings.administration.warnLimit) {
    const member = await fetchMember(interaction, user);
    if (member?.moderatable) {
      const minutes = settings.administration.defaultTimeoutMinutes || 10;
      await member.timeout(minutes * 60_000, `Límite de advertencias alcanzado (${total})`).catch(() => null);
      timeoutText = ` Se aplicó timeout de ${minutes} min.`;
    }
  }

  await interaction.reply({ content: `⚠️ ${user.tag} recibió una advertencia. Total: ${total}.${timeoutText}`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Advertencia', `${interaction.user.tag} advirtió a ${user.tag}.\nMotivo: ${reason}\nTotal: ${total}`);
  return true;
}

async function handleWarnings(interaction) {
  if (!hasPerm(interaction, PermissionFlagsBits.ModerateMembers)) return deny(interaction, 'Moderar miembros');
  const user = interaction.options.getUser('usuario', true);
  const rows = await listWarnings(interaction.guild.id, user.id, 10);
  if (!rows.length) {
    await interaction.reply({ content: `${user.tag} no tiene advertencias.`, ephemeral: true });
    return true;
  }
  const lines = rows.map((row, index) => `${index + 1}. ${row.reason} — <@${row.moderator_id}> · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Advertencias de ${user.tag}`).setDescription(lines.join('\n')).setColor(0xf0b232)], ephemeral: true });
  return true;
}

async function handleClearWarnings(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ModerateMembers)) return deny(interaction, 'Moderar miembros');
  const user = interaction.options.getUser('usuario', true);
  const removed = await clearWarnings(interaction.guild.id, user.id);
  await interaction.reply({ content: `✅ Se eliminaron ${removed} advertencia(s) de ${user.tag}.`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Advertencias borradas', `${interaction.user.tag} limpió las advertencias de ${user.tag}.`);
  return true;
}

async function handlePurge(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageMessages)) return deny(interaction, 'Gestionar mensajes');
  if (!interaction.channel?.isTextBased() || typeof interaction.channel.bulkDelete !== 'function') {
    await interaction.reply({ content: 'Este canal no permite borrado masivo.', ephemeral: true });
    return true;
  }
  const amount = interaction.options.getInteger('cantidad', true);
  await interaction.deferReply({ ephemeral: true });
  const deleted = await interaction.channel.bulkDelete(amount, true);
  await interaction.editReply(`✅ Se borraron ${deleted.size} mensaje(s).`);
  await adminLog(interaction.guild, settings, 'Purge', `${interaction.user.tag} borró ${deleted.size} mensajes en <#${interaction.channelId}>.`);
  return true;
}

async function handleSlowmode(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageChannels)) return deny(interaction, 'Gestionar canales');
  const seconds = interaction.options.getInteger('segundos', true);
  if (!('setRateLimitPerUser' in interaction.channel)) {
    await interaction.reply({ content: 'Este tipo de canal no soporta modo lento.', ephemeral: true });
    return true;
  }
  await interaction.channel.setRateLimitPerUser(seconds, `Configurado por ${interaction.user.tag}`);
  await interaction.reply({ content: seconds ? `✅ Modo lento configurado a ${seconds}s.` : '✅ Modo lento desactivado.', ephemeral: true });
  await adminLog(interaction.guild, settings, 'Slowmode', `${interaction.user.tag} configuró <#${interaction.channelId}> a ${seconds}s.`);
  return true;
}

async function handleLock(interaction, settings, unlock) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageChannels)) return deny(interaction, 'Gestionar canales');
  if (!interaction.channel?.permissionOverwrites) {
    await interaction.reply({ content: 'Este canal no admite permisos editables.', ephemeral: true });
    return true;
  }
  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: unlock ? null : false,
    AddReactions: unlock ? null : false,
    SendMessagesInThreads: unlock ? null : false,
  }, { reason: `${unlock ? 'Unlock' : 'Lock'} por ${interaction.user.tag}` });
  await interaction.reply({ content: unlock ? '🔓 Canal desbloqueado.' : '🔒 Canal bloqueado.', ephemeral: true });
  await adminLog(interaction.guild, settings, unlock ? 'Canal desbloqueado' : 'Canal bloqueado', `${interaction.user.tag} modificó <#${interaction.channelId}>.`);
  return true;
}

async function handleNick(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageNicknames)) return deny(interaction, 'Gestionar apodos');
  const user = interaction.options.getUser('usuario', true);
  const member = await fetchMember(interaction, user);
  const nickname = interaction.options.getString('apodo') || null;
  if (!member?.manageable) {
    await interaction.reply({ content: 'No puedo cambiar el apodo de ese miembro.', ephemeral: true });
    return true;
  }
  await member.setNickname(nickname, `Por ${interaction.user.tag}`);
  await interaction.reply({ content: nickname ? `✅ Apodo cambiado a **${nickname}**.` : '✅ Apodo eliminado.', ephemeral: true });
  await adminLog(interaction.guild, settings, 'Apodo', `${interaction.user.tag} cambió el apodo de ${user.tag}.`);
  return true;
}

async function handleRole(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageRoles)) return deny(interaction, 'Gestionar roles');
  const action = interaction.options.getSubcommand();
  const user = interaction.options.getUser('usuario', true);
  const role = interaction.options.getRole('rol', true);
  const member = await fetchMember(interaction, user);
  if (!member || !role.editable) {
    await interaction.reply({ content: 'No puedo administrar ese rol o miembro. Revisa la jerarquía.', ephemeral: true });
    return true;
  }
  if (action === 'add') await member.roles.add(role, `Por ${interaction.user.tag}`);
  else await member.roles.remove(role, `Por ${interaction.user.tag}`);
  await interaction.reply({ content: `✅ Rol ${action === 'add' ? 'añadido' : 'retirado'} correctamente.`, ephemeral: true });
  await adminLog(interaction.guild, settings, 'Rol', `${interaction.user.tag} ${action === 'add' ? 'añadió' : 'quitó'} @${role.name} a ${user.tag}.`);
  return true;
}

async function handleSay(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageMessages)) return deny(interaction, 'Gestionar mensajes');
  const message = interaction.options.getString('mensaje', true);
  await interaction.channel.send({ content: message, allowedMentions: { parse: [] } });
  await interaction.reply({ content: '✅ Mensaje enviado.', ephemeral: true });
  await adminLog(interaction.guild, settings, 'Say', `${interaction.user.tag} usó /say en <#${interaction.channelId}>.`);
  return true;
}

async function handleEmbed(interaction, settings) {
  if (!hasPerm(interaction, PermissionFlagsBits.ManageMessages)) return deny(interaction, 'Gestionar mensajes');
  const title = interaction.options.getString('titulo', true);
  const description = interaction.options.getString('descripcion', true);
  await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x5865f2)] });
  await interaction.reply({ content: '✅ Embed enviado.', ephemeral: true });
  await adminLog(interaction.guild, settings, 'Embed', `${interaction.user.tag} publicó un embed en <#${interaction.channelId}>.`);
  return true;
}

async function handleUserInfo(interaction) {
  const user = interaction.options.getUser('usuario') || interaction.user;
  const member = await fetchMember(interaction, user);
  const created = Math.floor(user.createdTimestamp / 1000);
  const joined = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const roles = member ? member.roles.cache.filter((role) => role.id !== interaction.guild.roles.everyone.id).map((role) => role.toString()).slice(0, 12).join(' ') : '—';
  const embed = new EmbedBuilder()
    .setTitle(`Información de ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setColor(0x5865f2)
    .addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Cuenta creada', value: `<t:${created}:R>`, inline: true },
      { name: 'Entró al servidor', value: joined ? `<t:${joined}:R>` : 'No disponible', inline: true },
      { name: 'Roles', value: roles || 'Ninguno' },
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleServerInfo(interaction) {
  const guild = interaction.guild;
  const owner = await guild.fetchOwner().catch(() => null);
  const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 128 }))
    .setColor(0x5865f2)
    .addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Dueño', value: owner ? owner.user.tag : 'No disponible', inline: true },
      { name: 'Miembros', value: String(guild.memberCount), inline: true },
      { name: 'Canales', value: `${textChannels} texto · ${voiceChannels} voz`, inline: true },
      { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
      { name: 'Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function adminLog(guild, settings, title, description) {
  const channelId = settings.administration?.logChannelId || settings.moderation?.logChannelId || settings.logs?.channelId;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({
    embeds: [new EmbedBuilder().setTitle(`Administración · ${title}`).setDescription(description).setColor(0x5865f2).setTimestamp()],
  }).catch(() => null);
}
