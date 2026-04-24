/**
 * PWA Share Target — recibe contenido compartido desde otras apps
 *
 * Cuando el usuario instala ArtNet como PWA (Agregar a pantalla de inicio)
 * y comparte texto desde Instagram/Facebook/WhatsApp, esta pantalla
 * recibe el contenido, lo valida con IA y lo publica automáticamente.
 *
 * URL: /post/share?text=...&title=...&url=...
 */
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../src/constants/theme';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';

async function validateCircusJob(text: string): Promise<{ isCircus: boolean; confidence: 'high' | 'medium' | 'low'; reason?: string }> {
  if (!GROQ_KEY) return { isCircus: true, confidence: 'low' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 150,
        messages: [{ role: 'user', content:
          `Sos un filtro para una plataforma de trabajos de circo y artes acrobáticas.
Analizá el texto y determiná:
1. ¿Es una oferta/audición/casting para artistas de CIRCO, acrobacia, varieté, clown, aéreos, malabares o similares?
2. Nivel de confianza.
NO incluir: danza convencional, ballet, teatro dramático, música, yoga.
Respondé SOLO con JSON: {"is_circus": true/false, "confidence": "high"/"medium"/"low", "reason": "breve"}

TEXTO:
${text.slice(0, 2000)}` }],
      }),
    });
    if (!res.ok) return { isCircus: true, confidence: 'low' };
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { isCircus: true, confidence: 'low' };
    const parsed = JSON.parse(match[0]);
    return { isCircus: !!parsed.is_circus, confidence: parsed.confidence ?? 'low', reason: parsed.reason };
  } catch {
    return { isCircus: true, confidence: 'low' };
  }
}

const GROQ_KEY_VISION = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const SHARE_CACHE = 'artnet-share-v1';

async function analyzeImageWithAI(base64: string): Promise<string | null> {
  const prompt = `Analizá esta imagen. Es un screenshot de una publicación de redes sociales o una foto de un flyer.
Extraé SOLO el texto visible que parezca ser una convocatoria o audición para artistas de circo, acrobacia o varieté.
Si hay texto de una convocatoria, devolvelo completo. Si no hay, respondé "NO_CONTENT".`;

  // Try Groq vision
  if (GROQ_KEY_VISION) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY_VISION}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 800,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt },
          ]}],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? '';
        if (text && text !== 'NO_CONTENT') return text;
      }
    } catch {}
  }
  // Try Gemini
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: prompt },
          ]}] }) }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text && text !== 'NO_CONTENT') return text;
      }
    } catch {}
  }
  return null;
}

