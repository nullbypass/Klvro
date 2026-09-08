import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import {
  closeTicketRecord,
  createTicketRecord,
  findOpenTicket,
  findTicketByChannel,
  getGuildSettings,
} from './db.mjs';
import { administrationCommandBuilders, handleAdministrationCommand } from './administration.mjs';
import { antiRaidCommandBuilder, handleAntiRaidCommand, setupAntiRaid } from './anti-raid.mjs';

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let started = false;
const spamBuckets = new Map();

export function botIsReady() {
  return bot.isReady();
}

export function botHasGuild(guildId) {
  return bot.guilds.cache.has(guildId);
}

export function canManageGuild(partialGuild) {
  if (partialGuild.owner) return true;
  try {
    const permissions = new PermissionsBitField(BigInt(partialGuild.permissions || '0'));
    return permissions.has(PermissionFlagsBits.Administrator) || permissions.has(PermissionFlagsBits.ManageGuild);
  } catch {
    return false;
  }
}

export function buildInviteUrl(guildId) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error('DISCORD_CLIENT_ID no está configurado.');

  const permissions = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageNicknames,
  ]).bitfield.toString();

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions,
  });

  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function getGuildChannelsAndRoles(guildId) {
  const guild = await bot.guilds.fetch(guildId);
  const [channels, roles] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);

  const channelList = [...channels.values()]
    .filter(Boolean)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const roleList = [...roles.values()]
    .filter((role) => role.id !== guild.roles.everyone.id && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({ id: role.id, name: role.name, color: role.hexColor }));

  return { channels: channelList, roles: roleList };
}

export async function startBot() {
  if (started || !process.env.DISCORD_BOT_TOKEN) return;
  started = true;

  wireEvents();
  await bot.login(process.env.DISCORD_BOT_TOKEN);
}

function wireEvents() {
  setupAntiRaid(bot);

  bot.once('ready', async () => {
    bot.user.setActivity('Klvro');
    console.log(`[Klvro] Bot conectado como ${bot.user.tag} en ${bot.guilds.cache.size} servidores.`);
    if (process.env.REGISTER_COMMANDS === 'true') {
      try {
        await registerCommands();
        console.log('[Klvro] Slash commands registrados.');
      } catch (error) {
        console.error('[Klvro] No se pudieron registrar los slash commands:', error);
      }
    }
  });

  bot.on('guildMemberAdd', async (member) => {
    try {
      const settings = await getGuildSettings(member.guild.id);
      if (!settings.general?.enabled) return;

      if (settings.autoroles?.enabled && settings.autoroles.roleId) {
        if (!member.user.bot || settings.autoroles.bots) {
          await member.roles.add(settings.autoroles.roleId).catch(() => null);
        }
      }

      if (settings.welcome?.enabled && settings.welcome.channelId) {
        const channel = await member.guild.channels.fetch(settings.welcome.channelId).catch(() => null);
        if (channel?.isTextBased()) {
          const text = renderWelcome(settings.welcome.message, member);
          await channel.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => null);
        }

        if (settings.welcome.dm) {
          await member.send(renderWelcome(settings.welcome.message, member)).catch(() => null);
        }
      }

      if (settings.logs?.enabled && settings.logs.members) {
        await sendLog(member.guild, settings.logs.channelId, {
          title: 'Miembro nuevo',
          description: `${member.user.tag} (${member.id}) entró al servidor.`,
        });
      }
    } catch (error) {
      console.error('[Klvro] guildMemberAdd:', error);
    }
  });

  bot.on('guildMemberRemove', async (member) => {
    try {
      const settings = await getGuildSettings(member.guild.id);
      if (!settings.general?.enabled) return;
      if (settings.logs?.enabled && settings.logs.members) {
        await sendLog(member.guild, settings.logs.channelId, {
          title: 'Miembro salió',
          description: `${member.user?.tag ?? member.id} (${member.id}) salió del servidor.`,
        });
      }
    } catch (error) {
      console.error('[Klvro] guildMemberRemove:', error);
    }
  });

  bot.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    try {
      const settings = await getGuildSettings(message.guild.id);
      if (!settings.general?.enabled) return;

      if (settings.commands?.enabled && settings.commands.legacyPrefix && message.content.startsWith(settings.general.prefix || '!')) {
        const command = message.content.slice((settings.general.prefix || '!').length).trim().split(/\s+/)[0]?.toLowerCase();
        if (command === 'ping') {
          await message.reply(`Pong: ${Math.max(0, Math.round(bot.ws.ping))} ms`).catch(() => null);
          return;
        }
        if (command === 'panel') {
          await message.reply(`${process.env.PUBLIC_URL || 'https://klvro.site'}/app`).catch(() => null);
          return;
        }
      }

      if (!settings.moderation?.enabled) return;

      const memberCanModerate = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
      if (memberCanModerate) return;

      if (settings.moderation.antiLinks && /(?:https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i.test(message.content)) {
        await message.delete().catch(() => null);
        const notice = await message.channel.send(`${message.author}, los enlaces están bloqueados en este servidor.`).catch(() => null);
        if (notice) setTimeout(() => notice.delete().catch(() => null), 5000);
        await moderationLog(message.guild, settings, `Se eliminó un enlace de ${message.author.tag} en #${message.channel.name}.`);
        return;
      }

      if (settings.moderation.antiSpam && isSpamming(message.guild.id, message.author.id)) {
        await message.delete().catch(() => null);
        if (message.member?.moderatable) {
          await message.member.timeout(30_000, 'Antispam de Klvro').catch(() => null);
        }
        await moderationLog(message.guild, settings, `Antispam activado para ${message.author.tag}.`);
      }
    } catch (error) {
      console.error('[Klvro] messageCreate:', error);
    }
  });

  bot.on('messageDelete', async (message) => {
    if (!message.guild) return;
    try {
      const settings = await getGuildSettings(message.guild.id);
      if (!settings.general?.enabled) return;
      if (!settings.logs?.enabled || !settings.logs.messages) return;
      await sendLog(message.guild, settings.logs.channelId, {
        title: 'Mensaje eliminado',
        description: `Canal: <#${message.channelId}>\nAutor: ${message.author?.tag ?? 'desconocido'}`,
      });
    } catch (error) {
      console.error('[Klvro] messageDelete:', error);
    }
  });


  bot.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    try {
      const settings = await getGuildSettings(guild.id);
      if (!settings.general?.enabled || !settings.logs?.enabled || !settings.logs.voice) return;
      if (oldState.channelId === newState.channelId) return;

      let description;
      if (!oldState.channelId && newState.channelId) {
        description = `<@${newState.id}> entró a <#${newState.channelId}>.`;
      } else if (oldState.channelId && !newState.channelId) {
        description = `<@${oldState.id}> salió de <#${oldState.channelId}>.`;
      } else {
        description = `<@${newState.id}> se movió de <#${oldState.channelId}> a <#${newState.channelId}>.`;
      }

      await sendLog(guild, settings.logs.channelId, { title: 'Canal de voz', description });
    } catch (error) {
      console.error('[Klvro] voiceStateUpdate:', error);
    }
  });

  bot.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      console.error('[Klvro] interactionCreate:', error);
      const payload = { content: 'Ocurrió un error procesando esa acción.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => null);
      else await interaction.reply(payload).catch(() => null);
    }
  });
}

