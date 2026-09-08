import fs from 'node:fs';

const read = (url) => fs.readFileSync(url, 'utf8');
const write = (url, text) => fs.writeFileSync(url, text);
const root = new URL('./', import.meta.url);
const file = (relative) => new URL(`../${relative}`, root);

const indexPath = file('server/index.mjs');
const mainPath = file('src/main.jsx');

let index = read(indexPath);
let main = read(mainPath);

if (!index.includes("from './admin-db.mjs'")) {
  index = index.replace(
    "import { publicPlans } from './plans.mjs';",
    `import { publicPlans } from './plans.mjs';
import {
  banUser,
  getAdminOverview,
  getUserBan,
  grantManualPremium,
  initAdminDb,
  listAdminActions,
  searchAdminUsers,
  unbanUser,
} from './admin-db.mjs';`
  );
}

const oldRequireAuth = `function requireAuth(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  next();
}`;

const newRequireAuth = `async function requireAuth(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  try {
    const ban = await getUserBan(req.session.user.id);
    if (ban) return res.status(403).json({ error: 'Tu acceso a Klvro está suspendido.' });
    next();
  } catch (error) {
    next(error);
  }
}

const ADMIN_USER_IDS = new Set(
  String(process.env.ADMIN_DISCORD_IDS || '')
    .split(/[\\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => /^\\d{16,22}$/.test(value))
);

function isAdminUserId(userId) {
  return ADMIN_USER_IDS.has(String(userId || ''));
}

async function requireAdmin(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  try {
    const ban = await getUserBan(req.session.user.id);
    if (ban) return res.status(403).json({ error: 'Tu acceso a Klvro está suspendido.' });
    if (!isAdminUserId(req.session.user.id)) {
      return res.status(403).json({ error: 'No tienes acceso al panel administrativo.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}`;

if (index.includes(oldRequireAuth)) {
  index = index.replace(oldRequireAuth, newRequireAuth);
}

if (!index.includes('const adminLimiter = rateLimit')) {
  index = index.replace(
    "app.use('/api/billing/paypal', billingLimiter);",
    `app.use('/api/billing/paypal', billingLimiter);

const adminLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/admin', adminLimiter);`
  );
}

if (!index.includes("const accountBan = await getUserBan(user.id);")) {
  index = index.replace(
    "    if (!userResponse.ok) throw new Error('No se pudo leer el perfil de Discord.');",
    `    if (!userResponse.ok) throw new Error('No se pudo leer el perfil de Discord.');

    const accountBan = await getUserBan(user.id);
    if (accountBan) {
      return res.status(403).send('Tu acceso a Klvro está suspendido.');
    }`
  );
}

const oldMeRoute = `app.get('/api/me', async (req, res, next) => {
  try {
    if (!req.session.user?.id) return res.json({ authenticated: false, user: null, premium: null });
    const premium = await getPremiumAccess(req.session.user.id);
    res.json({ authenticated: true, user: req.session.user, premium });
  } catch (error) {
    next(error);
  }
});`;

const newMeRoute = `app.get('/api/me', async (req, res, next) => {
  try {
    if (!req.session.user?.id) return res.json({ authenticated: false, user: null, premium: null, admin: false });
    const ban = await getUserBan(req.session.user.id);
    if (ban) {
      return res.status(403).json({ authenticated: false, banned: true, error: 'Tu acceso a Klvro está suspendido.' });
    }
    const premium = await getPremiumAccess(req.session.user.id);
    res.json({
      authenticated: true,
      user: req.session.user,
      premium,
      admin: isAdminUserId(req.session.user.id),
    });
  } catch (error) {
    next(error);
  }
});`;

if (index.includes(oldMeRoute)) {
  index = index.replace(oldMeRoute, newMeRoute);
}

