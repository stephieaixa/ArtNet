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
  ScrollView, ActivityIndicator, Alert, Platform,
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

export default function ShareTargetScreen() {
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();

  const [content, setContent] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<'published' | 'review' | null>(null);

  // Pre-fill from share params
  useEffect(() => {
    const parts = [params.title, params.text, params.url].filter(Boolean).join('\n');
    if (parts) setContent(parts);
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

    const { error } = await supabase.from('scraped_jobs').insert({
      source_id:    sourceId,
      source_name:  'community',
      source_url:   params.url ?? '',
      title:        (params.title ?? content.slice(0, 80)).trim(),
      description:  content.trim(),
      contact_email: contactEmail.trim() || null,
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
        <Text style={s.label}>Contenido de la publicación</Text>
        <Text style={s.hint}>
          Pegá el texto de la convocatoria tal como la viste en el grupo.
          La IA analizará si es una audición circense.
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
});
