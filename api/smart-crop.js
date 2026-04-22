/**
 * POST /api/smart-crop
 *
 * Recibe una imagen (base64) desde el Gmail Apps Script,
 * usa Groq Vision para detectar el crop del flyer principal (ignorando UI de redes sociales),
 * recorta con sharp y sube a Supabase Storage.
 *
 * Body: { imageBase64, mimeType, sourceId, supabaseUrl, supabaseKey }
 * Response: { url } | { error }
 */
import sharp from 'sharp';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType, sourceId, supabaseUrl, supabaseKey } = req.body ?? {};
  if (!imageBase64 || !sourceId || !supabaseUrl || !supabaseKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const type = mimeType || 'image/jpeg';
  const ext  = type === 'image/png' ? 'png' : 'jpg';
  const safeId = sourceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `email/${safeId}.${ext}`;

  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const meta = await sharp(imageBuffer).metadata();
    const W = meta.width ?? 1;
    const H = meta.height ?? 1;

    // ── Pedir a Groq Vision las coordenadas del flyer principal ──────────────
    let cropBox = null;

    if (GROQ_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            max_tokens: 120,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${type};base64,${imageBase64}` } },
                { type: 'text', text:
                  `Esta imagen es un screenshot de Instagram, Facebook u otra red social.
Identificá el área del FLYER o imagen principal del post (ignorando: barra de estado, íconos de la app, navegación, nombre de usuario, botones de like/share).
Respondé SOLO con JSON: {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
donde cada valor es una fracción de 0.0 a 1.0 del tamaño total de la imagen.
Si toda la imagen es el flyer, respondé {"x":0,"y":0,"w":1,"h":1}.` },
              ],
            }],
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const raw = data.choices?.[0]?.message?.content ?? '';
          const match = raw.match(/\{[\s\S]*?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const x = Math.max(0, Math.min(1, parsed.x ?? 0));
            const y = Math.max(0, Math.min(1, parsed.y ?? 0));
            const w = Math.max(0.1, Math.min(1 - x, parsed.w ?? 1));
            const h = Math.max(0.1, Math.min(1 - y, parsed.h ?? 1));
            // Solo recortar si vale la pena (el flyer ocupa al menos 20% del área)
            if (w * h > 0.04) cropBox = { x, y, w, h };
          }
        }
      } catch (e) {
        console.warn('Groq Vision crop error:', e.message);
      }
    }

    // ── Recortar con sharp ───────────────────────────────────────────────────
    let processed = sharp(imageBuffer);

    if (cropBox && !(cropBox.x === 0 && cropBox.y === 0 && cropBox.w === 1 && cropBox.h === 1)) {
      const left   = Math.round(cropBox.x * W);
      const top    = Math.round(cropBox.y * H);
      const width  = Math.round(cropBox.w * W);
      const height = Math.round(cropBox.h * H);
      console.log(`Cropping: ${left},${top} ${width}x${height} (from ${W}x${H})`);
      processed = processed.extract({ left, top, width, height });
    }

    // Re-encode as JPEG (max 1200px wide, 85% quality)
    const outBuffer = await processed
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // ── Subir a Supabase Storage ─────────────────────────────────────────────
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/job-flyers/${path}`, {
      method: 'POST',
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type':  'image/jpeg',
        'x-upsert':      'true',
      },
      body: outBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('Supabase upload error:', uploadRes.status, err);
      return res.status(500).json({ error: 'Upload failed', detail: err });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/job-flyers/${path}`;
    return res.status(200).json({ url: publicUrl });

  } catch (e) {
    console.error('smart-crop error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
