import fs from 'node:fs';

const root = new URL('./', import.meta.url);
const file = (relative) => new URL('../' + relative, root);
const read = (url) => fs.readFileSync(url, 'utf8');
const write = (url, text) => fs.writeFileSync(url, text);

const dbPath = file('server/db.mjs');
const discordPath = file('server/discord.mjs');
const indexPath = file('server/index.mjs');
const mainPath = file('src/main.jsx');
const cssPath = file('src/styles.css');

let db = read(dbPath);
let discord = read(discordPath);
let index = read(indexPath);
let main = read(mainPath);
let css = read(cssPath);

// Defaults.
if (!db.includes("panelMode: 'buttons'")) {
  db = db.replace(
    "    panelDescription: 'Pulsa el botón para abrir un ticket privado.',\n",
    "    panelDescription: 'Pulsa el botón para abrir un ticket privado.',\n    panelMode: 'buttons',\n    requireReason: false,\n    ticketOptions: [{ id: 'soporte', label: 'Soporte', emoji: '🎫', description: 'Ayuda general' }],\n"
  );
}
if (!db.includes('antiSpamMaxMessages: 6')) {
  db = db.replace(
    "    antiLinks: false,\n",
    "    antiLinks: false,\n    antiSpamMaxMessages: 6,\n    antiSpamWindowSeconds: 6,\n    antiSpamTimeoutSeconds: 30,\n"
  );
}

// Server-side sanitation and Premium limits.
if (!index.includes("const ticketOptionLimit = premiumPlan === 'pro' ? 5 : 3;")) {
  index = index.replace(
`  const previousTickets = current.tickets || {};
  const premiumValue = (requiredRank, nextValue, previousValue, fallback) =>
    premiumRank >= requiredRank ? nextValue : (previousValue ?? fallback);

  return {`,
`  const previousTickets = current.tickets || {};
  const premiumValue = (requiredRank, nextValue, previousValue, fallback) =>
    premiumRank >= requiredRank ? nextValue : (previousValue ?? fallback);
  const ticketOptionLimit = premiumPlan === 'pro' ? 5 : 3;
  const rawTicketOptions = Array.isArray(body.tickets?.ticketOptions) && body.tickets.ticketOptions.length
    ? body.tickets.ticketOptions
    : [{ id: 'soporte', label: body.tickets?.panelButtonLabel || 'Soporte', emoji: body.tickets?.panelButtonEmoji || '🎫', description: 'Ayuda general' }];
  const seenTicketOptionIds = new Set();
  const cleanTicketOptions = rawTicketOptions.slice(0, ticketOptionLimit).map((item, optionIndex) => {
    const option = item && typeof item === 'object' ? item : {};
    let optionId = str(option.id || ('opcion-' + (optionIndex + 1)), 32).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!optionId || seenTicketOptionIds.has(optionId)) optionId = 'opcion-' + (optionIndex + 1);
    seenTicketOptionIds.add(optionId);
    return {
      id: optionId,
      label: str(option.label || ('Ticket ' + (optionIndex + 1)), 80).trim() || ('Ticket ' + (optionIndex + 1)),
      emoji: str(option.emoji || '', 64).trim(),
      description: str(option.description || '', 100).trim(),
    };
  });

  return {`
  );
}
if (!index.includes("panelMode: ['buttons', 'select']")) {
  index = index.replace(
    "      panelDescription: str(body.tickets?.panelDescription || 'Pulsa el botón para abrir un ticket privado.', 4000),\n",
    "      panelDescription: str(body.tickets?.panelDescription || 'Pulsa el botón para abrir un ticket privado.', 4000),\n      panelMode: ['buttons', 'select'].includes(body.tickets?.panelMode) ? body.tickets.panelMode : 'buttons',\n      requireReason: bool(body.tickets?.requireReason),\n      ticketOptions: cleanTicketOptions,\n"
  );
}
if (!index.includes('antiSpamMaxMessages: number(body.moderation')) {
  index = index.replace(
    "      antiLinks: bool(body.moderation?.antiLinks),\n",
    "      antiLinks: bool(body.moderation?.antiLinks),\n      antiSpamMaxMessages: number(body.moderation?.antiSpamMaxMessages, 6, 3, 20),\n      antiSpamWindowSeconds: number(body.moderation?.antiSpamWindowSeconds, 6, 2, 30),\n      antiSpamTimeoutSeconds: number(body.moderation?.antiSpamTimeoutSeconds, 30, 5, 3600),\n"
  );
}

