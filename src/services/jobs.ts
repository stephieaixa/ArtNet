/**
 * Servicio para obtener trabajos de Supabase (scrapeados + manuales)
 */
import { supabase } from './supabase';
import type { FilterState } from '../components/shared/FilterModal';
import { getDisciplinesByGenre } from '../constants/disciplines';

export type ScrapedJob = {
  id: string;
  title: string;
  description: string;
  venue_name: string;
  venue_type: string;
  location_city: string;
  location_country: string;
  region: string;
  disciplines: string[];
  start_date: string;
  end_date: string;
  deadline: string;
  contact_email: string;
  contact_url: string;
  pay_info: string;
  source_name: string;
  source_url: string;
  is_scraped: boolean;
  is_featured: boolean;
  flyer_url: string | null;
  scraped_at: string;
  created_at: string;
  ai_insights?: {
    website?: string;
    casting_url?: string;
    contact_email?: string;
    instagram?: string;
    description?: string;
    search_snippets?: Array<{ title: string; url: string; snippet: string }>;
  } | null;
};

/**
 * Detecta si un job es de temporada festiva y devuelve la fecha hasta la que
 * debe mantenerse visible. Retorna null si no aplica.
 *
 * Temporadas detectadas:
 *  - Navidad / Año Nuevo / Reyes → visible hasta el 10 de enero
 *  - Semana Santa / Pascua     → visible hasta 2 semanas después de Pascua
 *  - Halloween / Día de Muertos → visible hasta el 5 de noviembre
 *  - Carnaval                   → visible hasta 1 semana después de inicio de Cuaresma
 */
function getSeasonalSafeUntil(job: { title: string; description: string }, today: Date): Date | null {
  const text = `${job.title} ${job.description}`.toLowerCase();

  // Navidad / Año Nuevo / Reyes Magos
  if (/navidad|navideñ|christmas|xmas|año nuevo|new year|nochevieja|reyes\s*mag|epifan/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-based
    // En nov/dic → safe hasta 10 ene del año siguiente
    // En enero   → safe hasta 10 ene del año en curso
    if (m >= 10) return new Date(y + 1, 0, 10);
    if (m === 0)  return new Date(y,     0, 10);
  }

  // Halloween / Día de los Muertos
  if (/halloween|día de (los )?muertos|dia de (los )?muertos|all saints|all hallows/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (m === 9 || m === 10) return new Date(y, 10, 5); // 5 nov
  }

  // Semana Santa / Pascua (Easter) — usamos fecha fija cutoff: 2 semanas después de abril 20
  if (/semana santa|pascua|easter|viernes santo|domingo de resurrecci/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (m >= 2 && m <= 3) return new Date(y, 3, 30); // ~30 abr
  }

  // Carnaval
  if (/carnaval|carnival|mardi gras/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (m >= 0 && m <= 2) return new Date(y, 1, 28); // ~28 feb
  }

  return null;
}

