import fs from 'node:fs';

const read = (url) => fs.readFileSync(url, 'utf8');
const write = (url, text) => fs.writeFileSync(url, text);
const root = new URL('./', import.meta.url);
const file = (relative) => new URL(`../${relative}`, root);

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

if (!db.includes("panelChannelId: ''")) {
  db = db.replace(
`  tickets: {
    enabled: false,
    categoryId: '',
    staffRoleId: '',
    logChannelId: '',
    transcript: true,
  },`,
`  tickets: {
    enabled: false,
    panelChannelId: '',
    categoryId: '',
    staffRoleId: '',
    logChannelId: '',
    transcript: true,
    panelTitle: 'Soporte',
    panelDescription: 'Pulsa el botón para abrir un ticket privado.',
    panelButtonLabel: 'Abrir ticket',
    panelButtonEmoji: '🎫',
    panelColor: '#5865F2',
    panelFooter: '',
    panelImageUrl: '',
    panelMessageId: '',
    panelMessageChannelId: '',
  },`
  );
}

if (!discord.includes('saveGuildSettings,')) {
  discord = discord.replace(
    '  getGuildSettings,\n} from \'./db.mjs\';',
    '  getGuildSettings,\n  saveGuildSettings,\n} from \'./db.mjs\';'
  );
}

if (!discord.includes('export async function syncTicketPanel')) {
  const helper = String.raw`
function parseTicketColor(value) {
  const text = String(value || '#5865F2').trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(text)) return 0x5865f2;
  return Number.parseInt(text.replace('#', ''), 16);
}

function ticketPanelPayload(settings = {}) {
  const embed = new EmbedBuilder()
    .setTitle(String(settings.panelTitle || 'Soporte').slice(0, 256))
    .setDescription(String(settings.panelDescription || 'Pulsa el botón para abrir un ticket privado.').slice(0, 4000))
    .setColor(parseTicketColor(settings.panelColor));

  if (settings.panelFooter) embed.setFooter({ text: String(settings.panelFooter).slice(0, 2048) });
  if (/^https:\/\//i.test(String(settings.panelImageUrl || ''))) {
    embed.setImage(String(settings.panelImageUrl).slice(0, 1000));
  }

  const button = new ButtonBuilder()
    .setCustomId('klvro_ticket_create')
    .setLabel(String(settings.panelButtonLabel || 'Abrir ticket').slice(0, 80))
    .setStyle(ButtonStyle.Primary);

  const emoji = String(settings.panelButtonEmoji || '').trim();
  if (emoji) {
    try { button.setEmoji(emoji.slice(0, 64)); } catch {}
  }

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)],
  };
}

export async function syncTicketPanel(guildId, nextTickets = {}, previousTickets = {}) {
  const guild = await bot.guilds.fetch(guildId);
  const oldMessageId = previousTickets.panelMessageId || '';
  const oldChannelId = previousTickets.panelMessageChannelId || previousTickets.panelChannelId || '';

  const removeOldPanel = async () => {
    if (!oldMessageId || !oldChannelId) return;
    const oldChannel = await guild.channels.fetch(oldChannelId).catch(() => null);
    if (!oldChannel?.isTextBased()) return;
    const oldMessage = await oldChannel.messages.fetch(oldMessageId).catch(() => null);
    if (oldMessage) await oldMessage.delete().catch(() => null);
  };

  if (!nextTickets.enabled || !nextTickets.panelChannelId) {
    await removeOldPanel();
    return { panelMessageId: '', panelMessageChannelId: '' };
  }

  const channel = await guild.channels.fetch(nextTickets.panelChannelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('El canal del panel de tickets no es válido.');

  const payload = ticketPanelPayload(nextTickets);

  if (oldMessageId && oldChannelId === nextTickets.panelChannelId) {
    const existing = await channel.messages.fetch(oldMessageId).catch(() => null);
    if (existing) {
      await existing.edit(payload);
      return { panelMessageId: existing.id, panelMessageChannelId: channel.id };
    }
  }

  if (oldMessageId && oldChannelId && oldChannelId !== nextTickets.panelChannelId) {
    await removeOldPanel();
  }

  const message = await channel.send(payload);
  return { panelMessageId: message.id, panelMessageChannelId: channel.id };
}
`;
  discord = discord.replace('async function handleSlashCommand(interaction) {', `${helper}\nasync function handleSlashCommand(interaction) {`);
}

