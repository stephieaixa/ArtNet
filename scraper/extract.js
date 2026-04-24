/**
 * Extracción de trabajos con IA.
 * Cadena de fallback: Groq (gratis, 6000 req/día) → Gemini (si hay key)
 *
 * Configurar en .env:
 *   GROQ_KEY=gsk_...    (gratis en console.groq.com)
 *   GEMINI_KEY=...      (opcional, fallback)
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ─── Lista canónica de disciplinas de la app ──────────────────────────────────
const DISCIPLINES_LIST = `
AÉREO: aerial_silk (Tela/Aerial Silk), aerial_hoop (Aro/Lyra), aerial_trapeze (Trapecio/Trapeze), flying_trapeze (Trapecio Volante/Flying Trapeze), swinging_trapeze (Trapecio Balancín/Swinging Trapeze), dance_trapeze (Trapecio de Danza/Dance Trapeze), aerial_straps (Cintas/Straps), aerial_rope (Cuerda/Cuerda Lisa/Rope), cloud_swing (Cloud Swing/Hamaca), aerial_cradle (Cuna Aérea/Aerial Cradle), korean_cradle (Cuna Coreana/Korean Cradle), aerial_cube (Cubo Aéreo), aerial_pole (Pole Aéreo/Aerial Pole), hair_suspension (Suspensión Capilar/Hair Suspension), chinese_pole (Palo Chino/Chinese Pole), russian_bar (Barra Rusa/Russian Bar)
ACROBACIA DE PISO: acrobatics (Acrobacia/Acrobatics), partner_acrobatics (Acrobacia Dúo/Portor/Partner Acrobatics), hand_to_hand (Hand to Hand/Mano a Mano), basic_scale (Báscula/Basic Scale), contortion (Contorsionismo/Contortion), hand_balance (Verticalista/Hand Balance), banquine (Banquina), teeterboard (Balancín/Trampolín/Teeterboard), wheel_of_death (Rueda de la Muerte/Wheel of Death), rola_bola (Rola Bola), cyr_wheel (Rueda Cyr/Cyr Wheel), german_wheel (German Wheel/Rhönrad)
MANIPULACIÓN: juggling (Malabares/Juggling), poi (Poi), staff (Staff/Bastón), hula_hoop (Hula Hoop), diabolo (Diábolo/Diabolo), kendama (Kendama/Yo-yo)
FUEGO: fire_poi (Poi de Fuego/Fire Poi), fire_staff (Staff de Fuego/Fire Staff), fire_juggling (Malabares con Fuego/Fire Juggling), fire_hoop (Hula Hoop de Fuego/Fire Hoop), fire_eating (Tragafuegos/Fire Eating/Fire Breathing)
LED/LUMINOSO: led_poi (Poi LED), led_staff (Staff LED), led_hoop (Hula Hoop LED), led_suit (Traje LED), led_show (Show LED/Luminoso), glow (Glow/Neón)
EQUILIBRISMO: tightrope (Cuerda Floja/Slackline/Tightrope), unicycle (Monociclo/Unicycle), bottle_balance (Equilibrio en Botellas/Bottle Balance)
CLOWN & COMEDIA: clown (Clown/Payaso), mime (Mimo/Mime), bouffon (Bufón/Bouffon), physical_comedy (Comedia Física/Physical Comedy)
PERSONAJE & CALLE: stilt_walking (Zancos/Stilt Walking), living_statue (Estatua Viviente/Living Statue), street_show (Espectáculo Callejero/Street Show)
PRODUCCIÓN: spectacle_direction (Dirección de Espectáculos), choreography (Coreografía/Choreography), stage_management (Producción/Stage Manager)

MAPEOS IMPORTANTES — usá siempre el ID correcto:
- "trapeze" sin especificar → aerial_trapeze
- "flying trapeze" o "trapecio volante" → flying_trapeze
- "swinging trapeze" o "trapecio balancín" → swinging_trapeze
- "cloud swing" o "hamaca aérea" → cloud_swing
- "cradle" o "cuna" → aerial_cradle (si no especifica korean)
- "korean cradle" → korean_cradle
- "hand to hand" o "mano a mano" → hand_to_hand
- "báscula" → basic_scale
- "cyr" → cyr_wheel; "german wheel" o "rhönrad" → german_wheel
- "aerial pole" o "pole aéreo" (en contexto de circo/show) → aerial_pole
- "russian bar" o "barra rusa" → russian_bar
- "straps" o "cintas" → aerial_straps
`.trim();

const SYSTEM_PROMPT = `Sos un clasificador y extractor especializado en ofertas de trabajo para artistas de CIRCO, VARIETÉ y ARTES ACROBÁTICAS.

═══ FILTRO PRINCIPAL — SOLO ARTES CIRCENSES ═══
Esta plataforma es EXCLUSIVAMENTE para disciplinas de circo y acrobacia.

✅ SÍ incluir:
- Circo: acróbatas, equilibristas, payasos/clowns, malabaristas, artistas de fuego/LED
- Aéreos: tela, aro/lyra, trapecio, cuerdas, cintas, barra rusa, palo chino
- Varieté y entretenimiento: contorsionismo, zancos, estatuas vivientes, magia de escena
- Cruceros, hoteles, casinos, parques de diversiones buscando performers o entertainers
- Dinner shows, cabarés y espectáculos con componente acrobático
- Festivales de circo o varieté
- Producción/dirección de espectáculos de circo

❌ NO incluir — RECHAZAR aunque sean "artes escénicas":
- Ballet, danza clásica, danza contemporánea, danza folclórica, flamenco, tango (salvo que el contexto sea claramente un show de varieté con acrobacia)
- Teatro dramático, teatro de texto, actuación (acting), obras de teatro
- Música, cantantes, bandas, DJ, coros
- Yoga, pilates, fitness, pole dance fitness (no es circo)
- Modelaje, fotografía, extras para cine
- Cualquier oferta que NO mencione: circo, acrobacia, aéreos, malabares, varieté, entertainer, performer, stunt o disciplinas equivalentes

REGLA FUNDAMENTAL: Solo extraé publicaciones donde UN EMPLEADOR, VENUE, PRODUCTOR O FESTIVAL busca contratar artistas.

✅ SÍ es una oferta laboral si:
- Un crucero, hotel, resort, casino, festival, circo o productor busca artistas para actuar
- Hay un casting o audición abierta con fecha
- Una empresa convoca para una temporada o contrato
- Un agente busca artistas para representar/colocar

❌ NO es una oferta laboral si:
- Un artista se autopromociona ("Soy malabarista, busco trabajo", "Disponible para shows")
- Es una noticia, artículo o reseña sin convocatoria
- Es un comentario, reacción o conversación
- Es publicidad de cursos o venta de productos
- Es un logro, foto o video sin convocatoria
- Es teatro, danza, música o cualquier disciplina fuera del espectro circense

DISCIPLINAS: Para el campo "disciplines" usá SOLO los IDs de esta lista canónica:
${DISCIPLINES_LIST}
Si no hay match exacto, elegí el más cercano. Podés usar varios IDs.

CONTACTOS DIRECTOS — MÁXIMA PRIORIDAD:
El objetivo es que los artistas puedan contactar directamente SIN pasar por plataformas de pago o membresías.

1. BUSCA SIEMPRE primero:
   - Email directo: cualquier dirección @... en el texto → "contact_email"
   - WhatsApp/teléfono: wa.me/..., número con "WhatsApp" o "Tel" → "extra_contacts"
   - Instagram/TikTok: @handle o links de perfil → "extra_contacts"
   - Formulario propio del venue (no de un job board) → "contact_url"

2. Si reconocés el nombre de la empresa (Royal Caribbean, Club Med, MSC, Cirque du Soleil, Disney, Carnival, etc.):
   - Completá "contact_url" con su página de casting/careers directa si la conocés
   - Completá "venue_website" con su web oficial
   - Completá "contact_email" si conocés su email de casting directo
   - Indicá en descripción "[contacto completado por conocimiento externo]"

3. EVITÁ como contact_url principal (usalos solo como fallback si no hay nada directo):
   - Indeed.com, LinkedIn.com, Glassdoor.com, ZipRecruiter.com, Monster.com
   - Cualquier plataforma que requiera membresía o suscripción para postularse
   - Si el único link disponible es un job board genérico de pago, ponlo en "extra_contacts" con nota "(requiere membresía)" y dejá "contact_url" vacío

4. NOMBRES PROPIOS: Si el texto menciona nombres de personas (director, productor, coordinador de casting), incluí el nombre en la descripción para que el artista pueda buscarlo en redes.

VENUE WEBSITE: Completá con tu conocimiento si reconocés la empresa. Dejá vacío si no estás seguro.

DISCIPLINAS — IMPORTANTE: Analizá el texto completo y asigná TODOS los IDs que apliquen. Si dicen "acróbata" → acrobatics. Si dicen "aéreo" sin especificar → aerial_silk, aerial_hoop, aerial_trapeze. Si dicen "malabarista" → juggling. Si dicen "artista de circo" → usá los más probables según contexto.

Si el texto no contiene ninguna oferta laboral real, devolvé {"jobs": []}.
Traducí todo al español. Si un campo no está disponible, usá string vacío o array vacío.`;

const SCHEMA_DESCRIPTION = `Respondé SOLO con JSON válido, sin markdown, sin explicaciones:
{
  "jobs": [
    {
      "title": "título claro de la oferta (ej: 'Artista Aéreo para Crucero MSC')",
      "description": "qué buscan exactamente, requisitos, condiciones. Si completaste contacto por conocimiento propio, indicalo al final entre corchetes [info obtenida de conocimiento externo]",
      "venue_name": "nombre del venue, empresa, festival o producción que contrata",
      "venue_type": "cruise_ship|hotel|festival|circus|amusement_park|production_company|theater|agency|school|other",
      "location_city": "ciudad donde se trabaja",
      "location_country": "país donde se trabaja",
      "region": "europa|america_latina|america_norte|asia|medio_oriente|oceania|africa|global",
      "disciplines": ["IDs de disciplinas de la lista canónica, ej: aerial_silk, juggling"],
      "start_date": "cuándo empieza (texto libre o YYYY-MM)",
      "end_date": "cuándo termina",
      "contact_email": "email de contacto (del texto O de tu conocimiento sobre la empresa)",
      "contact_url": "URL para postularse o más info (del texto O de tu conocimiento)",
      "venue_website": "URL oficial del venue, empresa o festival (del texto O de tu conocimiento)",
      "pay_info": "info sobre sueldo, caché, condiciones económicas",
      "deadline": "fecha límite para postularse",
      "extra_contacts": ["otros contactos encontrados: Instagram @usuario → 'instagram:usuario', WhatsApp → 'whatsapp:+549...', web adicional → 'web:https://...', email adicional → 'email:...@...'"],
      "source_excerpt": "fragmento textual más relevante, máx 200 chars"
    }
  ]
}`;

// ─── Groq ─────────────────────────────────────────────────────────────────────

function getGroqKeys() {
  const keys = [];
  if (process.env.GROQ_KEY) keys.push(process.env.GROQ_KEY);
  if (process.env.GROQ_KEY_2) keys.push(process.env.GROQ_KEY_2);
  return keys;
}

async function extractWithGroq(prompt) {
  const keys = getGroqKeys();
  if (!keys.length) return null;

  for (const key of keys) {
    try {
      const client = new Groq({ apiKey: key });
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096,
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      if (err?.status === 429) {
        console.warn('[extract] Groq: límite de requests alcanzado, probando siguiente key...');
      } else {
        console.warn('[extract] Groq error:', err.message);
        return null;
      }
    }
  }
  console.warn('[extract] Groq: todas las keys alcanzaron el límite, intentando Gemini...');
  return null;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

let geminiClient = null;

function getGemini() {
  if (!geminiClient && process.env.GEMINI_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_KEY);
  }
  return geminiClient;
}

async function extractWithGemini(prompt) {
  const genAI = getGemini();
  if (!genAI) return null;

  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        console.warn(`[extract] Gemini ${modelName}: cuota agotada`);
        continue;
      }
      console.warn(`[extract] Gemini ${modelName}:`, err.message);
    }
  }
  return null;
}

// ─── Parser de respuesta ──────────────────────────────────────────────────────

function parseJobsFromText(text) {
  if (!text) return [];
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return parsed.jobs ?? [];
  } catch {
    return [];
  }
}

// ─── Pre-extracción de contactos ──────────────────────────────────────────────

/**
 * Extrae emails, handles de Instagram y números de WhatsApp del texto crudo.
 * Esto se pasa al AI como contexto adicional para que no los pierda.
 */
