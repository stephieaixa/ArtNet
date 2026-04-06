/**
 * Pantalla para que la comunidad sugiera fuentes de trabajo:
 * grupos de Telegram, Facebook, Instagram, WhatsApp, sitios web, etc.
 * Estas sugerencias se guardan en Supabase y el equipo las revisa
 * para agregarlas al scraper automático.
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const SOURCE_TYPES = [
  { id: 'telegram',       emoji: '✈️',  label: 'Telegram',        placeholder: '@nombre_del_canal' },
  { id: 'facebook_group', emoji: '👥',  label: 'Grupo Facebook',  placeholder: 'URL o nombre del grupo' },
  { id: 'instagram',      emoji: '📷',  label: 'Instagram',       placeholder: '@cuenta o hashtag' },
  { id: 'whatsapp',       emoji: '💬',  label: 'WhatsApp',        placeholder: 'Link de invitación' },
  { id: 'website',        emoji: '🌐',  label: 'Sitio web',       placeholder: 'https://...' },
  { id: 'other',          emoji: '📌',  label: 'Otro',            placeholder: 'Descripción o link' },
];

const REGIONS = [
  { id: 'global',         label: 'Global / Internacional' },
  { id: 'europa',         label: 'Europa' },
  { id: 'america_latina', label: 'América Latina' },
  { id: 'america_norte',  label: 'América del Norte' },
  { id: 'asia',           label: 'Asia' },
  { id: 'medio_oriente',  label: 'Medio Oriente' },
  { id: 'oceania',        label: 'Oceanía' },
  { id: 'africa',         label: 'África' },
];

export default function SuggestSourceScreen() {
  const { user } = useAuthStore();
  const [type, setType] = useState('telegram');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('global');
  const [members, setMembers] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selectedType = SOURCE_TYPES.find(t => t.id === type)!;

  // Detección básica de spam: links sospechosos, palabras prohibidas
  function detectSpam(text: string): boolean {
    const spamSignals = [
      /bit\.ly|tinyurl|t\.co/i,          // acortadores de URL sospechosos
      /gana\s+dinero|ganar\s+dinero/i,    // promesas de dinero fácil
      /\$\d{4,}|usd\s*\d{4,}/i,          // montos irrealistas
      /click\s+here|haz\s+clic/i,
      /gratis|free\s+money/i,
    ];
    return spamSignals.some(re => re.test(text));
  }

  async function handleSubmit() {
    if (!handle.trim()) {
      Alert.alert('Falta el link o handle', `Ingresá el ${selectedType.label} que querés sugerir.`);
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      Alert.alert('Descripción muy corta', 'Contanos brevemente qué tipo de contenido tiene esta fuente (mínimo 20 caracteres).');
      return;
    }

    // Spam check
    if (detectSpam(handle + ' ' + description)) {
      Alert.alert('Contenido no permitido', 'Esta sugerencia parece spam. Si creés que es un error, contactá al equipo.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('community_sources').insert({
      submitted_by: user?.id ?? null,
      type,
      handle: handle.trim(),
      name: name.trim() || null,
      description: description.trim(),
      region,
      approx_members: members ? parseInt(members) : null,
      status: 'pending',
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', 'No se pudo enviar la sugerencia. Intentá de nuevo.');
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>¡Gracias por contribuir!</Text>
        <Text style={styles.doneSubtitle}>
          Vamos a revisar esta fuente y si cumple los criterios la agregamos al sistema de búsqueda automática. Con tu ayuda la red crece.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => { setDone(false); setHandle(''); setDescription(''); setName(''); }}>
          <Text style={styles.doneBtnText}>Sugerir otra fuente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}>
          <Text style={styles.backLinkText}>← Volver al perfil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sugerí una fuente</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={styles.intro}>
            ¿Conocés un grupo de Telegram, página de Facebook, cuenta de Instagram o sitio web donde se publican trabajos para artistas de circo? Compartilo y lo agregamos al radar automático.
          </Text>

          {/* Tipo de fuente */}
          <Text style={styles.label}>Tipo de fuente</Text>
          <View style={styles.typeGrid}>
            {SOURCE_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, type === t.id && styles.typeChipActive]}
                onPress={() => setType(t.id)}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, type === t.id && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Handle / URL */}
          <Text style={styles.label}>{selectedType.label} — link o handle *</Text>
          <TextInput
            style={styles.input}
            placeholder={selectedType.placeholder}
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Nombre */}
          <Text style={styles.label}>Nombre del grupo / canal (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Circus Jobs Worldwide"
            value={name}
            onChangeText={setName}
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Descripción */}
          <Text style={styles.label}>¿Qué tipo de contenido tiene? *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Ej: Grupo de Telegram en español con ofertas de trabajo para circo, cruceros y festivales de toda Europa. Se actualiza diariamente."
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Región */}
          <Text style={styles.label}>Región que cubre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.base }}>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, paddingRight: SPACING.base }}>
              {REGIONS.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.regionChip, region === r.id && styles.regionChipActive]}
                  onPress={() => setRegion(r.id)}
                >
                  <Text style={[styles.regionLabel, region === r.id && styles.regionLabelActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Miembros aproximados */}
          <Text style={styles.label}>Miembros aproximados (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 5000"
            value={members}
            onChangeText={setMembers}
            keyboardType="numeric"
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Info de calidad */}
          <View style={styles.qualityCard}>
            <Text style={styles.qualityTitle}>🔍 Criterios de aprobación</Text>
            <Text style={styles.qualityText}>
              • El grupo debe publicar ofertas laborales reales para artistas{'\n'}
              • No se aceptan grupos de spam, ventas o contenido inapropiado{'\n'}
              • Se verifica que el grupo sea activo (posts recientes){'\n'}
              • Se prioriza contenido específico de circo, artes y espectáculo
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>Enviar sugerencia →</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40 },
  backText: { fontSize: 22, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.xl },
  intro: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20,
    marginBottom: SPACING.xl, backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: SPACING.base,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  label: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACING.sm, marginTop: SPACING.base,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  typeLabelActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base,
    fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  regionChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  regionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  regionLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  regionLabelActive: { color: COLORS.white, fontWeight: '700' },
  qualityCard: {
    backgroundColor: '#EFF6FF', borderRadius: RADIUS.lg, padding: SPACING.base,
    borderWidth: 1, borderColor: '#BFDBFE', marginTop: SPACING.xl, marginBottom: SPACING.base,
  },
  qualityTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#1D4ED8', marginBottom: SPACING.sm },
  qualityText: { fontSize: FONTS.sizes.sm, color: '#1E40AF', lineHeight: 20 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  // Done state
  doneEmoji: { fontSize: 64, marginBottom: SPACING.md },
  doneTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.sm },
  doneSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  doneBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl,
  },
  doneBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  backLink: { marginTop: SPACING.md },
  backLinkText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sizes.sm },
});
