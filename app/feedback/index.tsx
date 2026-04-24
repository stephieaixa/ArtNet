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

const CATEGORIES = [
  { id: 'bug',        emoji: '🐛', label: 'Bug / error',          placeholder: 'Describí qué pasó, en qué pantalla y cómo reproducirlo.' },
  { id: 'feature',    emoji: '💡', label: 'Idea / sugerencia',     placeholder: '¿Qué funcionalidad te gustaría ver? ¿Cómo mejoraría tu experiencia?' },
  { id: 'content',    emoji: '📋', label: 'Contenido / datos',     placeholder: 'Algo que está mal, desactualizado o falta en las publicaciones.' },
  { id: 'ux',         emoji: '🎨', label: 'Diseño / usabilidad',   placeholder: '¿Algo es difícil de usar, confuso o no se ve bien?' },
  { id: 'other',      emoji: '💬', label: 'Otro',                  placeholder: 'Cualquier otra cosa que quieras compartir con el equipo.' },
];

export default function FeedbackScreen() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState('feature');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.id === category)!;

  async function handleSubmit() {
    if (message.trim().length < 15) {
      Alert.alert('Muy corto', 'Contanos un poco más para poder ayudarte mejor (mínimo 15 caracteres).');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('app_feedback').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      category,
      message: message.trim(),
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', 'No se pudo enviar. Intentá de nuevo.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <Text style={styles.doneEmoji}>🙌</Text>
        <Text style={styles.doneTitle}>¡Gracias!</Text>
        <Text style={styles.doneSub}>
          Tu feedback llega directo al equipo. Cada sugerencia nos ayuda a mejorar ArtNet para toda la comunidad.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => { setDone(false); setMessage(''); setCategory('feature'); }}>
          <Text style={styles.doneBtnText}>Enviar otro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={styles.backLinkText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sugerencias para la app</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.introCard}>
            <Text style={styles.introEmoji}>📣</Text>
            <Text style={styles.introText}>
              Tu opinión nos importa. Reportá bugs, sugerí funcionalidades o contanos cualquier cosa que pueda hacer ArtNet mejor.
            </Text>
          </View>

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, category === c.id && styles.catChipActive]}
                onPress={() => setCategory(c.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catLabel, category === c.id && styles.catLabelActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Tu mensaje *</Text>
          <TextInput
            style={styles.textarea}
            placeholder={selectedCat.placeholder}
            placeholderTextColor={COLORS.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length} caracteres</Text>

          <TouchableOpacity
            style={[styles.submitBtn, (saving || message.trim().length < 15) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || message.trim().length < 15}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.submitBtnText}>Enviar feedback →</Text>
            }
          </TouchableOpacity>

          <Text style={styles.note}>
            {user?.email
              ? `Enviando como: ${user.email}`
              : 'Enviando de forma anónima'
            }
          </Text>

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
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.xl },
  introCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACING.xl,
  },
  introEmoji: { fontSize: 28 },
  introText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  label: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACING.sm, marginTop: SPACING.base,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  catLabelActive: { color: COLORS.white },
  textarea: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.base,
    fontSize: FONTS.sizes.base, color: COLORS.text,
    height: 140, textAlignVertical: 'top',
  },
  charCount: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.xl,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  note: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },
  doneEmoji: { fontSize: 72, marginBottom: SPACING.base },
  doneTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  doneSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl, paddingHorizontal: SPACING.md },
  doneBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl,
  },
  doneBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  backLink: { marginTop: SPACING.md },
  backLinkText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sizes.sm },
});
