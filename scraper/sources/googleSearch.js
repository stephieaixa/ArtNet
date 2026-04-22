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

const CURRENT_YEAR  = new Date().getFullYear();
const NEXT_YEAR     = CURRENT_YEAR + 1;
const YEARS         = `${CURRENT_YEAR} OR ${NEXT_YEAR}`;

// Búsquedas especializadas — cada una busca en nichos distintos
const SEARCH_QUERIES = [
  // ── Facebook (grupos de circo — muchas convocatorias se publican ahí) ──
  { q: `"audición" OR "casting" circo acróbata site:facebook.com`, lang: 'es' },
  { q: `"audition" circus acrobat performer entertainer site:facebook.com ${YEARS}`, lang: 'en' },
  { q: `"se busca" artista circo trapecista malabarista "tela" OR "aro" OR "trapecio" site:facebook.com`, lang: 'es' },

  // ── Cruceros — uno de los mayores empleadores de circo ──
  { q: `cruise ship circus performer acrobat entertainer audition ${YEARS} -dance -ballet`, lang: 'en' },
  { q: `crucero artista circo acróbata "se busca" OR "buscamos" ${YEARS}`, lang: 'es' },
  { q: `"Royal Caribbean" OR "MSC" OR "Carnival" OR "Norwegian" circus acrobat performer audition ${YEARS}`, lang: 'en' },
  { q: `"Club Med" OR "Disney" OR "Universal" circus entertainer performer acrobat casting ${YEARS}`, lang: 'en' },

  // ── Circos y festivales ──
  { q: `festival circo artistas convocatoria audición ${YEARS}`, lang: 'es' },
  { q: `circus festival artist audition casting ${YEARS} -dance -theater -music`, lang: 'en' },
  { q: `"cirque" "audition" OR "casting" artiste ${YEARS}`, lang: 'fr' },

  // ── Temáticos: disciplinas específicas ──
  { q: `"flying trapeze" OR "trapecio volante" audition casting job ${YEARS}`, lang: 'en' },
  { q: `"aerial silk" OR "tela" OR "aerial hoop" performer job audition ${YEARS}`, lang: 'en' },
  { q: `"hand to hand" OR "partner acrobatics" audition casting job ${YEARS}`, lang: 'en' },
  { q: `"russian bar" OR "barra rusa" OR "korean cradle" audition casting performer ${YEARS}`, lang: 'en' },
  { q: `"cloud swing" OR "aerial cradle" OR "swinging trapeze" performer job ${YEARS}`, lang: 'en' },
  { q: `"acróbatas" OR "malabaristas" OR "equilibristas" convocatoria contrato ${YEARS}`, lang: 'es' },

  // ── Hoteles, casinos, parques ──
  { q: `hotel resort casino entertainer performer acrobat circus hire ${YEARS}`, lang: 'en' },
  { q: `"parque de atracciones" OR "Disneyland" OR "PortAventura" artista acróbata contrato ${YEARS}`, lang: 'es' },
  { q: `"dinner show" OR "dinner theatre" acrobat circus performer hiring ${YEARS}`, lang: 'en' },

  // ── Navidad / Año Nuevo / temporadas ──
  { q: `christmas show circus acrobat performer audition ${NEXT_YEAR}`, lang: 'en' },
  { q: `"show de navidad" OR "año nuevo" circo acróbata artista convocatoria ${NEXT_YEAR}`, lang: 'es' },

  // ── Instagram vía Google ──
  { q: `site:instagram.com "circus" "audition" OR "casting" performer ${YEARS}`, lang: 'en' },
  { q: `site:instagram.com "circo" "audición" OR "casting" artista ${YEARS}`, lang: 'es' },

  // ── SUDAMÉRICA — Argentina ──
  { q: `circo argentina audición convocatoria artistas ${YEARS}`, lang: 'es', gl: 'ar' },
  { q: `"buscamos" OR "se busca" artista circo acróbata argentina ${YEARS}`, lang: 'es', gl: 'ar' },
  { q: `trapecista malabarista contorcionista trabajo argentina ${YEARS}`, lang: 'es', gl: 'ar' },
  { q: `site:facebook.com circo argentina "se busca" OR "convocatoria" OR "audición" ${YEARS}`, lang: 'es', gl: 'ar' },
  { q: `compañía circo teatro físico argentina convocatoria ${YEARS}`, lang: 'es', gl: 'ar' },
  { q: `"iNTeatro" OR "Fondo Nacional de las Artes" circo convocatoria ${YEARS}`, lang: 'es', gl: 'ar' },

  // ── SUDAMÉRICA — Brasil ──
  { q: `circo brasil audição convocatória artistas ${YEARS}`, lang: 'pt', gl: 'br' },
  { q: `"procura-se" artista circo acrobata malabarista brasil ${YEARS}`, lang: 'pt', gl: 'br' },
  { q: `site:facebook.com circo brasil "seleção" OR "audição" OR "procura-se" ${YEARS}`, lang: 'pt', gl: 'br' },
  { q: `Funarte circo convocatoria edital ${YEARS}`, lang: 'pt', gl: 'br' },
  { q: `circo contemporaneo brasil contratação artistas ${YEARS}`, lang: 'pt', gl: 'br' },

  // ── SUDAMÉRICA — Colombia, Chile, Uruguay, Perú ──
  { q: `circo colombia convocatoria artistas audición ${YEARS}`, lang: 'es', gl: 'co' },
  { q: `circo chile convocatoria artistas ${YEARS}`, lang: 'es', gl: 'cl' },
  { q: `site:facebook.com circo chile colombia peru "se busca" artista ${YEARS}`, lang: 'es' },
  { q: `artes escénicas circo convocatoria latinoamerica ${YEARS}`, lang: 'es' },
  { q: `"ministerio de cultura" circo artistas convocatoria ${YEARS} argentina OR chile OR colombia OR peru OR uruguay`, lang: 'es' },
  { q: `"FONDART" circo artes escénicas convocatoria ${YEARS}`, lang: 'es', gl: 'cl' },
  { q: `circo mexico convocatoria artistas audicion ${YEARS}`, lang: 'es', gl: 'mx' },
  { q: `site:facebook.com circo mexico venezuela "se busca" artista ${YEARS}`, lang: 'es' },

  // ── JAPÓN ──
  { q: `japan circus acrobat performer audition job ${YEARS}`, lang: 'en', gl: 'jp' },
  { q: `"Tokyo DisneySea" OR "Universal Studios Japan" OR "Huis Ten Bosch" entertainer performer acrobat ${YEARS}`, lang: 'en' },
  { q: `"Wonder Osaka" OR "Kinoshita Circus" OR "Kirin Kids Circus" audition performer ${YEARS}`, lang: 'en' },
  { q: `japan "dinner show" OR "theme park" acrobat circus entertainer hiring ${YEARS}`, lang: 'en', gl: 'jp' },
  { q: `サーカス 募集 アクロバット パフォーマー ${CURRENT_YEAR}`, lang: 'ja', gl: 'jp' },

  // ── CHINA / EAST ASIA ──
  { q: `china circus acrobat performer job audition international ${YEARS}`, lang: 'en', gl: 'cn' },
  { q: `"Shanghai Circus World" OR "Beijing Acrobatic Troupe" OR "Guangzhou" acrobat audition ${YEARS}`, lang: 'en' },
  { q: `china resort hotel entertainer acrobat circus performer hiring ${YEARS}`, lang: 'en' },
  { q: `"Cirque du Soleil" china asia casting audition performer ${YEARS}`, lang: 'en' },
  { q: `korea circus acrobat performer audition job ${YEARS}`, lang: 'en', gl: 'kr' },
  { q: `"Everland" OR "Lotte World" OR "Seoul" entertainer acrobat circus performer ${YEARS}`, lang: 'en' },
  { q: `site:facebook.com china OR korea OR japan circus acrobat audition ${YEARS}`, lang: 'en' },

  // ── DUBAI / MEDIO ORIENTE ──
  { q: `dubai circus performer acrobat entertainer job ${YEARS}`, lang: 'en', gl: 'ae' },
  { q: `"Global Village Dubai" OR "Ferrari World" OR "Yas Island" OR "Atlantis" performer acrobat entertainment ${YEARS}`, lang: 'en' },
  { q: `UAE "dinner show" OR resort circus performer entertainer hiring ${YEARS}`, lang: 'en', gl: 'ae' },
  { q: `"Saudi Arabia" OR "Qatar" OR "Bahrain" entertainment performer acrobat circus job ${YEARS}`, lang: 'en' },
  { q: `middle east circus entertainment performer acrobat hiring ${YEARS}`, lang: 'en' },
  { q: `site:instagram.com dubai circus acrobat performer audition ${YEARS}`, lang: 'en' },

  // ── AUSTRALIA / NUEVA ZELANDA ──
  { q: `australia circus acrobat performer audition job ${YEARS}`, lang: 'en', gl: 'au' },
  { q: `"Circus Oz" OR "Strut & Fret" OR "Strange Fruit" OR "Flying Fruit Fly" audition performer ${YEARS}`, lang: 'en' },
  { q: `australia "theme park" OR resort entertainer acrobat circus ${YEARS}`, lang: 'en', gl: 'au' },
  { q: `new zealand circus performer audition ${YEARS}`, lang: 'en', gl: 'nz' },

  // ── EUROPA AMPLIADO ──
  { q: `uk circus performer acrobat audition job ${YEARS}`, lang: 'en', gl: 'gb' },
  { q: `"Zippos Circus" OR "Giffords Circus" OR "NoFit State" OR "Mimbre" audition ${YEARS}`, lang: 'en' },
  { q: `germany cirque zirkus artist audition job ${YEARS}`, lang: 'de', gl: 'de' },
  { q: `Zirkus Artist Engagement Casting ${YEARS}`, lang: 'de', gl: 'de' },
  { q: `italia circo artista audizione lavoro ${YEARS}`, lang: 'it', gl: 'it' },
  { q: `spain circo artista audición trabajo ${YEARS}`, lang: 'es', gl: 'es' },
  { q: `netherlands belgium circus performer acrobat job ${YEARS}`, lang: 'en', gl: 'nl' },
  { q: `russia circus acrobat performer audition international ${YEARS}`, lang: 'en', gl: 'ru' },
  { q: `scandinavian circus performer acrobat norway sweden denmark ${YEARS}`, lang: 'en' },
  { q: `site:facebook.com europe circus audition "we are looking" acrobat performer ${YEARS}`, lang: 'en' },

  // ── CRUCEROS — más específico ──
  { q: `"Costa Cruises" OR "Cunard" OR "P&O" OR "Celebrity Cruises" circus entertainer performer audition ${YEARS}`, lang: 'en' },
  { q: `"Disney Cruise" OR "Virgin Voyages" OR "Regent Seven Seas" performer acrobat circus entertainer ${YEARS}`, lang: 'en' },
  { q: `cruise ship entertainment company acrobat circus audition open call ${YEARS}`, lang: 'en' },
  { q: `site:facebook.com cruise ship circus acrobat performer audition ${YEARS}`, lang: 'en' },

  // ── CIRQUE DU SOLEIL & GRANDES COMPAÑÍAS ──
  { q: `"Cirque du Soleil" audition casting acrobat performer ${YEARS}`, lang: 'en' },
  { q: `"Cirque Dreams" OR "Feld Entertainment" OR "Big Apple Circus" audition acrobat ${YEARS}`, lang: 'en' },
  { q: `"Compagnie Eolienne" OR "Les 7 Doigts" OR "Circa" audition performer ${YEARS}`, lang: 'en' },
  { q: `"NoFit State" OR "Gandini Juggling" OR "Gravity & Other Myths" audition ${YEARS}`, lang: 'en' },

  // ── BUSCADORES DE EMPLEO ESPECIALIZADOS ──
  { q: `site:mandy.com circus acrobat aerial performer job ${YEARS}`, lang: 'en' },
  { q: `site:castingcallpro.com circus acrobat aerial ${YEARS}`, lang: 'en' },
  { q: `site:entertainerjobs.com circus acrobat ${YEARS}`, lang: 'en' },
  { q: `"open audition" circus acrobat aerial performer ${YEARS}`, lang: 'en' },
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
async function searchGoogle(query, lang = 'es', num = 10, gl = 'us') {
  const key = process.env.SERPER_KEY;
  if (!key) return [];

  try {
    const res = await fetch(SERPER_API, {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl, hl: lang, num }),
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

  for (const { q, lang, gl } of SEARCH_QUERIES) {
    console.log(`\n[google] Buscando: "${q.slice(0, 70)}..."`);
    const results = await searchGoogle(q, lang, 10, gl ?? 'us');

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