if (discord.includes("interaction.commandName === 'ticketpanel'") && discord.includes("Panel de tickets publicado.")) {
  discord = discord.replace(
/  if \(interaction\.commandName === 'ticketpanel'\) \{[\s\S]*?    return;\n  \}\n\n  if \(interaction\.commandName === 'close'\)/,
`  if (interaction.commandName === 'ticketpanel') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Necesitas el permiso **Administrar servidor**.', ephemeral: true });
      return;
    }

    if (!settings.tickets?.enabled || !settings.tickets?.panelChannelId) {
      await interaction.reply({ content: 'Selecciona el canal del panel desde la web y guarda los cambios.', ephemeral: true });
      return;
    }

    const state = await syncTicketPanel(interaction.guild.id, settings.tickets, settings.tickets);
    if (state.panelMessageId !== settings.tickets.panelMessageId || state.panelMessageChannelId !== settings.tickets.panelMessageChannelId) {
      settings.tickets = { ...settings.tickets, ...state };
      await saveGuildSettings(interaction.guild.id, settings, interaction.user.id);
    }
    await interaction.reply({ content: \`Panel sincronizado en <#\${settings.tickets.panelChannelId}>.\`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'close')`
  );
}

if (!index.includes('syncTicketPanel,')) {
  index = index.replace(
    '  getGuildChannelsAndRoles,\n  startBot,\n} from \'./discord.mjs\';',
    '  getGuildChannelsAndRoles,\n  startBot,\n  syncTicketPanel,\n} from \'./discord.mjs\';'
  );
}

index = index.replace(
  "imgSrc: [\"'self'\", 'data:', 'https://cdn.discordapp.com'],",
  "imgSrc: [\"'self'\", 'data:', 'https:', 'https://cdn.discordapp.com'],"
);

if (!index.includes('const panelState = await syncTicketPanel')) {
  index = index.replace(
`app.put('/api/guilds/:guildId/settings', requireAuth, requireGuildAccess, async (req, res, next) => {
  try {
    const settings = sanitizeSettings(req.body?.settings ?? req.body);
    const saved = await saveGuildSettings(req.params.guildId, settings, req.session.user.id);
    res.json({ ok: true, settings: saved });
  } catch (error) {
    next(error);
  }
});`,
`app.put('/api/guilds/:guildId/settings', requireAuth, requireGuildAccess, async (req, res, next) => {
  try {
    const current = await getGuildSettings(req.params.guildId);
    const premium = await getPremiumAccess(req.session.user.id);
    const settings = sanitizeSettings(req.body?.settings ?? req.body, {
      premiumPlan: premium?.plan || null,
      current,
    });

    settings.tickets.panelMessageId = current.tickets?.panelMessageId || '';
    settings.tickets.panelMessageChannelId = current.tickets?.panelMessageChannelId || '';

    let saved = await saveGuildSettings(req.params.guildId, settings, req.session.user.id);

    if (botHasGuild(req.params.guildId)) {
      try {
        const panelState = await syncTicketPanel(req.params.guildId, saved.tickets, current.tickets || {});
        saved = await saveGuildSettings(
          req.params.guildId,
          { ...saved, tickets: { ...saved.tickets, ...panelState } },
          req.session.user.id
        );
      } catch (panelError) {
        panelError.status = 400;
        throw panelError;
      }
    }

    res.json({ ok: true, settings: saved, premium });
  } catch (error) {
    next(error);
  }
});`
  );
}

if (index.includes('function sanitizeSettings(input) {')) {
  index = index.replace(
    'function sanitizeSettings(input) {',
    'function sanitizeSettings(input, { premiumPlan = null, current = {} } = {}) {'
  );
}

if (!index.includes('const premiumRank = premiumPlan')) {
  index = index.replace(
`  const ids = (value) => {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[\\s,;]+/);
    return [...new Set(list.map((item) => String(item).trim()).filter((item) => /^\\d{16,22}$/.test(item)))].slice(0, 50);
  };

  return {`,
`  const ids = (value) => {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[\\s,;]+/);
    return [...new Set(list.map((item) => String(item).trim()).filter((item) => /^\\d{16,22}$/.test(item)))].slice(0, 50);
  };
  const url = (value, max = 1000) => {
    const text = str(value, max).trim();
    return !text || /^https:\\/\\//i.test(text) ? text : '';
  };
  const color = (value) => {
    const text = str(value || '#5865F2', 7).trim();
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : '#5865F2';
  };
  const premiumRank = premiumPlan === 'pro' ? 2 : premiumPlan === 'lite' ? 1 : 0;
  const previousTickets = current.tickets || {};
  const premiumValue = (requiredRank, nextValue, previousValue, fallback) =>
    premiumRank >= requiredRank ? nextValue : (previousValue ?? fallback);

  return {`
  );
}