export default function ShareTargetScreen() {
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string; has_image?: string }>();

  const [content, setContent] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<'published' | 'review' | null>(null);
  const [sharedImage, setSharedImage] = useState<string | null>(null); // data URL for preview
  const [sharedImageBase64, setSharedImageBase64] = useState<string>('');
  const [readingImage, setReadingImage] = useState(false);

  // Pre-fill from share params + load shared image from cache
  useEffect(() => {
    const parts = [params.title, params.text, params.url].filter(Boolean).join('\n');
    if (parts) setContent(parts);

    // If image was shared, read it from Cache API
    if (Platform.OS === 'web' && params.has_image === '1' && 'caches' in window) {
      setReadingImage(true);
      (async () => {
        try {
          const cache = await caches.open(SHARE_CACHE);
          const response = await cache.match('/shared-image');
          if (response) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = async () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(',')[1] ?? '';
              setSharedImage(dataUrl);
              setSharedImageBase64(base64);
              setReadingImage(false);
              // Auto-extract text from image
              if (base64 && !parts) {
                setProcessing(true);
                const text = await analyzeImageWithAI(base64);
                setProcessing(false);
                if (text) setContent(text);
              }
            };
            reader.readAsDataURL(blob);
            // Delete from cache after reading
            await cache.delete('/shared-image');
          } else {
            setReadingImage(false);
          }
        } catch {
          setReadingImage(false);
        }
      })();
    }
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Falta el contenido', 'Pegá el texto de la publicación.');
      return;
    }
    setProcessing(true);

    const { isCircus, confidence } = await validateCircusJob(content);

    if (!isCircus && confidence !== 'low') {
      setProcessing(false);
      Alert.alert(
        'No es una convocatoria circense',
        'Esta plataforma es exclusivamente para circo, acrobacia y varieté.',
        [{ text: 'Entendido', onPress: () => router.replace('/') }]
      );
      return;
    }

    const status = (isCircus && confidence === 'high') ? 'published' : 'pending_review';
    const sourceId = `share::${Date.now()}::${Math.random().toString(36).slice(2)}`;

    // Upload shared image if present
    let flyerUrl: string | null = null;
    if (sharedImageBase64) {
      try {
        const fileName = `community/${sourceId.replace('::', '-')}.jpg`;
        const byteArray = Uint8Array.from(atob(sharedImageBase64), c => c.charCodeAt(0));
        const { error: upErr } = await supabase.storage.from('Portfolio').upload(fileName, byteArray, { contentType: 'image/jpeg' });
        if (!upErr) flyerUrl = supabase.storage.from('Portfolio').getPublicUrl(fileName).data.publicUrl;
      } catch {}
    }

    const { error } = await supabase.from('scraped_jobs').insert({
      source_id:    sourceId,
      source_name:  'community',
      source_url:   params.url ?? '',
      title:        (params.title ?? content.slice(0, 80)).trim(),
      description:  content.trim(),
      contact_email: contactEmail.trim() || null,
      flyer_url:    flyerUrl,
      status,
      is_scraped:   false,
      scraped_at:   new Date().toISOString(),
    });

    setProcessing(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.');
      return;
    }
    setDone(status === 'published' ? 'published' : 'review');
  };

  if (done) {
    return (
      <View style={s.doneContainer}>
        <Text style={s.doneEmoji}>{done === 'published' ? '🎉' : '✅'}</Text>
        <Text style={s.doneTitle}>
          {done === 'published' ? '¡Publicado en ArtNet!' : '¡Recibido! En revisión'}
        </Text>
        <Text style={s.doneSub}>
          {done === 'published'
            ? 'La convocatoria ya está visible para los artistas.'
            : 'Revisaremos la publicación muy pronto.'}
        </Text>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/')}>
          <Text style={s.doneBtnText}>Ir a ArtNet →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>🎪 Enviar a ArtNet</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Shared image preview */}
        {readingImage && (
          <View style={s.imageReadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={s.imageReadingText}>Leyendo imagen compartida...</Text>
          </View>
        )}
        {sharedImage && !readingImage && (
          <View style={s.sharedImageCard}>
            <Image source={{ uri: sharedImage }} style={s.sharedImagePreview} resizeMode="contain" />
            {processing ? (
              <View style={s.imageAnalyzingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={s.imageAnalyzingText}>La IA está leyendo el texto del screenshot...</Text>
              </View>
            ) : content ? (
              <Text style={s.imageExtractedNote}>✓ Texto extraído de la imagen</Text>
            ) : (
              <Text style={s.imageExtractedNote}>⚠️ No se encontró texto — completá manualmente</Text>
            )}
          </View>
        )}

        <Text style={s.label}>Contenido de la publicación</Text>
        <Text style={s.hint}>
          {sharedImage ? 'Revisá y editá el texto extraído de la imagen.' : 'Pegá el texto de la convocatoria tal como la viste en el grupo. La IA analizará si es una audición circense.'}
        </Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={8}
          placeholder="Copiá y pegá aquí el texto del post..."
          autoFocus={!content}
        />

        <Text style={s.label}>Tu email (opcional)</Text>
        <Text style={s.hint}>Si querés que te avisemos cuando se publique.</Text>
        <TextInput
          style={s.input}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[s.submitBtn, processing && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing
            ? <><ActivityIndicator color={COLORS.white} size="small" /><Text style={s.submitBtnText}>  Analizando con IA...</Text></>
            : <Text style={s.submitBtnText}>🎪 Enviar a ArtNet</Text>
          }
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Solo se publican convocatorias de circo, acrobacia y varieté.
          El resto se descarta automáticamente.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: HEADER_TOP, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: { padding: SPACING.xs },
  closeText: { fontSize: 18, color: COLORS.text },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.xl, gap: SPACING.xs },
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: SPACING.base, marginBottom: 4 },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, lineHeight: 16 },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.sm, color: COLORS.text,
  },
  textarea: { height: 180, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.xl,
    flexDirection: 'row', justifyContent: 'center',
  },
  submitBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.md },
  disclaimer: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16, marginTop: SPACING.base },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md, backgroundColor: COLORS.background },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  doneSub: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  doneBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl, marginTop: SPACING.md },
  doneBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.md },
  imageReadingCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1, borderColor: COLORS.border },
  imageReadingText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  sharedImageCard: { borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, marginBottom: SPACING.sm },
  sharedImagePreview: { width: '100%', height: 220 },
  imageAnalyzingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm },
  imageAnalyzingText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, flex: 1 },
  imageExtractedNote: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: '#166534', padding: SPACING.sm, paddingTop: 4 },
});
