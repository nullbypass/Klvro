import fs from 'node:fs';

const serverPath = new URL('../server/index.mjs', import.meta.url);
let server = fs.readFileSync(serverPath, 'utf8');

const bad = `  const docsDir = path.join(rootDir, 'docs-site');
  app.get('/docs', (_req, res) => res.redirect(301, '/docs/'));
  app.use('/docs/', express.static(docsDir, { maxAge: '1h', etag: true, index: 'index.html' }));`;

const fixed = `  const docsDir = path.join(rootDir, 'docs-site');
  app.get('/docs', (_req, res) => res.sendFile(path.join(docsDir, 'index.html')));
  app.get('/docs/', (_req, res) => res.sendFile(path.join(docsDir, 'index.html')));
  app.use('/docs', express.static(docsDir, { maxAge: '1h', etag: true, index: false, redirect: false }));`;

if (server.includes(bad)) {
  server = server.replace(bad, fixed);
} else if (!server.includes("app.get('/docs/', (_req, res) => res.sendFile(path.join(docsDir, 'index.html')))")) {
  server = server.replace(
    `  const docsDir = path.join(rootDir, 'docs-site');`,
    fixed
  );
}

fs.writeFileSync(serverPath, server);
console.log('[Klvro] Ruta /docs corregida sin redirecciones.');