// Required Discord builders.
if (!discord.includes('StringSelectMenuBuilder,')) {
  discord = discord.replace(
    '  SlashCommandBuilder,\n',
    '  SlashCommandBuilder,\n  StringSelectMenuBuilder,\n  StringSelectMenuOptionBuilder,\n  ModalBuilder,\n  TextInputBuilder,\n  TextInputStyle,\n'
  );
}

const panelPayloadCode = String.raw`function normalizedTicketOptions(settings = {}) {
  const source = Array.isArray(settings.ticketOptions) && settings.ticketOptions.length
    ? settings.ticketOptions
    : [{ id: 'soporte', label: settings.panelButtonLabel || 'Soporte', emoji: settings.panelButtonEmoji || '🎫', description: 'Ayuda general' }];
  return source.slice(0, 5).map((option, optionIndex) => ({
    id: String(option?.id || ('opcion-' + (optionIndex + 1))).replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || ('opcion-' + (optionIndex + 1)),
    label: String(option?.label || ('Ticket ' + (optionIndex + 1))).slice(0, 80),
    emoji: String(option?.emoji || '').trim().slice(0, 64),
    description: String(option?.description || '').trim().slice(0, 100),
  }));
}

function ticketPanelPayload(settings = {}) {
  const embed = new EmbedBuilder()
    .setTitle(String(settings.panelTitle || 'Soporte').slice(0, 256))
    .setDescription(String(settings.panelDescription || 'Elige una opción para abrir un ticket privado.').slice(0, 4000))
    .setColor(parseTicketColor(settings.panelColor));
  if (settings.panelFooter) embed.setFooter({ text: String(settings.panelFooter).slice(0, 2048) });
  if (/^https:\/\//i.test(String(settings.panelImageUrl || ''))) embed.setImage(String(settings.panelImageUrl).slice(0, 1000));

  const options = normalizedTicketOptions(settings);
  if (settings.panelMode === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('klvro_ticket_select')
      .setPlaceholder('Selecciona el tipo de ticket')
      .setMinValues(1)
      .setMaxValues(1);
    for (const option of options) {
      const item = new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.id);
      if (option.description) item.setDescription(option.description);
      if (option.emoji) { try { item.setEmoji(option.emoji); } catch {} }
      menu.addOptions(item);
    }
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
  }

  const buttons = options.map((option) => {
    const button = new ButtonBuilder()
      .setCustomId('klvro_ticket_create:' + option.id)
      .setLabel(option.label)
      .setStyle(ButtonStyle.Primary);
    if (option.emoji) { try { button.setEmoji(option.emoji); } catch {} }
    return button;
  });
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] };
}

export async function syncTicketPanel`;
const panelPayloadPattern = /function ticketPanelPayload\(settings = \{\}\) \{[\s\S]*?\n\}\n\nexport async function syncTicketPanel/;
if (panelPayloadPattern.test(discord) && !discord.includes('function normalizedTicketOptions(settings = {})')) {
  discord = discord.replace(panelPayloadPattern, panelPayloadCode);
}

if (!discord.includes('interaction.isStringSelectMenu()')) {
  discord = discord.replace(
`      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }`,
`      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleTicketSelect(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleTicketModal(interaction);
      }`
  );
}

discord = discord.replace(
`async function handleButton(interaction) {
  if (!interaction.guild) return;
  if (interaction.customId === 'klvro_ticket_create') {
    await createTicketFromInteraction(interaction);
  } else if (interaction.customId === 'klvro_ticket_close') {
    await closeTicketFromInteraction(interaction);
  }
}`,
`async function handleButton(interaction) {
  if (!interaction.guild) return;
  if (interaction.customId === 'klvro_ticket_create' || interaction.customId.startsWith('klvro_ticket_create:')) {
    const optionId = interaction.customId.includes(':') ? interaction.customId.split(':').slice(1).join(':') : '';
    await beginTicketOpen(interaction, optionId);
  } else if (interaction.customId === 'klvro_ticket_close') {
    await closeTicketFromInteraction(interaction);
  }
}`
);

