/**
 * ArtNet — Gmail → Supabase automático
 * Google Apps Script (gratuito, corre en los servidores de Google)
 *
 * SETUP (5 minutos):
 * 1. Ir a https://script.google.com con la cuenta artnetcircus@gmail.com
 * 2. "Nuevo proyecto" → seleccionar todo el contenido y reemplazar con este código
 * 3. En el menú izquierdo "Configuración del proyecto" → Propiedades de script → agregar:
 *      GROQ_KEY       → tu clave de Groq (gratis en console.groq.com → API Keys)
 *      SUPABASE_URL   → https://xxxx.supabase.co
 *      SUPABASE_KEY   → service_role key de Supabase
 * 4. Ejecutar processNewEmails() una vez manualmente para autorizar permisos de Gmail
 * 5. Triggers → "Agregar trigger" → processNewEmails → una vez por día
 *
 * FLUJO:
 * - Lee todos los emails nuevos (la cuenta es exclusiva para ArtNet)
 * - Si el email contiene un link de Instagram/Facebook/TikTok/YouTube:
 *     → intenta fetchear el contenido público (og: tags)
 *     → si es privado o falla → pending_review con el link guardado
 *     → si es público → analiza con Groq
 * - Alta confianza → publica directo en la app
 * - Baja confianza → va a pending_review (lo ves en el panel de admin)
 * - No es circo → ignora y archiva
 * - Marca cada email procesado con la etiqueta "artnet-procesado"
 */

const LABEL_PROCESSED = 'artnet-procesado';
const LABEL_PENDING   = 'artnet-pendiente';

// ─── Main ──────────────────────────────────────────────────────────────────

function processNewEmails() {
  const groqKey     = PropertiesService.getScriptProperties().getProperty('GROQ_KEY');
  const supabaseUrl = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
  const supabaseKey = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');

  if (!groqKey || !supabaseUrl || !supabaseKey) {
    console.error('Faltan propiedades de script. Revisá GROQ_KEY, SUPABASE_URL, SUPABASE_KEY');
    return;
  }

  ensureLabel(LABEL_PROCESSED);
  ensureLabel(LABEL_PENDING);

  const query = `-(label:${LABEL_PROCESSED}) -(label:${LABEL_PENDING})`;
  const threads = GmailApp.search(query, 0, 20);
  console.log(`Emails sin procesar: ${threads.length}`);

  for (const thread of threads) {
    try {
      processThread(thread, groqKey, supabaseUrl, supabaseKey);
    } catch (err) {
      console.error('Error procesando email:', err.message);
    }
    Utilities.sleep(1200);
  }
}

// ─── Procesar un thread ─────────────────────────────────────────────────────

// Dominios y patrones a ignorar silenciosamente (sin notificar a nadie)
const SKIP_SENDERS = [
  'no-reply@', 'noreply@', 'mailer-daemon@', 'postmaster@',
  '@accounts.google.com', '@google.com', '@googlemail.com',
  '@facebookmail.com', '@instagram.com', '@notifications.',
  'bounce', 'automated', 'donotreply',
];

function isSystemEmail(from) {
  const f = from.toLowerCase();
  return SKIP_SENDERS.some(pattern => f.includes(pattern));
}

