import fs from 'node:fs';

const root = new URL('./', import.meta.url);
const file = (relative) => new URL(`../${relative}`, root);
const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);

const mainPath = file('src/main.jsx');
const cssPath = file('src/styles.css');
const serverPath = file('server/index.mjs');

let main = read(mainPath);
let css = read(cssPath);
let server = read(serverPath);

const marker = '/* Klvro domain docs language patch */';

if (!main.includes('const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL')) {
  main = main.replace(
    "import './styles.css';",
    `import './styles.css';

const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL || '';

const SITE_LANGUAGES = [
  { code: 'ES', id: 'es', label: 'Español', flag: '/flags/es.svg' },
  { code: 'EN', id: 'en', label: 'English', flag: '/flags/en.svg' },
  { code: 'PT', id: 'pt', label: 'Português', flag: '/flags/pt.svg' },
  { code: 'FR', id: 'fr', label: 'Français', flag: '/flags/fr.svg' },
  { code: 'DE', id: 'de', label: 'Deutsch', flag: '/flags/de.svg' },
  { code: 'IT', id: 'it', label: 'Italiano', flag: '/flags/it.svg' },
];

const SITE_TRANSLATIONS = {
  en: {
    'Panel': 'Dashboard', 'Servidor': 'Server', 'Estado': 'Status', 'Comandos': 'Commands', 'Funciones': 'Features',
    'Iniciar sesión': 'Sign in', 'Volver al dashboard': 'Back to dashboard', 'Abrir panel': 'Open dashboard',
    'Añadir a Discord': 'Add to Discord', 'Bot de Discord para moderación, tickets, registros y Anti-Raid.': 'Discord bot for moderation, tickets, logs and Anti-Raid.',
    'Configura el bot desde la web y úsalo en Discord. Moderación, tickets, logs y Anti-Raid.': 'Configure the bot from the web and use it on Discord. Moderation, tickets, logs and Anti-Raid.',
    'Pasos para añadir Klvro y dejarlo listo.': 'Steps to add Klvro and get it ready.', 'Cómo añadir y configurar Klvro.': 'How to add and configure Klvro.',
    'Revisa si el bot está conectado.': 'Check whether the bot is connected.', 'Comprueba si el bot está conectado.': 'Check whether the bot is connected.',
    'Lista rápida de los comandos principales.': 'Quick list of the main commands.', 'Lista de comandos disponibles.': 'List of available commands.',
    'Módulos que puedes activar o dejar apagados.': 'Modules you can enable or leave disabled.', 'Todo lo que puedes activar desde el panel.': 'Everything you can enable from the dashboard.',
    'Añade Klvro y entra directo al panel': 'Add Klvro and go straight to the dashboard', 'Añade Klvro y configura tu servidor': 'Add Klvro and configure your server',
    'Haz login, añade el bot y abre la configuración del servidor.': 'Sign in, add the bot and open the server settings.', 'Entra con Discord, elige un servidor y Klvro te lleva al panel.': 'Sign in with Discord, choose a server and Klvro takes you to the dashboard.',
    'Ir al panel': 'Go to dashboard', 'Invitar bot': 'Invite bot', 'Inicia sesión': 'Sign in', 'Usa tu cuenta de Discord.': 'Use your Discord account.',
    'Elige el servidor': 'Choose the server', 'Solo aparecen los que puedes administrar.': 'Only servers you can manage are shown.',
    'Configura': 'Configure', 'Activa módulos, elige canales y guarda.': 'Enable modules, choose channels and save.',
    'Estado de Klvro': 'Klvro status', 'Estado actual del bot y datos básicos del servicio.': 'Current bot status and basic service information.', 'Aquí puedes ver si el bot está conectado.': 'See whether the bot is connected.',
    'Servidores': 'Servers', 'Latencia': 'Latency', 'Comprobando…': 'Checking…', 'Datos actualizados desde Klvro.': 'Data updated from Klvro.',
    'Los comandos más usados dentro del servidor.': 'The most used commands in the server.', 'Los principales comandos que trae Klvro.': 'Klvro main commands.',
    'Moderación': 'Moderation', 'Canales y roles': 'Channels and roles', 'Utilidades': 'Utilities',
    'Enciende solo los módulos que necesites.': 'Enable only the modules you need.', 'Activa solo lo que vayas a usar.': 'Enable only what you will use.',
    'Administración': 'Administration', 'Registros': 'Logs', 'Bienvenidas': 'Welcome messages',
    'Detecta entradas masivas y acciones sensibles repetidas.': 'Detects mass joins and repeated sensitive actions.',
    'Ban, kick, timeout, warns, roles, canales y más.': 'Ban, kick, timeout, warnings, roles, channels and more.',
    'Crea tickets privados con staff y registros.': 'Creates private tickets with staff and logs.',
    'Entradas, salidas, mensajes y eventos del servidor.': 'Joins, leaves, messages and server events.',
    'Mensaje en canal y, si quieres, también por DM.': 'Channel message and optionally a DM too.',
    'Pagas 30 días y luego decides si quieres renovarlo.': 'Pay for 30 days and decide later whether to renew.', '30 días por compra. No se renueva solo.': '30 days per purchase. No automatic renewal.',
    'Gratis': 'Free', 'Sin pago': 'No payment', 'Usar gratis': 'Use free', 'Comprar Lite': 'Buy Lite', 'Comprar Pro': 'Buy Pro',
    'Panel web': 'Web dashboard', 'Comandos básicos': 'Basic commands', 'Más opciones de configuración': 'More configuration options', 'Más registros': 'More logs', 'Más capacidad': 'More capacity', 'Soporte prioritario': 'Priority support',
    'Todo lo de Lite': 'Everything in Lite', 'Límites más altos': 'Higher limits', 'Funciones avanzadas': 'Advanced features',
  },
  pt: {
    'Panel': 'Painel', 'Servidor': 'Servidor', 'Estado': 'Status', 'Comandos': 'Comandos', 'Funciones': 'Recursos',
    'Iniciar sesión': 'Entrar', 'Volver al dashboard': 'Voltar ao painel', 'Abrir panel': 'Abrir painel', 'Añadir a Discord': 'Adicionar ao Discord',
    'Bot de Discord para moderación, tickets, registros y Anti-Raid.': 'Bot do Discord para moderação, tickets, registros e Anti-Raid.',
    'Configura el bot desde la web y úsalo en Discord. Moderación, tickets, logs y Anti-Raid.': 'Configure o bot pela web e use no Discord. Moderação, tickets, registros e Anti-Raid.',
    'Añade Klvro y entra directo al panel': 'Adicione o Klvro e entre direto no painel', 'Añade Klvro y configura tu servidor': 'Adicione o Klvro e configure seu servidor',
    'Haz login, añade el bot y abre la configuración del servidor.': 'Entre, adicione o bot e abra as configurações do servidor.', 'Entra con Discord, elige un servidor y Klvro te lleva al panel.': 'Entre com o Discord, escolha um servidor e o Klvro leva você ao painel.',
    'Ir al panel': 'Ir ao painel', 'Invitar bot': 'Convidar bot', 'Inicia sesión': 'Entre', 'Usa tu cuenta de Discord.': 'Use sua conta do Discord.',
    'Elige el servidor': 'Escolha o servidor', 'Solo aparecen los que puedes administrar.': 'Só aparecem os servidores que você pode administrar.', 'Configura': 'Configure', 'Activa módulos, elige canales y guarda.': 'Ative módulos, escolha canais e salve.',
    'Estado de Klvro': 'Status do Klvro', 'Aquí puedes ver si el bot está conectado.': 'Veja se o bot está conectado.', 'Servidores': 'Servidores', 'Latencia': 'Latência', 'Comprobando…': 'Verificando…',
    'Moderación': 'Moderação', 'Canales y roles': 'Canais e cargos', 'Utilidades': 'Utilidades', 'Administración': 'Administração', 'Registros': 'Registros', 'Bienvenidas': 'Boas-vindas',
    'Enciende solo los módulos que necesites.': 'Ative apenas os módulos que você precisa.', 'Activa solo lo que vayas a usar.': 'Ative apenas o que vai usar.',
    'Pagas 30 días y luego decides si quieres renovarlo.': 'Pague por 30 dias e depois decida se quer renovar.', 'Gratis': 'Grátis', 'Sin pago': 'Sem pagamento', 'Usar gratis': 'Usar grátis', 'Comprar Lite': 'Comprar Lite', 'Comprar Pro': 'Comprar Pro',
  },
  fr: {
    'Panel': 'Tableau de bord', 'Servidor': 'Serveur', 'Estado': 'État', 'Comandos': 'Commandes', 'Funciones': 'Fonctions',
    'Iniciar sesión': 'Se connecter', 'Volver al dashboard': 'Retour au tableau de bord', 'Abrir panel': 'Ouvrir le tableau de bord', 'Añadir a Discord': 'Ajouter à Discord',
    'Bot de Discord para moderación, tickets, registros y Anti-Raid.': 'Bot Discord pour la modération, les tickets, les journaux et l’Anti-Raid.',
    'Añade Klvro y entra directo al panel': 'Ajoutez Klvro et ouvrez directement le tableau de bord', 'Añade Klvro y configura tu servidor': 'Ajoutez Klvro et configurez votre serveur',
    'Haz login, añade el bot y abre la configuración del servidor.': 'Connectez-vous, ajoutez le bot et ouvrez les paramètres du serveur.', 'Entra con Discord, elige un servidor y Klvro te lleva al panel.': 'Connectez-vous avec Discord, choisissez un serveur et Klvro vous emmène au tableau de bord.',
    'Ir al panel': 'Aller au tableau de bord', 'Invitar bot': 'Inviter le bot', 'Inicia sesión': 'Connectez-vous', 'Usa tu cuenta de Discord.': 'Utilisez votre compte Discord.',
    'Elige el servidor': 'Choisissez le serveur', 'Solo aparecen los que puedes administrar.': 'Seuls les serveurs que vous pouvez gérer apparaissent.', 'Configura': 'Configurez', 'Activa módulos, elige canales y guarda.': 'Activez les modules, choisissez les canaux et enregistrez.',
    'Estado de Klvro': 'État de Klvro', 'Aquí puedes ver si el bot está conectado.': 'Vérifiez si le bot est connecté.', 'Servidores': 'Serveurs', 'Latencia': 'Latence', 'Comprobando…': 'Vérification…',
    'Moderación': 'Modération', 'Canales y roles': 'Canaux et rôles', 'Utilidades': 'Utilitaires', 'Administración': 'Administration', 'Registros': 'Journaux', 'Bienvenidas': 'Bienvenue',
    'Enciende solo los módulos que necesites.': 'Activez uniquement les modules nécessaires.', 'Activa solo lo que vayas a usar.': 'Activez uniquement ce que vous utiliserez.',
    'Pagas 30 días y luego decides si quieres renovarlo.': 'Payez 30 jours puis décidez si vous souhaitez renouveler.', 'Gratis': 'Gratuit', 'Sin pago': 'Sans paiement', 'Usar gratis': 'Utiliser gratuitement', 'Comprar Lite': 'Acheter Lite', 'Comprar Pro': 'Acheter Pro',
  },
  de: {
    'Panel': 'Dashboard', 'Servidor': 'Server', 'Estado': 'Status', 'Comandos': 'Befehle', 'Funciones': 'Funktionen',
    'Iniciar sesión': 'Anmelden', 'Volver al dashboard': 'Zurück zum Dashboard', 'Abrir panel': 'Dashboard öffnen', 'Añadir a Discord': 'Zu Discord hinzufügen',
    'Bot de Discord para moderación, tickets, registros y Anti-Raid.': 'Discord-Bot für Moderation, Tickets, Protokolle und Anti-Raid.',
    'Añade Klvro y entra directo al panel': 'Klvro hinzufügen und direkt zum Dashboard', 'Añade Klvro y configura tu servidor': 'Klvro hinzufügen und deinen Server konfigurieren',
    'Haz login, añade el bot y abre la configuración del servidor.': 'Melde dich an, füge den Bot hinzu und öffne die Servereinstellungen.', 'Entra con Discord, elige un servidor y Klvro te lleva al panel.': 'Melde dich mit Discord an, wähle einen Server und öffne das Dashboard.',
    'Ir al panel': 'Zum Dashboard', 'Invitar bot': 'Bot einladen', 'Inicia sesión': 'Anmelden', 'Usa tu cuenta de Discord.': 'Verwende dein Discord-Konto.',
    'Elige el servidor': 'Server auswählen', 'Solo aparecen los que puedes administrar.': 'Es werden nur Server angezeigt, die du verwalten kannst.', 'Configura': 'Konfigurieren', 'Activa módulos, elige canales y guarda.': 'Module aktivieren, Kanäle wählen und speichern.',
    'Estado de Klvro': 'Klvro-Status', 'Aquí puedes ver si el bot está conectado.': 'Prüfe, ob der Bot verbunden ist.', 'Servidores': 'Server', 'Latencia': 'Latenz', 'Comprobando…': 'Prüfen…',
    'Moderación': 'Moderation', 'Canales y roles': 'Kanäle und Rollen', 'Utilidades': 'Werkzeuge', 'Administración': 'Administration', 'Registros': 'Protokolle', 'Bienvenidas': 'Willkommen',
    'Enciende solo los módulos que necesites.': 'Aktiviere nur die Module, die du brauchst.', 'Activa solo lo que vayas a usar.': 'Aktiviere nur, was du verwendest.',
    'Pagas 30 días y luego decides si quieres renovarlo.': 'Bezahle 30 Tage und entscheide danach über eine Verlängerung.', 'Gratis': 'Kostenlos', 'Sin pago': 'Keine Zahlung', 'Usar gratis': 'Kostenlos nutzen', 'Comprar Lite': 'Lite kaufen', 'Comprar Pro': 'Pro kaufen',
  },
  it: {
    'Panel': 'Pannello', 'Servidor': 'Server', 'Estado': 'Stato', 'Comandos': 'Comandi', 'Funciones': 'Funzioni',
    'Iniciar sesión': 'Accedi', 'Volver al dashboard': 'Torna al pannello', 'Abrir panel': 'Apri pannello', 'Añadir a Discord': 'Aggiungi a Discord',
    'Bot de Discord para moderación, tickets, registros y Anti-Raid.': 'Bot Discord per moderazione, ticket, registri e Anti-Raid.',
    'Añade Klvro y entra directo al panel': 'Aggiungi Klvro e vai direttamente al pannello', 'Añade Klvro y configura tu servidor': 'Aggiungi Klvro e configura il tuo server',
    'Haz login, añade el bot y abre la configuración del servidor.': 'Accedi, aggiungi il bot e apri le impostazioni del server.', 'Entra con Discord, elige un servidor y Klvro te lleva al panel.': 'Accedi con Discord, scegli un server e Klvro ti porta al pannello.',
    'Ir al panel': 'Vai al pannello', 'Invitar bot': 'Invita bot', 'Inicia sesión': 'Accedi', 'Usa tu cuenta de Discord.': 'Usa il tuo account Discord.',
    'Elige el servidor': 'Scegli il server', 'Solo aparecen los que puedes administrar.': 'Appaiono solo i server che puoi amministrare.', 'Configura': 'Configura', 'Activa módulos, elige canales y guarda.': 'Attiva i moduli, scegli i canali e salva.',
    'Estado de Klvro': 'Stato di Klvro', 'Aquí puedes ver si el bot está conectado.': 'Controlla se il bot è connesso.', 'Servidores': 'Server', 'Latencia': 'Latenza', 'Comprobando…': 'Controllo…',
    'Moderación': 'Moderazione', 'Canales y roles': 'Canali e ruoli', 'Utilidades': 'Utilità', 'Administración': 'Amministrazione', 'Registros': 'Registri', 'Bienvenidas': 'Benvenuti',
    'Enciende solo los módulos que necesites.': 'Attiva solo i moduli necessari.', 'Activa solo lo que vayas a usar.': 'Attiva solo ciò che userai.',
    'Pagas 30 días y luego decides si quieres renovarlo.': 'Paghi 30 giorni e poi decidi se rinnovare.', 'Gratis': 'Gratis', 'Sin pago': 'Nessun pagamento', 'Usar gratis': 'Usa gratis', 'Comprar Lite': 'Acquista Lite', 'Comprar Pro': 'Acquista Pro',
  },
};

const SITE_TRANSLATION_LOOKUP = (() => {
  const lookup = new Map();
  const sourceKeys = new Set(Object.values(SITE_TRANSLATIONS).flatMap((table) => Object.keys(table)));
  for (const source of sourceKeys) {
    lookup.set(source, source);
    for (const table of Object.values(SITE_TRANSLATIONS)) {
      if (table[source]) lookup.set(table[source], source);
    }
  }
  return lookup;
})();

function translatePublicSite(root, language) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE'].includes(parent.tagName)) continue;
    const raw = node.nodeValue || '';
    const value = raw.trim();
    if (!value) continue;
    const source = SITE_TRANSLATION_LOOKUP.get(value);
    if (!source) continue;
    const target = language === 'es' ? source : (SITE_TRANSLATIONS[language]?.[source] || source);
    if (target === value) continue;
    node.nodeValue = raw.replace(value, target);
  }
}`
  );
}

