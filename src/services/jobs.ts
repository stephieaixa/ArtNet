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
};

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

  return data ?? [];
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
