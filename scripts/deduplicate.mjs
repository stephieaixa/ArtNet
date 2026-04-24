/**
 * Limpieza de duplicados existentes en Supabase
 *
 * Uso:
 *   node scripts/deduplicate.mjs          → modo preview (solo muestra, no borra)
 *   node scripts/deduplicate.mjs --delete  → borra los duplicados
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const DRY_RUN = !process.argv.includes('--delete');

// ─── Normalización de títulos ─────────────────────────────────────────────────

const STOPWORDS = new Set([
  'de','la','el','los','las','un','una','para','en','con','que','por',
  'se','busca','buscan','buscamos','the','and','for','with','in','of',
  'a','an','to','is','are','we','our','looking','needed','artistas',
  'artista','performers','performer','show','shows','trabajo','trabajos',
  'job','jobs','casting','audicion','audición','audition',
]);

function normalizeTitle(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .sort()
    .join(' ');
}

function jaccardSimilarity(a, b) {
  const wordsA = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN
    ? '🔍 MODO PREVIEW — no se borra nada. Usá --delete para borrar.\n'
    : '🗑️  MODO BORRADO — eliminando duplicados...\n'
  );

  // Traer todos los jobs publicados
  const { data: jobs, error } = await supabase
    .from('scraped_jobs')
    .select('id, title, location_country, scraped_at, source_name')
    .in('status', ['published', 'pending_review'])
    .order('scraped_at', { ascending: false }); // el más nuevo es el "original" (menos probable de expirar)

  if (error) { console.error('Error al traer jobs:', error.message); process.exit(1); }

  console.log(`Total de jobs: ${jobs.length}`);

  const toDelete = new Set();
  const groups = []; // para mostrar los grupos de duplicados

  for (let i = 0; i < jobs.length; i++) {
    if (toDelete.has(jobs[i].id)) continue;

    const duplicatesOfI = [];

    for (let j = i + 1; j < jobs.length; j++) {
      if (toDelete.has(jobs[j].id)) continue;

      // Solo comparar si mismo país (o alguno sin país)
      const sameCountry =
        !jobs[i].location_country || !jobs[j].location_country ||
        jobs[i].location_country === jobs[j].location_country;

      if (!sameCountry) continue;

      const sim = jaccardSimilarity(jobs[i].title, jobs[j].title);
      if (sim >= 0.45) {
        toDelete.add(jobs[j].id);
        duplicatesOfI.push({ sim: (sim * 100).toFixed(0), job: jobs[j] });
      }
    }

    if (duplicatesOfI.length > 0) {
      groups.push({ original: jobs[i], duplicates: duplicatesOfI });
    }
  }

  if (groups.length === 0) {
    console.log('✅ No se encontraron duplicados.');
    return;
  }

  console.log(`\n⚠️  ${toDelete.size} duplicados encontrados en ${groups.length} grupos:\n`);

  for (const { original, duplicates } of groups) {
    console.log(`ORIGINAL: "${original.title}" [${original.location_country ?? '?'}] (${original.source_name})`);
    for (const { sim, job } of duplicates) {
      console.log(`  ${sim}% similar → BORRAR: "${job.title}" [${job.location_country ?? '?'}] (${job.source_name}) id=${job.id}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log(`\nEjecutá con --delete para borrar estos ${toDelete.size} duplicados.`);
    return;
  }

  // Borrar en lotes de 50
  const ids = [...toDelete];
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { error: delError } = await supabase
      .from('scraped_jobs')
      .delete()
      .in('id', batch);
    if (delError) console.error('Error borrando:', delError.message);
    else deleted += batch.length;
  }

  console.log(`\n✅ Eliminados ${deleted} duplicados.`);
}

main().catch(err => { console.error(err); process.exit(1); });
