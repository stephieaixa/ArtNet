/**
 * Guarda y deduplica trabajos en Supabase
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service role para escritura desde servidor
);

// ─── Deduplicación por contenido ─────────────────────────────────────────────

/**
 * Normaliza un título para comparación:
 * - Minúsculas, sin acentos, sin signos
 * - Elimina stopwords en español/inglés
 * - Devuelve array de palabras ordenadas
 */
function normalizeTitle(str) {
  const stopwords = new Set([
    'de','la','el','los','las','un','una','para','en','con','que','por',
    'se','busca','buscan','buscamos','para','the','and','for','with',
    'in','of','a','an','to','is','are','we','our','your','looking',
    'needed','wanted','required','artistas','artista','performers',
    'performer','show','shows','trabajo','trabajos','job','jobs',
  ]);
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .sort();
}

/**
 * Jaccard similarity entre dos títulos (0 = nada en común, 1 = idénticos).
 * Umbral recomendado: > 0.45 es probable duplicado.
 */
function titleSimilarity(a, b) {
  const setA = new Set(normalizeTitle(a));
  const setB = new Set(normalizeTitle(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Busca un job similar en los últimos 90 días (mismo país + título parecido).
 * Devuelve el id del duplicado, o null si no hay.
 */
async function findSimilarJob(title, locationCountry) {
  if (!title || title.length < 5) return null;

  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();

  // Traer jobs recientes del mismo país (o sin país si coincide)
  let query = supabase
    .from('scraped_jobs')
    .select('id, title')
    .neq('status', 'archived')
    .gte('scraped_at', cutoff);

  if (locationCountry) {
    query = query.eq('location_country', locationCountry);
  }

  const { data } = await query.limit(200);
  if (!data?.length) return null;

  for (const existing of data) {
    if (!existing.title) continue;
    const sim = titleSimilarity(title, existing.title);
    if (sim >= 0.45) {
      console.log(`[db] Duplicado detectado (sim=${sim.toFixed(2)}): "${title}" ≈ "${existing.title}"`);
      return existing.id;
    }
  }
  return null;
}

// ─── Guardar job ──────────────────────────────────────────────────────────────

/**
 * Guarda un trabajo extraído en la base de datos.
 * - Usa source_id para evitar re-insertar la misma fuente
 * - Usa similitud de título+país para detectar duplicados entre fuentes
 */
export async function saveJob({ job, sourceId, sourceName, sourceUrl, rawText }) {
  // 1. Verificar duplicado por source_id (mismo scrape)
  if (await jobExists(sourceId)) return true;

  // 2. Verificar duplicado por contenido (mismo job de otra fuente)
  const dupId = await findSimilarJob(job.title, job.location_country);
  if (dupId) {
    console.log(`[db] Saltando duplicado de contenido: "${job.title}"`);
    return false;
  }

  const record = {
    // Identificación de la fuente
    source_id:      sourceId,
    source_name:    sourceName,
    source_url:     sourceUrl,
    raw_text:       rawText?.slice(0, 2000),

    // Datos del trabajo
    title:            job.title,
    description:      job.description,
    venue_name:       job.venue_name,
    venue_type:       job.venue_type,
    location_city:    job.location_city,
    location_country: job.location_country,
    region:           job.region,
    disciplines:      job.disciplines ?? [],
    start_date:       job.start_date || null,
    end_date:         job.end_date || null,
    contact_email:    job.contact_email || null,
    contact_url:      job.contact_url || null,
    pay_info:         job.pay_info || null,
    deadline:         job.deadline || null,
    source_excerpt:   job.source_excerpt,

    // Estado
    status:     'published',
    is_scraped: true,
    scraped_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('scraped_jobs')
    .insert(record);

  if (error) {
    if (error.code === '23505') return false; // unique constraint — ya existe
    console.error('[db] Error al guardar trabajo:', error.message, '| source_id:', sourceId);
    return false;
  }

  console.log(`[db] ✅ Guardado: "${job.title}" (${job.location_country ?? 'sin país'})`);
  return true;
}

export async function jobExists(sourceId) {
  const { data } = await supabase
    .from('scraped_jobs')
    .select('id')
    .eq('source_id', sourceId)
    .maybeSingle();
  return !!data;
}

export async function getStats() {
  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('source_name, status')
    .order('scraped_at', { ascending: false });

  if (error) return null;

  const bySource = {};
  for (const row of data) {
    bySource[row.source_name] = (bySource[row.source_name] ?? 0) + 1;
  }
  return { total: data.length, bySource };
}
