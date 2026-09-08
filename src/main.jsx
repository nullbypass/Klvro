import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Command,
  CreditCard,
  ExternalLink,
  Globe,
  LifeBuoy,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

const nav = [
  { id: 'overview', label: 'Resumen', icon: SlidersHorizontal },
  { id: 'general', label: 'General', icon: Settings },
  { id: 'welcome', label: 'Bienvenidas', icon: UserPlus },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'moderation', label: 'Moderación', icon: ShieldCheck },
  { id: 'antiRaid', label: 'Anti-Raid', icon: ShieldAlert },
  { id: 'administration', label: 'Administración', icon: UserCog },
  { id: 'autoroles', label: 'Autoroles', icon: Users },
  { id: 'logs', label: 'Registros', icon: ClipboardList },
  { id: 'commands', label: 'Comandos', icon: Command },
];

const showcaseServers = [
  { id: 'a', name: 'Roleplay', members: 'Comunidades RP', accent: 'blue' },
  { id: 'b', name: 'Gaming', members: 'Servidores gaming', accent: 'red' },
  { id: 'c', name: 'Comunidad', members: 'Servidores sociales', accent: 'gray' },
  { id: 'd', name: 'Anime', members: 'Comunidades temáticas', accent: 'gold' },
  { id: 'e', name: 'Eventos', members: 'Eventos y torneos', accent: 'green' },
  { id: 'f', name: 'Soporte', members: 'Equipos y servicios', accent: 'yellow' },
];

const publicRoutes = {
  home: '/',
  server: '/servidor',
  status: '/estado',
  commands: '/comandos',
  features: '/funciones',
  premium: '/premium',
};

function publicPageFromPath(pathname) {
  return Object.entries(publicRoutes).find(([, path]) => path === pathname)?.[0] || 'home';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
  return data;
}


