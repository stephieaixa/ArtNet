import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { DISCIPLINES } from '../../src/constants/disciplines';

const POST_TYPES = [
  { id: 'availability', label: '📅 Estoy disponible', desc: 'Avisá que buscás trabajo' },
  { id: 'portfolio', label: '🎬 Compartir trabajo', desc: 'Mostrá un show o actuación' },
  { id: 'achievement', label: '🏆 Logro / Noticia', desc: 'Compartí algo que conseguiste' },
  { id: 'looking', label: '🔍 Busco oportunidad', desc: 'Especificá qué tipo de trabajo buscás' },
];

export default function PostArtistScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState('availability');
  const [text, setText] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');

  const toggleDiscipline = (id: string) => {
    setDisciplines(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handlePost = async () => {
    if (!text.trim()) {
      Alert.alert('Escribí algo antes de publicar');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    Alert.alert('¡Publicado!', 'Tu post ya está visible en el feed.', [
      { text: 'Ver feed', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  const placeholders: Record<string, string> = {
    availability: '¡Estoy disponible para trabajar! Especializado en... Busco contratos en...',
    portfolio: 'Acá les comparto mi último show en... ¡Fue una experiencia increíble!',
    achievement: 'Muy feliz de anunciar que acabo de firmar contrato con...',
    looking: 'Busco oportunidades como... idealmente en cruceros / festivales / hoteles...',
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva publicación</Text>
          <TouchableOpacity
            style={[styles.postBtn, (!text.trim() || loading) && styles.btnDisabled]}
            onPress={handlePost}
            disabled={!text.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Text style={styles.postBtnText}>Publicar</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* User info */}
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.email?.split('@')[0]}</Text>
              <Text style={styles.userRole}>Artista · ArtNet</Text>
            </View>
          </View>

          {/* Post type selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            <View style={styles.typeRow}>
              {POST_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, postType === t.id && styles.typeChipActive]}
                  onPress={() => setPostType(t.id)}
                >
                  <Text style={[styles.typeLabel, postType === t.id && styles.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Text input */}
          <TextInput
            style={styles.textInput}
            placeholder={placeholders[postType]}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={5}
            autoFocus
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Upload media placeholder */}
          <TouchableOpacity style={styles.mediaBtn}>
            <Text style={styles.mediaEmoji}>📸</Text>
            <Text style={styles.mediaText}>Agregar foto / video</Text>
          </TouchableOpacity>

          {/* Disciplines */}
          <Text style={styles.sectionLabel}>Tus disciplinas</Text>
          <View style={styles.chipGrid}>
            {DISCIPLINES.slice(0, 16).map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, disciplines.includes(d.id) && styles.chipActive]}
                onPress={() => toggleDiscipline(d.id)}
              >
                <Text style={[styles.chipText, disciplines.includes(d.id) && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location + availability */}
          <Text style={styles.sectionLabel}>Ubicación actual</Text>
          <TextInput style={styles.input} placeholder="Ciudad, País" value={location} onChangeText={setLocation} />

          {(postType === 'availability' || postType === 'looking') && (
            <>
              <Text style={styles.sectionLabel}>Disponible desde</Text>
              <TextInput style={styles.input} placeholder="Ej: Abril 2025" value={availableFrom} onChangeText={setAvailableFrom} />
            </>
          )}

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
  btnDisabled: { opacity: 0.4 },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  content: { padding: SPACING.xl },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.base },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.md },
  userName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  userRole: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  typeScroll: { marginBottom: SPACING.base },
  typeRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.xs },
  typeChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 7, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  typeLabelActive: { color: COLORS.white, fontWeight: '700' },
  textInput: {
    fontSize: FONTS.sizes.md, color: COLORS.text, minHeight: 120,
    textAlignVertical: 'top', lineHeight: 24, marginBottom: SPACING.base,
  },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  mediaEmoji: { fontSize: 22 },
  mediaText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, fontWeight: '500' },
  sectionLabel: {
    fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text,
    marginBottom: SPACING.sm, marginTop: SPACING.md,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  chip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 7, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
});