export async function fetchJobs(filters: FilterState, search: string): Promise<ScrapedJob[]> {
  let query = supabase
    .from('scraped_jobs')
    .select('*')
    .eq('status', 'published')
    .order('scraped_at', { ascending: false })
    .limit(100);

  if (filters.venueTypes.length > 0) {
    query = query.in('venue_type', filters.venueTypes);
  }

  if (filters.regions.length > 0) {
    query = query.in('region', filters.regions);
  }

  if (filters.countries.length > 0) {
    query = query.in('location_country', filters.countries);
  }

  // Combinar géneros (expandidos a IDs) + disciplinas específicas
  const disciplineIds = [
    ...filters.disciplines,
    ...filters.genres.flatMap(g => getDisciplinesByGenre(g)),
  ];
  if (disciplineIds.length > 0) {
    query = query.overlaps('disciplines', [...new Set(disciplineIds)]);
  }

  if (search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[jobs] Error fetching:', error.message);
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoff14 = new Date(today.getTime() - 14 * 86400000);
  const cutoff90 = new Date(today.getTime() - 90 * 86400000);
  const cutoff30 = new Date(today.getTime() - 30 * 86400000);

  let results = (data ?? []).filter(job => {
    // 1. Deadline vencido → ocultar
    if (job.deadline) {
      const d = new Date(job.deadline);
      if (!isNaN(d.getTime()) && d < today) return false;
    }
    // 2. end_date vencido hace más de 14 días → ocultar
    if (job.end_date) {
      const d = new Date(job.end_date);
      if (!isNaN(d.getTime()) && d < cutoff14) return false;
    }
    // 3. Sin deadline ni end_date → usar start_date como guía inteligente
    if (!job.deadline && !job.end_date) {
      if (job.start_date) {
        const start = new Date(job.start_date);
        if (!isNaN(start.getTime())) {
          // start_date en el futuro → siempre visible
          if (start >= today) return true;
          // start_date ya pasó → revisar si es temporada festiva
          if (start < cutoff30) {
            const safeUntil = getSeasonalSafeUntil(job, today);
            // Si hay fecha de gracia y todavía no pasó → mantener visible
            if (safeUntil && today <= safeUntil) return true;
            return false;
          }
        }
      } else {
        // Sin ninguna fecha → 90 días desde scraping (salvo temporada festiva)
        const scraped = new Date(job.scraped_at ?? job.created_at);
        if (!isNaN(scraped.getTime()) && scraped < cutoff90) {
          const safeUntil = getSeasonalSafeUntil(job, today);
          if (safeUntil && today <= safeUntil) return true;
          return false;
        }
      }
    }
    return true;
  });

  // Month filter (by start_date month)
  if (filters.months.length > 0) {
    results = results.filter(job => {
      if (!job.start_date) return true; // no date → always show
      const d = new Date(job.start_date);
      if (isNaN(d.getTime())) return true;
      return filters.months.includes(String(d.getMonth() + 1));
    });
  }

  return results;
}

/**
 * Archiva automáticamente los trabajos expirados (status → 'archived').
 * Se llama cuando el admin abre el discover screen.
 * Criterios:
 *  - deadline existe y ya pasó
 *  - end_date existe y pasó hace más de 14 días
 */
export async function archiveExpiredJobs(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff14 = new Date(today.getTime() - 14 * 86400000).toISOString();
  const cutoff90 = new Date(today.getTime() - 90 * 86400000).toISOString();

  // 1. Deadline explícito vencido → archivar
  const { data: deadlineExpired } = await supabase
    .from('scraped_jobs')
    .select('id')
    .eq('status', 'published')
    .not('deadline', 'is', null)
    .lt('deadline', today.toISOString());

  // 2. end_date vencido hace más de 14 días → archivar
  const { data: endDateExpired } = await supabase
    .from('scraped_jobs')
    .select('id')
    .eq('status', 'published')
    .not('end_date', 'is', null)
    .lt('end_date', cutoff14);

  // 3. Sin ninguna fecha, scrapeado hace más de 90 días → archivar
  const { data: staleJobs } = await supabase
    .from('scraped_jobs')
    .select('id')
    .eq('status', 'published')
    .is('deadline', null)
    .is('end_date', null)
    .is('start_date', null)
    .lt('scraped_at', cutoff90);

  // Nota: start_date solo NO se usa para archivar — un show puede
  // empezar en octubre y durar toda la temporada.

  const ids = [
    ...(deadlineExpired ?? []).map(j => j.id),
    ...(endDateExpired ?? []).map(j => j.id),
    ...(staleJobs ?? []).map(j => j.id),
  ];
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) return 0;

  await supabase
    .from('scraped_jobs')
    .update({ status: 'archived' })
    .in('id', uniqueIds);

  return uniqueIds.length;
}

export async function fetchFeaturedJobs(): Promise<ScrapedJob[]> {
  const { data } = await supabase
    .from('scraped_jobs')
    .select('*')
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('scraped_at', { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function fetchJobById(id: string): Promise<ScrapedJob | null> {
  const { data } = await supabase
    .from('scraped_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return data;
}