const advancedHandlers = String.raw`async function handleTicketSelect(interaction) {
  if (!interaction.guild || interaction.customId !== 'klvro_ticket_select') return;
  await beginTicketOpen(interaction, interaction.values?.[0] || '');
}

async function handleTicketModal(interaction) {
  if (!interaction.guild || !interaction.customId.startsWith('klvro_ticket_reason:')) return;
  const optionId = interaction.customId.slice('klvro_ticket_reason:'.length);
  const reason = String(interaction.fields.getTextInputValue('ticket_reason') || '').trim().slice(0, 500);
  await createAdvancedTicket(interaction, optionId, reason);
}

async function beginTicketOpen(interaction, optionId = '') {
  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings.tickets?.enabled) {
    await interaction.reply({ content: 'El sistema de tickets está desactivado.', ephemeral: true });
    return;
  }
  const options = normalizedTicketOptions(settings.tickets);
  const option = options.find((item) => item.id === optionId) || (!optionId ? options[0] : null);
  if (!option) {
    await interaction.reply({ content: 'Esa opción de ticket ya no existe. Guarda el panel de nuevo.', ephemeral: true });
    return;
  }
  if (!settings.tickets.requireReason) {
    await createAdvancedTicket(interaction, option.id, '');
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId('klvro_ticket_reason:' + option.id)
    .setTitle(('Abrir · ' + option.label).slice(0, 45));
  const input = new TextInputBuilder()
    .setCustomId('ticket_reason')
    .setLabel('Motivo del ticket')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Explica brevemente qué necesitas...')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function createAdvancedTicket(interaction, optionId = '', reason = '') {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
  const settings = await getGuildSettings(interaction.guild.id);
  if (!settings.tickets?.enabled) {
    await interaction.editReply('El sistema de tickets está desactivado.');
    return;
  }
  const options = normalizedTicketOptions(settings.tickets);
  const option = options.find((item) => item.id === optionId) || (!optionId ? options[0] : null);
  if (!option) {
    await interaction.editReply('La opción de ticket seleccionada ya no está disponible.');
    return;
  }
  const existing = await findOpenTicket(interaction.guild.id, interaction.user.id);
  if (existing) {
    const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
    if (existingChannel) {
      await interaction.editReply('Ya tienes un ticket abierto: <#' + existing.channel_id + '>');
      return;
    }
    await closeTicketRecord(existing.channel_id);
  }

  const safeUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16) || 'usuario';
  const safeType = option.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'ticket';
  const cleanReason = String(reason || '').trim().slice(0, 500);
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (settings.tickets.staffRoleId) {
    overwrites.push({ id: settings.tickets.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
  }
  const channel = await interaction.guild.channels.create({
    name: ('ticket-' + safeType + '-' + safeUser).slice(0, 95),
    type: ChannelType.GuildText,
    parent: settings.tickets.categoryId || undefined,
    permissionOverwrites: overwrites,
    reason: 'Ticket ' + option.label + ' de ' + interaction.user.tag,
  });
  await createTicketRecord({ guildId: interaction.guild.id, channelId: channel.id, openerId: interaction.user.id });

  const closeButton = new ButtonBuilder().setCustomId('klvro_ticket_close').setLabel('Cerrar ticket').setStyle(ButtonStyle.Danger);
  const openEmbed = new EmbedBuilder()
    .setTitle(('Ticket · ' + option.label).slice(0, 256))
    .setDescription(option.description || 'El staff responderá cuando esté disponible.')
    .setColor(parseTicketColor(settings.tickets.panelColor || '#5865F2'))
    .addFields({ name: 'Motivo', value: cleanReason || (settings.tickets.requireReason ? 'No especificado' : 'No requerido') });
  const mention = '<@' + interaction.user.id + '>' + (settings.tickets.staffRoleId ? ' <@&' + settings.tickets.staffRoleId + '>' : '');
  await channel.send({
    content: mention,
    embeds: [openEmbed],
    components: [new ActionRowBuilder().addComponents(closeButton)],
    allowedMentions: { users: [interaction.user.id], roles: settings.tickets.staffRoleId ? [settings.tickets.staffRoleId] : [] },
  });
  if (settings.tickets.logChannelId) {
    await sendLog(interaction.guild, settings.tickets.logChannelId, {
      title: 'Ticket abierto',
      description: '<@' + interaction.user.id + '> abrió <#' + channel.id + '>.\nTipo: **' + option.label + '**' + (cleanReason ? '\nMotivo: ' + cleanReason : ''),
    });
  }
  await interaction.editReply('Ticket creado: <#' + channel.id + '>');
}

`;
if (!discord.includes('async function createAdvancedTicket(')) {
  discord = discord.replace('async function createTicketFromInteraction(interaction) {', advancedHandlers + 'async function createTicketFromInteraction(interaction) {');
}

