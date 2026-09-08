import fs from 'node:fs';

const mainPath = new URL('../src/main.jsx', import.meta.url);
const gatePath = new URL('../src/TurnstileGate.jsx', import.meta.url);
const indexPath = new URL('../server/index.mjs', import.meta.url);

let main = fs.readFileSync(mainPath, 'utf8');
let gate = fs.readFileSync(gatePath, 'utf8');
let index = fs.readFileSync(indexPath, 'utf8');

// Después de Cloudflare siempre se vuelve a la página principal.
gate = gate.replace(
`              window.setTimeout(() => {
                setState('done');
                const params = new URLSearchParams(window.location.search);
                const next = params.get('next');
                if (next && next.startsWith('/') && !next.startsWith('//')) window.location.href = next;
              }, 450);`,
`              window.setTimeout(() => {
                setState('done');
                window.location.replace('/');
              }, 450);`
);

// Si alguien intenta abrir OAuth sin haber pasado Turnstile, primero vuelve al home.
index = index.replace(
`  const nextPath = encodeURIComponent(req.originalUrl || '/');
  return res.redirect('/?verify=required&next=' + nextPath);`,
`  return res.redirect('/?verify=required');`
);

// Si OAuth se abrió en la misma pestaña y no como popup, tampoco entra al dashboard automáticamente.
index = index.replace(
  "if (!window.closed) window.location.replace('/app');",
  "if (!window.closed) window.location.replace('/');"
);

// Un login normal deja al usuario en el home. El dashboard se abre solo al pulsar Dashboard.
main = main.replace(
`      if (event.data?.type === 'klvro-auth-success') {
        const data = await loadMe();
        if (data?.authenticated) {
          history.pushState({}, '', '/app');
          setScreen('servers');
          loadGuilds();
        }
      }`,
`      if (event.data?.type === 'klvro-auth-success') {
        const data = await loadMe();
        if (data?.authenticated) goHome();
      }`
);

main = main.replace(
`          if (typeof afterLogin === 'function') {
            afterLogin();
          } else {
            history.pushState({}, '', '/app');
            setScreen('servers');
            loadGuilds();
          }`,
`          if (typeof afterLogin === 'function') {
            afterLogin();
          } else {
            goHome();
          }`
);

main = main.replace(
`        if (data?.authenticated && typeof afterLogin !== 'function') {
          history.pushState({}, '', '/app');
          setScreen('servers');
          loadGuilds();
        }`,
`        if (data?.authenticated && typeof afterLogin !== 'function') {
          goHome();
        }`
);

main = main.replaceAll('Volver al dashboard', 'Dashboard');

fs.writeFileSync(mainPath, main);
fs.writeFileSync(gatePath, gate);
fs.writeFileSync(indexPath, index);
console.log('[Klvro] Flujo de verificación/login ajustado al home.');