if (!index.includes('panelTitle: str(body.tickets')) {
  index = index.replace(
`    tickets: {
      enabled: bool(body.tickets?.enabled),
      categoryId: id(body.tickets?.categoryId),
      staffRoleId: id(body.tickets?.staffRoleId),
      logChannelId: id(body.tickets?.logChannelId),
      transcript: bool(body.tickets?.transcript),
    },`,
`    tickets: {
      enabled: bool(body.tickets?.enabled),
      panelChannelId: id(body.tickets?.panelChannelId),
      categoryId: id(body.tickets?.categoryId),
      staffRoleId: id(body.tickets?.staffRoleId),
      logChannelId: id(body.tickets?.logChannelId),
      transcript: bool(body.tickets?.transcript),
      panelTitle: str(body.tickets?.panelTitle || 'Soporte', 256),
      panelDescription: str(body.tickets?.panelDescription || 'Pulsa el botón para abrir un ticket privado.', 4000),
      panelButtonLabel: premiumValue(1, str(body.tickets?.panelButtonLabel || 'Abrir ticket', 80), previousTickets.panelButtonLabel, 'Abrir ticket'),
      panelColor: premiumValue(1, color(body.tickets?.panelColor), previousTickets.panelColor, '#5865F2'),
      panelFooter: premiumValue(1, str(body.tickets?.panelFooter, 2048), previousTickets.panelFooter, ''),
      panelButtonEmoji: premiumValue(2, str(body.tickets?.panelButtonEmoji || '🎫', 64), previousTickets.panelButtonEmoji, '🎫'),
      panelImageUrl: premiumValue(2, url(body.tickets?.panelImageUrl), previousTickets.panelImageUrl, ''),
      panelMessageId: id(previousTickets.panelMessageId),
      panelMessageChannelId: id(previousTickets.panelMessageChannelId),
    },`
  );
}

if (!main.includes('premiumPlan={me.premium?.plan || null}')) {
  main = main.replace(
    '              savedAt={savedAt}\n            />',
    '              savedAt={savedAt}\n              premiumPlan={me.premium?.plan || null}\n            />'
  );
}

main = main.replace(
  'function SettingsPage({ section, settings, setSettings, resources, onSave, savedAt }) {',
  'function SettingsPage({ section, settings, setSettings, resources, onSave, savedAt, premiumPlan }) {'
);
main = main.replace(
  "{section === 'tickets' && <TicketsForm config={config} set={set} resources={resources} />}",
  "{section === 'tickets' && <TicketsForm config={config} set={set} resources={resources} premiumPlan={premiumPlan} />}"
);

