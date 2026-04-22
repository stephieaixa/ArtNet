/**
 * /api/admin-job — Admin approve / delete scraped jobs
 *
 * POST { action: 'approve' | 'delete', jobId: string }
 * Header: Authorization: Bearer <user_jwt>
 *
 * Uses service_role key → bypasses RLS entirely.
 * Verifies the caller is the admin before acting.
 */

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL     || process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL      = 'circusworldlife@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify user JWT
  const auth = req.headers.authorization ?? '';
  const jwt  = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'No token' });

  // Get user from Supabase using their JWT
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey':        SUPABASE_SERVICE,
      'Authorization': `Bearer ${jwt}`,
    },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const userData = await userRes.json();
  if (userData.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Not admin' });
  }

  // 2. Parse body
  const { action, jobId } = req.body ?? {};
  if (!jobId || !['approve', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // 3. Execute with service_role (bypasses RLS)
  const headers = {
    'apikey':        SUPABASE_SERVICE,
    'Authorization': `Bearer ${SUPABASE_SERVICE}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  };

  if (action === 'approve') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/scraped_jobs?id=eq.${jobId}`,
      { method: 'PATCH', headers, body: JSON.stringify({ status: 'published' }) }
    );
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  }

  if (action === 'delete') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/scraped_jobs?id=eq.${jobId}`,
      { method: 'DELETE', headers }
    );
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  }
}
