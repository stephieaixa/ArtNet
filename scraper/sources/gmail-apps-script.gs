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
 * 5. Triggers → "Agregar trigger" → processNewEmails → cada 15 minutos
 *
 * FLUJO:
 * - Lee emails nuevos con asunto que contenga "audición", "casting", "circo", etc.
 * - Los analiza con Groq / llama-3.3-70b (gratuito, sin límite práctico)
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

  // Todos los emails no procesados — la cuenta es exclusiva para ArtNet
  const query = `-(label:${LABEL_PROCESSED}) -(label:${LABEL_PENDING})`;

  const threads = GmailApp.search(query, 0, 20);
  console.log(`Emails sin procesar: ${threads.length}`);

  for (const thread of threads) {
    try {
      processThread(thread, groqKey, supabaseUrl, supabaseKey);
    } catch (err) {
      console.error('Error procesando email:', err.message);
    }
    Utilities.sleep(1200); // pausa entre emails para no saturar la API
  }
}

// ─── Procesar un thread ─────────────────────────────────────────────────────

function processThread(thread, groqKey, supabaseUrl, supabaseKey) {
  const messages = thread.getMessages();
  const msg = messages[messages.length - 1]; // último mensaje del hilo

  const subject = msg.getSubject();
  const from    = msg.getFrom();
  const body    = msg.getPlainBody().slice(0, 3000);

  const fullText = `Asunto: ${subject}\nDe: ${from}\n\n${body}`;
  console.log(`Procesando: "${subject}" de ${from}`);

  const result = validateWithGroq(fullText, groqKey);
  console.log(`Resultado IA: circus=${result.isCircus}, confidence=${result.confidence}`);

  if (!result.isCircus && result.confidence !== 'low') {
    // No es circo con alta certeza → archivar sin hacer nada
    console.log('No es circo → archivando');
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    thread.moveToArchive();
    return;
  }

  const status = (result.isCircus && result.confidence === 'high') ? 'published' : 'pending_review';

  const sourceId = `gmail::${Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    msg.getId()
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('')}`;

  const saved = saveToSupabase({ sourceId, subject, from, body, status, supabaseUrl, supabaseKey });

  if (saved) {
    console.log(`✅ Guardado con status: ${status}`);
    thread.addLabel(GmailApp.getUserLabelByName(LABEL_PROCESSED));
    if (status === 'pending_review') {
      thread.addLabel(GmailApp.getUserLabelByName(LABEL_PENDING));
    }
    thread.moveToArchive();
  }
}

// ─── Groq (reemplaza Gemini — gratuito, sin límite práctico) ─────────────────

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
      console.error('Groq HTTP error:', res.getResponseCode(), res.getContentText().slice(0, 200));
      return { isCircus: true, confidence: 'low' };
    }

    const data = JSON.parse(res.getContentText());
    const raw = data.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { isCircus: true, confidence: 'low' };
    const parsed = JSON.parse(match[0]);
    return { isCircus: !!parsed.is_circus, confidence: parsed.confidence ?? 'low' };
  } catch (e) {
    console.error('Error Groq:', e.message);
    return { isCircus: true, confidence: 'low' }; // falla abierto → pending_review
  }
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function saveToSupabase({ sourceId, subject, from, body, status, supabaseUrl, supabaseKey }) {
  try {
    const payload = {
      source_id:     sourceId,
      source_name:   'email',
      source_url:    '',
      title:         subject.replace(/^(Re:|Fwd:|FW:)\s*/i, '').trim().slice(0, 120),
      description:   body.trim(),
      contact_email: extractEmail(from),
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
    if (code === 409) {
      console.log('Ya existe (duplicate) — saltando');
      return true; // no es error, ya fue procesado antes
    }
    return code === 201;
  } catch (e) {
    console.error('Error Supabase:', e.message);
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractEmail(from) {
  const m = from.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return m ? m[0] : null;
}

function ensureLabel(name) {
  if (!GmailApp.getUserLabelByName(name)) {
    GmailApp.createLabel(name);
  }
}
