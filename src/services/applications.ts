import { supabase } from './supabase';

export type ApplicationStatus = 'pending' | 'viewed' | 'accepted' | 'rejected';

export type Application = {
  id: string;
  job_id: string;
  artist_user_id: string;
  cover_message?: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  // joined
  job?: {
    id: string;
    title: string;
    venue_name?: string;
    location_city?: string;
    location_country?: string;
    user_id?: string;
  };
  artist?: {
    display_name?: string;
    bio?: string;
    disciplines?: string[];
    instagram_handle?: string;
    website_url?: string;
  };
};

/** Artist: apply to a job */
export async function applyToJob(
  jobId: string,
  coverMessage?: string
): Promise<{ data: Application | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('applications')
    .insert({ job_id: jobId, artist_user_id: user.id, cover_message: coverMessage ?? null })
    .select()
    .single();

  if (error) {
    // unique constraint violation = already applied
    if (error.code === '23505') return { data: null, error: 'already_applied' };
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

/** Artist: fetch all my applications */
export async function fetchMyApplications(): Promise<Application[]> {
  const { data } = await supabase
    .from('applications')
    .select(`
      *,
      job:scraped_jobs(id, title, venue_name, location_city, location_country, user_id)
    `)
    .order('created_at', { ascending: false });
  return (data ?? []) as Application[];
}

/** Check if current user already applied to a job */
export async function checkIfApplied(jobId: string): Promise<ApplicationStatus | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('applications')
    .select('status')
    .eq('job_id', jobId)
    .eq('artist_user_id', user.id)
    .maybeSingle();

  return (data?.status as ApplicationStatus) ?? null;
}

/** Job poster: fetch applications to their jobs */
export async function fetchApplicationsForMyJobs(): Promise<Application[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all their job IDs first
  const { data: jobs } = await supabase
    .from('scraped_jobs')
    .select('id')
    .eq('user_id', user.id);

  if (!jobs?.length) return [];
  const jobIds = jobs.map((j) => j.id);

  const { data: apps } = await supabase
    .from('applications')
    .select('*, job:scraped_jobs(id, title, venue_name, location_city, location_country, user_id)')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });

  if (!apps?.length) return [];

  // Batch-fetch artist profiles
  const artistIds = [...new Set(apps.map((a) => a.artist_user_id))];
  const { data: profiles } = await supabase
    .from('artist_profiles')
    .select('user_id, display_name, bio, disciplines, instagram_handle, website_url')
    .in('user_id', artistIds);

  const profileMap: Record<string, any> = {};
  profiles?.forEach((p) => { profileMap[p.user_id] = p; });

  return apps.map((a) => ({ ...a, artist: profileMap[a.artist_user_id] ?? null })) as Application[];
}

/** Job poster: update application status */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
): Promise<string | null> {
  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId);
  return error?.message ?? null;
}

/** Job poster: accept + open conversation */
export async function acceptApplicationAndChat(application: Application): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Update status
  await updateApplicationStatus(application.id, 'accepted');

  // 2. Check if conversation already exists
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('application_id', application.id)
    .maybeSingle();

  if (existing) return existing.id;

  // 3. Create conversation
  const { data: conv } = await supabase
    .from('conversations')
    .insert({
      application_id: application.id,
      job_id: application.job_id,
      artist_user_id: application.artist_user_id,
      other_user_id: user.id,
    })
    .select('id')
    .single();

  return conv?.id ?? null;
}
