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

function App() {
  const [screen, setScreen] = useState(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');
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

    const onPop = () => setScreen(window.location.pathname.startsWith('/app') ? 'servers' : 'landing');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (screen === 'servers' && me.authenticated) loadGuilds();
  }, [screen, me.authenticated]);

  async function loadMe() {
    try {
      const data = await api('/api/me');
      setMe({ loading: false, ...data });
      if (window.location.pathname.startsWith('/app') && !data.authenticated) {
        window.location.href = '/auth/discord';
      }
    } catch (err) {
      setMe({ loading: false, authenticated: false, user: null, premium: null });
      setError(err.message);
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

  function goApp() {
    if (!me.authenticated) {
      window.location.href = '/auth/discord';
      return;
    }
    history.pushState({}, '', '/app');
    setScreen('servers');
  }

  function goHome() {
    history.pushState({}, '', '/');
    setSelectedServer(null);
    setScreen('landing');
  }

  async function openServer(server) {
    if (!server.botAdded) {
      window.location.href = `/api/discord/invite?guildId=${encodeURIComponent(server.id)}`;
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
          me={me}
          onManage={goApp}
          onAdd={() => { window.location.href = '/api/discord/invite'; }}
          onLogin={() => { window.location.href = '/auth/discord'; }}
          onPlan={(plan) => {
            if (!me.authenticated) window.location.href = '/auth/discord';
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

function Landing({ me, onManage, onAdd, onLogin, onPlan, error, clearError }) {
  const [paidPlans, setPaidPlans] = useState([
    { id: 'lite', name: 'Premium Lite', amount: 299, days: 30 },
    { id: 'pro', name: 'Premium Pro', amount: 599, days: 30 },
  ]);

  useEffect(() => {
    api('/api/billing/plans').then((data) => setPaidPlans(data.plans || [])).catch(() => null);
  }, []);

  const paidById = Object.fromEntries(paidPlans.map((plan) => [plan.id, plan]));
  const plans = [
    { id: 'free', name: 'Gratis', price: 'US$0', note: 'Para comenzar', features: ['Funciones básicas', 'Dashboard', 'Comandos esenciales', 'Soporte estándar'], cta: 'Empezar gratis' },
    { id: 'lite', name: paidById.lite?.name || 'Premium Lite', price: formatPrice(paidById.lite?.amount ?? 299), note: `${paidById.lite?.days ?? 30} días`, features: ['Bienvenidas avanzadas', 'Más tickets', 'Más registros', 'Soporte prioritario'], cta: 'Obtener Lite', featured: true },
    { id: 'pro', name: paidById.pro?.name || 'Premium Pro', price: formatPrice(paidById.pro?.amount ?? 599), note: `${paidById.pro?.days ?? 30} días`, features: ['Todo en Lite', 'Funciones avanzadas', 'Más capacidad', 'Mejor soporte'], cta: 'Obtener Pro' },
  ];

  return (
    <div className="landing-screen">
      <header className="landing-nav">
        <button className="landing-brand brand-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <LogoMark className="landing-brand-avatar" />
          <strong>Klvro</strong>
        </button>
        <nav className="landing-links">
          <button onClick={onManage}>Panel</button>
          <button onClick={onAdd}>Invitar</button>
          <button>Servidor</button>
          <button>Estado</button>
          <button>Comandos</button>
          <button>Funciones <ChevronDown size={14} /></button>
        </nav>
        <div className="landing-actions">
          <button className="premium-chip" onClick={() => document.querySelector('.pricing-section')?.scrollIntoView({ behavior: 'smooth' })}><Sparkles size={14} /> Premium</button>
          <button className="lang-chip"><Globe size={14} /> ES <ChevronDown size={14} /></button>
          {me.authenticated ? (
            <button className="login-link" onClick={onManage}>{me.user?.globalName || me.user?.username}</button>
          ) : (
            <button className="login-link" onClick={onLogin}>Iniciar sesión</button>
          )}
        </div>
      </header>

      {error && <div className="landing-notice"><Notice text={error} onClose={clearError} /></div>}

      <section className="landing-hero dotted-bg">
        <LogoMark className="hero-bot-avatar" />
        <h1>Klvro</h1>
        <p>Un bot multifunción para Discord con una dashboard limpia, rápida y fácil de usar.</p>
        <div className="hero-buttons">
          <button className="secondary-hero-button" onClick={onAdd}><DiscordIcon className="brand-discord-icon" /> Añadir a Discord</button>
          <button className="primary-hero-button" onClick={onManage}><Settings size={18} /> Administrar servidores</button>
        </div>
      </section>

      <section className="social-proof">
        <h2>Diseñado para todo tipo de comunidades</h2>
        <div className="showcase-grid">
          {showcaseServers.map((server) => (
            <article className="showcase-card" key={server.id}>
              <div className={`showcase-avatar ${server.accent}`}>{server.name.slice(0, 1)}</div>
              <div className="showcase-copy">
                <div className="showcase-title-row"><strong>{server.name}</strong></div>
                <span>{server.members}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-section">
        <div className="pricing-head">
          <p className="eyebrow pricing-eyebrow">PREMIUM</p>
          <h2>Planes simples y baratos</h2>
          <p>Sin contratos largos. Premium se activa por 30 días y puedes renovarlo cuando quieras.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.id}>
              <div className="pricing-top">
                <div><h3>{plan.name}</h3><p>{plan.note}</p></div>
                {plan.featured && <span className="plan-badge">Popular</span>}
              </div>
              <div className="pricing-price">{plan.price}</div>
              <ul className="pricing-features">{plan.features.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
              <button className={plan.featured ? 'primary-button full' : 'secondary-button full'} onClick={() => plan.id === 'free' ? onManage() : onPlan(plan)}>{plan.cta}</button>
            </article>
          ))}
        </div>
        <div className="payments-bar">
          <div className="payments-copy"><CreditCard size={18} /><span>Paga con <strong>PayPal</strong> o <strong>tarjeta de crédito/débito</strong>.</span></div>
          <div className="payment-pills"><span>PayPal</span><span>Visa</span><span>Mastercard</span></div>
        </div>
      </section>
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
        <p>{plan.price} por 30 días. Elige cómo quieres pagar.</p>
        {error && <Notice text={error} />}
        <button className="payment-option paypal" onClick={() => pay('paypal')} disabled={!!loading}>
          {loading === 'paypal' ? <LoaderCircle className="spin" size={19} /> : <span className="paypal-word">PayPal</span>}
          <span>Continuar con PayPal</span>
        </button>
        <button className="payment-option card" onClick={() => pay('stripe')} disabled={!!loading}>
          {loading === 'stripe' ? <LoaderCircle className="spin" size={19} /> : <CreditCard size={19} />}
          <span>Pagar con tarjeta</span>
        </button>
        <small>Los datos de pago se procesan en PayPal o Stripe; Klvro no almacena números de tarjeta.</small>
      </div>
    </div>
  );
}

function ServerSelect({ guilds, me, loading, error, onSelect, onRefresh, onLogout, onHome }) {
  return (
    <div className="servers-screen">
      <header className="servers-header">
        <button className="brand-inline brand-button" onClick={onHome}><LogoMark className="brand-mark mini" /><strong>Klvro</strong></button>
        <div className="servers-user"><UserAvatar user={me.user} /><span>{me.user?.globalName || me.user?.username}</span><button className="icon-button" onClick={onLogout}><LogOut size={17} /></button></div>
      </header>
      <main className="servers-content">
        {error && <Notice text={error} />}
        <div className="page-heading">
          <div><p className="eyebrow">DASHBOARD</p><h1>Selecciona un servidor</h1><p>Mostramos los servidores donde tienes permiso para administrar.</p></div>
          <button className="secondary-button" onClick={onRefresh}><RefreshCcw size={16} /> Actualizar</button>
        </div>
        {!guilds.length ? (
          <div className="empty-state"><Users size={28} /><h3>No encontramos servidores administrables</h3><p>Verifica que tengas el permiso Administrar servidor o que seas propietario.</p></div>
        ) : (
          <div className="server-grid">
            {guilds.map((server) => (
              <article className="server-card" key={server.id}>
                <div className="server-card-main"><ServerIcon server={server} size="large" /><div><h3>{server.name}</h3><p>{formatMembers(server.memberCount)}</p></div></div>
                {server.botAdded ? (
                  <button className="primary-button full" onClick={() => onSelect(server)} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <>Administrar <ChevronRight size={16} /></>}</button>
                ) : (
                  <button className="secondary-button full" onClick={() => onSelect(server)}><DiscordIcon className="button-discord-icon" /> Añadir Klvro</button>
                )}
              </article>
            ))}
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
        <div className="hero-server"><ServerIcon server={server} size="hero" /><div><div className="status-line"><span className="status-dot" /> {status.botReady ? 'Bot conectado' : 'Bot iniciando'}</div><h2>{server.name}</h2><p>Los cambios se guardan en la base de datos de Klvro.</p></div></div>
        <a className="secondary-button anchor-button" href="https://discord.com/app" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir Discord</a>
      </section>
      <section className="stat-grid">
        <div className="stat-card"><div><p>Miembros</p><strong>{server.memberCount?.toLocaleString?.() || '—'}</strong></div><Users size={20} /></div>
        <div className="stat-card"><div><p>Módulos activos</p><strong>{activeCount}</strong></div><SlidersHorizontal size={20} /></div>
        <div className="stat-card"><div><p>Estado</p><strong className="online-text">{status.botReady ? 'Online' : 'Offline'}</strong></div><Activity size={20} /></div>
        <div className="stat-card"><div><p>Latencia</p><strong>{status.latency == null ? '—' : `${status.latency} ms`}</strong></div><Activity size={20} /></div>
      </section>
      <div className="section-heading"><div><h2>Módulos</h2><p>Configura las funciones principales del bot.</p></div></div>
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
    general: ['Configuración general', 'Ajustes básicos de funcionamiento del bot.'],
    welcome: ['Bienvenidas', 'Configura lo que ocurre cuando entra un nuevo miembro.'],
    tickets: ['Sistema de tickets', 'Ajusta el soporte privado y el registro de tickets.'],
    moderation: ['Moderación', 'Protecciones básicas para el servidor.'],
    antiRaid: ['Anti-Raid', 'Detecta raids de entradas y acciones administrativas destructivas.'],
    administration: ['Administración', 'Configura las herramientas de moderación del staff.'],
    autoroles: ['Autoroles', 'Entrega roles automáticamente al entrar.'],
    logs: ['Registros', 'Elige qué eventos debe registrar Klvro.'],
    commands: ['Comandos', 'Controla cómo interactúan los miembros con el bot.'],
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
        <div className="help-card"><CircleHelp size={19} /><h3>¿Necesitas ayuda?</h3><p>Los canales y roles mostrados aquí se obtienen directamente del servidor de Discord.</p></div>
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
