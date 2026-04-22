/**
 * /api/archive-jobs — Cron job to archive expired scraped jobs
 *
 * Runs daily via Vercel Cron. No auth required (Vercel signs cron requests).
 *
 * Criteria:
 *  1. deadline exists and has passed → archive
 *  2. end_date expired more than 14 days ago → archive
 *  3. No deadline, no end_date, no start_date, scraped more than 90 days ago → archive
 *
 * Exception: jobs with seasonal keywords (Navidad, Año Nuevo, Carnaval, etc.)
 * are kept visible until their grace date even if they'd otherwise be archived.
 */

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

/**
 * Returns the "safe until" date for seasonal jobs, or null if not seasonal.
 */
function getSeasonalSafeUntil(title = '', description = '', today) {
  const text = `${title} ${description}`.toLowerCase();

  // Navidad / Año Nuevo / Reyes
  if (/navidad|navideñ|christmas|xmas|año nuevo|new year|nochevieja|reyes\s*mag|epifan/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (m >= 10) return new Date(y + 1, 0, 10); // nov/dic → 10 ene siguiente
    if (m === 0)  return new Date(y,     0, 10); // enero → 10 ene mismo año
  }

  // Halloween / Día de los Muertos
  if (/halloween|día de (los )?muertos|dia de (los )?muertos|all saints|all hallows/i.test(text)) {
    const y = today.getFullYear();
    const m = today.getMonth();
    if (m === 9 || m === 10) return new Date(y, 10, 5); // 5 nov
  }

  // Semana Santa / Pascua
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const headers = {
    'apikey':        SUPABASE_SERVICE,
    'Authorization': `Bearer ${SUPABASE_SERVICE}`,
    'Content-Type':  'application/json',
  };

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff14 = new Date(today.getTime() - 14 * 86400000).toISOString();
  const cutoff90 = new Date(today.getTime() - 90 * 86400000).toISOString();
  const todayISO = today.toISOString();

  // Fetch candidates with title+description to check seasonal keywords
  async function queryCandidates(params) {
    const url = `${SUPABASE_URL}/rest/v1/scraped_jobs?${params}&select=id,title,description`;
    const r = await fetch(url, { headers });
    if (!r.ok) return [];
    return (await r.json()) ?? [];
  }

  function filterOutSeasonal(candidates) {
    return candidates
      .filter(j => {
        const safeUntil = getSeasonalSafeUntil(j.title, j.description, today);
        if (safeUntil && today <= safeUntil) return false; // keep
        return true; // archive
      })
      .map(j => j.id);
  }

  // 1. Expired deadline
  const deadlineCandidates = await queryCandidates(
    'status=eq.published&deadline=not.is.null&deadline=lt.' + todayISO
  );
  const deadlineIds = filterOutSeasonal(deadlineCandidates);

  // 2. end_date expired > 14 days ago
  const endDateCandidates = await queryCandidates(
    'status=eq.published&end_date=not.is.null&end_date=lt.' + cutoff14
  );
  const endDateIds = filterOutSeasonal(endDateCandidates);

  // 3. No dates at all, scraped > 90 days ago
  const staleCandidates = await queryCandidates(
    'status=eq.published&deadline=is.null&end_date=is.null&start_date=is.null&scraped_at=lt.' + cutoff90
  );
  const staleIds = filterOutSeasonal(staleCandidates);

  const uniqueIds = [...new Set([...deadlineIds, ...endDateIds, ...staleIds])];

  if (uniqueIds.length === 0) {
    return res.status(200).json({ archived: 0, message: 'Nothing to archive' });
  }

  // Batch update in groups of 50 to avoid URL length limits
  const batchSize = 50;
  let archived = 0;
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch  = uniqueIds.slice(i, i + batchSize);
    const idList = batch.map(id => `"${id}"`).join(',');
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/scraped_jobs?id=in.(${idList})`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'archived' }),
      }
    );
    if (r.ok) archived += batch.length;
  }

  console.log(`[archive-jobs] Archived ${archived} jobs`);
  return res.status(200).json({ archived, ids: uniqueIds });
}
