import fs from 'node:fs';

const mainPath = new URL('../src/main.jsx', import.meta.url);
const cssPath = new URL('../src/styles.css', import.meta.url);

let main = fs.readFileSync(mainPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

// Quita las tarjetas genéricas de tipos de servidor.
main = main.replace(/\nconst showcaseServers = \[[\s\S]*?\];\n/, '\n');

// Lista usada por el carrusel infinito.
if (!main.includes('const logoCarouselItems =')) {
  main = main.replace(
    '  const commandGroups = [',
    '  const logoCarouselItems = Array.from({ length: 10 }, (_, index) => index + 1);\n\n  const commandGroups = ['
  );
}

const copy = new Map([
  ['Configura el bot desde la web y úsalo en Discord. Moderación, tickets, logs y Anti-Raid.', 'Moderación, tickets, registros y Anti-Raid desde un solo panel.'],
  ['Cómo añadir y configurar Klvro.', 'Añade Klvro y entra a la configuración.'],
  ['Comprueba si el bot está conectado.', 'Revisa si Klvro está conectado.'],
  ['Lista de comandos disponibles.', 'Mira los comandos principales.'],
  ['Todo lo que puedes activar desde el panel.', 'Activa o apaga los módulos que necesites.'],
  ['Añade Klvro y configura tu servidor', 'Añade Klvro y entra al panel'],
  ['Entra con Discord, elige un servidor y Klvro te lleva al panel.', 'Haz login, elige el servidor y abre su configuración.'],
  ['Aquí puedes ver si el bot está conectado.', 'Estado actual de Klvro.'],
  ['La información sale directamente de la API de Klvro.', 'Datos actualizados desde Klvro.'],
  ['Los principales comandos que trae Klvro.', 'Los comandos más usados de Klvro.'],
  ['Activa solo lo que vayas a usar.', 'Deja encendido solo lo que necesites.'],
  ['30 días por compra. No se renueva solo.', '30 días por compra. Tú decides si renuevas.'],
  ['Los canales y roles salen de tu servidor de Discord.', 'Aquí eliges los canales y roles de este servidor.'],
  ['Configuración conectada', 'Guardado activo'],
  ['Guardada en PostgreSQL', 'Base de datos conectada'],
  ['Opciones básicas del bot.', 'Ajustes del bot para este servidor.'],
  ['Qué hacer cuando entra un miembro.', 'Mensaje y canal de bienvenida.'],
  ['Canales, staff y registros de tickets.', 'Categoría, staff y canal de registros.'],
  ['Protección contra raids y acciones masivas.', 'Límites y respuesta del Anti-Raid.'],
  ['Ajustes de los comandos del staff.', 'Motivos, warns y acciones del staff.'],
  ['Elige qué quieres guardar en logs.', 'Canal y eventos que se van a registrar.'],
  ['Slash commands y prefijo.', 'Slash commands y comandos con prefijo.'],
  ['Los cambios se aplican al guardar.', 'Sin guardar todavía.'],
]);

for (const [from, to] of copy) main = main.split(from).join(to);

const carousel = `          <section className="server-types-block logo-carousel-block">
            <div className="logo-carousel-wrap">
              <div className="logo-carousel-track" aria-label="Klvro">
                {[...logoCarouselItems, ...logoCarouselItems].map((item, index) => (
                  <div className="logo-carousel-card" key={\`${'${item}-${index}'}\`}>
                    <LogoMark className="logo-carousel-image" />
                  </div>
                ))}
              </div>
            </div>
          </section>`;

if (!main.includes('logo-carousel-block')) {
  const before = main;
  main = main.replace(
    /          <section className="server-types-block">[\s\S]*?          <\/section>/,
    carousel
  );
  if (main === before) throw new Error('No se encontró server-types-block para reemplazar.');
}

const marker = '/* Klvro logo carousel */';
if (!css.includes(marker)) {
  css += `

${marker}
.logo-carousel-block {
  width: min(1120px, calc(100% - 48px));
  margin: 18px auto 70px;
}
.logo-carousel-wrap {
  overflow: hidden;
  padding: 16px 0;
  border: 1px solid #252a32;
  background: #101215;
  mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
}
.logo-carousel-track {
  display: flex;
  align-items: center;
  gap: 42px;
  width: max-content;
  padding-left: 42px;
  animation: klvro-logo-marquee 22s linear infinite;
  will-change: transform;
}
.logo-carousel-wrap:hover .logo-carousel-track,
.logo-carousel-wrap:active .logo-carousel-track {
  animation-play-state: paused;
}
.logo-carousel-card {
  width: 150px;
  height: 76px;
  flex: none;
  display: grid;
  place-items: center;
  opacity: .72;
  transition: opacity .16s ease, transform .16s ease;
}
.logo-carousel-card:hover {
  opacity: 1;
  transform: scale(1.04);
}
.logo-carousel-image {
  width: 58px;
  height: 58px;
  display: block;
  object-fit: cover;
  border-radius: 14px;
  filter: grayscale(1);
  transition: filter .16s ease;
}
.logo-carousel-card:hover .logo-carousel-image { filter: grayscale(0); }
@keyframes klvro-logo-marquee {
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
}
@media (max-width: 760px) {
  .logo-carousel-block { width: calc(100% - 28px); }
  .logo-carousel-track { gap: 20px; padding-left: 20px; }
  .logo-carousel-card { width: 112px; height: 66px; }
  .logo-carousel-image { width: 48px; height: 48px; }
}
`;
}

fs.writeFileSync(mainPath, main);
fs.writeFileSync(cssPath, css);
console.log('[Klvro] UI patch aplicado.');
