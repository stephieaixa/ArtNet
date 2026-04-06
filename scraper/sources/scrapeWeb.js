/**
 * Scraper de sitios web para trabajos de circo.
 *
 * Estrategia por capas:
 *   1. JSON-LD  → datos estructurados embebidos en el HTML (gratis, sin AI)
 *   2. Detail links → seguir links individuales de cada oferta (más texto = mejor extracción)
 *   3. AI extraction → enviar todo a Groq/Gemini
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { CIRCUS_SOURCES } from './websites.js';
import { extractJobsFromText } from '../extract.js';
import { saveJob, jobExists } from '../db.js';

// Cuántos links de detalle seguir por fuente (evita sobrecargar servidores)
const MAX_DETAIL_LINKS = parseInt(process.env.MAX_DETAIL_LINKS ?? '6');

// Headers para parecer un browser real
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,fr;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
};

// Keywords que indican que un link lleva a una oferta individual
const JOB_LINK_KEYWORDS = [
  'job', 'jobs', 'audition', 'casting', 'position', 'role', 'vacancy',
  'opening', 'apply', 'performer', 'artist', 'opportunity', 'offer',
  'empleo', 'trabajo', 'convocatoria', 'audicion', 'oferta', 'postular',
  'emploi', 'offre', 'artiste', 'stelle', 'bewerbung',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Fetch con timeout ────────────────────────────────────────────────────────

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── JSON-LD extraction ───────────────────────────────────────────────────────

/**
 * Extrae datos estructurados JSON-LD de tipo JobPosting del HTML.
 * Muchos job boards los embeben — datos perfectos, sin AI.
 */
function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? '';
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = item['@type'];
        if (type === 'JobPosting' || type === 'Event') {
          results.push(item);
        }
        // A veces viene anidado en @graph
        if (item['@graph']) {
          for (const node of item['@graph']) {
            if (node['@type'] === 'JobPosting' || node['@type'] === 'Event') {
              results.push(node);
            }
          }
        }
      }
    } catch {
      // JSON inválido, ignorar
    }
  });

  return results;
}

/**
 * Convierte un JobPosting JSON-LD a texto estructurado para el AI.
 */
function jsonLdToText(item) {
  const parts = [];
  if (item.title || item.name) parts.push(`TÍTULO: ${item.title ?? item.name}`);
  if (item.description) parts.push(`DESCRIPCIÓN: ${item.description.replace(/<[^>]+>/g, ' ').slice(0, 1000)}`);
  if (item.hiringOrganization?.name) parts.push(`EMPRESA: ${item.hiringOrganization.name}`);
  if (item.hiringOrganization?.sameAs) parts.push(`WEB EMPRESA: ${item.hiringOrganization.sameAs}`);
  if (item.jobLocation?.address) {
    const addr = item.jobLocation.address;
    const city = addr.addressLocality ?? '';
    const country = addr.addressCountry ?? '';
    if (city || country) parts.push(`UBICACIÓN: ${city} ${country}`.trim());
  }
  if (item.datePosted) parts.push(`PUBLICADO: ${item.datePosted}`);
  if (item.validThrough) parts.push(`CIERRE: ${item.validThrough}`);
  if (item.baseSalary) {
    const s = item.baseSalary;
    parts.push(`SALARIO: ${s.value?.minValue ?? ''}-${s.value?.maxValue ?? ''} ${s.currency ?? ''}`);
  }
  if (item.applicationContact?.email) parts.push(`EMAIL: ${item.applicationContact.email}`);
  if (item.url) parts.push(`URL: ${item.url}`);
  return parts.join('\n');
}

// ─── HTML cleaning ────────────────────────────────────────────────────────────

/**
 * Limpia HTML preservando texto útil.
 * Intenta extraer el área de contenido principal primero.
 * Preserva URLs inline para que el AI pueda verlas.
 */
