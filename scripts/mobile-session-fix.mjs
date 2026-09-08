import fs from 'node:fs';

const root = new URL('./', import.meta.url);
const file = (relative) => new URL(`../${relative}`, root);
const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);

const mainPath = file('src/main.jsx');
const cssPath = file('src/styles.css');
const indexPath = file('server/index.mjs');

let main = read(mainPath);
let css = read(cssPath);
let index = read(indexPath);

// En móvil el menú debe empezar cerrado.
main = main.replace(
  "const [sidebarOpen, setSidebarOpen] = useState(true);",
  "const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860);"
);

// Evita varias peticiones iguales de servidores al mismo tiempo.
if (!main.includes('const guildRequestRef = React.useRef(null);')) {
  main = main.replace(
    "const [billingPlan, setBillingPlan] = useState(null);",
    "const [billingPlan, setBillingPlan] = useState(null);\n  const guildRequestRef = React.useRef(null);"
  );
}

const oldLoadGuilds = `  async function loadGuilds() {
    try {
      setError('');
      const data = await api('/api/guilds');
      setGuilds(data.guilds || []);
    } catch (err) {
      setError(err.message);
    }
  }`;

const newLoadGuilds = `  async function loadGuilds() {
    if (guildRequestRef.current) return guildRequestRef.current;
    const request = (async () => {
      try {
        setError('');
        const data = await api('/api/guilds');
        setGuilds(data.guilds || []);
        return data.guilds || [];
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        guildRequestRef.current = null;
      }
    })();
    guildRequestRef.current = request;
    return request;
  }`;

if (main.includes(oldLoadGuilds)) main = main.replace(oldLoadGuilds, newLoadGuilds);

// Ya no recarga la lista por cada focus/visibility, que en iPhone dispara llamadas de más.
main = main.replace(
`  useEffect(() => {
    if (screen !== 'servers' || !me.authenticated) return;

    loadGuilds();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadGuilds();
    };
    const refreshOnFocus = () => loadGuilds();

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [screen, me.authenticated]);`,
`  useEffect(() => {
    if (screen !== 'servers' || !me.authenticated) return;
    loadGuilds();
  }, [screen, me.authenticated]);`
);

// Cierra la sesión al recargar, cerrar la pestaña o salir de la web.
if (!main.includes("window.addEventListener('pagehide', logoutWhenLeaving)")) {
  const anchor = `  async function loadMe() {`;
  const effect = `  useEffect(() => {
    if (!me.authenticated) return undefined;
    const logoutWhenLeaving = () => {
      try {
        const payload = new Blob(['{}'], { type: 'application/json' });
        navigator.sendBeacon('/auth/logout', payload);
      } catch {}
    };
    window.addEventListener('pagehide', logoutWhenLeaving);
    return () => window.removeEventListener('pagehide', logoutWhenLeaving);
  }, [me.authenticated]);

`;
  main = main.replace(anchor, effect + anchor);
}

// Cierra el drawer al elegir una sección en móvil.
main = main.replace(
  "onClick={() => setSection(item.id)}>",
  "onClick={() => { setSection(item.id); if (window.innerWidth <= 860) setSidebarOpen(false); }}>"
);

