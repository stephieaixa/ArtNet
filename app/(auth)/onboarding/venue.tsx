import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { VENUE_TYPES } from '../../../src/constants/venueTypes';

const TOTAL_STEPS = 3;

export default function VenueOnboardingScreen() {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [venueName, setVenueName] = useState('');
  const [venueType, setVenueType] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [website, setWebsite] = useState('');

  // Pre-cargar datos existentes
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('venue_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setVenueName(data.venue_name ?? '');
        setVenueType(data.venue_type ?? '');
        setDescription(data.description ?? '');
        setCity(data.city ?? '');
        setCountry(data.country ?? '');
        setContactName(data.contact_name ?? '');
        setContactTitle(data.contact_title ?? '');
        setWebsite(data.website ?? '');
      });
  }, [user?.id]);

  const handleNext = () => {
    if (step === 1 && (!venueName || !venueType)) {
      Alert.alert('Completá el nombre y tipo de venue');
      return;
    }
    if (step === 2 && (!contactName || !contactTitle)) {
      Alert.alert('Completá los datos del contacto');
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!user?.id) { Alert.alert('Error', 'Sesión no encontrada. Volvé a iniciar sesión.'); return; }
    setLoading(true);
    const { error } = await supabase.from('venue_profiles').upsert({
      user_id: user.id,
      venue_name: venueName.trim(),
      venue_type: venueType,
      description: description.trim(),
      city: city.trim(),
      country: country.trim(),
      contact_name: contactName.trim(),
      contact_title: contactTitle.trim(),
      website: website.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    setLoading(false);
    if (error) {
      Alert.alert('Error al guardar', error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>Paso {step} de {TOTAL_STEPS}</Text>

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🏢</Text>
            <Text style={styles.stepTitle}>Tu empresa / venue</Text>
            <Text style={styles.stepSubtitle}>Contanos quién busca artistas</Text>

            <Text style={styles.label}>Nombre del venue / empresa *</Text>
            <TextInput style={styles.input} placeholder="Ej: MSC Cruceros, Festival Lollapalooza..." value={venueName} onChangeText={setVenueName} />

            <Text style={styles.label}>Tipo de venue *</Text>
            <View style={styles.typeGrid}>
              {VENUE_TYPES.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.typeChip, venueType === v.id && styles.typeChipActive]}
                  onPress={() => setVenueType(v.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.typeEmoji}>{v.emoji}</Text>
                  <Text style={[styles.typeLabel, venueType === v.id && styles.typeLabelActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Ciudad</Text>
            <TextInput style={styles.input} placeholder="Ej: Barcelona" value={city} onChangeText={setCity} />

            <Text style={styles.label}>País</Text>
            <TextInput style={styles.input} placeholder="Ej: España" value={country} onChangeText={setCountry} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>👔</Text>
            <Text style={styles.stepTitle}>Contacto responsable</Text>
            <Text style={styles.stepSubtitle}>¿Quién maneja el área artística?</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} placeholder="Nombre y apellido" value={contactName} onChangeText={setContactName} />

            <Text style={styles.label}>Rol / Cargo *</Text>
            <TextInput style={styles.input} placeholder="Ej: Entertainment Director, Casting Manager..." value={contactTitle} onChangeText={setContactTitle} />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Contá brevemente qué tipo de artistas buscás..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Website (opcional)</Text>
            <TextInput style={styles.input} placeholder="https://..." value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎉</Text>
            <Text style={styles.stepTitle}>¡Todo listo!</Text>
            <Text style={styles.stepSubtitle}>Tu cuenta está configurada</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Venue</Text>
              <Text style={styles.summaryValue}>{venueName}</Text>
              <Text style={styles.summaryLabel}>Tipo</Text>
              <Text style={styles.summaryValue}>{VENUE_TYPES.find(v => v.id === venueType)?.label}</Text>
              <Text style={styles.summaryLabel}>Contacto</Text>
              <Text style={styles.summaryValue}>{contactName} — {contactTitle}</Text>
            </View>

            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepEmoji}>📋</Text>
              <Text style={styles.nextStepText}>
                Ahora podés publicar tu primera búsqueda de artistas y empezar a recibir postulaciones.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, loading && styles.btnDisabled]}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS ? '¡Empezar a buscar artistas! →' : 'Continuar →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: SPACING.xl, gap: SPACING.md },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: COLORS.textMuted, fontWeight: '500' },
  progressBar: { flex: 1, height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: COLORS.secondary, borderRadius: 2 },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  stepLabel: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xl, marginTop: SPACING.md,
  },
  stepContainer: { gap: SPACING.sm },
  stepEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  stepTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  stepSubtitle: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginBottom: SPACING.md },
  label: {
    fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  typeChipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  typeLabelActive: { color: COLORS.white, fontWeight: '700' },
  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.base,
    gap: SPACING.xs, marginTop: SPACING.md,
  },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '600', marginBottom: SPACING.sm },
  nextStepCard: {
    flexDirection: 'row', backgroundColor: '#FFF7ED', borderRadius: RADIUS.lg,
    padding: SPACING.base, gap: SPACING.sm, alignItems: 'flex-start', marginTop: SPACING.lg,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  nextStepEmoji: { fontSize: 24 },
  nextStepText: { flex: 1, fontSize: FONTS.sizes.sm, color: '#C2410C', lineHeight: 20 },
  footer: {
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.xl, paddingBottom: 34,
    backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  backBtn: {
    padding: SPACING.base, borderRadius: RADIUS.lg, borderWidth: 1.5,
    borderColor: COLORS.border, paddingHorizontal: SPACING.xl,
  },
  backBtnText: { fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '600' },
  nextBtn: {
    flex: 1, backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.sizes.base, fontWeight: '700' },
});