function cleanHtml(html, baseUrl = '') {
  const $ = cheerio.load(html);

  // Eliminar ruido
  $('script, style, nav, footer, header, iframe, noscript').remove();
  $('[aria-hidden="true"]').remove();
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [id*="cookie"]').remove();
  $('[class*="sidebar"], [class*="ad-"], [id*="sidebar"]').remove();

  // Convertir links a texto con URL visible (para que el AI vea las URLs)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();
    if (href.startsWith('mailto:')) {
      $(el).replaceWith(`${text} [${href}]`);
    } else if (href.startsWith('http') && text && text !== href) {
      $(el).replaceWith(`${text}`);
    }
  });

  // Intentar extraer zona de contenido principal
  const contentSelectors = [
    'main', '[role="main"]', 'article',
    '.job-description', '.job-detail', '.job-content',
    '.listing-detail', '.posting-detail', '.opportunity-detail',
    '#job-description', '#main-content', '#content',
    '.content', '.entry-content',
  ];

  let contentEl = null;
  for (const sel of contentSelectors) {
    if ($(sel).length) { contentEl = $(sel).first(); break; }
  }

  const source = contentEl ?? $('body');
  const text = source.text()
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// ─── Contact extraction ───────────────────────────────────────────────────────

/**
 * Extrae del HTML crudo: mailto, WhatsApp, Instagram, Facebook.
 * Cosas que desaparecen al limpiar el HTML.
 */
function extractContactsFromHtml(html) {
  const $ = cheerio.load(html);
  const contacts = new Set();

  $('a[href^="mailto:"]').each((_, el) => {
    const email = ($(el).attr('href') ?? '').replace('mailto:', '').split('?')[0].trim();
    if (email && !email.includes('example')) contacts.add(`email:${email}`);
  });

  $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    contacts.add(`whatsapp:${href}`);
  });

  $('a[href*="instagram.com/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/instagram\.com\/([^/?#]+)/);
    if (match?.[1] && !['p', 'reel', 'stories', 'explore'].includes(match[1])) {
      contacts.add(`instagram:https://instagram.com/${match[1]}`);
    }
  });

  $('a[href*="facebook.com/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    contacts.add(`facebook:${href}`);
  });

  return [...contacts].slice(0, 15);
}

// ─── Detail link extraction ───────────────────────────────────────────────────

/**
 * Extrae links de la página de listado que probablemente llevan a ofertas individuales.
 * Filtra por keywords relevantes en href o en el texto del link.
 */
function extractJobDetailLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const links = [];

  let base;
  try { base = new URL(baseUrl); } catch { return []; }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const linkText = $(el).text().toLowerCase();

    // Resolver URL relativa
    let fullUrl;
    try {
      fullUrl = new URL(href, base).toString();
    } catch { return; }

    // Solo links del mismo dominio
    try {
      if (new URL(fullUrl).hostname !== base.hostname) return;
    } catch { return; }

    // Ignorar duplicados y links no-HTML
    if (seen.has(fullUrl)) return;
    if (/\.(pdf|doc|docx|zip|jpg|png|gif|mp4)$/i.test(fullUrl)) return;
    if (fullUrl === baseUrl) return;

    // Verificar si el href o texto contiene keywords de job
    const hrefLower = fullUrl.toLowerCase();
    const hasKeyword = JOB_LINK_KEYWORDS.some(kw =>
      hrefLower.includes(kw) || linkText.includes(kw)
    );

    if (hasKeyword) {
      seen.add(fullUrl);
      links.push(fullUrl);
    }
  });

  return links.slice(0, MAX_DETAIL_LINKS);
}

// ─── Source ID ────────────────────────────────────────────────────────────────

