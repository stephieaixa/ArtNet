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

  // ── Detectar link de red social ──────────────────────────────────────────
  const socialUrl = extractSocialUrl(body + ' ' + subject);

  if (socialUrl) {
    console.log(`Link social detectado: ${socialUrl}`);
    const social = fetchSocialContent(socialUrl);

    if (!social) {
      // Privado o inaccesible → pending_review con el link
      console.log('Contenido privado o inaccesible → pending_review');
      const title = subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Posible audición (link privado)';
      const saved = saveToSupabase({
        sourceId, subject: title, from,
        body: body.trim() || `Link enviado: ${socialUrl}`,
        sourceUrl: socialUrl,
        status: 'pending_review',
        supabaseUrl, supabaseKey,
      });
      if (saved) labelAndArchive(thread, 'pending_review');
      return;
    }

    // Público → analizar con Groq
    const textToAnalyze = `Asunto: ${subject}\nDe: ${from}\n\nTítulo: ${social.title}\nDescripción: ${social.description}\n\nLink: ${socialUrl}`;
    const result = validateWithGroq(textToAnalyze, groqKey);
    console.log(`Resultado IA (social): circus=${result.isCircus}, confidence=${result.confidence}`);

    if (!result.isCircus && result.confidence !== 'low') {
      console.log('No es circo → archivando');
      thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
      thread.moveToArchive();
      return;
    }

    const status = (result.isCircus && result.confidence === 'high') ? 'published' : 'pending_review';
    const title  = social.title || subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim() || 'Audición sin título';
    const saved  = saveToSupabase({
      sourceId,
      subject: title,
      from,
      body: social.description || body.trim(),
      sourceUrl: socialUrl,
      flyerUrl: social.image || null,
      status,
      supabaseUrl, supabaseKey,
    });
    if (saved) labelAndArchive(thread, status);
    return;
  }

  // ── Email de texto normal ────────────────────────────────────────────────
  const fullText = `Asunto: ${subject}\nDe: ${from}\n\n${body}`;
  const result   = validateWithGroq(fullText, groqKey);
  console.log(`Resultado IA: circus=${result.isCircus}, confidence=${result.confidence}`);

  if (!result.isCircus && result.confidence !== 'low') {
    console.log('No es circo → archivando');
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
  if (saved) labelAndArchive(thread, status);
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
        'Prefer':        'return=minimal',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code === 409) { console.log('Ya existe → saltando'); return true; }
    return code === 201;
  } catch (e) {
    console.error('Error Supabase:', e.message);
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelAndArchive(thread, status) {
  console.log(`✅ Guardado con status: ${status}`);
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
