/**
 * Reenvía el email de confirmación a usuarios que se registraron pero no confirmaron.
 *
 * Uso:
 *   node scripts/resend-confirmation.mjs           → modo preview (solo muestra)
 *   node scripts/resend-confirmation.mjs --send    → reenvía los emails
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
    ? 'PREVIEW — usá --send para reenviar\n'
    : 'Reenviando emails de confirmación...\n'
  );

  // Listar todos los usuarios
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Filtrar los no confirmados
  const unconfirmed = users.filter(u => !u.email_confirmed_at && u.email);

  if (!unconfirmed.length) {
    console.log('No hay usuarios sin confirmar.');
    return;
  }

  console.log(`${unconfirmed.length} usuario(s) sin confirmar:\n`);

  let sent = 0;
  for (const user of unconfirmed) {
    const since = Math.round((Date.now() - new Date(user.created_at).getTime()) / 3600000);
    console.log(`  ${user.email} (registrado hace ${since}h)`);

    if (DRY_RUN) continue;

    try {
      const { error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: user.email,
        options: { redirectTo: 'https://artnet-circus.vercel.app' },
      });

      if (linkError) {
        console.error(`  ❌ Error con ${user.email}: ${linkError.message}`);
        continue;
      }

      console.log(`  ✅ Email de confirmación reenviado a ${user.email}`);
      sent++;

      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`  ❌ ${user.email}: ${err.message}`);
    }
  }

  if (!DRY_RUN) console.log(`\n✅ ${sent}/${unconfirmed.length} emails reenviados.`);
  else console.log(`\nEjecutá con --send para reenviar.`);
}

main().catch(err => { console.error(err); process.exit(1); });