function makeSourceId(sourceId, job) {
  const key = `${sourceId}::${job.title}::${job.location_city}::${job.start_date}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

// ─── Scrape de una fuente ─────────────────────────────────────────────────────

async function scrapeSource(source) {
  console.log(`\n[web] Scrapeando: ${source.name}`);

  const html = await fetchHtml(source.url);
  if (!html) {
    console.warn(`[web] Sin respuesta de ${source.name}`);
    return 0;
  }

  // 1. JSON-LD — datos estructurados gratuitos
  const jsonLdItems = extractJsonLd(html);
  const jsonLdText = jsonLdItems.length > 0
    ? `\n\n=== DATOS ESTRUCTURADOS (JSON-LD) ===\n${jsonLdItems.map(jsonLdToText).join('\n---\n')}`
    : '';

  if (jsonLdItems.length > 0) {
    console.log(`[web] ${jsonLdItems.length} items JSON-LD encontrados en ${source.name}`);
  }

  // 2. Texto de la página principal
  const mainText = cleanHtml(html, source.url);
  const htmlContacts = extractContactsFromHtml(html);

  // 3. Seguir links a páginas de detalle (más info por oferta)
  const detailLinks = source.followLinks !== false
    ? extractJobDetailLinks(html, source.url)
    : [];

  const detailTexts = [];
  const detailLinkMap = []; // { link, text } — used to find best source_url per job
  for (const link of detailLinks) {
    await sleep(800 + Math.random() * 700);
    const detailHtml = await fetchHtml(link);
    if (!detailHtml) continue;

    const detailContacts = extractContactsFromHtml(detailHtml);
    const detailJsonLd = extractJsonLd(detailHtml);
    const text = cleanHtml(detailHtml, link);

    if (text.length > 150) {
      const contactsStr = detailContacts.length > 0 ? ` [Contactos: ${detailContacts.join(', ')}]` : '';
      const jsonStr = detailJsonLd.length > 0 ? `\n${detailJsonLd.map(jsonLdToText).join('\n')}` : '';
      // Hint the AI to use this URL as contact_url/source_url for the job on this page
      detailTexts.push(`\n--- DETALLE (URL_DIRECTA: ${link})${contactsStr} ---\nUSA "${link}" como contact_url para el trabajo en esta página si no hay otro link de postulación.\n${text.slice(0, 3000)}${jsonStr}`);
      detailLinkMap.push({ link, text: text.slice(0, 500) });
      console.log(`[web]   ↳ ${link.slice(0, 80)}`);
    }
  }

  // 4. Armar texto final combinado
  const contactsHint = htmlContacts.length > 0
    ? ` | Contactos HTML: ${htmlContacts.join(', ')}`
    : '';

  const combinedText = [
    mainText.slice(0, 4000),
    ...detailTexts,
    jsonLdText,
  ].join('\n').trim();

  if (combinedText.length < 100) {
    console.warn(`[web] Contenido muy corto en ${source.name}, saltando`);
    return 0;
  }

  const context = `${source.name} (${source.category}) — URL: ${source.url}${contactsHint}`;
  const jobs = await extractJobsFromText(combinedText, context);

  if (!jobs.length) {
    console.log(`[web] Sin trabajos encontrados en ${source.name}`);
    return 0;
  }

  console.log(`[web] ${jobs.length} trabajos encontrados en ${source.name}`);

  let saved = 0;
  for (const job of jobs) {
    if (!job.title || job.title.length < 5) continue;

    const sourceId = makeSourceId(source.id, job);
    if (await jobExists(sourceId)) continue;

    // If AI didn't extract a contact_url, try to match to a detail page
    if (!job.contact_url && detailLinkMap.length > 0) {
      const titleLower = job.title.toLowerCase().slice(0, 40);
      const match = detailLinkMap.find(({ text }) =>
        titleLower.split(' ').filter(w => w.length > 4).some(w => text.toLowerCase().includes(w))
      );
      if (match) job.contact_url = match.link;
      else if (detailLinkMap.length === 1) job.contact_url = detailLinkMap[0].link;
    }

    const ok = await saveJob({
      job,
      sourceId,
      sourceName: source.name,
      sourceUrl: job.contact_url || source.url,
      rawText: combinedText.slice(0, 500),
    });

    if (ok) saved++;
  }

  console.log(`[web] ✓ ${saved} trabajos nuevos guardados de ${source.name}`);
  return saved;
}

// ─── Runner principal ─────────────────────────────────────────────────────────

export async function runWebScraper(options = {}) {
  const { onlyPriority } = options;

  const sources = onlyPriority
    ? CIRCUS_SOURCES.filter(s => s.priority === 1)
    : [...CIRCUS_SOURCES].sort((a, b) => a.priority - b.priority);

  console.log(`\n======================================`);
  console.log(`[web] Iniciando scraping de ${sources.length} fuentes (max ${MAX_DETAIL_LINKS} links/fuente)`);
  console.log(`======================================`);

  let totalNew = 0;

  for (const source of sources) {
    try {
      const newJobs = await scrapeSource(source);
      totalNew += newJobs;
    } catch (err) {
      console.error(`[web] Error en ${source.name}:`, err.message);
    }

    // Pausa entre fuentes
    await sleep(2000 + Math.random() * 2000);
  }

  console.log(`\n[web] ✅ Scraping web completado. Total trabajos nuevos: ${totalNew}`);
  return totalNew;
}
