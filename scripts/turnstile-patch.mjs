import fs from 'node:fs';

const mainPath = new URL('../src/main.jsx', import.meta.url);
const indexPath = new URL('../server/index.mjs', import.meta.url);
let main = fs.readFileSync(mainPath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

if (!main.includes("import TurnstileGate from './TurnstileGate.jsx';")) {
  main = main.replace(
    "import './styles.css';",
    "import './styles.css';\nimport TurnstileGate from './TurnstileGate.jsx';"
  );
}

if (!main.includes('<TurnstileGate />')) {
  main = main.replace(
    "createRoot(document.getElementById('root')).render(<App />);",
    "createRoot(document.getElementById('root')).render(<><TurnstileGate /><App /></>);"
  );
}

// Allow Cloudflare Turnstile in the site's CSP.
index = index.replace(
  "scriptSrc: [\"'self'\"],",
  "scriptSrc: [\"'self'\", 'https://challenges.cloudflare.com'],"
);
if (!index.includes("frameSrc: [\"'self'\", 'https://challenges.cloudflare.com']")) {
  index = index.replace(
    "connectSrc: [\"'self'\"],",
    "connectSrc: [\"'self'\"],\n      frameSrc: [\"'self'\", 'https://challenges.cloudflare.com'],"
  );
}

const marker = '// Klvro Cloudflare Turnstile';
if (!index.includes(marker)) {
  const block = `
${marker}
const TURNSTILE_WINDOW_MS = 1000 * 60 * 60 * 12;

function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

function turnstileVerified(req) {
  if (!turnstileConfigured()) return true;
  const verifiedAt = Number(req.session?.turnstileVerifiedAt || 0);
  return verifiedAt > 0 && Date.now() - verifiedAt < TURNSTILE_WINDOW_MS;
}

function requireTurnstile(req, res, next) {
  if (turnstileVerified(req)) return next();
  return res.status(403).json({
    error: 'Completa la verificación de seguridad para continuar.',
    code: 'TURNSTILE_REQUIRED',
  });
}

function requireTurnstilePage(req, res, next) {
  if (turnstileVerified(req)) return next();
  const nextPath = encodeURIComponent(req.originalUrl || '/');
  return res.redirect('/?verify=required&next=' + nextPath);
}

app.get('/api/turnstile/config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    enabled: turnstileConfigured(),
    siteKey: turnstileConfigured() ? process.env.TURNSTILE_SITE_KEY : '',
  });
});

app.get('/api/turnstile/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: turnstileConfigured(), verified: turnstileVerified(req) });
});

const turnstileLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.post('/api/turnstile/verify', turnstileLimiter, async (req, res) => {
  if (!turnstileConfigured()) return res.json({ verified: true, enabled: false });

  const token = String(req.body?.token || '').trim();
  if (!token || token.length > 2048) {
    return res.status(400).json({ error: 'Token de Cloudflare inválido.' });
  }

  try {
    const form = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (req.ip) form.set('remoteip', String(req.ip));

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();

    let hostnameOk = true;
    try {
      const expectedHostname = new URL(process.env.PUBLIC_URL || 'https://klvro.site').hostname;
      hostnameOk = !result.hostname || result.hostname === expectedHostname;
    } catch {}

    if (!response.ok || !result.success || result.action !== 'site_access' || !hostnameOk) {
      console.warn('[Klvro] Turnstile rechazado:', result['error-codes'] || 'validation_failed');
      return res.status(403).json({ error: 'Cloudflare no pudo verificar esta solicitud.' });
    }

    req.session.turnstileVerifiedAt = Date.now();
    req.session.save((error) => {
      if (error) return res.status(500).json({ error: 'No se pudo guardar la verificación.' });
      return res.json({ verified: true, expiresIn: TURNSTILE_WINDOW_MS });
    });
  } catch (error) {
    console.error('[Klvro] Turnstile Siteverify:', error.message);
    return res.status(503).json({ error: 'Cloudflare no está disponible temporalmente.' });
  }
});
`;

  index = index.replace(
    "function publicUrl(pathname = '') {",
    `${block}\nfunction publicUrl(pathname = '') {`
  );
}

// Authenticated API actions require a successful Turnstile session when configured.
if (!index.includes("if (!turnstileVerified(req)) return res.status(403)")) {
  index = index.replace(
`function requireAuth(req, res, next) {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  next();
}`,
`function requireAuth(req, res, next) {
  if (!turnstileVerified(req)) return res.status(403).json({ error: 'Completa la verificación de seguridad para continuar.', code: 'TURNSTILE_REQUIRED' });
  if (!req.session.user?.id) return res.status(401).json({ error: 'Debes iniciar sesión con Discord.' });
  next();
}`
  );
}

if (!index.includes("app.get('/auth/discord', requireTurnstilePage")) {
  index = index.replace(
    "app.get('/auth/discord', (req, res) => {",
    "app.get('/auth/discord', requireTurnstilePage, (req, res) => {"
  );
}

fs.writeFileSync(mainPath, main);
fs.writeFileSync(indexPath, index);
console.log('[Klvro] Cloudflare Turnstile aplicado.');