function openCenteredPopup(url, name, width = 560, height = 760) {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return window.open(
    url,
    name,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function App() {
  const [screen, setScreen] = useState(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');
  const [publicPage, setPublicPage] = useState(publicPageFromPath(window.location.pathname));
  const [me, setMe] = useState({ loading: true, authenticated: false, user: null, premium: null });
  const [guilds, setGuilds] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [section, setSection] = useState('overview');
  const [settings, setSettings] = useState(null);
  const [resources, setResources] = useState({ channels: [], roles: [] });
  const [status, setStatus] = useState({ botReady: false, guildCount: 0, latency: null });
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [serverMenu, setServerMenu] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [billingPlan, setBillingPlan] = useState(null);

  useEffect(() => {
    loadMe();
    api('/api/status').then(setStatus).catch(() => null);

    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (billing === 'success') setError('Pago completado. Tu Premium ya está activo.');
    if (billing === 'cancelled') setError('El pago fue cancelado.');
    if (billing === 'error') setError('No se pudo completar el pago.');

    const onPopupMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'klvro-auth-success') {
        const data = await loadMe();
        if (data?.authenticated) {
          history.pushState({}, '', '/app');
          setScreen('servers');
          loadGuilds();
        }
      }
    };

    const onPop = () => {
      setScreen(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');
      setPublicPage(publicPageFromPath(window.location.pathname));
    };
    window.addEventListener('message', onPopupMessage);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('message', onPopupMessage);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
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
  }, [screen, me.authenticated]);

  async function loadMe() {
    try {
      const data = await api('/api/me');
      setMe({ loading: false, ...data });

      if (window.location.pathname.startsWith('/app') && !data.authenticated) {
        window.location.href = '/auth/discord';
      }
      return data;
    } catch (err) {
      setMe({ loading: false, authenticated: false, user: null, premium: null });
      setError(err.message);
      return null;
    }
  }

  async function loadGuilds() {
    try {
      setError('');
      const data = await api('/api/guilds');
      setGuilds(data.guilds || []);
    } catch (err) {
      setError(err.message);
    }
  }

  function openLoginPopup(afterLogin = null) {
    const popup = openCenteredPopup('/auth/discord', 'klvro-discord-login', 540, 760);
    if (!popup) {
      setError('El navegador bloqueó la ventana de Discord. Permite ventanas emergentes para este sitio.');
      return;
    }
    popup.focus();

    let checks = 0;
    const watcher = window.setInterval(async () => {
      checks += 1;
      try {
        const data = await api('/api/me');
        if (data?.authenticated) {
          window.clearInterval(watcher);
          setMe({ loading: false, ...data });
          try { popup.close(); } catch {}

          if (typeof afterLogin === 'function') {
            afterLogin();
          } else {
            history.pushState({}, '', '/app');
            setScreen('servers');
            loadGuilds();
          }
          return;
        }
      } catch {
        // El popup sigue abierto mientras Discord termina el login.
      }

      if (popup.closed || checks >= 180) {
        window.clearInterval(watcher);
        const data = await loadMe();
        if (data?.authenticated && typeof afterLogin !== 'function') {
          history.pushState({}, '', '/app');
          setScreen('servers');
          loadGuilds();
        }
      }
    }, 700);
  }

  function openInvitePopup(serverId = '') {
    if (!me.authenticated) {
      openLoginPopup(() => launchInvitePopup(serverId));
      return;
    }
    launchInvitePopup(serverId);
  }

  function launchInvitePopup(serverId = '') {
    const suffix = serverId ? `?guildId=${encodeURIComponent(serverId)}` : '';
    const popup = openCenteredPopup(`/api/discord/invite${suffix}`, 'klvro-discord-invite', 560, 780);
    if (!popup) {
      setError('El navegador bloqueó la ventana de Discord. Permite ventanas emergentes para este sitio.');
      return;
    }
    popup.focus();

    let checks = 0;
    let installedBefore = new Set(guilds.filter((guild) => guild.botAdded).map((guild) => guild.id));

    // Si se abrió desde la web pública, toma una foto real de los servidores antes de esperar la instalación.
    api('/api/guilds').then((data) => {
      installedBefore = new Set((data.guilds || []).filter((guild) => guild.botAdded).map((guild) => guild.id));
      setGuilds(data.guilds || []);
    }).catch(() => null);

    const watcher = window.setInterval(async () => {
      checks += 1;
      try {
        const data = await api('/api/guilds');
        const nextGuilds = data.guilds || [];
        setGuilds(nextGuilds);

        const installed = serverId
          ? nextGuilds.find((guild) => guild.id === serverId && guild.botAdded)
          : nextGuilds.find((guild) => guild.botAdded && !installedBefore.has(guild.id));

        if (installed) {
          window.clearInterval(watcher);
          try { popup.close(); } catch {}
          history.pushState({}, '', '/app');
          setScreen('servers');
          await openServer(installed);
          return;
        }
      } catch {
        // Se vuelve a intentar mientras Discord termina de añadir el bot.
      }

      if (popup.closed || checks >= 120) {
        window.clearInterval(watcher);
        loadGuilds();
      }
    }, 1000);
  }

  function goApp() {
    if (!me.authenticated) {
      openLoginPopup();
      return;
    }
    history.pushState({}, '', '/app');
    setScreen('servers');
  }

  function goHome() {
    history.pushState({}, '', '/');
    setSelectedServer(null);
    setPublicPage('home');
    setScreen('landing');
  }

  function goPublic(page) {
    const path = publicRoutes[page] || '/';
    history.pushState({}, '', path);
    setPublicPage(page in publicRoutes ? page : 'home');
    setSelectedServer(null);
    setScreen('landing');
    window.scrollTo(0, 0);
  }

  async function openServer(server) {
    if (!server.botAdded) {
      openInvitePopup(server.id);
      return;
    }

    setLoadingDashboard(true);
    setError('');
    try {
      const [configData, resourceData, statusData] = await Promise.all([
        api(`/api/guilds/${server.id}/settings`),
        api(`/api/guilds/${server.id}/resources`),
        api('/api/status'),
      ]);
      setSelectedServer(server);
      setSettings(configData.settings);
      setResources(resourceData);
      setStatus(statusData);
      setSection('overview');
      setScreen('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function saveSettings() {
    if (!selectedServer || !settings) return;
    try {
      setError('');
      const data = await api(`/api/guilds/${selectedServer.id}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      setSettings(data.settings);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 2200);
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    setMe({ loading: false, authenticated: false, user: null, premium: null });
    goHome();
  }

  if (screen === 'landing') {
    return (
      <>
        <Landing
          page={publicPage}
          me={me}
          onHome={goHome}
          onNavigate={goPublic}
          onManage={goApp}
          onAdd={() => openInvitePopup()}
          onLogin={openLoginPopup}
          onPlan={(plan) => {
            if (!me.authenticated) openLoginPopup();
            else setBillingPlan(plan);
          }}
          error={error}
          clearError={() => setError('')}
        />
        {billingPlan && <PaymentModal plan={billingPlan} onClose={() => setBillingPlan(null)} />}
      </>
    );
  }

  if (screen === 'servers') {
    return (
      <ServerSelect
        guilds={guilds}
        me={me}
        loading={loadingDashboard}
        error={error}
        onSelect={openServer}
        onRefresh={loadGuilds}
        onLogout={logout}
        onHome={goHome}
      />
    );
  }

  if (!selectedServer || !settings) return <FullLoader />;

  return (
    <div className="app-shell">
      <ServerRail
        guilds={guilds.filter((guild) => guild.botAdded)}
        selectedServerId={selectedServer.id}
        onSelect={(id) => {
          const server = guilds.find((guild) => guild.id === id);
          if (server) openServer(server);
        }}
        onAllServers={() => setScreen('servers')}
        onHome={goHome}
      />

      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <div className="sidebar-top">
          <button className="server-picker" onClick={() => setServerMenu((value) => !value)}>
            <ServerIcon server={selectedServer} size="small" />
            <div className="server-picker-copy">
              <strong>{selectedServer.name}</strong>
              <span>{formatMembers(selectedServer.memberCount)}</span>
            </div>
            <ChevronDown size={16} />
          </button>

          {serverMenu && (
            <div className="server-dropdown">
              {guilds.filter((server) => server.botAdded).map((server) => (
                <button key={server.id} onClick={() => { setServerMenu(false); openServer(server); }}>
                  <ServerIcon server={server} size="tiny" />
                  <span>{server.name}</span>
                </button>
              ))}
              <button className="dropdown-secondary" onClick={() => setScreen('servers')}>
                <Plus size={15} /> Ver todos los servidores
              </button>
            </div>
          )}
        </div>

        <nav className="nav-list">
          <p className="nav-kicker">CONFIGURACIÓN</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button><CircleHelp size={17} /> Documentación</button>
          <button><LifeBuoy size={17} /> Soporte</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-sidebar" onClick={() => setSidebarOpen((value) => !value)}><Menu size={19} /></button>
            <div>
              <p className="breadcrumb">Klvro <ChevronRight size={13} /> {nav.find((item) => item.id === section)?.label}</p>
              <h1>{nav.find((item) => item.id === section)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {me.premium && <span className="premium-user-chip"><Sparkles size={13} /> {premiumName(me.premium.plan)}</span>}
            <button className="icon-button" title="Actualizar" onClick={() => openServer(selectedServer)}><RefreshCcw size={18} /></button>
            <button className="icon-button notification" title="Estado"><Bell size={18} /><span /></button>
            <button className="user-button" onClick={logout} title="Cerrar sesión">
              <UserAvatar user={me.user} />
              <div><strong>{me.user?.globalName || me.user?.username}</strong><span>Administrador</span></div>
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {error && <Notice text={error} onClose={() => setError('')} />}
          {section === 'overview' ? (
            <Overview server={selectedServer} settings={settings} status={status} onNavigate={setSection} />
          ) : (
            <SettingsPage
              section={section}
              settings={settings}
              setSettings={setSettings}
              resources={resources}
              onSave={saveSettings}
              savedAt={savedAt}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Landing({ page, me, onHome, onNavigate, onManage, onAdd, onLogin, onPlan, error, clearError }) {
  const [paidPlans, setPaidPlans] = useState([
    { id: 'lite', name: 'Premium Lite', amount: 299, days: 30 },
    { id: 'pro', name: 'Premium Pro', amount: 599, days: 30 },
  ]);
  const [liveStatus, setLiveStatus] = useState({ loading: true, botReady: false, guildCount: 0, latency: null });

  useEffect(() => {
    api('/api/billing/plans').then((data) => setPaidPlans(data.plans || [])).catch(() => null);
    api('/api/status')
      .then((data) => setLiveStatus({ loading: false, ...data }))
      .catch(() => setLiveStatus((current) => ({ ...current, loading: false })));
  }, []);

  const paidById = Object.fromEntries(paidPlans.map((plan) => [plan.id, plan]));
  const plans = [
    { id: 'free', name: 'Gratis', price: 'US$0', note: 'Sin pago', features: ['Panel web', 'Comandos básicos', 'Tickets', 'Moderación'], cta: 'Usar gratis' },
    { id: 'lite', name: paidById.lite?.name || 'Premium Lite', price: formatPrice(paidById.lite?.amount ?? 299), note: `${paidById.lite?.days ?? 30} días`, features: ['Más opciones de configuración', 'Más registros', 'Más capacidad', 'Soporte prioritario'], cta: 'Comprar Lite', featured: true },
    { id: 'pro', name: paidById.pro?.name || 'Premium Pro', price: formatPrice(paidById.pro?.amount ?? 599), note: `${paidById.pro?.days ?? 30} días`, features: ['Todo lo de Lite', 'Límites más altos', 'Funciones avanzadas', 'Soporte prioritario'], cta: 'Comprar Pro' },
  ];

  const commandGroups = [
    {
      title: 'Moderación',
      items: [
        ['/ban', 'Banea a un miembro.'],
        ['/kick', 'Saca a un miembro del servidor.'],
        ['/timeout', 'Aplica un timeout.'],
        ['/untimeout', 'Quita el timeout.'],
        ['/warn', 'Guarda una advertencia.'],
        ['/warnings', 'Muestra las advertencias de un miembro.'],
        ['/clearwarnings', 'Borra sus advertencias.'],
        ['/purge', 'Borra varios mensajes.'],
      ],
    },
    {
      title: 'Canales y roles',
      items: [
        ['/slowmode', 'Cambia el modo lento del canal.'],
        ['/lock', 'Bloquea el canal.'],
        ['/unlock', 'Vuelve a abrirlo.'],
        ['/role add', 'Añade un rol.'],
        ['/role remove', 'Quita un rol.'],
        ['/nick', 'Cambia el apodo de un miembro.'],
      ],
    },
    {
      title: 'Anti-Raid',
      items: [
        ['/antiraid status', 'Muestra el estado del Anti-Raid.'],
        ['/antiraid lockdown', 'Activa la protección reforzada.'],
        ['/antiraid unlock', 'Quita el lockdown manual.'],
      ],
    },
    {
      title: 'Utilidades',
      items: [
        ['/say', 'Hace que Klvro envíe un mensaje.'],
        ['/embed', 'Envía un embed.'],
        ['/userinfo', 'Muestra información de un usuario.'],
        ['/serverinfo', 'Muestra información del servidor.'],
      ],
    },
  ];

  return (
    <div className="landing-screen public-site">
      <header className="landing-nav">
        <button className="landing-brand brand-button" onClick={onHome}>
          <LogoMark className="landing-brand-avatar" />
          <strong>Klvro</strong>
        </button>
        <nav className="landing-links">
          <button onClick={onManage}>Panel</button>
          <button className={page === 'server' ? 'active' : ''} onClick={() => onNavigate('server')}>Servidor</button>
          <button className={page === 'status' ? 'active' : ''} onClick={() => onNavigate('status')}>Estado</button>
          <button className={page === 'commands' ? 'active' : ''} onClick={() => onNavigate('commands')}>Comandos</button>
          <button className={page === 'features' ? 'active' : ''} onClick={() => onNavigate('features')}>Funciones</button>
        </nav>
        <div className="landing-actions">
          <button className={`premium-chip ${page === 'premium' ? 'active' : ''}`} onClick={() => onNavigate('premium')}><Sparkles size={14} /> Premium</button>
          <span className="lang-chip"><Globe size={14} /> ES</span>
          {me.authenticated ? (
            <button className="login-link dashboard-return-button" onClick={onManage}><Settings size={15} /> Volver al dashboard</button>
          ) : (
            <button className="login-link" onClick={onLogin}>Iniciar sesión</button>
          )}
        </div>
      </header>

      {error && <div className="landing-notice"><Notice text={error} onClose={clearError} /></div>}

      {page === 'home' && (
        <main className="public-page home-page">
          <section className="landing-hero dotted-bg">
            <LogoMark className="hero-bot-avatar" />
            <h1>Klvro</h1>
            <p>Configura el bot desde la web y úsalo en Discord. Moderación, tickets, logs y Anti-Raid.</p>
            <div className="hero-buttons">
              <button className="secondary-hero-button" onClick={onAdd}><DiscordIcon className="brand-discord-icon" /> Añadir a Discord</button>
              <button className="primary-hero-button" onClick={onManage}><Settings size={18} /> {me.authenticated ? 'Volver al dashboard' : 'Abrir panel'}</button>
            </div>
          </section>
          <section className="home-links-section">
            <div className="home-link-grid">
              <button onClick={() => onNavigate('server')}><Users size={20} /><div><strong>Servidor</strong><span>Cómo añadir y configurar Klvro.</span></div><ChevronRight size={18} /></button>
              <button onClick={() => onNavigate('status')}><Activity size={20} /><div><strong>Estado</strong><span>Comprueba si el bot está conectado.</span></div><ChevronRight size={18} /></button>
              <button onClick={() => onNavigate('commands')}><Command size={20} /><div><strong>Comandos</strong><span>Lista de comandos disponibles.</span></div><ChevronRight size={18} /></button>
              <button onClick={() => onNavigate('features')}><ShieldCheck size={20} /><div><strong>Funciones</strong><span>Todo lo que puedes activar desde el panel.</span></div><ChevronRight size={18} /></button>
            </div>
          </section>
        </main>
      )}

      {page === 'server' && (
        <main className="public-page">
          <section className="public-page-head">
            <p className="eyebrow">SERVIDOR</p>
            <h1>Añade Klvro y configura tu servidor</h1>
            <p>Entra con Discord, elige un servidor y Klvro te lleva al panel.</p>
            <div className="hero-buttons compact-actions">
              <button className="primary-hero-button" onClick={onManage}><Settings size={18} /> {me.authenticated ? 'Volver al dashboard' : 'Ir al panel'}</button>
              <button className="secondary-hero-button" onClick={onAdd}><DiscordIcon className="brand-discord-icon" /> Invitar bot</button>
            </div>
          </section>
          <section className="server-steps-grid">
            <article><span>1</span><h3>Inicia sesión</h3><p>Usa tu cuenta de Discord.</p></article>
            <article><span>2</span><h3>Elige el servidor</h3><p>Solo aparecen los que puedes administrar.</p></article>
            <article><span>3</span><h3>Configura</h3><p>Activa módulos, elige canales y guarda.</p></article>
          </section>
          <section className="server-types-block">
            <h2>Funciona en distintos tipos de servidor</h2>
            <div className="showcase-grid">
              {showcaseServers.map((server) => (
                <article className="showcase-card" key={server.id}>
                  <div className={`showcase-avatar ${server.accent}`}>{server.name.slice(0, 1)}</div>
                  <div className="showcase-copy"><strong>{server.name}</strong><span>{server.members}</span></div>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      {page === 'status' && (
        <main className="public-page">
          <section className="public-page-head">
            <p className="eyebrow">ESTADO</p>
            <h1>Estado de Klvro</h1>
            <p>Aquí puedes ver si el bot está conectado.</p>
          </section>
          <section className="status-grid public-status-grid">
            <article className="status-card">
              <div className={`status-icon ${liveStatus.botReady ? 'online' : 'offline'}`}><Activity size={20} /></div>
              <div><span className="status-label">Bot</span><strong>{liveStatus.loading ? 'Comprobando…' : liveStatus.botReady ? 'Online' : 'Offline'}</strong></div>
            </article>
            <article className="status-card"><div className="status-icon"><Users size={20} /></div><div><span className="status-label">Servidores</span><strong>{liveStatus.guildCount ?? 0}</strong></div></article>
            <article className="status-card"><div className="status-icon"><Activity size={20} /></div><div><span className="status-label">Latencia</span><strong>{liveStatus.latency == null ? '—' : `${liveStatus.latency} ms`}</strong></div></article>
          </section>
          <div className="status-note">La información sale directamente de la API de Klvro.</div>
        </main>
      )}

      {page === 'commands' && (
        <main className="public-page">
          <section className="public-page-head">
            <p className="eyebrow">COMANDOS</p>
            <h1>Comandos</h1>
            <p>Los principales comandos que trae Klvro.</p>
          </section>
          <section className="commands-page-grid">
            {commandGroups.map((group) => (
              <article className="command-group-card" key={group.title}>
                <h2>{group.title}</h2>
                <div className="command-rows">
                  {group.items.map(([name, description]) => (
                    <div className="command-row" key={name}><code>{name}</code><span>{description}</span></div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </main>
      )}

      {page === 'features' && (
        <main className="public-page">
          <section className="public-page-head">
            <p className="eyebrow">FUNCIONES</p>
            <h1>Funciones</h1>
            <p>Activa solo lo que vayas a usar.</p>
          </section>
          <section className="feature-showcase-grid public-feature-grid">
            <article className="feature-showcase-card"><ShieldAlert size={22} /><div><h3>Anti-Raid</h3><p>Detecta entradas masivas y acciones sensibles repetidas.</p></div></article>
            <article className="feature-showcase-card"><UserCog size={22} /><div><h3>Administración</h3><p>Ban, kick, timeout, warns, roles, canales y más.</p></div></article>
            <article className="feature-showcase-card"><Ticket size={22} /><div><h3>Tickets</h3><p>Crea tickets privados con staff y registros.</p></div></article>
            <article className="feature-showcase-card"><ClipboardList size={22} /><div><h3>Registros</h3><p>Entradas, salidas, mensajes y eventos del servidor.</p></div></article>
            <article className="feature-showcase-card"><UserPlus size={22} /><div><h3>Bienvenidas</h3><p>Mensaje en canal y, si quieres, también por DM.</p></div></article>
            <article className="feature-showcase-card"><Users size={22} /><div><h3>Autoroles</h3><p>Entrega un rol cuando entra un miembro.</p></div></article>
          </section>
          <div className="public-bottom-action"><button className="primary-hero-button" onClick={onManage}><Settings size={18} /> Configurar servidor</button></div>
        </main>
      )}

      {page === 'premium' && (
        <main className="public-page premium-page">
          <section className="public-page-head">
            <p className="eyebrow">PREMIUM</p>
            <h1>Premium</h1>
            <p>30 días por compra. No se renueva solo.</p>
          </section>
          <section className="pricing-grid public-pricing-grid">
            {plans.map((plan) => (
              <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.id}>
                <div className="pricing-top"><div><h3>{plan.name}</h3><p>{plan.note}</p></div>{plan.featured && <span className="plan-badge">Popular</span>}</div>
                <div className="pricing-price">{plan.price}</div>
                <ul className="pricing-features">{plan.features.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
                <button className={plan.featured ? 'primary-button full' : 'secondary-button full'} onClick={() => plan.id === 'free' ? onManage() : onPlan(plan)}>{plan.cta}</button>
              </article>
            ))}
          </section>
          <div className="payments-bar public-payments-bar">
            <div className="payments-copy"><CreditCard size={18} /><span>PayPal o tarjeta.</span></div>
            <div className="payment-pills"><span>PayPal</span><span>Visa</span><span>Mastercard</span></div>
          </div>
        </main>
      )}
    </div>
  );
}

function PaymentModal({ plan, onClose }) {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function pay(provider) {
    try {
      setError('');
      setLoading(provider);
      const data = await api(`/api/billing/${provider}`, {
        method: 'POST',
        body: JSON.stringify({ plan: plan.id }),
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading('');
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="payment-modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <LogoMark className="modal-logo" />
        <h2>{plan.name}</h2>
        <p>{plan.price} por 30 días.</p>
        {error && <Notice text={error} />}
        <button className="payment-option paypal" onClick={() => pay('paypal')} disabled={!!loading}>
          {loading === 'paypal' ? <LoaderCircle className="spin" size={19} /> : <span className="paypal-word">PayPal</span>}
          <span>Continuar con PayPal</span>
        </button>
        <button className="payment-option card" onClick={() => pay('stripe')} disabled={!!loading}>
          {loading === 'stripe' ? <LoaderCircle className="spin" size={19} /> : <CreditCard size={19} />}
          <span>Pagar con tarjeta</span>
        </button>
        <small>PayPal y Stripe procesan el pago. Klvro no guarda los datos de tu tarjeta.</small>
      </div>
    </div>
  );
}

function ServerSelect({ guilds, me, loading, error, onSelect, onRefresh, onLogout, onHome }) {
  const installedGuilds = guilds.filter((server) => server.botAdded);
  const availableGuilds = guilds.filter((server) => !server.botAdded);

  const renderServerCard = (server) => (
    <article className={`server-card ${server.botAdded ? 'server-card-installed' : ''}`} key={server.id}>
      <div className="server-card-main">
        <ServerIcon server={server} size="large" />
        <div className="server-card-copy">
          <h3>{server.name}</h3>
          <p>{formatMembers(server.memberCount)}</p>
          {server.botAdded && <span className="server-installed-badge"><Check size={13} /> Klvro ya está aquí</span>}
        </div>
      </div>
      {server.botAdded ? (
        <button className="primary-button full" onClick={() => onSelect(server)} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <>Configurar <ChevronRight size={16} /></>}
        </button>
      ) : (
        <button className="secondary-button full" onClick={() => onSelect(server)}><DiscordIcon className="button-discord-icon" /> Añadir Klvro</button>
      )}
    </article>
  );

  return (
    <div className="servers-screen">
      <header className="servers-header">
        <button className="brand-inline brand-button" onClick={onHome}><LogoMark className="brand-mark mini" /><strong>Klvro</strong></button>
        <div className="servers-user"><UserAvatar user={me.user} /><span>{me.user?.globalName || me.user?.username}</span><button className="icon-button" onClick={onLogout}><LogOut size={17} /></button></div>
      </header>
      <main className="servers-content">
        {error && <Notice text={error} />}
        <div className="page-heading">
          <div><p className="eyebrow">DASHBOARD</p><h1>Tus servidores</h1><p>Elige uno para configurarlo o añade Klvro a otro.</p></div>
          <button className="secondary-button" onClick={onRefresh}><RefreshCcw size={16} /> Actualizar</button>
        </div>

        {!guilds.length ? (
          <div className="empty-state"><Users size={28} /><h3>No hay servidores para mostrar</h3><p>Necesitas ser dueño o tener Administrar servidor.</p></div>
        ) : (
          <div className="server-sections">
            <section className="server-list-section">
              <div className="server-list-heading">
                <div><h2>Listos para configurar</h2><p>Servidores donde Klvro ya está añadido.</p></div>
                <span className="server-count">{installedGuilds.length}</span>
              </div>
              {installedGuilds.length ? (
                <div className="server-grid">{installedGuilds.map(renderServerCard)}</div>
              ) : (
                <div className="server-inline-empty">Todavía no has añadido Klvro a ninguno de estos servidores.</div>
              )}
            </section>

            {availableGuilds.length > 0 && (
              <section className="server-list-section server-list-secondary">
                <div className="server-list-heading">
                  <div><h2>Otros servidores</h2><p>Puedes añadir Klvro desde aquí.</p></div>
                  <span className="server-count">{availableGuilds.length}</span>
                </div>
                <div className="server-grid">{availableGuilds.map(renderServerCard)}</div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ServerRail({ guilds, selectedServerId, onSelect, onAllServers, onHome }) {
  return (
    <aside className="server-rail">
      <button className="rail-logo" onClick={onHome}><LogoMark className="rail-logo-image" /></button>
      <div className="rail-divider" />
      {guilds.slice(0, 8).map((server) => (
        <button key={server.id} className={`rail-server ${selectedServerId === server.id ? 'active' : ''}`} onClick={() => onSelect(server.id)} title={server.name}>
          {server.icon ? <img src={server.icon} alt="" /> : initials(server.name)}
        </button>
      ))}
      <button className="rail-server add" onClick={onAllServers}><Plus size={19} /></button>
    </aside>
  );
}

function Overview({ server, settings, status, onNavigate }) {
  const modules = [
    { id: 'welcome', title: 'Bienvenidas', desc: 'Mensajes para nuevos miembros y mensajes privados.', icon: UserPlus },
    { id: 'tickets', title: 'Tickets', desc: 'Soporte privado con categoría y rol de staff.', icon: Ticket },
    { id: 'moderation', title: 'Moderación', desc: 'Antispam, bloqueo de enlaces y registros.', icon: ShieldCheck },
    { id: 'antiRaid', title: 'Anti-Raid', desc: 'Protección contra raids, nukes y acciones masivas.', icon: ShieldAlert },
    { id: 'administration', title: 'Administración', desc: 'Ban, kick, timeout, warn, purge, roles y más.', icon: UserCog },
    { id: 'autoroles', title: 'Autoroles', desc: 'Asigna un rol automáticamente al entrar.', icon: Users },
    { id: 'logs', title: 'Registros', desc: 'Centraliza eventos importantes del servidor.', icon: ClipboardList },
    { id: 'commands', title: 'Comandos', desc: 'Configura cómo se usan los comandos.', icon: Command },
  ];
  const activeCount = modules.filter((module) => settings[module.id]?.enabled).length;

  return (
    <>
      <section className="hero-card">
        <div className="hero-server"><ServerIcon server={server} size="hero" /><div><div className="status-line"><span className="status-dot" /> {status.botReady ? 'Bot conectado' : 'Bot iniciando'}</div><h2>{server.name}</h2><p>Configuración guardada.</p></div></div>
        <a className="secondary-button anchor-button" href="https://discord.com/app" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir Discord</a>
      </section>
      <section className="stat-grid">
        <div className="stat-card"><div><p>Miembros</p><strong>{server.memberCount?.toLocaleString?.() || '—'}</strong></div><Users size={20} /></div>
        <div className="stat-card"><div><p>Módulos activos</p><strong>{activeCount}</strong></div><SlidersHorizontal size={20} /></div>
        <div className="stat-card"><div><p>Estado</p><strong className="online-text">{status.botReady ? 'Online' : 'Offline'}</strong></div><Activity size={20} /></div>
        <div className="stat-card"><div><p>Latencia</p><strong>{status.latency == null ? '—' : `${status.latency} ms`}</strong></div><Activity size={20} /></div>
      </section>
      <div className="section-heading"><div><h2>Módulos</h2><p>Elige qué quieres usar.</p></div></div>
      <section className="module-grid">
        {modules.map((module) => {
          const Icon = module.icon;
          const enabled = settings[module.id]?.enabled;
          return <button className="module-card" key={module.id} onClick={() => onNavigate(module.id)}><div className="module-icon"><Icon size={19} /></div><div className="module-copy"><div className="module-title"><h3>{module.title}</h3><span className={`pill ${enabled ? 'enabled' : ''}`}>{enabled ? 'Activo' : 'Inactivo'}</span></div><p>{module.desc}</p></div><ChevronRight size={17} className="module-arrow" /></button>;
        })}
      </section>
    </>
  );
}

function SettingsPage({ section, settings, setSettings, resources, onSave, savedAt }) {
  const config = settings[section] || {};
  const set = (key, value) => setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  const meta = {
    general: ['Configuración general', 'Opciones básicas del bot.'],
    welcome: ['Bienvenidas', 'Qué hacer cuando entra un miembro.'],
    tickets: ['Sistema de tickets', 'Canales, staff y registros de tickets.'],
    moderation: ['Moderación', 'Antispam y bloqueo de enlaces.'],
    antiRaid: ['Anti-Raid', 'Protección contra raids y acciones masivas.'],
    administration: ['Administración', 'Ajustes de los comandos del staff.'],
    autoroles: ['Autoroles', 'Rol automático al entrar.'],
    logs: ['Registros', 'Elige qué quieres guardar en logs.'],
    commands: ['Comandos', 'Slash commands y prefijo.'],
  }[section];

  return (
    <div className="settings-layout">
      <div className="settings-main">
        <div className="page-heading settings-heading">
          <div><p className="eyebrow">CONFIGURACIÓN</p><h2>{meta[0]}</h2><p>{meta[1]}</p></div>
          {section !== 'general' && <Toggle checked={!!config.enabled} onChange={(value) => set('enabled', value)} label={config.enabled ? 'Activo' : 'Inactivo'} />}
        </div>
        {section === 'general' && <GeneralForm config={config} set={set} />}
        {section === 'welcome' && <WelcomeForm config={config} set={set} resources={resources} />}
        {section === 'tickets' && <TicketsForm config={config} set={set} resources={resources} />}
        {section === 'moderation' && <ModerationForm config={config} set={set} resources={resources} />}
        {section === 'antiRaid' && <AntiRaidForm config={config} set={set} resources={resources} />}
        {section === 'administration' && <AdministrationForm config={config} set={set} resources={resources} />}
        {section === 'autoroles' && <AutorolesForm config={config} set={set} resources={resources} />}
        {section === 'logs' && <LogsForm config={config} set={set} resources={resources} />}
        {section === 'commands' && <CommandsForm config={config} set={set} />}
        <div className="save-bar"><div>{savedAt ? <span className="saved-label">Cambios guardados</span> : <span>Los cambios se aplican al guardar.</span>}</div><button className="primary-button" onClick={onSave}><Save size={16} /> Guardar cambios</button></div>
      </div>
      <aside className="settings-help">
        <div className="help-card"><CircleHelp size={19} /><h3>Ayuda</h3><p>Los canales y roles salen de tu servidor de Discord.</p></div>
        <div className="help-card plain"><p className="small-label">ESTADO</p><div className="bot-status"><span className="status-dot" /><div><strong>Configuración conectada</strong><span>Guardada en PostgreSQL</span></div></div></div>
      </aside>
    </div>
  );
}

function GeneralForm({ config, set }) {
  return <div className="form-card"><FormSection title="Bot" description="Opciones principales de Klvro en este servidor."><ToggleRow title="Bot habilitado" description="Permite procesar las funciones configuradas." checked={config.enabled} onChange={(value) => set('enabled', value)} /><Field label="Prefijo secundario"><input value={config.prefix} maxLength={5} onChange={(event) => set('prefix', event.target.value)} /></Field><Field label="Idioma"><select value={config.language} onChange={(event) => set('language', event.target.value)}><option>Español</option><option>English</option></select></Field><Field label="Zona horaria"><select value={config.timezone} onChange={(event) => set('timezone', event.target.value)}><option>America/Santo_Domingo</option><option>America/New_York</option><option>UTC</option></select></Field></FormSection></div>;
}

function WelcomeForm({ config, set, resources }) {
  return <div className="form-card"><FormSection title="Mensaje de bienvenida" description="Envía un mensaje cuando una persona entra al servidor."><ChannelSelect label="Canal" value={config.channelId} onChange={(value) => set('channelId', value)} channels={textChannels(resources.channels)} /><Field label="Mensaje" hint="Variables: {user}, {server}, {memberCount}"><textarea rows="5" maxLength={1900} value={config.message} onChange={(event) => set('message', event.target.value)} /></Field><ToggleRow title="Enviar también por DM" description="Manda una copia del mensaje directamente al usuario." checked={config.dm} onChange={(value) => set('dm', value)} /></FormSection><PreviewCard title="Vista previa"><div className="discord-preview"><LogoMark className="preview-avatar" /><div><strong>Klvro <span>APP</span></strong><p>{String(config.message).replace('{user}', '@usuario').replace('{server}', 'Mi servidor').replace('{memberCount}', '1,249')}</p></div></div></PreviewCard></div>;
}

function TicketsForm({ config, set, resources }) {
  return <div className="form-card"><FormSection title="Configuración de tickets" description="Usa /ticketpanel en Discord después de guardar."><ChannelSelect label="Categoría" value={config.categoryId} onChange={(value) => set('categoryId', value)} channels={categoryChannels(resources.channels)} /><RoleSelect label="Rol del staff" value={config.staffRoleId} onChange={(value) => set('staffRoleId', value)} roles={resources.roles} /><ChannelSelect label="Canal de registros" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} /><ToggleRow title="Guardar transcript" description="Genera un archivo .txt con los mensajes del ticket al cerrarlo." checked={config.transcript} onChange={(value) => set('transcript', value)} /></FormSection></div>;
}

function ModerationForm({ config, set, resources }) {
  return <div className="form-card"><FormSection title="Protecciones" description="Controles automáticos sencillos."><ToggleRow title="Antispam" description="Detecta ráfagas de mensajes y aplica una pausa corta." checked={config.antiSpam} onChange={(value) => set('antiSpam', value)} /><ToggleRow title="Bloquear enlaces" description="Elimina enlaces enviados por usuarios sin permiso de moderación." checked={config.antiLinks} onChange={(value) => set('antiLinks', value)} /></FormSection><FormSection title="Registros" description="Canal usado por las acciones automáticas."><ChannelSelect label="Canal de moderación" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} /></FormSection></div>;
}

function AntiRaidForm({ config, set, resources }) {
  const trustedIdsText = Array.isArray(config.trustedUserIds) ? config.trustedUserIds.join(', ') : String(config.trustedUserIds || '');
  return <div className="form-card">
    <FormSection title="Nivel de protección" description="Klvro usa ventanas de tiempo y umbrales para evitar falsos positivos.">
      <Field label="Modo"><select value={config.mode || 'normal'} onChange={(event) => set('mode', event.target.value)}><option value="normal">Normal</option><option value="strict">Estricto</option><option value="custom">Personalizado</option></select></Field>
      <ToggleRow title="Protección de entradas" description="Detecta muchas cuentas entrando en pocos segundos." checked={config.joinProtection} onChange={(value) => set('joinProtection', value)} />
      <Field label="Máximo de entradas"><input type="number" min="2" max="100" value={config.joinThreshold} onChange={(event) => set('joinThreshold', Number(event.target.value))} /></Field>
      <Field label="Ventana de entradas (segundos)"><input type="number" min="2" max="120" value={config.joinWindowSeconds} onChange={(event) => set('joinWindowSeconds', Number(event.target.value))} /></Field>
      <Field label="Edad mínima de cuenta (horas)" hint="Durante un raid, Klvro puede actuar sobre cuentas más nuevas que este valor."><input type="number" min="0" max="8760" value={config.accountAgeHours} onChange={(event) => set('accountAgeHours', Number(event.target.value))} /></Field>
      <Field label="Acción sobre cuentas sospechosas"><select value={config.joinAction || 'kick'} onChange={(event) => set('joinAction', event.target.value)}><option value="none">Solo alertar</option><option value="kick">Expulsar</option><option value="ban">Banear</option></select></Field>
    </FormSection>
    <FormSection title="Protección administrativa" description="Vigila el registro de auditoría para detectar nukes y acciones masivas.">
      <ToggleRow title="Canales" description="Detecta creación y borrado masivo de canales." checked={config.protectChannels} onChange={(value) => set('protectChannels', value)} />
      <ToggleRow title="Roles" description="Detecta creación y borrado masivo de roles." checked={config.protectRoles} onChange={(value) => set('protectRoles', value)} />
      <ToggleRow title="Roles peligrosos" description="Detecta permisos administrativos añadidos o asignados." checked={config.protectDangerousRoles} onChange={(value) => set('protectDangerousRoles', value)} />
      <ToggleRow title="Bans masivos" description="Detecta ráfagas de baneos." checked={config.protectBans} onChange={(value) => set('protectBans', value)} />
      <ToggleRow title="Kicks masivos" description="Detecta expulsiones repetidas usando el audit log." checked={config.protectKicks} onChange={(value) => set('protectKicks', value)} />
      <ToggleRow title="Webhooks" description="Vigila creación, edición y borrado sospechoso de webhooks." checked={config.protectWebhooks} onChange={(value) => set('protectWebhooks', value)} />
      <Field label="Acciones para activar defensa"><input type="number" min="1" max="50" value={config.actionThreshold} onChange={(event) => set('actionThreshold', Number(event.target.value))} /></Field>
      <Field label="Ventana administrativa (segundos)"><input type="number" min="2" max="120" value={config.actionWindowSeconds} onChange={(event) => set('actionWindowSeconds', Number(event.target.value))} /></Field>
      <Field label="Respuesta al ejecutor"><select value={config.executorAction || 'strip'} onChange={(event) => set('executorAction', event.target.value)}><option value="alert">Solo alertar</option><option value="strip">Retirar roles peligrosos + timeout</option><option value="kick">Expulsar</option><option value="ban">Banear</option></select></Field>
    </FormSection>
    <FormSection title="Lockdown y confianza" description="El lockdown refuerza temporalmente las reglas cuando Klvro detecta un ataque.">
      <ToggleRow title="Lockdown automático" description="Activa protección reforzada cuando se supera un umbral." checked={config.autoLockdown} onChange={(value) => set('autoLockdown', value)} />
      <Field label="Duración del lockdown (minutos)"><input type="number" min="1" max="60" value={config.lockdownMinutes} onChange={(event) => set('lockdownMinutes', Number(event.target.value))} /></Field>
      <ChannelSelect label="Canal de alertas" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} />
      <RoleSelect label="Rol de confianza" value={config.trustedRoleId} onChange={(value) => set('trustedRoleId', value)} roles={resources.roles} />
      <Field label="Usuarios de confianza" hint="IDs separados por coma. El dueño del servidor y Klvro siempre están protegidos."><textarea rows="3" value={trustedIdsText} onChange={(event) => set('trustedUserIds', event.target.value.split(/[\s,;]+/).filter(Boolean))} placeholder="123456789012345678, 987654321098765432" /></Field>
    </FormSection>
  </div>;
}

function AdministrationForm({ config, set, resources }) {
  return <div className="form-card">
    <FormSection title="Comandos del staff" description="Configura el comportamiento de las herramientas de administración.">
      <ChannelSelect label="Canal de acciones" value={config.logChannelId} onChange={(value) => set('logChannelId', value)} channels={textChannels(resources.channels)} />
      <ToggleRow title="Exigir motivo" description="Ban, kick, timeout, warn y untimeout requieren una razón." checked={config.requireReason} onChange={(value) => set('requireReason', value)} />
      <Field label="Timeout predeterminado (minutos)"><input type="number" min="1" max="40320" value={config.defaultTimeoutMinutes} onChange={(event) => set('defaultTimeoutMinutes', Number(event.target.value))} /></Field>
      <Field label="Límite de advertencias"><input type="number" min="1" max="20" value={config.warnLimit} onChange={(event) => set('warnLimit', Number(event.target.value))} /></Field>
      <ToggleRow title="Timeout al llegar al límite" description="Aplica el timeout predeterminado al alcanzar el número de warns." checked={config.autoTimeoutOnWarnLimit} onChange={(value) => set('autoTimeoutOnWarnLimit', value)} />
    </FormSection>
    <FormSection title="Funciones incluidas" description="Se registran como slash commands globales cuando el bot inicia.">
      <div className="command-list-grid">
        <span>/ban</span><span>/kick</span><span>/timeout</span><span>/untimeout</span><span>/warn</span><span>/warnings</span><span>/clearwarnings</span><span>/purge</span><span>/slowmode</span><span>/lock</span><span>/unlock</span><span>/nick</span><span>/role</span><span>/say</span><span>/embed</span><span>/userinfo</span><span>/serverinfo</span><span>/antiraid</span>
      </div>
    </FormSection>
  </div>;
}

function AutorolesForm({ config, set, resources }) {
  return <div className="form-card"><FormSection title="Rol automático" description="Klvro lo entrega cuando entra un miembro."><RoleSelect label="Rol" value={config.roleId} onChange={(value) => set('roleId', value)} roles={resources.roles} /><ToggleRow title="Aplicar también a bots" description="Entrega el mismo rol a nuevos bots." checked={config.bots} onChange={(value) => set('bots', value)} /></FormSection></div>;
}

function LogsForm({ config, set, resources }) {
  return <div className="form-card"><FormSection title="Canal de registros" description="Todos los eventos seleccionados se enviarán aquí."><ChannelSelect label="Canal" value={config.channelId} onChange={(value) => set('channelId', value)} channels={textChannels(resources.channels)} /></FormSection><FormSection title="Eventos" description="Selecciona lo que quieres registrar."><ToggleRow title="Mensajes" description="Registra eliminaciones de mensajes." checked={config.messages} onChange={(value) => set('messages', value)} /><ToggleRow title="Miembros" description="Registra entradas y salidas." checked={config.members} onChange={(value) => set('members', value)} /><ToggleRow title="Voz" description="Registra entradas, salidas y movimientos entre canales de voz." checked={config.voice} onChange={(value) => set('voice', value)} /></FormSection></div>;
}

function CommandsForm({ config, set }) {
  return <div className="form-card"><FormSection title="Métodos de comandos" description="Incluye comandos generales, tickets, Anti-Raid y herramientas completas de administración."><ToggleRow title="Slash commands" description="Comandos modernos de Discord." checked={config.slash} onChange={(value) => set('slash', value)} /><ToggleRow title="Comandos con prefijo" description="Habilita ping y panel usando el prefijo configurado." checked={config.legacyPrefix} onChange={(value) => set('legacyPrefix', value)} /></FormSection></div>;
}

function ChannelSelect({ label, value, onChange, channels }) {
  return <Field label={label}><select value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar…</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></Field>;
}
function RoleSelect({ label, value, onChange, roles }) {
  return <Field label={label}><select value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar…</option>{roles.map((role) => <option value={role.id} key={role.id}>@{role.name}</option>)}</select></Field>;
}
function FormSection({ title, description, children }) { return <section className="form-section"><div className="form-section-heading"><h3>{title}</h3><p>{description}</p></div><div className="form-fields">{children}</div></section>; }
function Field({ label, hint, children }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function ToggleRow({ title, description, checked, onChange }) { return <div className="toggle-row"><div><strong>{title}</strong><p>{description}</p></div><Toggle checked={checked} onChange={onChange} /></div>; }
function Toggle({ checked, onChange, label }) { return <button type="button" className={`toggle-wrap ${label ? 'with-label' : ''}`} onClick={() => onChange(!checked)}><span className={`toggle ${checked ? 'on' : ''}`}><span /></span>{label && <strong>{label}</strong>}</button>; }
function PreviewCard({ title, children }) { return <section className="preview-card"><p className="small-label">{title}</p>{children}</section>; }

function Notice({ text, onClose }) {
  return <div className="notice-bar"><span>{text}</span>{onClose && <button onClick={onClose}><X size={15} /></button>}</div>;
}
function FullLoader() { return <div className="full-loader"><LogoMark className="loader-logo" /><LoaderCircle className="spin" size={24} /></div>; }
function UserAvatar({ user }) { return user?.avatar ? <img className="user-avatar image" src={user.avatar} alt="" /> : <div className="user-avatar">{initials(user?.globalName || user?.username || 'U')}</div>; }
function ServerIcon({ server, size }) { return server?.icon ? <img className={`server-avatar ${size} image`} src={server.icon} alt="" /> : <div className={`server-avatar ${size}`}>{initials(server?.name || 'S')}</div>; }
function LogoMark({ className = '' }) { return <img src="/klvro-logo.jpg" alt="Klvro" className={className} />; }
function initials(name) { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function formatMembers(count) { return count == null ? 'Miembros no disponibles' : `${Number(count).toLocaleString('es-DO')} miembros`; }
function premiumName(plan) { return plan === 'pro' ? 'Premium Pro' : 'Premium Lite'; }
function formatPrice(amount) { return `US$${(Number(amount) / 100).toFixed(2)}`; }
function textChannels(channels) { return channels.filter((channel) => [0, 5].includes(channel.type)); }
function categoryChannels(channels) { return channels.filter((channel) => channel.type === 4); }
function DiscordIcon({ className = '' }) { return <svg viewBox="0 0 127.14 96.36" aria-hidden="true" className={className}><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83 72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 33.35-1.71 57.98.54 82.26a105.73 105.73 0 0 0 32.17 16.1 77.7 77.7 0 0 0 6.89-11.13 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.04a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.12 105.25 105.25 0 0 0 32.19-16.1c2.64-28.13-4.5-52.53-18.9-74.19ZM42.45 65.69C36.18 65.69 31 59.96 31 52.91s5-12.78 11.43-12.78c6.48 0 11.62 5.78 11.43 12.78 0 7.05-5 12.78-11.43 12.78Zm42.24 0c-6.27 0-11.43-5.73-11.43-12.78s5-12.78 11.43-12.78c6.48 0 11.62 5.78 11.43 12.78 0 7.05-5 12.78-11.43 12.78Z" /></svg>; }

createRoot(document.getElementById('root')).render(<App />);
