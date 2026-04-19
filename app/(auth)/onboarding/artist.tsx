import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../src/constants/theme';
import { DISCIPLINES, DISCIPLINE_CATEGORIES } from '../../../src/constants/disciplines';

const TOTAL_STEPS = 4;

export default function ArtistOnboardingScreen() {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Step 2
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);

  // Step 3 — portfolio
  const [portfolioItems, setPortfolioItems] = useState<{ uri: string; type: 'photo' | 'video' }[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  // Step 4 — availability
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  // Pre-cargar datos existentes
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('artist_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? '');
        setBio(data.bio ?? '');
        setCity(data.city ?? '');
        setCountry(data.country ?? '');
        setSelectedDisciplines(data.disciplines ?? []);
        setAvailableFrom(data.available_from ?? '');
        setAvailableTo(data.available_to ?? '');
        setInstagramHandle(data.instagram_handle ?? '');
        setTiktokHandle(data.tiktok_handle ?? '');
        setYoutubeUrl(data.youtube_url ?? '');
        setFacebookUrl(data.facebook_url ?? '');
        setWebsiteUrl(data.website_url ?? '');
      });
  }, [user?.id]);

  const pickPortfolioMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets.length) return;

    const newItems = result.assets.map(a => ({
      uri: a.uri,
      type: (a.type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    }));
    setPortfolioItems(prev => [...prev, ...newItems]);
  };

  const uploadPortfolioToSupabase = async (userId: string) => {
    if (!portfolioItems.length) return;
    setUploadingPortfolio(true);
    for (let i = 0; i < portfolioItems.length; i++) {
      const item = portfolioItems[i];
      const ext = item.uri.split('.').pop() ?? (item.type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${userId}/${Date.now()}_${i}.${ext}`;
      try {
        const response = await fetch(item.uri);
        const arrayBuffer = await response.arrayBuffer();
        const { error } = await supabase.storage.from('Portfolio').upload(fileName, arrayBuffer, {
          contentType: item.type === 'video' ? `video/${ext}` : `image/${ext}`,
          upsert: false,
        });
        if (!error) {
          const { data } = supabase.storage.from('Portfolio').getPublicUrl(fileName);
          await supabase.from('portfolio_items').insert({
            user_id: userId, type: item.type,
            storage_path: fileName, url: data.publicUrl, sort_order: i,
          });
        }
      } catch (e) { /* continúa con los demás */ }
    }
    setUploadingPortfolio(false);
  };

  const toggleDiscipline = (id: string) => {
    setSelectedDisciplines(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!displayName.trim()) { setErrorMsg('⚠️ Completá tu nombre artístico'); return; }
      if (!city.trim()) { setErrorMsg('⚠️ Completá tu ciudad'); return; }
      if (!country.trim()) { setErrorMsg('⚠️ Completá tu país'); return; }
    }
    if (step === 2 && selectedDisciplines.length === 0) {
      setErrorMsg('⚠️ Seleccioná al menos una disciplina');
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
    const { error } = await supabase.from('artist_profiles').upsert({
      user_id: user.id,
      display_name: displayName.trim(),
      bio: bio.trim(),
      city: city.trim(),
      country: country.trim(),
      disciplines: selectedDisciplines,
      available_from: availableFrom.trim(),
      available_to: availableTo.trim(),
      instagram_handle: instagramHandle.trim() || null,
      tiktok_handle: tiktokHandle.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    setLoading(false);
    if (error) {
      Alert.alert('Error al guardar', error.message);
      return;
    }
    if (portfolioItems.length > 0) {
      await uploadPortfolioToSupabase(user.id);
    }
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header con botón salir */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.stepLabel}>Paso {step} de {TOTAL_STEPS}</Text>

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>👤</Text>
            <Text style={styles.stepTitle}>Tu información básica</Text>
            <Text style={styles.stepSubtitle}>Contanos quién sos</Text>

            <Text style={styles.label}>Nombre artístico *</Text>
            <TextInput style={styles.input} placeholder="Como querés que te conozcan" value={displayName} onChangeText={setDisplayName} />

            <Text style={styles.label}>Bio corta</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Describí tu arte en 2-3 oraciones..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Ciudad *</Text>
            <TextInput style={styles.input} placeholder="Ej: Buenos Aires" value={city} onChangeText={setCity} />

            <Text style={styles.label}>País *</Text>
            <TextInput style={styles.input} placeholder="Ej: Argentina" value={country} onChangeText={setCountry} />

            <Text style={[styles.label, { marginTop: SPACING.xl }]}>Redes sociales (opcional)</Text>
            <Text style={styles.socialHint}>Linkea tu Instagram, TikTok o YouTube para que los venues puedan ver tu trabajo directamente.</Text>

            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>📸</Text>
              <TextInput
                style={[styles.input, styles.socialInput]}
                placeholder="Instagram: @tuusuario"
                value={instagramHandle}
                onChangeText={t => setInstagramHandle(t.replace(/^@/, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>🎵</Text>
              <TextInput
                style={[styles.input, styles.socialInput]}
                placeholder="TikTok: @tuusuario"
                value={tiktokHandle}
                onChangeText={t => setTiktokHandle(t.replace(/^@/, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>▶️</Text>
              <TextInput
                style={[styles.input, styles.socialInput]}
                placeholder="YouTube: link a tu canal"
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>👤</Text>
              <TextInput
                style={[styles.input, styles.socialInput]}
                placeholder="Facebook: link a tu perfil o página"
                value={facebookUrl}
                onChangeText={setFacebookUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <View style={styles.socialRow}>
              <Text style={styles.socialIcon}>🌐</Text>
              <TextInput
                style={[styles.input, styles.socialInput]}
                placeholder="Web: tu sitio personal"
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎨</Text>
            <Text style={styles.stepTitle}>Tus disciplinas</Text>
            <Text style={styles.stepSubtitle}>Seleccioná todo lo que hacés</Text>
            <Text style={styles.selected}>{selectedDisciplines.length} seleccionadas</Text>

            {DISCIPLINE_CATEGORIES.map(cat => (
              <View key={cat} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{cat}</Text>
                <View style={styles.chipGrid}>
                  {DISCIPLINES.filter(d => d.category === cat).map(d => {
                    const active = selectedDisciplines.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleDiscipline(d.id)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎬</Text>
            <Text style={styles.stepTitle}>Tu portfolio</Text>
            <Text style={styles.stepSubtitle}>Subí fotos y videos de tu trabajo</Text>

            <TouchableOpacity style={styles.uploadBox} onPress={pickPortfolioMedia} activeOpacity={0.75}>
              <Text style={styles.uploadEmoji}>📤</Text>
              <Text style={styles.uploadTitle}>
                {portfolioItems.length > 0 ? `${portfolioItems.length} archivo${portfolioItems.length > 1 ? 's' : ''} seleccionado${portfolioItems.length > 1 ? 's' : ''}` : 'Subir fotos / videos'}
              </Text>
              <Text style={styles.uploadSubtitle}>
                {portfolioItems.length > 0 ? 'Tocá para agregar más' : 'JPG, PNG, MP4 — Máx. 100MB por archivo'}
              </Text>
            </TouchableOpacity>

            {portfolioItems.length > 0 && (
              <View style={styles.previewGrid}>
                {portfolioItems.map((item, i) => (
                  <View key={i} style={styles.previewThumb}>
                    <Image source={{ uri: item.uri }} style={styles.previewImage} />
                    {item.type === 'video' && (
                      <View style={styles.videoTag}>
                        <Text style={styles.videoTagText}>▶</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeThumb}
                      onPress={() => setPortfolioItems(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={styles.removeThumbText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.tip}>
              💡 Los perfiles con al menos 1 video de muestra reciben hasta 8x más contactos de venues.
            </Text>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>📅</Text>
            <Text style={styles.stepTitle}>Disponibilidad</Text>
            <Text style={styles.stepSubtitle}>¿Cuándo estás disponible para trabajar?</Text>

            <Text style={styles.label}>Disponible desde</Text>
            <TextInput style={styles.input} placeholder="Ej: Abril 2025" value={availableFrom} onChangeText={setAvailableFrom} />

            <Text style={styles.label}>Disponible hasta</Text>
            <TextInput style={styles.input} placeholder="Ej: Diciembre 2025 (opcional)" value={availableTo} onChangeText={setAvailableTo} />

            <View style={styles.readyCard}>
              <Text style={styles.readyEmoji}>🚀</Text>
              <Text style={styles.readyText}>¡Tu perfil está casi listo! Después podrás completar más detalles desde tu cuenta.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        {!!errorMsg && (
          <Text style={styles.errorMsg}>{errorMsg}</Text>
        )}
        <View style={styles.footerRow}>
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
              {step === TOTAL_STEPS ? '¡Listo! Ir a explorar →' : 'Continuar →'}
            </Text>
          )}
        </TouchableOpacity>
        </View>
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: COLORS.textMuted, fontWeight: '500' },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  stepLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  stepContainer: { gap: SPACING.sm },
  stepEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  stepTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  stepSubtitle: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginBottom: SPACING.md },
  selected: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600', marginBottom: SPACING.sm },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  socialHint: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 17, marginBottom: SPACING.sm },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  socialIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  socialInput: { flex: 1 },
  categoryBlock: { marginTop: SPACING.base },
  categoryTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 7,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  uploadBox: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
  },
  uploadEmoji: { fontSize: 40 },
  uploadTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  uploadSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  previewThumb: { width: 90, height: 90, borderRadius: RADIUS.md, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  videoTag: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  videoTagText: { fontSize: 10, color: COLORS.white },
  removeThumb: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  removeThumbText: { fontSize: 10, color: COLORS.white, fontWeight: '700' },
  tip: {
    backgroundColor: '#EDE9FE',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryDark,
    lineHeight: 20,
    marginTop: SPACING.lg,
  },
  readyCard: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
    alignItems: 'flex-start',
    marginTop: SPACING.lg,
  },
  readyEmoji: { fontSize: 24 },
  readyText: { flex: 1, fontSize: FONTS.sizes.sm, color: '#065F46', lineHeight: 20 },
  footer: {
    flexDirection: 'column',
    gap: SPACING.sm,
    padding: SPACING.xl,
    paddingBottom: 24,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  footerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  backBtn: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.xl,
  },
  backBtnText: { fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '600' },
  nextBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { color: COLORS.white, fontSize: FONTS.sizes.base, fontWeight: '700' },
  errorMsg: {
    width: '100%',
    fontSize: FONTS.sizes.sm,
    color: '#B91C1C',
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
});