if (!main.includes("const [language, setLanguage]")) {
  main = main.replace(
    "  const [liveStatus, setLiveStatus] = useState({ loading: true, botReady: false, guildCount: 0, latency: null });",
    `  const [liveStatus, setLiveStatus] = useState({ loading: true, botReady: false, guildCount: 0, latency: null });
  const [language, setLanguage] = useState(() => localStorage.getItem('klvro.language') || 'es');
  const [languageMenu, setLanguageMenu] = useState(false);`
  );

  const landingEffectAnchor = `  const paidById = Object.fromEntries(paidPlans.map((plan) => [plan.id, plan]));`;
  const languageEffect = `  useEffect(() => {
    localStorage.setItem('klvro.language', language);
    document.documentElement.lang = language;
    const frame = requestAnimationFrame(() => translatePublicSite(document.querySelector('.public-site'), language));
    return () => cancelAnimationFrame(frame);
  }, [language, page, me.authenticated, liveStatus.loading, liveStatus.botReady, paidPlans]);

`;
  main = main.replace(landingEffectAnchor, languageEffect + landingEffectAnchor);
}

main = main.replace(
  '<span className="lang-chip"><Globe size={14} /> ES</span>',
  `<div className="language-menu">
            <button className="lang-chip language-trigger" type="button" onClick={() => setLanguageMenu((value) => !value)} aria-expanded={languageMenu}>
              <img className="language-flag" src={SITE_LANGUAGES.find((item) => item.id === language)?.flag || '/flags/es.svg'} alt="" />
              <span>{SITE_LANGUAGES.find((item) => item.id === language)?.code || 'ES'}</span>
              <ChevronDown size={13} className={languageMenu ? 'language-chevron-open' : ''} />
            </button>
            {languageMenu && (
              <div className="language-dropdown">
                {SITE_LANGUAGES.map((item) => (
                  <button key={item.id} type="button" className={language === item.id ? 'active' : ''} onClick={() => { setLanguage(item.id); setLanguageMenu(false); }}>
                    <img className="language-flag" src={item.flag} alt="" />
                    <span>{item.label}</span>
                    <small>{item.code}</small>
                  </button>
                ))}
              </div>
            )}
          </div>`
);