// Anti-link + configurable anti-spam.
discord = discord.replace(
  'if (settings.moderation.antiLinks && /(?:https?:\\/\\/|discord\\.gg\\/|discord\\.com\\/invite\\/)/i.test(message.content)) {',
  'if (settings.moderation.antiLinks && containsBlockedLink(message.content)) {'
);
discord = discord.replace(
  'if (settings.moderation.antiSpam && isSpamming(message.guild.id, message.author.id)) {',
  'if (settings.moderation.antiSpam && isSpamming(message.guild.id, message.author.id, settings.moderation)) {'
);
discord = discord.replace(
  "await message.member.timeout(30_000, 'Antispam de Klvro').catch(() => null);",
  "await message.member.timeout(Math.max(5, Number(settings.moderation.antiSpamTimeoutSeconds) || 30) * 1000, 'Antispam de Klvro').catch(() => null);"
);
const spamPattern = /function isSpamming\(guildId, userId\) \{[\s\S]*?\n\}\n\nasync function moderationLog/;
if (spamPattern.test(discord)) {
  discord = discord.replace(spamPattern, String.raw`function containsBlockedLink(content) {
  return /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/|\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|net|org|gg|io|co|dev|app|xyz|site|me|tv|ly)(?:\/|\b))/i.test(String(content || ''));
}

function isSpamming(guildId, userId, config = {}) {
  const key = guildId + ':' + userId;
  const now = Date.now();
  const windowMs = Math.max(2, Math.min(30, Number(config.antiSpamWindowSeconds) || 6)) * 1000;
  const threshold = Math.max(3, Math.min(20, Number(config.antiSpamMaxMessages) || 6));
  const recent = (spamBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  if (recent.length >= threshold) {
    spamBuckets.delete(key);
    return true;
  }
  spamBuckets.set(key, recent);
  if (recent.length === 1) {
    const timer = setTimeout(() => {
      const bucket = spamBuckets.get(key) || [];
      if (!bucket.length || Date.now() - bucket[bucket.length - 1] >= windowMs) spamBuckets.delete(key);
    }, windowMs + 1000);
    timer.unref?.();
  }
  return false;
}

async function moderationLog`);
}