function processThread(thread, groqKey, supabaseUrl, supabaseKey) {
  const messages = thread.getMessages();
  const msg = messages[messages.length - 1];

  const subject  = msg.getSubject();
  const from     = msg.getFrom();
  const body     = msg.getPlainBody().slice(0, 3000);
  const sourceId = `gmail::${Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    msg.getId()
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('')}`;

  console.log(`Procesando: "${subject}" de ${from}`);

  // Ignorar emails automáticos/de sistema sin notificar a nadie
  if (isSystemEmail(from)) {
    console.log('Email de sistema → ignorando silenciosamente');
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    thread.moveToArchive();
    return;
  }

  // ── Detectar link de red social ──────────────────────────────────────────
  const socialUrl = extractSocialUrl(body + ' ' + subject);

  if (socialUrl) {
    console.log(`Link social detectado: ${socialUrl}`);
    const social = fetchSocialContent(socialUrl);

    if (!social) {
      // Link privado o de grupo → pending_review con el link guardado
      console.log('Contenido privado o inaccesible → pending_review');
      const title = subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Posible audición (link privado)';
      const result = saveToSupabase({
        sourceId, subject: title, from,
        body: body.trim() || `Link enviado: ${socialUrl}`,
        sourceUrl: socialUrl,
        status: 'pending_review',
        supabaseUrl, supabaseKey,
      });
      if (result.ok) {
        notifyBoth('private_link', title, result.id, extractEmail(from), socialUrl);
        labelAndArchive(thread, 'pending_review');
      }
      return;
    }

    // Link público → analizar con Groq
    const textToAnalyze = `Asunto: ${subject}\nDe: ${from}\n\nTítulo: ${social.title}\nDescripción: ${social.description}\n\nLink: ${socialUrl}`;
    const aiResult = validateWithGroq(textToAnalyze, groqKey);
    console.log(`Resultado IA (social): circus=${aiResult.isCircus}, confidence=${aiResult.confidence}`);

    if (!aiResult.isCircus && aiResult.confidence !== 'low') {
      console.log('No es circo → archivando y notificando');
      notifyBoth('not_circus', subject, null, extractEmail(from), null);
      thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
      thread.moveToArchive();
      return;
    }

    const status = (aiResult.isCircus && aiResult.confidence === 'high') ? 'published' : 'pending_review';
    const title  = social.title || subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Audición sin título';
    const saved  = saveToSupabase({
      sourceId, subject: title, from,
      body: social.description || body.trim(),
      sourceUrl: socialUrl,
      flyerUrl: social.image || null,
      status, supabaseUrl, supabaseKey,
    });
    if (saved.ok) {
      notifyBoth(status, title, saved.id, extractEmail(from), null);
      labelAndArchive(thread, status);
    }
    return;
  }

  // ── Email de texto normal ────────────────────────────────────────────────
  const fullText = `Asunto: ${subject}\nDe: ${from}\n\n${body}`;
  const result   = validateWithGroq(fullText, groqKey);
  console.log(`Resultado IA: circus=${result.isCircus}, confidence=${result.confidence}`);

  if (!result.isCircus && result.confidence !== 'low') {
    console.log('No es circo → archivando y notificando');
    notifyBoth('not_circus', subject, null, extractEmail(from), null);
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    thread.moveToArchive();
    return;
  }

  const status = (result.isCircus && result.confidence === 'high') ? 'published' : 'pending_review';
  const saved  = saveToSupabase({
    sourceId, subject, from, body,
    sourceUrl: null, flyerUrl: null,
    status, supabaseUrl, supabaseKey,
  });
  if (saved.ok) {
    notifyBoth(status, subject, saved.id, extractEmail(from), null);
    labelAndArchive(thread, status);
  }
}

// ─── Detectar URLs de redes sociales ─────────────────────────────────────────

function extractSocialUrl(text) {
  const patterns = [
    /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?/,
    /https?:\/\/(?:www\.)?facebook\.com\/[^\s<>"]+/,
    /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s<>"]+\/video\/\d+/,
    /https?:\/\/(?:www\.)?youtube\.com\/(?:watch|shorts)[^\s<>"]+/,
    /https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/[.,;)]+$/, ''); // limpiar puntuación final
  }
  return null;
}

// ─── Fetchear contenido público via og: tags ──────────────────────────────────

function fetchSocialContent(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    const code = res.getResponseCode();
    const finalUrl = res.getHeaders()['Location'] || url;

    // Si redirige a login → privado
    if (code !== 200 || finalUrl.includes('/login') || finalUrl.includes('/accounts/login')) {
      console.log(`Acceso denegado (${code}) → privado`);
      return null;
    }

    const html = res.getContentText().slice(0, 50000);

    // Instagram a veces retorna 200 pero muestra login wall
    if (html.includes('"loginPage"') || html.includes('Log in to Instagram')) {
      console.log('Login wall detectado → privado');
      return null;
    }

    const title       = ogTag(html, 'og:title')       || metaTag(html, 'title') || '';
    const description = ogTag(html, 'og:description') || metaTag(html, 'description') || '';
    const image       = ogTag(html, 'og:image')       || '';

    if (!title && !description) return null; // no se pudo extraer nada útil

    console.log(`Contenido público: "${title.slice(0, 60)}"`);
    return { title: title.slice(0, 200), description: description.slice(0, 1000), image };
  } catch (e) {
    console.warn('fetchSocialContent error:', e.message);
    return null;
  }
}

