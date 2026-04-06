/**
 * Google Search Scraper — via Serper.dev (2500 búsquedas gratis/mes)
 *
 * Busca convocatorias de circo en Google, incluyendo previsualizaciones
 * de posts en grupos de Facebook, Instagram, etc.
 *
 * Configurar en .env:
 *   SERPER_KEY=tu_api_key   → gratis en https://serper.dev (2500 req/mes)
 *
 * Qué hace:
 *   1. Lanza varias búsquedas especializadas en Google
 *   2. Toma el snippet + link de cada resultado
 *   3. Pasa el snippet al extractor de IA igual que el resto de fuentes
 *   4. Si el resultado es de un grupo de Facebook/Instagram/etc.,
 *      guarda el link original para que el usuario pueda ir al grupo
 */
import fetch from 'node-fetch';
import crypto from 'crypto';
import { extractJobsFromText } from '../extract.js';
import { saveJob, jobExists } from '../db.js';

const SERPER_API = 'https://google.serper.dev/search';

// Búsquedas especializadas — cada una busca en nichos distintos
const SEARCH_QUERIES = [
  // Grupos de Facebook públicos con preview en Google
  { q: '"audición" OR "casting" circo acróbata site:facebook.com', region: 'global', lang: 'es' },
  { q: '"audition" circus acrobat performer cruise site:facebook.com', region: 'global', lang: 'en' },
  { q: '"se busca" artista circo acróbata trapecista malabarista', region: 'global', lang: 'es' },
  { q: '"looking for" circus performer acrobat entertainer -dance -ballet -theater', region: 'global', lang: 'en' },
  { q: 'audicion circo varieté 2025 convocatoria artista escénico', region: 'global', lang: 'es' },
  { q: 'circus performer job audition 2025 -dance -theater -ballet', region: 'global', lang: 'en' },
  { q: '"artiste cirque" "audition" OR "casting" 2025', region: 'global', lang: 'fr' },
  { q: 'crucero artista circo acróbata "se busca" OR "buscamos"', region: 'global', lang: 'es' },
  { q: 'cruise ship circus performer acrobat entertainer audition 2025', region: 'global', lang: 'en' },
  { q: 'festival circo artistas convocatoria audición 2025', region: 'global', lang: 'es' },
];

// Dominios que no vale la pena procesar (muy genéricos o irrelevantes)
const SKIP_DOMAINS = [
  'youtube.com', 'wikipedia.org', 'wikihow.com', 'indeed.com',
  'glassdoor.com', 'linkedin.com', 'ziprecruiter.com',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hace una búsqueda en Google vía Serper.dev y devuelve los resultados
 */
async function searchGoogle(query, lang = 'es', num = 10) {
  const key = process.env.SERPER_KEY;
  if (!key) return [];

  try {
    const res = await fetch(SERPER_API, {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: lang, num }),
    });

    if (!res.ok) {
      console.warn(`[google] API error ${res.status} para: "${query}"`);
      return [];
    }

    const data = await res.json();
    return data.organic ?? [];
  } catch (err) {
    console.warn('[google] Error en búsqueda:', err.message);
    return [];
  }
}

/**
 * Convierte un resultado de búsqueda de Google en texto para el extractor de IA
 */
function resultToText(result) {
  const parts = [];
  if (result.title) parts.push(`TÍTULO: ${result.title}`);
  if (result.snippet) parts.push(`DESCRIPCIÓN: ${result.snippet}`);
  if (result.link) parts.push(`URL: ${result.link}`);
  if (result.date) parts.push(`FECHA: ${result.date}`);
  // sitelinks adicionales si existen
  if (result.sitelinks?.length) {
    for (const sl of result.sitelinks.slice(0, 3)) {
      if (sl.snippet) parts.push(`DETALLE ADICIONAL: ${sl.snippet}`);
    }
  }
  return parts.join('\n');
}

function makeSourceId(result) {
  const key = `google::${result.link}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

function isSkippable(url) {
  try {
    const { hostname } = new URL(url);
    return SKIP_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return true;
  }
}

export async function runGoogleSearchScraper() {
  if (!process.env.SERPER_KEY) {
    console.log('\n[google] ⚠️  SERPER_KEY no configurado — saltando Google Search scraper');
    console.log('         Gratis en https://serper.dev (2500 búsquedas/mes)');
    return 0;
  }

  console.log('\n======================================');
  console.log('[google] Iniciando scraper de búsqueda Google');
  console.log(`[google] ${SEARCH_QUERIES.length} consultas programadas`);
  console.log('======================================');

  let totalNew = 0;

  for (const { q, lang } of SEARCH_QUERIES) {
    console.log(`\n[google] Buscando: "${q.slice(0, 70)}..."`);
    const results = await searchGoogle(q, lang, 10);

    if (!results.length) {
      console.log('[google] Sin resultados');
      await sleep(1500);
      continue;
    }

    // Agrupar resultados en un bloque de texto para el extractor
    // (más eficiente que llamar al AI por cada resultado)
    const validResults = results.filter(r => r.link && !isSkippable(r.link));
    if (!validResults.length) { await sleep(1500); continue; }

    const combinedText = validResults
      .map((r, i) => `=== RESULTADO ${i + 1} ===\n${resultToText(r)}`)
      .join('\n\n');

    const context = `Google Search: "${q}" — ${validResults.length} resultados`;
    const jobs = await extractJobsFromText(combinedText, context);

    if (!jobs.length) {
      console.log('[google] Sin trabajos extraídos');
      await sleep(1500);
      continue;
    }

    console.log(`[google] ${jobs.length} trabajos encontrados`);

    for (const job of jobs) {
      if (!job.title || job.title.length < 5) continue;

      // Intentar asociar el link del resultado correspondiente
      if (!job.contact_url && !job.source_url) {
        // Buscar el resultado más relevante por título
        const titleWords = job.title.toLowerCase().split(' ').filter(w => w.length > 4);
        const match = validResults.find(r =>
          titleWords.some(w => (r.title + ' ' + (r.snippet ?? '')).toLowerCase().includes(w))
        );
        if (match) job.contact_url = match.link;
      }

      const sourceId = makeSourceId({ link: job.contact_url || job.title });
      if (await jobExists(sourceId)) continue;

      const ok = await saveJob({
        job,
        sourceId,
        sourceName: 'google_search',
        sourceUrl: job.contact_url || '',
        rawText: combinedText.slice(0, 500),
      });

      if (ok) totalNew++;
    }

    // Pausa entre búsquedas para no saturar la API
    await sleep(2000 + Math.random() * 1000);
  }

  console.log(`\n[google] ✅ Completado. Trabajos nuevos: ${totalNew}`);
  return totalNew;
}