const ticketsForm = String.raw`function TicketsForm({ config, set, resources, premiumPlan }) {
  const rank = premiumPlan === 'pro' ? 2 : premiumPlan === 'lite' ? 1 : 0;
  const maxOptions = premiumPlan === 'pro' ? 5 : 3;
  const planName = rank === 2 ? 'Pro' : rank === 1 ? 'Lite' : 'Gratis';
  const title = config.panelTitle || 'Soporte';
  const description = config.panelDescription || 'Elige una opción para abrir un ticket privado.';
  const color = /^#[0-9a-fA-F]{6}$/.test(config.panelColor || '') ? config.panelColor : '#5865F2';
  const options = Array.isArray(config.ticketOptions) && config.ticketOptions.length
    ? config.ticketOptions.slice(0, maxOptions)
    : [{ id: 'soporte', label: 'Soporte', emoji: '🎫', description: 'Ayuda general' }];
  const updateOption = (optionIndex, key, value) => set('ticketOptions', options.map((item, index) => index === optionIndex ? { ...item, [key]: value } : item));
  const removeOption = (optionIndex) => { if (options.length > 1) set('ticketOptions', options.filter((_, index) => index !== optionIndex)); };
  const addOption = () => {
    if (options.length >= maxOptions) return;
    set('ticketOptions', [...options, { id: 'ticket-' + Date.now().toString(36) + '-' + (options.length + 1), label: 'Ticket ' + (options.length + 1), emoji: '🎫', description: '' }]);
  };

  return <div className="form-card ticket-builder">
    <FormSection title="Publicación" description="Al guardar, Klvro publica o actualiza el panel en el canal elegido.">
      <ChannelSelect label="Canal del panel" value={config.panelChannelId} onChange={(value) => set('panelChannelId', value)} channels={textChannels(resources.channels)} />
      <ChannelSelect label="Categoría de tickets" value={config.categoryId} onChange={(value) => set('categoryId', value)} channels={categoryChannels(resources.channels)} />
      <RoleSelect label="Rol del staff" value={config.staffRoleId} onChange={(value) => set('staffRoleId', value)} roles={resources.roles} />
      <ChannelSelect label="Canal de registros" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} />
      <ToggleRow title="Guardar transcript" description="Adjunta un .txt al cerrar el ticket." checked={config.transcript} onChange={(value) => set('transcript', value)} />
    </FormSection>
    <FormSection title="Comportamiento" description="Elige cómo se abren los tickets.">
      <Field label="Selector de tickets"><select value={config.panelMode || 'buttons'} onChange={(event) => set('panelMode', event.target.value)}><option value="buttons">Botones</option><option value="select">Menú desplegable</option></select></Field>
      <ToggleRow title="Pedir motivo antes de abrir" description="Muestra una ventana para escribir el motivo antes de crear el canal." checked={!!config.requireReason} onChange={(value) => set('requireReason', value)} />
    </FormSection>
    <FormSection title="Opciones para abrir ticket" description={'Puedes usar hasta ' + maxOptions + ' opciones con tu plan ' + planName + '.'}>
      <div className="ticket-option-stack">
        {options.map((option, optionIndex) => <div className="ticket-option-editor" key={option.id || optionIndex}>
          <div className="ticket-option-editor-head"><strong>{'Opción ' + (optionIndex + 1)}</strong><button type="button" onClick={() => removeOption(optionIndex)} disabled={options.length <= 1}>Eliminar</button></div>
          <div className="ticket-option-fields">
            <Field label="Texto"><input maxLength="80" value={option.label || ''} onChange={(event) => updateOption(optionIndex, 'label', event.target.value)} placeholder="Soporte" /></Field>
            <Field label="Emoji"><input maxLength="64" value={option.emoji || ''} onChange={(event) => updateOption(optionIndex, 'emoji', event.target.value)} placeholder="🎫" /></Field>
          </div>
          <Field label="Descripción" hint={config.panelMode === 'select' ? 'Se muestra dentro del menú desplegable.' : 'Se muestra al abrir el ticket.'}><input maxLength="100" value={option.description || ''} onChange={(event) => updateOption(optionIndex, 'description', event.target.value)} placeholder="Ayuda general" /></Field>
        </div>)}
      </div>
      <button type="button" className="ticket-add-option" onClick={addOption} disabled={options.length >= maxOptions}>{'+ Añadir opción (' + options.length + '/' + maxOptions + ')'}</button>
      {premiumPlan !== 'pro' && options.length >= 3 && <div className="premium-lock"><Sparkles size={15} /> Premium Pro permite hasta 5 opciones</div>}
    </FormSection>
    <FormSection title="Panel" description="Personaliza el mensaje principal.">
      <Field label="Título"><input maxLength="256" value={title} onChange={(event) => set('panelTitle', event.target.value)} /></Field>
      <Field label="Descripción"><textarea rows="5" maxLength="4000" value={description} onChange={(event) => set('panelDescription', event.target.value)} /></Field>
    </FormSection>
    <FormSection title="Premium Lite" description="Color y pie del panel.">
      {rank < 1 && <div className="premium-lock"><Sparkles size={15} /> Premium Lite</div>}
      <Field label="Color"><div className="color-field"><input disabled={rank < 1} type="color" value={color} onChange={(event) => set('panelColor', event.target.value)} /><code>{color.toUpperCase()}</code></div></Field>
      <Field label="Pie"><input disabled={rank < 1} maxLength="2048" value={config.panelFooter || ''} onChange={(event) => set('panelFooter', event.target.value)} placeholder="Opcional" /></Field>
    </FormSection>
    <FormSection title="Premium Pro" description="Imagen dentro del embed y hasta 5 opciones de ticket.">
      {rank < 2 && <div className="premium-lock"><Sparkles size={15} /> Premium Pro</div>}
      <Field label="Imagen"><input disabled={rank < 2} maxLength="1000" value={config.panelImageUrl || ''} onChange={(event) => set('panelImageUrl', event.target.value)} placeholder="https://..." /></Field>
    </FormSection>
    <PreviewCard title="Vista previa">
      <div className="ticket-panel-preview">
        <div className="ticket-preview-embed" style={{ borderLeftColor: color }}>
          <strong>{title || 'Soporte'}</strong><p>{description}</p>
          {rank >= 2 && String(config.panelImageUrl || '').startsWith('https://') && <img src={config.panelImageUrl} alt="" />}
          {rank >= 1 && config.panelFooter && <small>{config.panelFooter}</small>}
        </div>
        {config.panelMode === 'select'
          ? <div className="ticket-preview-select"><span>Selecciona el tipo de ticket</span><span>⌄</span></div>
          : <div className="ticket-preview-buttons">{options.map((option, optionIndex) => <button type="button" className="ticket-preview-button" tabIndex="-1" key={option.id || optionIndex}>{option.emoji && <span>{option.emoji}</span>}{option.label || ('Ticket ' + (optionIndex + 1))}</button>)}</div>}
        <div className="ticket-preview-reason">Motivo: <strong>{config.requireReason ? 'Se solicitará antes de abrir' : 'No requerido'}</strong></div>
      </div>
    </PreviewCard>
  </div>;
}

function ModerationForm`;
const ticketsFormPattern = /function TicketsForm\(\{ config, set, resources, premiumPlan \}\) \{[\s\S]*?\n\}\n\nfunction ModerationForm/;
if (ticketsFormPattern.test(main) && !main.includes("const maxOptions = premiumPlan === 'pro' ? 5 : 3;")) {
  main = main.replace(ticketsFormPattern, ticketsForm);
}

