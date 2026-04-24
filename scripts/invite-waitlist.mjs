/**
 * Procesa la lista de espera: crea el usuario en Supabase y le manda
 * el email de confirmación original (igual al del registro normal).
 *
 * Uso:
 *   node scripts/invite-waitlist.mjs           → modo preview (solo muestra)
 *   node scripts/invite-waitlist.mjs --send    → procesa y envía
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const DRY_RUN = !process.argv.includes('--send');

async function main() {
  console.log(DRY_RUN
    ? 'PREVIEW — usá --send para procesar\n'
    : 'Procesando lista de espera...\n'
  );

  const { data: pending, error } = await supabase
    .from('waitlist')
    .select('id, email, role, created_at')
    .is('notified_at', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('Error:', error.message); process.exit(1); }
  if (!pending?.length) { console.log('No hay nadie en la lista de espera.'); return; }

  console.log(`${pending.length} persona(s) en lista de espera:\n`);

  let sent = 0;
  for (const entry of pending) {
    const espera = Math.round((Date.now() - new Date(entry.created_at).getTime()) / 3600000);
    console.log(`  ${entry.email} (rol: ${entry.role}, esperando ${espera}h)`);

    if (DRY_RUN) continue;

    try {
      // Primero crear el usuario si no existe
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const exists = existingUsers?.users?.find(u => u.email === entry.email);

      if (!exists) {
        // Crear usuario sin contraseña — la setea cuando confirma el email
        await supabase.auth.admin.createUser({
          email: entry.email,
          email_confirm: false,
          user_metadata: { role: entry.role },
        });
      }

      // Mandar el email de confirmación original de Supabase
      const { error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: entry.email,
        options: { redirectTo: 'https://artnet-circus.vercel.app' },
      });

      if (linkError) {
        console.error(`  ❌ Error con ${entry.email}: ${linkError.message}`);
        continue;
      }

      // Marcar como notificado
      await supabase
        .from('waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      console.log(`  ✅ Email de confirmación enviado a ${entry.email}`);
      sent++;

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ❌ ${entry.email}: ${err.message}`);
    }
  }

  if (!DRY_RUN) console.log(`\n✅ ${sent}/${pending.length} emails enviados.`);
  else console.log(`\nEjecutá con --send para procesar la lista.`);
}

main().catch(err => { console.error(err); process.exit(1); });
