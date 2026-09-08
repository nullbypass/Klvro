import fs from 'node:fs';

const mainPath = new URL('../src/main.jsx', import.meta.url);
let main = fs.readFileSync(mainPath, 'utf8');
main = main.replace(
  "{rank >= 2 && /^https:///i.test(config.panelImageUrl || '') && <img src={config.panelImageUrl} alt=\"\" />}",
  "{rank >= 2 && String(config.panelImageUrl || '').startsWith('https://') && <img src={config.panelImageUrl} alt=\"\" />}"
);
fs.writeFileSync(mainPath, main);
console.log('[Klvro] Ticket UI hotfix aplicado.');
