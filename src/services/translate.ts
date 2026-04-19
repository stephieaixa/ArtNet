import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import es from '../i18n/locales/es';
import en from '../i18n/locales/en';
import fr from '../i18n/locales/fr';

/** Maps common display-name variations to a pre-built i18n language code */
const PREBUILT: Record<string, string> = {
  english: 'en', inglés: 'en', ingles: 'en',
  français: 'fr', francais: 'fr', french: 'fr', frances: 'fr', francés: 'fr',
};

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

  // Use pre-built bundles for English and French — no Groq needed
  const prebuiltCode = PREBUILT[name.toLowerCase()];
  if (prebuiltCode) {
    const bundle = prebuiltCode === 'en' ? en : fr;
    i18n.addResourceBundle(prebuiltCode, 'translation', bundle, true, true);
    i18n.changeLanguage(prebuiltCode);
    await AsyncStorage.setItem('artnet_language', name).catch(() => {});
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

// ── Batch title translation (for job cards) ───────────────────────────────────

/**
 * Translates multiple job titles in a single Groq call.
 * Input: [{id, title}] — Output: {id: translatedTitle}
 */
export async function translateTitlesBatch(
  items: Array<{ id: string; title: string }>,
  targetLang: string
): Promise<Record<string, string>> {
  if (!GROQ_KEY || !items.length) return {};

  const input = Object.fromEntries(items.map(i => [i.id, i.title]));

  const prompt = `Translate these performing arts job listing titles to ${targetLang}.
Return ONLY valid JSON object with the same keys and translated values. No markdown, no explanation.
Keep brand names, proper nouns, and "ArtNet" unchanged.

${JSON.stringify(input)}`;

  const raw = await groqCall(prompt, 3000);
  if (!raw) return {};

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};

  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

// ── Batch title + description translation ─────────────────────────────────────

/**
 * Translates job titles AND descriptions in a single batch call.
 * Input: [{id, title, description}] — Output: {id: {title, description}}
 */
export async function translateBatch(
  items: Array<{ id: string; title: string; description?: string }>,
  targetLang: string
): Promise<Record<string, { title: string; description: string }>> {
  if (!GROQ_KEY || !items.length) return {};

  const input = Object.fromEntries(
    items.map(i => [i.id, { t: i.title, d: (i.description ?? '').slice(0, 400) }])
  );

  const prompt = `Translate these performing arts job listings to ${targetLang}.
Return ONLY valid JSON with same keys, each value as {"t":"translated title","d":"translated description"}.
No markdown, no explanation. Keep brand names and "ArtNet" unchanged.

${JSON.stringify(input)}`;

  const raw = await groqCall(prompt, 8000);
  if (!raw) return {};
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]);
    const result: Record<string, { title: string; description: string }> = {};
    for (const [id, val] of Object.entries(parsed)) {
      const v = val as any;
      result[id] = { title: v.t ?? '', description: v.d ?? '' };
    }
    return result;
  } catch { return {}; }
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
