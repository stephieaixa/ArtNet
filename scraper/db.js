/**
 * Guarda y deduplica trabajos en Supabase
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service role para escritura desde servidor
);

/**
 * Guarda un trabajo extraído en la base de datos.
 * Usa el source_id para evitar duplicados.
 */
export async function saveJob({ job, sourceId, sourceName, sourceUrl, rawText }) {
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
    start_date:       job.start_date,
    end_date:         job.end_date,
    contact_email:    job.contact_email,
    contact_url:      job.contact_url,
    pay_info:         job.pay_info,
    deadline:         job.deadline,
    source_excerpt:   job.source_excerpt,

    // Estado
    status:     'published',     // auto-publicado, puede cambiarse a 'pending_review'
    is_scraped: true,
    scraped_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('scraped_jobs')
    .upsert(record, { onConflict: 'source_id', ignoreDuplicates: true });

  if (error) {
    console.error('[db] Error al guardar trabajo:', error.message, '| source_id:', sourceId);
    return false;
  }
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