function renderWelcome(template, member) {
  return String(template || 'Bienvenido {user} a {server}.')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', String(member.guild.memberCount));
}

function isSpamming(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const recent = (spamBuckets.get(key) || []).filter((timestamp) => now - timestamp < 6000);
  recent.push(now);
  spamBuckets.set(key, recent);
  return recent.length >= 6;
}

async function moderationLog(guild, settings, description) {
  if (!settings.moderation.logChannelId) return;
  await sendLog(guild, settings.moderation.logChannelId, { title: 'Moderación', description });
}

async function sendLog(guild, channelId, { title, description }) {
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865f2)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => null);
}

async function handleSlashCommand(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Este comando solo funciona dentro de un servidor.', ephemeral: true });
    return;
  }

  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings.general?.enabled || !settings.commands?.enabled || !settings.commands?.slash) {
    await interaction.reply({ content: 'Los comandos de Klvro están desactivados en este servidor.', ephemeral: true });
    return;
  }

  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: `Pong: ${Math.max(0, Math.round(bot.ws.ping))} ms`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'panel') {
    await interaction.reply({ content: `${process.env.PUBLIC_URL || 'https://klvro.site'}/app`, ephemeral: true });
    return;
  }

  if (await handleAntiRaidCommand(interaction)) return;
  if (await handleAdministrationCommand(interaction)) return;

  if (interaction.commandName === 'ticketpanel') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Necesitas el permiso **Administrar servidor**.', ephemeral: true });
      return;
    }

    if (!settings.tickets?.enabled) {
      await interaction.reply({ content: 'Primero activa el módulo de tickets desde la dashboard.', ephemeral: true });
      return;
    }

    const button = new ButtonBuilder()
      .setCustomId('klvro_ticket_create')
      .setLabel('Abrir ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);
    await interaction.channel.send({
      embeds: [new EmbedBuilder().setTitle('Soporte').setDescription('Pulsa el botón para abrir un ticket privado.').setColor(0x5865f2)],
      components: [row],
    });
    await interaction.reply({ content: 'Panel de tickets publicado.', ephemeral: true });
    return;
  }

  if (interaction.commandName === 'close') {
    await closeTicketFromInteraction(interaction);
  }
}

async function handleButton(interaction) {
  if (!interaction.guild) return;
  if (interaction.customId === 'klvro_ticket_create') {
    await createTicketFromInteraction(interaction);
  } else if (interaction.customId === 'klvro_ticket_close') {
    await closeTicketFromInteraction(interaction);
  }
}

