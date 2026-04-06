/**
 * ArteLynk Scraper — Orquestador principal
 *
 * Corre todos los scrapers en secuencia y luego espera el intervalo configurado.
 *
 * Uso:
 *   node index.js          → corre una vez y repite cada SCRAPE_INTERVAL_HOURS horas
 *   node index.js --once   → corre una sola vez y termina
 *   node sources/telegram.js  → solo Telegram
 *   node sources/scrapeWeb.js → solo web
 */
import 'dotenv/config';
import { runWebScraper } from './sources/scrapeWeb.js';
import { runTelegramScraper } from './sources/telegram.js';
import { runGoogleSearchScraper } from './sources/googleSearch.js';
import { getStats } from './db.js';
import { runEnrichment } from './enrich.js';

const INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS ?? '6');
const RUN_ONCE = process.argv.includes('--once');
const SKIP_TELEGRAM = process.argv.includes('--no-telegram');
const SKIP_WEB = process.argv.includes('--no-web');

function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`\n❌ Faltan variables de entorno: ${missing.join(', ')}`);
    console.error('   Copiá scraper/.env.example a scraper/.env y completá los valores\n');
    process.exit(1);
  }
}

async function runAll() {
  const start = Date.now();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎪 ArtNet Scraper — ${new Date().toLocaleString('es-AR')}`);
  console.log(`${'='.repeat(50)}`);

  let totalNew = 0;

  // 1. Scraping web
  if (!SKIP_WEB) {
    try {
      const webNew = await runWebScraper();
      totalNew += webNew;
    } catch (err) {
      console.error('[main] Error en scraper web:', err.message);
    }
  }

  // 2. Google Search (si hay SERPER_KEY)
  try {
    const googleNew = await runGoogleSearchScraper();
    totalNew += googleNew;
  } catch (err) {
    console.error('[main] Error en Google Search scraper:', err.message);
  }

  // 3. Telegram
  if (!SKIP_TELEGRAM && process.env.TELEGRAM_API_ID) {
    try {
      const tgNew = await runTelegramScraper();
      totalNew += tgNew;
    } catch (err) {
      console.error('[main] Error en scraper Telegram:', err.message);
    }
  } else if (!SKIP_TELEGRAM && !process.env.TELEGRAM_API_ID) {
    console.log('\n[main] ⚠️  Telegram saltado (TELEGRAM_API_ID no configurado)');
    console.log('        Seguí las instrucciones en scraper/.env.example para activarlo');
  }

  // 4. Enriquecimiento de empresas (busca web oficial, casting email, etc.)
  try {
    await runEnrichment();
  } catch (err) {
    console.error('[main] Error en enriquecimiento:', err.message);
  }

  // 5. Stats finales
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const stats = await getStats();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Corrida completada en ${elapsed}s`);
  console.log(`📊 Trabajos nuevos esta corrida: ${totalNew}`);

  if (stats) {
    console.log(`📦 Total en base de datos: ${stats.total}`);
    console.log('📋 Por fuente:');
    for (const [source, count] of Object.entries(stats.bySource).slice(0, 10)) {
      console.log(`   ${source}: ${count}`);
    }
  }
  console.log(`${'='.repeat(50)}\n`);
}

async function main() {
  validateEnv();

  if (RUN_ONCE) {
    await runAll();
    process.exit(0);
  }

  // Loop continuo
  while (true) {
    await runAll();

    const nextRun = new Date(Date.now() + INTERVAL_HOURS * 60 * 60 * 1000);
    console.log(`⏰ Próxima corrida: ${nextRun.toLocaleString('es-AR')}`);
    console.log(`   (cada ${INTERVAL_HOURS} horas — cambiá SCRAPE_INTERVAL_HOURS en .env)\n`);

    await new Promise(r => setTimeout(r, INTERVAL_HOURS * 60 * 60 * 1000));
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