// Backend: guarda en sesión la lista administrable obtenida de Discord y la reutiliza.
const fetchGuildsPattern = /async function fetchManageableGuilds\(req\) \{[\s\S]*?\n\}\n\nasync function requireGuildAccess/;
if (fetchGuildsPattern.test(index)) {
  index = index.replace(fetchGuildsPattern, `function decorateManageableGuilds(guilds) {
  return guilds.map((guild) => ({ ...guild, botAdded: botHasGuild(guild.id) }));
}

async function fetchManageableGuilds(req, { force = false } = {}) {
  if (!force && Array.isArray(req.session.manageableGuilds)) {
    return decorateManageableGuilds(req.session.manageableGuilds);
  }

  const accessToken = await refreshDiscordToken(req);
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds?limit=200', {
    headers: { Authorization: \`Bearer \${accessToken}\` },
  });

  if (!response.ok) {
    if (Array.isArray(req.session.manageableGuilds)) {
      return decorateManageableGuilds(req.session.manageableGuilds);
    }
    throw new Error('No se pudieron obtener los servidores de Discord.');
  }

  const guilds = await response.json();
  const manageable = guilds
    .filter(canManageGuild)
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      permissions: guild.permissions,
      memberCount: null,
      presenceCount: null,
      icon: guild.icon
        ? \`https://cdn.discordapp.com/icons/\${guild.id}/\${guild.icon}.png?size=128\`
        : null,
    }));

  req.session.manageableGuilds = manageable;
  return decorateManageableGuilds(manageable);
}

async function requireGuildAccess`);
}

// Precarga los servidores durante el callback OAuth para que /app los muestre de inmediato.
index = index.replace(
  '    await upsertUser(user);\n    req.session.save(() => {',
  `    await Promise.all([
      upsertUser(user),
      fetchManageableGuilds(req, { force: true }).catch((error) => {
        console.warn('[Klvro] No se pudo precargar la lista de servidores:', error.message);
        return [];
      }),
    ]);
    req.session.save(() => {`
);

const marker = '/* Klvro mobile dashboard fix */';
if (!css.includes(marker)) {
  css += `

${marker}
@media (max-width: 860px) {
  html, body, #root { width: 100%; overflow-x: hidden; }
  .app-shell {
    display: block;
    min-height: 100dvh;
    width: 100%;
  }
  .server-rail { display: none !important; }
  .main-panel {
    width: 100%;
    min-width: 0;
    grid-column: auto;
  }
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(82vw, 300px);
    height: 100dvh;
    inset: 0 auto 0 0;
    z-index: 80;
    overflow-y: auto;
    overscroll-behavior: contain;
    transform: translateX(0);
    transition: transform .2s ease;
    box-shadow: 18px 0 48px rgba(0,0,0,.5);
  }
  .sidebar.sidebar-collapsed { transform: translateX(-105%); }
  .mobile-sidebar { display: grid !important; }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
  }
  .content-wrap {
    width: calc(100% - 28px);
    max-width: none;
    margin: 0 14px;
    padding: 20px 0 48px;
  }
  .settings-layout { grid-template-columns: minmax(0, 1fr); }
  .settings-main, .form-card, .hero-card, .stat-card, .module-card { min-width: 0; }
}

@media (max-width: 560px) {
  .topbar {
    height: 64px;
    padding: 0 12px;
    gap: 8px;
  }
  .topbar-left { gap: 9px; }
  .topbar-left h1 { font-size: 18px; margin-top: 0; }
  .breadcrumb { display: none; }
  .topbar-actions { gap: 7px; }
  .topbar-actions .premium-user-chip,
  .topbar-actions > .icon-button[title='Actualizar'] { display: none; }
  .icon-button, .user-button { width: 38px; height: 38px; }
  .user-button { padding: 4px; justify-content: center; }
  .user-avatar { width: 28px; height: 28px; }
  .content-wrap { width: calc(100% - 24px); margin: 0 12px; }
  .hero-card { padding: 18px; }
  .hero-server { width: 100%; align-items: flex-start; }
  .server-avatar.hero { width: 48px; height: 48px; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .stat-card { padding: 14px; min-height: 90px; }
  .module-grid { grid-template-columns: 1fr; }
  .module-card { min-height: 82px; padding: 14px; }
  .form-section { padding: 18px 14px; }
  .save-bar { bottom: 8px; margin-left: 0; margin-right: 0; }
}

@media (max-width: 380px) {
  .stat-grid { grid-template-columns: 1fr; }
  .topbar-actions .notification { display: none; }
}
`;
}

write(mainPath, main);
write(cssPath, css);
write(indexPath, index);
console.log('[Klvro] Responsive móvil, sesión y carga de servidores corregidos.');