async function createTicketFromInteraction(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings.tickets?.enabled) {
    await interaction.editReply('El sistema de tickets está desactivado.');
    return;
  }

  const existing = await findOpenTicket(interaction.guild.id, interaction.user.id);
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
    if (existingChannel) {
      await interaction.editReply(`Ya tienes un ticket abierto: <#${existing.channel_id}>`);
      return;
    }
    await closeTicketRecord(existing.channel_id);
  }

  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'usuario';
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  if (settings.tickets.staffRoleId) {
    overwrites.push({
      id: settings.tickets.staffRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`,
    type: ChannelType.GuildText,
    parent: settings.tickets.categoryId || undefined,
    permissionOverwrites: overwrites,
    reason: `Ticket de ${interaction.user.tag}`,
  });

  await createTicketRecord({ guildId: interaction.guild.id, channelId: channel.id, openerId: interaction.user.id });

  const closeButton = new ButtonBuilder()
    .setCustomId('klvro_ticket_close')
    .setLabel('Cerrar ticket')
    .setStyle(ButtonStyle.Danger);

  await channel.send({
    content: `<@${interaction.user.id}>${settings.tickets.staffRoleId ? ` <@&${settings.tickets.staffRoleId}>` : ''}`,
    embeds: [new EmbedBuilder().setTitle('Ticket abierto').setDescription('Explica aquí lo que necesitas. El staff responderá cuando esté disponible.').setColor(0x5865f2)],
    components: [new ActionRowBuilder().addComponents(closeButton)],
    allowedMentions: { users: [interaction.user.id], roles: settings.tickets.staffRoleId ? [settings.tickets.staffRoleId] : [] },
  });

  if (settings.tickets.logChannelId) {
    await sendLog(interaction.guild, settings.tickets.logChannelId, {
      title: 'Ticket abierto',
      description: `<@${interaction.user.id}> abrió <#${channel.id}>.`,
    });
  }

  await interaction.editReply(`Ticket creado: <#${channel.id}>`);
}

async function closeTicketFromInteraction(interaction) {
  const ticket = await findTicketByChannel(interaction.channelId);
  if (!ticket) {
    const respond = { content: 'Este canal no es un ticket abierto de Klvro.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(respond);
    else await interaction.reply(respond);
    return;
  }

  const isOpener = interaction.user.id === ticket.opener_id;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
  if (!isOpener && !isStaff) {
    const respond = { content: 'No tienes permiso para cerrar este ticket.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(respond);
    else await interaction.reply(respond);
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({ content: 'Cerrando ticket en unos segundos…' });
  }

  const settings = await getGuildSettings(interaction.guild.id);
  if (settings.tickets?.transcript && settings.tickets.logChannelId) {
    await sendTicketTranscript(interaction.channel, settings.tickets.logChannelId, interaction.user.id).catch((error) => {
      console.error('[Klvro] transcript:', error);
    });
  }

  if (settings.tickets?.logChannelId) {
    await sendLog(interaction.guild, settings.tickets.logChannelId, {
      title: 'Ticket cerrado',
      description: `<#${interaction.channelId}> fue cerrado por <@${interaction.user.id}>.`,
    });
  }

  await closeTicketRecord(interaction.channelId);
  setTimeout(() => interaction.channel?.delete('Ticket cerrado').catch(() => null), 2500);
}

async function sendTicketTranscript(channel, logChannelId, closedById) {
  const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
  if (!logChannel?.isTextBased()) return;

  const all = [];
  let before;
  for (let page = 0; page < 5; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = all.map((message) => {
    const time = new Date(message.createdTimestamp).toISOString();
    const author = message.author?.tag || message.author?.username || 'desconocido';
    const content = message.cleanContent || '[sin contenido de texto]';
    return `[${time}] ${author}: ${content}`;
  });

  const header = `Klvro Ticket Transcript
Servidor: ${channel.guild.name}
Canal: #${channel.name}
Cerrado por: ${closedById}
Mensajes: ${lines.length}

`;
  const attachment = new AttachmentBuilder(Buffer.from(header + lines.join('\n'), 'utf8'), {
    name: `transcript-${channel.name}.txt`,
  });

  await logChannel.send({ content: `Transcript de <#${channel.id}>`, files: [attachment] });
}

export async function registerCommands() {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    throw new Error('Faltan DISCORD_BOT_TOKEN o DISCORD_CLIENT_ID.');
  }

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Muestra la latencia de Klvro.'),
    new SlashCommandBuilder().setName('panel').setDescription('Muestra el enlace a la dashboard de Klvro.'),
    new SlashCommandBuilder().setName('ticketpanel').setDescription('Publica el panel para abrir tickets.'),
    new SlashCommandBuilder().setName('close').setDescription('Cierra el ticket actual.'),
    antiRaidCommandBuilder(),
    ...administrationCommandBuilders(),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
}
