/**
 * Enriquecimiento de empresas — busca en Google info real de cada venue
 *
 * Para cada job recién scrapeado que tenga venue_name pero sin contact_email
 * ni contact_url, hace una búsqueda y completa los datos.
 *
 * Usa SERPER_KEY (mismo que googleSearch.js) + GROQ_KEY para parsear resultados.
 */
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Cache en memoria para no buscar la misma empresa dos veces en una corrida
const enrichedVenues = new Set();

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Busca info de una empresa en Google via Serper
 */
async function searchCompany(venueName) {
  const key = process.env.SERPER_KEY;
  if (!key) return [];

  const queries = [
    `"${venueName}" casting audition contact email`,
    `"${venueName}" site:official OR site:web casting performers`,
  ];

  const results = [];
  for (const q of queries) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'us', hl: 'en', num: 5 }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      results.push(...(data.organic ?? []));
    } catch { /* ignore */ }
    await sleep(300);
  }
  return results;
}

/**
 * Usa Groq para extraer info de contacto de los resultados de búsqueda
 */
async function extractContactFromSearch(venueName, searchResults) {
  const key = process.env.GROQ_KEY_2 || process.env.GROQ_KEY;
  if (!key || !searchResults.length) return null;

  const resultsText = searchResults
    .slice(0, 6)
    .map(r => `TÍTULO: ${r.title}\nURL: ${r.link}\nSNIPPET: ${r.snippet}`)
    .join('\n---\n');

  const prompt = `Empresa de artes escénicas/circo: "${venueName}"

Resultados de búsqueda web:
${resultsText}

Extraé la siguiente información sobre esta empresa. Respondé SOLO con JSON válido:
{
  "website": "URL oficial de la empresa (no un job board)",
  "casting_url": "URL específica de su página de casting/audiciones/careers (si existe)",
  "contact_email": "email directo para enviar CV o postularse (no genérico como info@)",
  "instagram": "handle de Instagram sin @ (si aparece)",
  "description": "1-2 frases sobre qué hace la empresa",
  "confidence": "high|medium|low"
}

Si no encontrás un campo con seguridad, ponelo como string vacío "".
NO inventes URLs ni emails. Solo usá lo que aparece en los resultados.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch { return null; }
}

/**
 * Enriquece los jobs recientes que tengan venue_name pero les falte info de contacto.
 * Corre después del scraping principal.
 */
export async function runEnrichment() {
  const key = process.env.SERPER_KEY;
  if (!key) {
    console.log('\n[enrich] ⚠️  Sin SERPER_KEY — enriquecimiento saltado');
    return;
  }

  console.log('\n[enrich] 🔍 Buscando jobs para enriquecer...');

  // Busca jobs de las últimas 48h con venue_name pero sin contact_email ni contact_url
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: jobs, error } = await supabase
    .from('scraped_jobs')
    .select('id, venue_name, contact_email, contact_url, source_url')
    .gte('scraped_at', cutoff)
    .or('contact_email.is.null,contact_url.is.null')
    .not('venue_name', 'is', null)
    .limit(30);

  if (error || !jobs?.length) {
    console.log('[enrich] Sin jobs para enriquecer');
    return;
  }

  // Agrupa por venue_name para no buscar la misma empresa múltiples veces
  const byVenue = {};
  for (const job of jobs) {
    const key = job.venue_name.trim().toLowerCase();
    if (!byVenue[key]) byVenue[key] = { venueName: job.venue_name, jobs: [] };
    byVenue[key].jobs.push(job);
  }

  let enriched = 0;

  for (const { venueName, jobs: venueJobs } of Object.values(byVenue)) {
    const cacheKey = venueName.toLowerCase();
    if (enrichedVenues.has(cacheKey)) continue;
    enrichedVenues.add(cacheKey);

    console.log(`[enrich] 🔎 Buscando: "${venueName}"`);

    const results = await searchCompany(venueName);
    if (!results.length) {
      console.log(`[enrich]   Sin resultados para "${venueName}"`);
      continue;
    }

    const info = await extractContactFromSearch(venueName, results);
    if (!info || info.confidence === 'low') {
      console.log(`[enrich]   Info poco confiable para "${venueName}", saltando`);
      continue;
    }

    // Construir bloque ai_insights con todo lo que encontró la IA
    const aiInsights = {};
    if (info.website) aiInsights.website = info.website;
    if (info.casting_url) aiInsights.casting_url = info.casting_url;
    if (info.contact_email) aiInsights.contact_email = info.contact_email;
    if (info.instagram) aiInsights.instagram = info.instagram;
    if (info.description) aiInsights.description = info.description;
    // Agregar snippets relevantes de los resultados de búsqueda
    const snippets = results
      .slice(0, 3)
      .filter(r => r.snippet && r.link)
      .map(r => ({ title: r.title, url: r.link, snippet: r.snippet }));
    if (snippets.length) aiInsights.search_snippets = snippets;

    // Actualiza todos los jobs de este venue
    for (const job of venueJobs) {
      const update = {};

      if (!job.contact_email && info.contact_email) {
        update.contact_email = info.contact_email;
      }
      if (!job.contact_url && (info.casting_url || info.website)) {
        update.contact_url = info.casting_url || info.website;
      }
      if (Object.keys(aiInsights).length > 0) {
        update.ai_insights = aiInsights;
      }

      if (Object.keys(update).length > 0) {
        await supabase.from('scraped_jobs').update(update).eq('id', job.id);
        enriched++;
        console.log(`[enrich]   ✅ Job ${job.id}: contacto + ai_insights guardados`);
      }
    }

    await sleep(500); // respetar rate limits
  }

  console.log(`[enrich] ✨ ${enriched} jobs enriquecidos con info de contacto`);
  return enriched;
}