const moderationForm = String.raw`function ModerationForm({ config, set, resources }) {
  return <div className="form-card">
    <FormSection title="Anti-spam" description="Detecta ráfagas de mensajes y frena al usuario automáticamente.">
      <ToggleRow title="Anti-spam" description="Elimina el mensaje que dispara el límite y aplica timeout." checked={!!config.antiSpam} onChange={(value) => set('antiSpam', value)} />
      <Field label="Mensajes para detectar spam"><input type="number" min="3" max="20" disabled={!config.antiSpam} value={config.antiSpamMaxMessages || 6} onChange={(event) => set('antiSpamMaxMessages', Number(event.target.value))} /></Field>
      <Field label="Ventana de tiempo (segundos)"><input type="number" min="2" max="30" disabled={!config.antiSpam} value={config.antiSpamWindowSeconds || 6} onChange={(event) => set('antiSpamWindowSeconds', Number(event.target.value))} /></Field>
      <Field label="Timeout por spam (segundos)"><input type="number" min="5" max="3600" disabled={!config.antiSpam} value={config.antiSpamTimeoutSeconds || 30} onChange={(event) => set('antiSpamTimeoutSeconds', Number(event.target.value))} /></Field>
    </FormSection>
    <FormSection title="Anti-link" description="Bloquea enlaces para miembros normales.">
      <ToggleRow title="Bloquear enlaces" description="Elimina URLs, invitaciones de Discord y dominios comunes. Los moderadores quedan exentos." checked={!!config.antiLinks} onChange={(value) => set('antiLinks', value)} />
    </FormSection>
    <FormSection title="Registros" description="Canal usado por las acciones automáticas.">
      <ChannelSelect label="Canal de moderación" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} />
    </FormSection>
  </div>;
}

function AntiRaidForm`;
const moderationPattern = /function ModerationForm\(\{ config, set, resources \}\) \{[\s\S]*?\n\}\n\nfunction AntiRaidForm/;
if (moderationPattern.test(main) && !main.includes('Mensajes para detectar spam')) main = main.replace(moderationPattern, moderationForm);

if (!css.includes('/* Klvro ticket v2 */')) {
  css += `

/* Klvro ticket v2 */
.ticket-option-stack{display:grid;gap:12px}.ticket-option-editor{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.ticket-option-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.ticket-option-editor-head strong{font-size:13px;color:#eef0f6}.ticket-option-editor-head button{border:0;background:transparent;color:#f38ba8;font-size:12px;font-weight:700;cursor:pointer}.ticket-option-editor-head button:disabled{opacity:.35;cursor:not-allowed}.ticket-option-fields{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:12px}.ticket-add-option{min-height:40px;padding:0 14px;border:1px dashed rgba(88,101,242,.42);border-radius:10px;background:rgba(88,101,242,.08);color:#cbd0ff;font-weight:700;cursor:pointer}.ticket-add-option:disabled{opacity:.45;cursor:not-allowed}.ticket-preview-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.ticket-preview-buttons .ticket-preview-button{margin-top:0}.ticket-preview-select{display:flex;justify-content:space-between;align-items:center;width:min(100%,420px);min-height:40px;margin-top:8px;padding:0 12px;border-radius:4px;background:#1e1f22;color:#b5bac1;font-size:13px}.ticket-preview-reason{margin-top:10px;color:#949ba4;font-size:11px}.ticket-preview-reason strong{color:#dbdee1;font-weight:600}@media(max-width:620px){.ticket-option-fields{grid-template-columns:1fr}}
`;
}

write(dbPath, db);
write(discordPath, discord);
write(indexPath, index);
write(mainPath, main);
write(cssPath, css);
console.log('[Klvro] Ticket v2 + anti-spam + anti-link aplicados.');
