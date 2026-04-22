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
  // ArtNet's own emails — never process these
  'artnetcircus@gmail.com', 'circusworldlife@gmail.com',
  '@supabase.io', '@supabase.co', 'supabase',
];

// Subject patterns that are clearly system/notification emails
const SKIP_SUBJECTS = [
  'confirm', 'verificá', 'verifica', 'sign up', 'registro', 'bienvenido',
  'welcome', 'password', 'contraseña', 'reset', 'audición está en revisión',
  'tu audicion', 'subscription', 'suscripción', 'invoice', 'factura',
];

function isSystemEmail(from, subject) {
  const f = from.toLowerCase();
  const s = (subject || '').toLowerCase();
  if (SKIP_SENDERS.some(pattern => f.includes(pattern))) return true;
  if (SKIP_SUBJECTS.some(pattern => s.includes(pattern))) return true;
  return false;
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
  if (isSystemEmail(from, subject)) {
    console.log('Email de sistema → ignorando silenciosamente');
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    thread.moveToArchive();
    return;
  }

  // ── Detectar imagen adjunta (screenshot, flyer) ───────────────────────────
  const attachments = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
  const imageAttachment = attachments.find(function(a) {
    return a.getContentType().startsWith('image/');
  });

  if (imageAttachment) {
    console.log('Imagen adjunta detectada → analizando con visión IA');
    const mimeType = imageAttachment.getContentType();
    const imageBytes = imageAttachment.getBytes();
    const imageBase64 = Utilities.base64Encode(imageBytes);

    // Subir imagen a Supabase Storage para que sea visible en la app
    const flyerUrl = uploadImageToSupabase(imageBytes, mimeType, sourceId, supabaseUrl, supabaseKey);
    console.log('Flyer subido:', flyerUrl);

    // Analizar imagen con IA vision
    const visionResult = analyzeImageWithVision(imageBase64, mimeType, groqKey);
    console.log(`Vision IA: circus=${visionResult.isCircus}, confidence=${visionResult.confidence}`);

    if (!visionResult.isCircus && visionResult.confidence === 'high') {
      console.log('No es circo (alta confianza) → archivando');
      notifyBoth('not_circus', subject, null, extractEmail(from), null);
      thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
      thread.moveToArchive();
      return;
    }

    const status = (visionResult.isCircus && visionResult.confidence === 'high') ? 'published' : 'pending_review';
    const title  = visionResult.extracted?.title || subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Audición (imagen)';
    console.log(`Status: ${status} — "${title}"`);

    // Guardar link directo al email para que el admin pueda verlo en Gmail
    const gmailUrl = 'https://mail.google.com/mail/u/0/#all/' + msg.getId();

    const saved = saveToSupabase({
      sourceId, subject: title, from,
      body: visionResult.extracted?.description || body.trim() || 'Ver imagen adjunta',
      sourceUrl: gmailUrl,
      flyerUrl: flyerUrl,
      status, supabaseUrl, supabaseKey,
      extracted: visionResult.extracted,
    });
    if (saved.ok) {
      notifyBoth(status, title, saved.id, extractEmail(from), null);
      labelAndArchive(thread, status);
    }
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
    const textToAnalyze = `Asunto: ${subject}\nDe: ${from}\n\nTítulo: ${social.title}\nDescripción: ${social.description}\n\nLink: ${socialUrl}\n\nCuerpo del email:\n${body}`;
    const aiResult = validateWithGroq(textToAnalyze, groqKey);
    console.log(`Resultado IA (social): circus=${aiResult.isCircus}, confidence=${aiResult.confidence}`);

    if (!aiResult.isCircus && aiResult.confidence === 'high') {
      console.log('No es circo (alta confianza) → archivando y notificando');
      notifyBoth('not_circus', subject, null, extractEmail(from), null);
      thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
      thread.moveToArchive();
      return;
    }

    // Alta confianza de que es circo → publicar directo
    // Media o baja confianza → pending_review para revisión manual
    const status = (aiResult.isCircus && aiResult.confidence === 'high') ? 'published' : 'pending_review';
    const title  = aiResult.extracted?.title || social.title || subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Audición sin título';
    console.log(`Status asignado: ${status}`);
    const saved  = saveToSupabase({
      sourceId, subject: title, from,
      body: social.description || body.trim(),
      sourceUrl: socialUrl,
      flyerUrl: social.image || null,
      status, supabaseUrl, supabaseKey,
      extracted: aiResult.extracted,
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

  if (!result.isCircus && result.confidence === 'high') {
    console.log('No es circo (alta confianza) → archivando y notificando');
    notifyBoth('not_circus', subject, null, extractEmail(from), null);
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    thread.moveToArchive();
    return;
  }

  // Alta confianza de que es circo → publicar directo; si no → pending_review
  const status = (result.isCircus && result.confidence === 'high') ? 'published' : 'pending_review';
  console.log(`Status asignado: ${status}`);
  const saved  = saveToSupabase({
    sourceId, subject, from, body,
    sourceUrl: null, flyerUrl: null,
    status, supabaseUrl, supabaseKey,
    extracted: result.extracted,
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

    const htmlLower = html.toLowerCase();

    // Detectar login walls en cualquier idioma
    const LOGIN_WALL_PATTERNS = [
      '"loginpage"', 'log in to instagram', 'log in to facebook',
      'inicia sesión en instagram', 'inicia sesi', // "inicia sesión" in Spanish
      'crea una cuenta o inicia', // "Crea una cuenta o inicia sesión"
      'create an account or log in', 'you must log in',
      'sign up to see photos', 'sign up for instagram',
      'connect with friends and the world', // Facebook login
      'log into facebook', 'facebook – log in',
    ];
    if (LOGIN_WALL_PATTERNS.some(p => htmlLower.includes(p))) {
      console.log('Login wall detectado → privado');
      return null;
    }

    const title       = ogTag(html, 'og:title')       || metaTag(html, 'title') || '';
    const description = ogTag(html, 'og:description') || metaTag(html, 'description') || '';
    const image       = ogTag(html, 'og:image')       || '';

    if (!title && !description) return null;

    // Si el título es solo el nombre de la plataforma → no hay info real
    const GENERIC_TITLES = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'x', 'whatsapp'];
    if (GENERIC_TITLES.includes(title.trim().toLowerCase())) {
      console.log('Título genérico de plataforma → tratar como privado');
      return null;
    }

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
      max_tokens: 600,
      messages: [{
        role: 'user',
        content:
`Sos un extractor de datos para una plataforma de trabajos de circo y artes acrobáticas.

Analizá el texto y respondé SOLO con JSON con esta estructura:
{
  "is_circus": true/false,
  "confidence": "high"/"medium"/"low",
  "title": "título del trabajo o null",
  "description": "descripción limpia del trabajo (máx 400 chars) o null",
  "venue_name": "nombre de la empresa/circo/crucero o null",
  "city": "ciudad o null",
  "country": "país o null",
  "disciplines": ["lista de disciplinas relevantes: aerial, trapeze, acrobatics, juggling, clown, contortion, hand_to_hand, etc."],
  "pay_info": "info de pago si se menciona o null",
  "contact_email": "email de contacto si se menciona o null"
}

SÍ es circo: acróbatas, aéreos, clowns, malabaristas, cruceros buscando entertainers, dinner shows, trapecio, telas, aro.
NO es circo: danza clásica, ballet, teatro dramático, música, yoga, fitness.

TEXTO:
${text.slice(0, 2500)}`
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
      return { isCircus: true, confidence: 'low', extracted: null };
    }

    const data   = JSON.parse(res.getContentText());
    const raw    = data.choices?.[0]?.message?.content ?? '';
    const match  = raw.match(/\{[\s\S]*\}/);
    if (!match) return { isCircus: true, confidence: 'low', extracted: null };
    const parsed = JSON.parse(match[0]);
    return {
      isCircus:   !!parsed.is_circus,
      confidence: parsed.confidence ?? 'low',
      extracted:  parsed,
    };
  } catch (e) {
    console.error('Error Groq:', e.message);
    return { isCircus: true, confidence: 'low', extracted: null };
  }
}

// ─── Groq Vision — analizar imagen ───────────────────────────────────────────

/**
 * Envía una imagen base64 a Groq Vision y extrae datos de la convocatoria.
 * Retorna el mismo shape que validateWithGroq: { isCircus, confidence, extracted }
 */
function analyzeImageWithVision(imageBase64, mimeType, groqKey) {
  try {
    const prompt =
`Analizá esta imagen. Es un screenshot o flyer de una convocatoria/audición.

Extraé los datos y respondé SOLO con JSON con esta estructura:
{
  "is_circus": true/false,
  "confidence": "high"/"medium"/"low",
  "title": "título de la convocatoria o null",
  "description": "descripción completa del trabajo (máx 400 chars) o null",
  "venue_name": "nombre del circo/empresa/crucero o null",
  "city": "ciudad o null",
  "country": "país o null",
  "disciplines": ["lista: aerial, trapeze, acrobatics, juggling, clown, contortion, hand_to_hand, etc."],
  "pay_info": "info de pago si se menciona o null",
  "contact_email": "email de contacto si aparece o null"
}

SÍ es circo: acróbatas, aéreos, clowns, malabaristas, cruceros buscando entertainers, dinner shows, trapecio, telas, aro aéreo.
NO es circo: danza clásica, ballet, teatro dramático, música, yoga, fitness.
Si la imagen no contiene texto de convocatoria, respondé con is_circus: false, confidence: "high".`;

    const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${groqKey}` },
      payload: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      console.error('Groq Vision HTTP error:', res.getResponseCode(), res.getContentText().slice(0, 200));
      return { isCircus: true, confidence: 'low', extracted: null };
    }

    const data  = JSON.parse(res.getContentText());
    const raw   = data.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { isCircus: true, confidence: 'low', extracted: null };
    const parsed = JSON.parse(match[0]);
    return {
      isCircus:   !!parsed.is_circus,
      confidence: parsed.confidence ?? 'low',
      extracted:  parsed,
    };
  } catch (e) {
    console.error('Error Groq Vision:', e.message);
    return { isCircus: true, confidence: 'low', extracted: null };
  }
}

// ─── Subir imagen con smart crop via Vercel API ───────────────────────────────

/**
 * Llama al endpoint /api/smart-crop de ArtNet:
 * - Groq Vision detecta el área del flyer (descarta UI de redes sociales)
 * - sharp recorta y reencoda la imagen
 * - Sube a Supabase Storage
 * - Retorna la URL pública, o null si falla
 */
function uploadImageToSupabase(imageBytes, mimeType, sourceId, supabaseUrl, supabaseKey) {
  const smartCropUrl = 'https://artnet-circus.vercel.app/api/smart-crop';
  try {
    const imageBase64 = Utilities.base64Encode(imageBytes);
    const res = UrlFetchApp.fetch(smartCropUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ imageBase64, mimeType, sourceId, supabaseUrl, supabaseKey }),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      console.error('smart-crop error:', code, res.getContentText().slice(0, 300));
      return null;
    }
    const data = JSON.parse(res.getContentText());
    if (data.url) {
      console.log('Imagen con smart crop subida:', data.url);
      return data.url;
    }
    console.error('smart-crop sin URL:', res.getContentText());
    return null;
  } catch (e) {
    console.error('Error en uploadImageToSupabase:', e.message);
    return null;
  }
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function saveToSupabase({ sourceId, subject, from, body, sourceUrl, flyerUrl, status, supabaseUrl, supabaseKey, extracted }) {
  try {
    const cleanTitle = (extracted?.title || subject).replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim().slice(0, 120);
    const payload = {
      source_id:        sourceId,
      source_name:      'email',
      source_url:       sourceUrl || '',
      contact_url:      sourceUrl || '',   // link visible en el detalle del trabajo
      title:            cleanTitle,
      description:      extracted?.description || body.trim(),
      venue_name:       extracted?.venue_name  || null,
      location_city:    extracted?.city        || null,
      location_country: extracted?.country     || null,
      disciplines:      extracted?.disciplines || [],
      pay_info:         extracted?.pay_info    || null,
      contact_email:    extracted?.contact_email || null,
      flyer_url:        flyerUrl || null,
      status,
      is_scraped:       false,
      scraped_at:       new Date().toISOString(),
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
