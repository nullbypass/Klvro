import 'dotenv/config';
import { registerCommands } from './discord.mjs';

try {
  await registerCommands();
  console.log('Slash commands de Klvro registrados correctamente.');
} catch (error) {
  console.error('No se pudieron registrar los slash commands:', error);
  process.exit(1);
}