if (!index.includes("app.get('/api/admin/overview'")) {
  const adminRoutes = `app.get('/api/admin/overview', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ overview: await getAdminOverview() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').slice(0, 80);
    res.json({ users: await searchAdminUsers(search, 60) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/actions', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ actions: await listAdminActions(40) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/ban', requireAdmin, async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!/^\\d{16,22}$/.test(userId)) {
      return res.status(400).json({ error: 'ID de Discord inválido.' });
    }
    if (isAdminUserId(userId)) {
      return res.status(400).json({ error: 'No puedes banear una cuenta administrativa.' });
    }
    const ban = await banUser({ userId, adminId: req.session.user.id, reason });
    res.json({ ok: true, ban });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/unban', requireAdmin, async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!/^\\d{16,22}$/.test(userId)) {
      return res.status(400).json({ error: 'ID de Discord inválido.' });
    }
    const result = await unbanUser({ userId, adminId: req.session.user.id });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/premium', requireAdmin, async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const plan = String(req.body?.plan || '').trim().toLowerCase();
    const days = Number(req.body?.days);
    if (!/^\\d{16,22}$/.test(userId)) {
      return res.status(400).json({ error: 'ID de Discord inválido.' });
    }
    if (!['lite', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan Premium inválido.' });
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'La duración debe estar entre 1 y 365 días.' });
    }
    const premium = await grantManualPremium({
      userId,
      adminId: req.session.user.id,
      plan,
      days,
    });
    res.json({ ok: true, premium });
  } catch (error) {
    next(error);
  }
});

`;
  index = index.replace("app.get('/api/billing/plans', (_req, res) => {", adminRoutes + "app.get('/api/billing/plans', (_req, res) => {");
}

if (!index.includes('await initAdminDb();')) {
  index = index.replace('  await initDb();\n', '  await initDb();\n  await initAdminDb();\n');
}

if (!main.includes("import AdminPanel from './AdminPanel.jsx';")) {
  main = main.replace(
    "import './styles.css';",
    "import './styles.css';\nimport AdminPanel from './AdminPanel.jsx';"
  );
}

main = main.replace(
  "const [screen, setScreen] = useState(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');",
  "const [screen, setScreen] = useState(window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/app') ? 'servers' : 'landing');"
);

main = main.replace(
  "      setScreen(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');",
  "      setScreen(window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/app') ? 'servers' : 'landing');"
);

main = main.replace(
`        if (data?.authenticated) {
          history.pushState({}, '', '/app');
          setScreen('servers');
          loadGuilds();
        }`,
`        if (data?.authenticated) {
          if (window.location.pathname.startsWith('/admin')) {
            setScreen('admin');
          } else {
            history.pushState({}, '', '/app');
            setScreen('servers');
            loadGuilds();
          }
        }`
);

if (!main.includes('function goAdmin()')) {
  main = main.replace(
    '  function goApp() {',
    `  function goAdmin() {
    history.pushState({}, '', '/admin');
    setSelectedServer(null);
    setScreen('admin');
    window.scrollTo(0, 0);
  }

  function goApp() {`
  );
}

if (!main.includes("if (screen === 'admin')")) {
  main = main.replace(
    "  if (screen === 'landing') {",
    `  if (screen === 'admin') {
    return (
      <AdminPanel
        me={me}
        onLogin={() => openLoginPopup(() => {
          history.pushState({}, '', '/admin');
          setScreen('admin');
          loadMe();
        })}
        onHome={goHome}
        onLogout={logout}
      />
    );
  }

  if (screen === 'landing') {`
  );
}

main = main.replace(
`        onLogout={logout}
        onHome={goHome}
      />`,
`        onLogout={logout}
        onHome={goHome}
        onAdmin={me.admin ? goAdmin : null}
      />`
);

main = main.replace(
  'function ServerSelect({ guilds, me, loading, error, onSelect, onRefresh, onLogout, onHome }) {',
  'function ServerSelect({ guilds, me, loading, error, onSelect, onRefresh, onLogout, onHome, onAdmin }) {'
);

main = main.replace(
`<div className="servers-user"><UserAvatar user={me.user} /><span>{me.user?.globalName || me.user?.username}</span><button className="icon-button" onClick={onLogout}><LogOut size={17} /></button></div>`,
`<div className="servers-user"><UserAvatar user={me.user} /><span>{me.user?.globalName || me.user?.username}</span>{onAdmin && <button className="admin-entry-button" onClick={onAdmin}>Admin</button>}<button className="icon-button" onClick={onLogout}><LogOut size={17} /></button></div>`
);

write(indexPath, index);
write(mainPath, main);
console.log('[Klvro] Panel administrativo seguro aplicado.');
