import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import es from '../i18n/locales/es';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';

// ── Bundle helpers ────────────────────────────────────────────────────────────

function flattenBundle(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      result[key] = v;
    } else if (typeof v === 'object' && v !== null) {
      Object.assign(result, flattenBundle(v, key));
    }
  }
  return result;
}

function unflattenBundle(flat: Record<string, string>): any {
  const result: any = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

// ── Core Groq call ────────────────────────────────────────────────────────────

async function groqCall(prompt: string, maxTokens = 4096): Promise<string | null> {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ── UI Bundle translation ─────────────────────────────────────────────────────

/**
 * Translates the entire UI string bundle from Spanish to any language.
 * Caches result in AsyncStorage so it only translates once per language.
 * Returns true on success.
 */
export async function loadLanguageBundle(langName: string): Promise<boolean> {
  const name = langName.trim();
  const isSpanish = /^(español|spanish|es)$/i.test(name);

  if (isSpanish) {
    i18n.changeLanguage('es');
    await AsyncStorage.setItem('artnet_language', 'Español').catch(() => {});
    return true;
  }

  const cacheKey = `artnet_trans_v2_${name.toLowerCase().replace(/\s+/g, '_')}`;

  // Try cache first (instant switch after first use)
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const bundle = JSON.parse(cached);
      i18n.addResourceBundle(name, 'translation', bundle, true, true);
      i18n.changeLanguage(name);
      await AsyncStorage.setItem('artnet_language', name).catch(() => {});
      return true;
    }
  } catch { /* ignore */ }

  // Translate via Groq
  const flat = flattenBundle(es);

  const prompt = `You are a UI string translator for a circus & performing arts job platform called ArtNet.
Translate all VALUES in the JSON below from Spanish to ${name}.

STRICT RULES:
- Return ONLY valid JSON, nothing else — no markdown, no code blocks, no comments
- All keys must remain exactly unchanged
- Keep {{variable}} placeholders exactly as-is (e.g. {{count}}, {{email}}, {{region}})
- Keep emojis exactly as-is
- Keep "ArtNet" as-is (brand name, never translate)
- Keep "←" arrow as-is
- Keep "●" symbol as-is
- Translate only the human-readable surrounding text

JSON:
${JSON.stringify(flat)}`;

  const raw = await groqCall(prompt, 6000);
  if (!raw) return false;

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return false;

  try {
    const translatedFlat = JSON.parse(match[0]);
    const bundle = unflattenBundle(translatedFlat);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(bundle)).catch(() => {});
    await AsyncStorage.setItem('artnet_language', name).catch(() => {});
    i18n.addResourceBundle(name, 'translation', bundle, true, true);
    i18n.changeLanguage(name);
    return true;
  } catch {
    return false;
  }
}

// ── Job content translation ───────────────────────────────────────────────────

/**
 * Translates a job listing's title and description to any language.
 */
export async function translateJobContent(
  title: string,
  description: string,
  targetLang: string
): Promise<{ title: string; description: string } | null> {
  const prompt = `Translate this circus/performing arts job listing to ${targetLang}.
Return ONLY valid JSON, no markdown:
{"title": "...", "description": "..."}

Title: ${title}
Description: ${(description || '').slice(0, 1500)}`;

  const raw = await groqCall(prompt, 1000);
  if (!raw) return null;

  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.title) return { title: parsed.title, description: parsed.description ?? '' };
  } catch {}
  return null;
}
