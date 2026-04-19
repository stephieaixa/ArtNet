import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { VENUE_TYPES, CONTRACT_TYPES, PAY_TYPES } from '../../src/constants/venueTypes';
import { DISCIPLINES } from '../../src/constants/disciplines';

export default function PostJobScreen() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueType, setVenueType] = useState('');
  const [contractType, setContractType] = useState('');
  const [payType, setPayType] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [requirements, setRequirements] = useState('');

  const toggleDiscipline = (id: string) => {
    setDisciplines(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handlePost = async () => {
    if (!title || !description || !venueType) {
      Alert.alert('Completá los campos obligatorios', 'Título, descripción y tipo de venue son requeridos.');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    Alert.alert('¡Publicado!', 'Tu búsqueda ya está visible para los artistas.', [
      { text: 'Ver feed', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.closeBtn}>
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

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Título de la búsqueda *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Artista Aéreo para Crucero Mediterráneo"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Descripción detallada *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describí el trabajo, horarios, condiciones, qué buscás en el artista..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />

          <Text style={styles.label}>Tipo de venue *</Text>
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

          <Text style={styles.label}>Tipo de contrato</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {CONTRACT_TYPES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, contractType === c.id && styles.chipActive]}
                  onPress={() => setContractType(c.id)}
                >
                  <Text style={[styles.chipText, contractType === c.id && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Disciplinas requeridas</Text>
          <Text style={styles.hint}>{disciplines.length} seleccionadas</Text>
          <View style={styles.disciplineGrid}>
            {DISCIPLINES.slice(0, 20).map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, disciplines.includes(d.id) && styles.chipActive]}
                onPress={() => toggleDiscipline(d.id)}
              >
                <Text style={[styles.chipText, disciplines.includes(d.id) && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Ubicación</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Ciudad" value={city} onChangeText={setCity} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="País" value={country} onChangeText={setCountry} />
          </View>

          <Text style={styles.label}>Pago</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {PAY_TYPES.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, payType === p.id && styles.chipActive]}
                  onPress={() => setPayType(p.id)}
                >
                  <Text style={[styles.chipText, payType === p.id && styles.chipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {payType && payType !== 'negotiable' && (
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Mínimo (USD)" value={payMin} onChangeText={setPayMin} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Máximo (USD)" value={payMax} onChangeText={setPayMax} keyboardType="numeric" />
            </View>
          )}

          <Text style={styles.label}>Requisitos adicionales</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Idiomas, experiencia mínima, disponibilidad para viajar, etc."
            value={requirements}
            onChangeText={setRequirements}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: 56,
    paddingBottom: SPACING.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { padding: SPACING.sm },
  closeText: { fontSize: 18, color: COLORS.text },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  postBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
  },
  btnDisabled: { opacity: 0.6 },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  content: { padding: SPACING.xl, gap: SPACING.xs },
  label: {
    fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600', marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  chipScroll: { marginBottom: SPACING.xs },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.xs },
  disciplineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 7, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
});
