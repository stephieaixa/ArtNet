import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { VENUE_TYPES } from '../../src/constants/venueTypes';
import { supabase } from '../../src/services/supabase';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';

async function validateCircusJob(text: string): Promise<{ isCircus: boolean; confidence: 'high' | 'medium' | 'low' }> {
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
1. ¿Es una oferta/audición/casting para artistas de CIRCO, acrobacia, varieté, clown, aéreos, malabares?
2. Nivel de confianza.
SÍ: acróbatas, aéreos, clowns, malabaristas, cruceros buscando entertainers, dinner shows.
NO: danza, ballet, teatro dramático, música, yoga, fitness.
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
    return { isCircus: !!parsed.is_circus, confidence: parsed.confidence ?? 'low' };
  } catch {
    return { isCircus: true, confidence: 'low' };
  }
}

export default function GuestPostScreen() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueType, setVenueType] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [howToApply, setHowToApply] = useState('');

  const handlePost = async () => {
    if (!title || !description || !contactEmail) {
      Alert.alert('Campos obligatorios', 'Completá el título, descripción y email de contacto.');
      return;
    }
    setLoading(true);

    // 1. Validar con IA
    const fullText = [title, description, howToApply].filter(Boolean).join('\n');
    const { isCircus, confidence } = await validateCircusJob(fullText);

    if (!isCircus && confidence !== 'low') {
      setLoading(false);
      Alert.alert(
        'No parece ser una convocatoria circense',
        'Esta plataforma es exclusivamente para trabajos de circo, acrobacia, varieté y artes circenses. Si creés que es un error, agregá más detalle sobre las disciplinas buscadas.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    // 2. Guardar — publicado directo si alta confianza, revision si no
    const status = (isCircus && confidence === 'high') ? 'published' : 'pending_review';

    const contactLine = [
      contactName && `Contacto: ${contactName}`,
      contactPhone && `Tel/WhatsApp: ${contactPhone}`,
      howToApply && `Cómo postularse: ${howToApply}`,
    ].filter(Boolean).join('\n');

    const sourceId = `guest::${Date.now()}::${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase.from('scraped_jobs').insert({
      source_id:       sourceId,
      source_name:     'community',
      source_url:      '',
      title:           title.trim(),
      description:     [description.trim(), contactLine].filter(Boolean).join('\n\n'),
      venue_type:      venueType || 'other',
      location_city:   city.trim(),
      location_country: country.trim(),
      contact_email:   contactEmail.trim(),
      status,
      is_scraped:      false,
      scraped_at:      new Date().toISOString(),
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'No se pudo enviar. Intentá de nuevo.');
      console.error('[guest post]', error.message);
      return;
    }

    Alert.alert(
      status === 'published' ? '¡Publicado! 🎉' : '¡Recibido! 🎉',
      status === 'published'
        ? 'Tu convocatoria ya está visible en ArtNet. Para gestionar postulaciones, creá una cuenta gratis.'
        : 'Tu publicación fue enviada y estará visible muy pronto tras una revisión rápida.',
      [
        { text: 'Crear cuenta', onPress: () => router.replace('/(auth)/register?role=venue') },
        { text: 'Volver', onPress: () => router.replace('/(auth)/welcome') },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Publicar búsqueda</Text>
          <TouchableOpacity
            style={[styles.postBtn, loading && styles.btnDisabled]}
            onPress={handlePost}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Text style={styles.postBtnText}>Publicar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* "Sin cuenta" banner */}
        <View style={styles.guestBanner}>
          <Text style={styles.guestEmoji}>👋</Text>
          <Text style={styles.guestText}>
            Publicás sin cuenta. Dejá tus datos de contacto para que los artistas puedan escribirte.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Título de la búsqueda *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Bailarín/a para resort en Cancún"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describí el trabajo, condiciones, fechas, qué buscás en el artista..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />

          <Text style={styles.label}>Tipo de venue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {VENUE_TYPES.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.chip, venueType === v.id && styles.chipActive]}
                  onPress={() => setVenueType(v.id)}
                >
                  <Text style={styles.chipEmoji}>{v.emoji}</Text>
                  <Text style={[styles.chipText, venueType === v.id && styles.chipTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput style={styles.input} placeholder="Ej: Madrid" value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>País</Text>
              <TextInput style={styles.input} placeholder="Ej: España" value={country} onChangeText={setCountry} />
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Tus datos de contacto</Text>
          <Text style={styles.sectionSubtitle}>Los artistas interesados te van a contactar directamente</Text>

          <Text style={styles.label}>Tu nombre / empresa</Text>
          <TextInput style={styles.input} placeholder="Ej: Juan García / Grand Hotel" value={contactName} onChangeText={setContactName} />

          <Text style={styles.label}>Email de contacto *</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>WhatsApp / Teléfono (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="+54 11 1234-5678"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Instrucciones para aplicar (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Ej: Enviá tu video de audición + CV artístico al email indicado con el asunto 'Audición Cancún'"
            value={howToApply}
            onChangeText={setHowToApply}
            multiline
            numberOfLines={3}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: { padding: SPACING.sm },
  closeText: { fontSize: 18, color: COLORS.text },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  postBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
  },
  btnDisabled: { opacity: 0.6 },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  guestBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: '#EDE9FE', padding: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: '#DDD6FE',
  },
  guestEmoji: { fontSize: 20 },
  guestText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.primaryDark ?? '#4A1FA8', lineHeight: 19 },
  content: { padding: SPACING.xl },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  chipScroll: { marginVertical: SPACING.xs },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 7, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xl },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
});