function preExtractContacts(text) {
  const found = [];

  // Emails
  const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  for (const e of [...new Set(emails)].slice(0, 10)) {
    if (!e.includes('example') && !e.includes('noreply') && !e.includes('sentry')) {
      found.push(`email:${e}`);
    }
  }

  // Handles de Instagram (@usuario)
  const igHandles = text.match(/(?<![a-zA-Z])@([a-zA-Z0-9_.]{3,30})(?![a-zA-Z0-9_.])/g) ?? [];
  for (const h of [...new Set(igHandles)].slice(0, 5)) {
    found.push(`instagram:${h}`);
  }

  // WhatsApp (números con prefijo internacional)
  const waNumbers = text.match(/(?:whatsapp|wa\.me|wa)[:\s/]*(\+?[\d\s\-().]{8,18})/gi) ?? [];
  for (const n of [...new Set(waNumbers)].slice(0, 3)) {
    found.push(`whatsapp:${n.replace(/\s+/g, '')}`);
  }

  return found;
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function extractJobsFromText(rawText, sourceContext = '') {
  if (!rawText || rawText.trim().length < 50) return [];

  if (!process.env.GROQ_KEY) {
    console.error('[extract] ❌ Falta GROQ_KEY. Configurala en .env (gratis en console.groq.com)');
    process.exit(1);
  }

  const truncated = rawText.slice(0, 12000);

  // Pre-extraer contactos del texto crudo (antes de truncar el contexto)
  const preContacts = preExtractContacts(rawText);
  const contactsHint = preContacts.length > 0
    ? `\n\nCONTACTOS DETECTADOS AUTOMÁTICAMENTE EN EL TEXTO (usá estos en los campos correspondientes):\n${preContacts.join('\n')}`
    : '';

  const prompt = `${SYSTEM_PROMPT}\n\nFuente: ${sourceContext}${contactsHint}\n\n--- TEXTO ---\n${truncated}\n\n${SCHEMA_DESCRIPTION}`;

  // 1. Intentar con Groq (preferido: gratis y generoso)
  const groqText = await extractWithGroq(prompt);
  if (groqText) {
    const jobs = parseJobsFromText(groqText);
    if (jobs.length > 0 || groqText.includes('"jobs"')) return jobs;
  }

  // 2. Fallback a Gemini
  const geminiText = await extractWithGemini(prompt);
  if (geminiText) return parseJobsFromText(geminiText);

  console.warn('[extract] Todos los proveedores fallaron para esta fuente.');
  return [];
}

async function extractWithGroqVision(base64Image, prompt) {
  const keys = getGroqKeys();
  if (!keys.length) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keys[0]}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.warn('[extract] Groq vision HTTP error:', res.status);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn('[extract] Groq vision error:', err.message);
    return null;
  }
}

async function extractWithGeminiVision(base64Image, prompt) {
  if (!process.env.GEMINI_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ]}]}),
      }
    );
    if (!res.ok) { console.warn('[extract] Gemini vision HTTP:', res.status); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.warn('[extract] Gemini vision error:', err.message);
    return null;
  }
}

export async function extractJobsFromImage(base64Image, sourceContext = '') {
  const prompt = `${SYSTEM_PROMPT}\n\nFuente: ${sourceContext}\nEsta es una imagen con una oferta de trabajo para artistas.\n\n${SCHEMA_DESCRIPTION}`;

  const text = (await extractWithGroqVision(base64Image, prompt)) ?? (await extractWithGeminiVision(base64Image, prompt));
  if (text) return parseJobsFromText(text);

  console.warn('[extract] extractJobsFromImage: todos los proveedores fallaron');
  return [];
}