main = main.replace(
  `<div className="sidebar-footer">
          <button><CircleHelp size={17} /> Documentación</button>
          <button><LifeBuoy size={17} /> Soporte</button>
        </div>`,
  `<div className="sidebar-footer">
          <button onClick={() => { window.location.href = '/docs/'; }}><CircleHelp size={17} /> Documentación</button>
          <button disabled={!SUPPORT_URL} title={SUPPORT_URL ? 'Abrir servidor de soporte' : 'Configura VITE_SUPPORT_URL en Render'} onClick={() => { if (SUPPORT_URL) window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer'); }}><LifeBuoy size={17} /> Soporte</button>
        </div>`
);

if (!css.includes(marker)) {
  css += `

${marker}
.language-menu { position: relative; display: inline-flex; align-items: center; }
.language-trigger { cursor: pointer; border: 0; background: transparent; }
.language-flag { width: 21px; height: 14px; border-radius: 3px; object-fit: cover; display: block; box-shadow: 0 0 0 1px rgba(255,255,255,.14); }
.language-chevron-open { transform: rotate(180deg); }
.language-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 120;
  width: 210px;
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #1d2027;
  box-shadow: 0 18px 46px rgba(0,0,0,.38);
}
.language-dropdown button {
  width: 100%;
  min-height: 40px;
  padding: 0 10px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #dfe3ea;
  text-align: left;
  cursor: pointer;
}
.language-dropdown button:hover, .language-dropdown button.active { background: #292d36; color: #fff; }
.language-dropdown small { color: #777f8d; font-size: 10px; font-weight: 700; }
.sidebar-footer button:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 860px) {
  .language-dropdown { position: fixed; top: 74px; right: 14px; width: min(250px, calc(100vw - 28px)); }
}
`;
}

if (!server.includes("const docsDir = path.join(rootDir, 'docs-site');")) {
  server = server.replace(
    `if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');`,
    `if (process.env.NODE_ENV === 'production') {
  const docsDir = path.join(rootDir, 'docs-site');
  app.get('/docs', (_req, res) => res.redirect(301, '/docs/'));
  app.use('/docs/', express.static(docsDir, { maxAge: '1h', etag: true, index: 'index.html' }));

  const distDir = path.join(rootDir, 'dist');`
  );
}

write(mainPath, main);
write(cssPath, css);
write(serverPath, server);
console.log('[Klvro] Dominio, docs, soporte e idiomas aplicados.');