if (!main.includes('function TicketsForm({ config, set, resources, premiumPlan })')) {
  main = main.replace(
/function TicketsForm\(\{ config, set, resources \}\) \{[\s\S]*?\n\}\n\nfunction ModerationForm/,
`function TicketsForm({ config, set, resources, premiumPlan }) {
  const rank = premiumPlan === 'pro' ? 2 : premiumPlan === 'lite' ? 1 : 0;
  const planName = rank === 2 ? 'Pro' : rank === 1 ? 'Lite' : 'Gratis';
  const title = config.panelTitle || 'Soporte';
  const description = config.panelDescription || 'Pulsa el botón para abrir un ticket privado.';
  const buttonLabel = config.panelButtonLabel || 'Abrir ticket';
  const emoji = config.panelButtonEmoji || '🎫';
  const color = /^#[0-9a-fA-F]{6}$/.test(config.panelColor || '') ? config.panelColor : '#5865F2';

  return <div className="form-card ticket-builder">
    <FormSection title="Publicación" description="Al guardar, Klvro publica o actualiza el panel en el canal elegido.">
      <ChannelSelect label="Canal del panel" value={config.panelChannelId} onChange={(value) => set('panelChannelId', value)} channels={textChannels(resources.channels)} />
      <ChannelSelect label="Categoría de tickets" value={config.categoryId} onChange={(value) => set('categoryId', value)} channels={categoryChannels(resources.channels)} />
      <RoleSelect label="Rol del staff" value={config.staffRoleId} onChange={(value) => set('staffRoleId', value)} roles={resources.roles} />
      <ChannelSelect label="Canal de registros" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} />
      <ToggleRow title="Guardar transcript" description="Adjunta un .txt al cerrar el ticket." checked={config.transcript} onChange={(value) => set('transcript', value)} />
    </FormSection>

    <FormSection title="Panel" description={\`Plan actual: \${planName}.\`}>
      <Field label="Título"><input maxLength="256" value={title} onChange={(event) => set('panelTitle', event.target.value)} /></Field>
      <Field label="Descripción"><textarea rows="5" maxLength="4000" value={description} onChange={(event) => set('panelDescription', event.target.value)} /></Field>
    </FormSection>

    <FormSection title="Premium Lite" description="Texto del botón, color y pie del panel.">
      {rank < 1 && <div className="premium-lock"><Sparkles size={15} /> Premium Lite</div>}
      <Field label="Texto del botón"><input disabled={rank < 1} maxLength="80" value={buttonLabel} onChange={(event) => set('panelButtonLabel', event.target.value)} /></Field>
      <Field label="Color"><div className="color-field"><input disabled={rank < 1} type="color" value={color} onChange={(event) => set('panelColor', event.target.value)} /><code>{color.toUpperCase()}</code></div></Field>
      <Field label="Pie"><input disabled={rank < 1} maxLength="2048" value={config.panelFooter || ''} onChange={(event) => set('panelFooter', event.target.value)} placeholder="Opcional" /></Field>
    </FormSection>

    <FormSection title="Premium Pro" description="Emoji del botón e imagen dentro del embed.">
      {rank < 2 && <div className="premium-lock"><Sparkles size={15} /> Premium Pro</div>}
      <Field label="Emoji"><input disabled={rank < 2} maxLength="64" value={emoji} onChange={(event) => set('panelButtonEmoji', event.target.value)} placeholder="🎫" /></Field>
      <Field label="Imagen"><input disabled={rank < 2} maxLength="1000" value={config.panelImageUrl || ''} onChange={(event) => set('panelImageUrl', event.target.value)} placeholder="https://..." /></Field>
    </FormSection>

    <PreviewCard title="Vista previa">
      <div className="ticket-panel-preview">
        <div className="ticket-preview-embed" style={{ borderLeftColor: color }}>
          <strong>{title || 'Soporte'}</strong>
          <p>{description || 'Pulsa el botón para abrir un ticket privado.'}</p>
          {rank >= 2 && /^https:\/\//i.test(config.panelImageUrl || '') && <img src={config.panelImageUrl} alt="" />}
          {rank >= 1 && config.panelFooter && <small>{config.panelFooter}</small>}
        </div>
        <button type="button" className="ticket-preview-button" tabIndex="-1">{rank >= 2 && emoji ? <span>{emoji}</span> : null}{buttonLabel}</button>
      </div>
    </PreviewCard>
  </div>;
}

function ModerationForm`
  );
}

const cssMarker = '/* Klvro ticket panel builder */';
if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
.ticket-builder { gap: 16px; }
.premium-lock {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  padding: 0 11px;
  border: 1px solid rgba(88,101,242,.28);
  border-radius: 9px;
  background: rgba(88,101,242,.1);
  color: #b9c0ff;
  font-size: 12px;
  font-weight: 700;
}
.field input:disabled, .field textarea:disabled, .field select:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.color-field { display: flex; align-items: center; gap: 10px; }
.color-field input[type="color"] { width: 48px; height: 38px; padding: 3px; cursor: pointer; }
.color-field code { color: #aeb5c0; font-size: 12px; }
.ticket-panel-preview { padding: 16px; border-radius: 12px; background: #313338; }
.ticket-preview-embed {
  max-width: 520px;
  overflow: hidden;
  padding: 13px 14px;
  border-left: 4px solid #5865F2;
  border-radius: 4px;
  background: #2b2d31;
  box-shadow: 0 1px 2px rgba(0,0,0,.18);
}
.ticket-preview-embed strong { display: block; margin-bottom: 8px; color: #f2f3f5; font-size: 15px; }
.ticket-preview-embed p { margin: 0; color: #dbdee1; white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
.ticket-preview-embed img { display: block; width: 100%; max-height: 240px; margin-top: 12px; border-radius: 5px; object-fit: cover; }
.ticket-preview-embed small { display: block; margin-top: 12px; color: #b5bac1; font-size: 11px; }
.ticket-preview-button {
  min-height: 38px;
  margin-top: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  background: #5865f2;
  color: white;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}
@media (max-width: 760px) {
  .ticket-panel-preview { padding: 12px; }
}
`;
}

write(dbPath, db);
write(discordPath, discord);
write(indexPath, index);
write(mainPath, main);
write(cssPath, css);
console.log('[Klvro] Ticket panel builder aplicado.');
