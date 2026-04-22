/**
 * Vercel Cron Function — invita automáticamente a usuarios en lista de espera.
 * Se ejecuta cada noche a las 2am UTC.
 * También se puede llamar manualmente con ?secret=CRON_SECRET
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
  // Verificar autorización: Vercel cron manda el header, o se puede pasar como query param
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const secret = process.env.CRON_SECRET;

  const authorized =
    (authHeader && authHeader === `Bearer ${secret}`) ||
    (querySecret && querySecret === secret);

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: pending, error } = await supabase
    .from('waitlist')
    .select('id, email, role')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(20); // máx 20 por corrida para no saturar el rate limit de emails

  if (error) {
    console.error('[cron] Error leyendo waitlist:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!pending?.length) {
    return res.status(200).json({ sent: 0, message: 'No hay usuarios en lista de espera' });
  }

  let sent = 0;
  const errors = [];

  for (const entry of pending) {
    try {
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(entry.email, {
        data: { role: entry.role },
        redirectTo: 'https://artnet-circus.vercel.app',
      });

      if (inviteError) {
        errors.push({ email: entry.email, error: inviteError.message });
        continue;
      }

      await supabase
        .from('waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      sent++;

      // Pausa para no saturar el rate limit de emails de Supabase
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      errors.push({ email: entry.email, error: err.message });
    }
  }

  console.log(`[cron] ✅ ${sent}/${pending.length} invitaciones enviadas`);
  return res.status(200).json({ sent, total: pending.length, errors });
}
