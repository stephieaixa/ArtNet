/**
 * Monitor de canales públicos de Telegram para trabajos de circo.
 *
 * Usa la API oficial de Telegram (MTProto) para leer mensajes de canales públicos
 * sin necesidad de que el canal te agregue como admin.
 *
 * SETUP REQUERIDO (una sola vez):
 * 1. Ir a https://my.telegram.org → Log in con tu número de teléfono
 * 2. Ir a "API Development Tools"
 * 3. Crear una nueva aplicación → copiar api_id y api_hash al .env
 * 4. La primera vez que corras esto, pedirá tu número y código SMS
 * 5. La sesión se guarda en TELEGRAM_SESSION del .env para no repetir el proceso
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TELEGRAM_CHANNELS } from './websites.js';
import { extractJobsFromText } from '../extract.js';
import { saveJob, jobExists } from '../db.js';

// Cuántos mensajes hacia atrás leer por canal (primera corrida: más, siguientes: menos)
const MESSAGES_LIMIT = parseInt(process.env.TELEGRAM_MESSAGES_LIMIT ?? '100');

// Palabras clave para filtrar mensajes relevantes (evita procesar todo con Claude)
const KEYWORDS = [
  // Español
  'circo', 'cirque', 'artista', 'casting', 'convocatoria', 'audición', 'contratar',
  'busco', 'buscamos', 'necesitamos', 'trabajo', 'temporada', 'contrato', 'gira',
  'festival', 'crucero', 'hotel', 'parque', 'espectáculo',
  // Inglés
  'circus', 'artist', 'hiring', 'audition', 'casting call', 'job', 'contract',
  'season', 'performer', 'tour', 'festival', 'cruise', 'entertainment',
  // Disciplinas
  'acroba', 'malabares', 'juggling', 'aérea', 'aerial', 'contorsion', 'equilibrio',
  'payaso', 'clown', 'fuego', 'fire', 'trapecio', 'trapeze', 'magia', 'magic',
];

function isRelevant(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

function makeSourceId(channelHandle, messageId) {
  return crypto.createHash('md5').update(`tg::${channelHandle}::${messageId}`).digest('hex');
}

async function getClient() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0');
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';

  if (!apiId || !apiHash) {
    throw new Error(
      'Faltan TELEGRAM_API_ID y TELEGRAM_API_HASH en el .env\n' +
      'Obtené tus credenciales en https://my.telegram.org → API Development Tools'
    );
  }

  const sessionStr = process.env.TELEGRAM_SESSION ?? '';
  const session = new StringSession(sessionStr);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: 'ArteLynk Scraper',
    appVersion: '1.0',
  });

  await client.start({
    phoneNumber: async () => {
      console.log('\n[telegram] Primera vez — necesitamos autenticar tu cuenta de Telegram');
      return await input.text('Tu número de teléfono (con código de país, ej: +5491112345678): ');
    },
    password: async () => {
      return await input.text('Contraseña 2FA (si tenés): ');
    },
    phoneCode: async () => {
      return await input.text('Código que llegó por Telegram/SMS: ');
    },
    onError: (err) => console.error('[telegram] Error de auth:', err),
  });

  // Guardar la sesión para próximas corridas
  const newSessionStr = client.session.save();
  if (newSessionStr !== sessionStr) {
    console.log('\n[telegram] ✅ Sesión guardada. Copiá esta línea en tu .env:');
    console.log(`TELEGRAM_SESSION=${newSessionStr}\n`);

    // También escribir en el .env local automáticamente
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('TELEGRAM_SESSION=')) {
        envContent = envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION=${newSessionStr}`);
      } else {
        envContent += `\nTELEGRAM_SESSION=${newSessionStr}`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log('[telegram] Sesión guardada en .env automáticamente');
    }
  }

  return client;
}

async function processChannel(client, channel) {
  console.log(`\n[telegram] Leyendo canal: @${channel.handle}`);

  let messages;
  try {
    messages = await client.getMessages(channel.handle, {
      limit: MESSAGES_LIMIT,
    });
  } catch (err) {
    if (err.message?.includes('CHANNEL_PRIVATE') || err.message?.includes('USERNAME_NOT_OCCUPIED')) {
      console.warn(`[telegram] Canal @${channel.handle} no existe o es privado, saltando`);
      return 0;
    }
    console.warn(`[telegram] Error en @${channel.handle}: ${err.message}`);
    return 0;
  }

  console.log(`[telegram] ${messages.length} mensajes obtenidos de @${channel.handle}`);

  let saved = 0;

  for (const msg of messages) {
    const text = msg.message ?? '';
    if (text.length < 30) continue;
    if (!isRelevant(text)) continue;

    const sourceId = makeSourceId(channel.handle, msg.id);
    if (await jobExists(sourceId)) continue;

    const context = `Telegram canal @${channel.handle} (${channel.name}) — ${channel.lang} — ${channel.region}`;
    const jobs = await extractJobsFromText(text, context);

    for (const job of jobs) {
      if (!job.title || job.title.length < 5) continue;

      // Para Telegram, el contact_url es el link al mensaje
      if (!job.contact_url) {
        job.contact_url = `https://t.me/${channel.handle}/${msg.id}`;
      }

      const ok = await saveJob({
        job,
        sourceId,
        sourceName: `Telegram @${channel.handle}`,
        sourceUrl: `https://t.me/${channel.handle}/${msg.id}`,
        rawText: text.slice(0, 500),
      });

      if (ok) saved++;
    }
  }

  console.log(`[telegram] ✓ ${saved} trabajos nuevos guardados de @${channel.handle}`);
  return saved;
}

export async function runTelegramScraper() {
  console.log(`\n======================================`);
  console.log(`[telegram] Iniciando monitoreo de ${TELEGRAM_CHANNELS.length} canales`);
  console.log(`======================================`);

  let client;
  try {
    client = await getClient();
  } catch (err) {
    console.error('[telegram] No se pudo conectar:', err.message);
    return 0;
  }

  let totalNew = 0;

  for (const channel of TELEGRAM_CHANNELS) {
    const newJobs = await processChannel(client, channel);
    totalNew += newJobs;

    // Pausa entre canales para no gatillar rate limits de Telegram
    await new Promise(r => setTimeout(r, 1500));
  }

  await client.disconnect();

  console.log(`\n[telegram] ✅ Monitoreo completado. Total trabajos nuevos: ${totalNew}`);
  return totalNew;
}