function ogTag(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return '';
}

function metaTag(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

function validateWithGroq(text, apiKey) {
  try {
    const payload = {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content:
`Sos un filtro para una plataforma de trabajos de circo y artes acrobáticas.
Analizá el texto y determiná:
1. ¿Es una oferta/audición/casting para artistas de CIRCO, acrobacia, varieté, clown, aéreos, malabares?
2. Nivel de confianza.
SÍ: acróbatas, aéreos, clowns, malabaristas, cruceros buscando entertainers, dinner shows.
NO: danza, ballet, teatro dramático, música, yoga, fitness.
Respondé SOLO con JSON: {"is_circus": true/false, "confidence": "high"/"medium"/"low", "reason": "breve"}

TEXTO:
${text.slice(0, 2000)}`
      }],
    };

    const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      console.error('Groq HTTP error:', res.getResponseCode());
      return { isCircus: true, confidence: 'low' };
    }

    const data   = JSON.parse(res.getContentText());
    const raw    = data.choices?.[0]?.message?.content ?? '';
    const match  = raw.match(/\{[\s\S]*\}/);
    if (!match) return { isCircus: true, confidence: 'low' };
    const parsed = JSON.parse(match[0]);
    return { isCircus: !!parsed.is_circus, confidence: parsed.confidence ?? 'low' };
  } catch (e) {
    console.error('Error Groq:', e.message);
    return { isCircus: true, confidence: 'low' };
  }
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function saveToSupabase({ sourceId, subject, from, body, sourceUrl, flyerUrl, status, supabaseUrl, supabaseKey }) {
  try {
    const payload = {
      source_id:     sourceId,
      source_name:   'email',
      source_url:    sourceUrl || '',
      title:         subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim().slice(0, 120),
      description:   body.trim(),
      contact_email: extractEmail(from),
      flyer_url:     flyerUrl || null,
      status,
      is_scraped:    false,
      scraped_at:    new Date().toISOString(),
    };

    const res = UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/scraped_jobs`, {
      method: 'post',
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation', // devuelve el registro creado
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code === 409) { console.log('Ya existe → saltando'); return { ok: true, id: null }; }
    if (code !== 201) return { ok: false, id: null };

    try {
      const created = JSON.parse(res.getContentText());
      const id = Array.isArray(created) ? created[0]?.id : created?.id;
      return { ok: true, id: id ?? null };
    } catch {
      return { ok: true, id: null };
    }
  } catch (e) {
    console.error('Error Supabase:', e.message);
    return { ok: false, id: null };
  }
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'circusworldlife@gmail.com';
const APP_URL     = 'https://artnet-circus.vercel.app';

/**
 * Notifica al ADMIN y al REMITENTE sobre el resultado del procesamiento.
 *
 * status:
 *   'published'      → publicada automáticamente
 *   'pending_review' → necesita revisión manual
 *   'not_circus'     → descartada (no era circo)
 *   'private_link'   → link privado/de grupo, necesita revisión con el texto completo
 */
function notifyBoth(status, jobTitle, jobId, fromEmail, extraInfo) {
  notifyAdmin(status, jobTitle, jobId, fromEmail, extraInfo);
  notifySender(status, jobTitle, jobId, fromEmail, extraInfo);
}

// ── Notificación al admin ─────────────────────────────────────────────────────

function notifyAdmin(status, jobTitle, jobId, fromEmail, extraInfo) {
  try {
    const jobUrl = jobId ? `${APP_URL}/jobs/${jobId}` : null;
    let subject, body;

    if (status === 'published') {
      subject = `✅ ArtNet publicó automáticamente — ${jobTitle}`;
      body =
`Nueva convocatoria publicada automáticamente.

Título:      ${jobTitle}
Enviada por: ${fromEmail || 'desconocido'}
Ver en app:  ${jobUrl || APP_URL}

Si los datos están mal o hay info incompleta, podés editarla directamente en la app.

— ArtNet Bot`;

    } else if (status === 'pending_review') {
      subject = `👀 ArtNet — revisión pendiente: ${jobTitle}`;
      body =
`Hay una convocatoria esperando tu revisión.

Título:      ${jobTitle}
Enviada por: ${fromEmail || 'desconocido'}
${extraInfo ? `Motivo:      ${extraInfo}\n` : ''}
Para aprobar o rechazar:
→ Abrí la app con circusworldlife@gmail.com: ${APP_URL}
→ Vas a ver el banner naranja "X publicaciones pendientes" arriba del feed
→ Expandilo y usá los botones ✓ Publicar / ✕ Eliminar

— ArtNet Bot`;

    } else if (status === 'private_link') {
      subject = `🔒 ArtNet — link privado, revisión manual: ${jobTitle}`;
      body =
`Se recibió un link que no se pudo procesar automáticamente (era privado o requería login).

Título/Asunto: ${jobTitle}
Enviada por:   ${fromEmail || 'desconocido'}
${extraInfo ? `Link:          ${extraInfo}\n` : ''}
Opciones:
1. Abrí el link manualmente y copiá el texto de la convocatoria
2. Respondé al email original con el texto completo para que la IA lo procese
3. Publicala manualmente desde la app: ${APP_URL}

También aparece en la app como pendiente de revisión.

— ArtNet Bot`;

    } else {
      // not_circus
      subject = `❌ ArtNet — descartada (no circo): ${jobTitle}`;
      body =
`Se descartó un email porque la IA determinó que no es una convocatoria de circo.

Título/Asunto: ${jobTitle}
Enviada por:   ${fromEmail || 'desconocido'}

Si creés que fue un error, buscá el email en artnetcircus@gmail.com
(etiqueta: artnet-procesado) y reenvialo con más contexto.

— ArtNet Bot`;
    }

    GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
    console.log(`📧 Admin notificado (${status}): ${subject}`);
  } catch (e) {
    console.warn('[notify] No se pudo notificar al admin:', e.message);
  }
}

// ── Notificación al remitente ─────────────────────────────────────────────────

function notifySender(status, jobTitle, jobId, fromEmail, extraInfo) {
  if (!fromEmail || fromEmail === ADMIN_EMAIL) return;
  try {
    const jobUrl = jobId ? `${APP_URL}/jobs/${jobId}` : null;
    const footer = `\n\n-- \nArtNet · artnetcircus@gmail.com`;
    let subject, body;

    if (status === 'published') {
      subject = `Gracias por compartir con ArtNet`;
      body =
`Hola,

Gracias por enviarnos la convocatoria, ya esta visible en la app para toda la comunidad.
${jobUrl ? `\nPodés verla aca: ${jobUrl}` : ''}

Seguí compartiendo, cada aporte ayuda a la comunidad circense.${footer}`;

    } else if (status === 'pending_review' || status === 'private_link') {
      subject = `Gracias por compartir con ArtNet`;
      body =
`Hola,

Gracias por enviarnos la convocatoria, la estamos revisando y la publicamos a la brevedad.

Seguí compartiendo las que encuentres, son muy valiosas para la comunidad.${footer}`;

    } else {
      // not_circus — no notificar, silencio total
      return;
    }

    GmailApp.sendEmail(fromEmail, subject, body);
    console.log(`📧 Remitente notificado (${status}): ${fromEmail}`);
  } catch (e) {
    console.warn('[notify] No se pudo notificar al remitente:', e.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelAndArchive(thread, status) {
  thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
  if (status === 'pending_review') {
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PENDING));
  }
  thread.moveToArchive();
}

function extractEmail(from) {
  const m = from.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return m ? m[0] : null;
}

function ensureLabel(name) {
  if (!GmailApp.getUserLabelByName(name)) {
    GmailApp.createLabel(name);
  }
}
