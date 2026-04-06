import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Linking, Share, Platform, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useLanguageStore } from '../../../src/stores/languageStore';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';

const LANG_SUGGESTIONS = [
  { flag: '🇪🇸', name: 'Español' },
  { flag: '🇬🇧', name: 'English' },
  { flag: '🇮🇹', name: 'Italiano' },
  { flag: '🇩🇪', name: 'Deutsch' },
  { flag: '🇫🇷', name: 'Français' },
  { flag: '🇵🇹', name: 'Português' },
  { flag: '🇯🇵', name: '日本語' },
  { flag: '🇸🇦', name: 'العربية' },
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { targetLanguage, isTranslating, setTargetLanguage } = useLanguageStore();
  const { user, setUser, reset } = useAuthStore();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [socials, setSocials] = useState<{ instagram?: string; tiktok?: string; youtube?: string; facebook?: string; website?: string }>({});
  const [editingLang, setEditingLang] = useState(false);
  const [langInput, setLangInput] = useState('');

  const isArtist = user?.role !== 'venue';

  useEffect(() => {
    if (!user?.id) return;
    const table = isArtist ? 'artist_profiles' : 'venue_profiles';
    const nameField = isArtist ? 'display_name' : 'venue_name';
    supabase.from(table).select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.[nameField]) {
          setDisplayName(data[nameField]);
          setProfileComplete(true);
        }
        setProfileChecked(true);
        if (isArtist && data) {
          setSocials({
            instagram: data.instagram_handle || undefined,
            tiktok: data.tiktok_handle || undefined,
            youtube: data.youtube_url || undefined,
            facebook: data.facebook_url || undefined,
            website: data.website_url || undefined,
          });
        }
      });
  }, [user?.id]);

  async function handleAvatarPress() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), t('profile.galleryPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${user!.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('Avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('Avatars').getPublicUrl(fileName);

      // Agregar timestamp para evitar caché
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      setUser({ ...user!, avatar_url: avatarUrl });
    } catch (err: any) {
      Alert.alert(t('common.error'), t('profile.photoError'));
      console.error('[avatar] Upload error:', err.message);
    }
    setUploadingAvatar(false);
  }

  const doLogout = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    reset();
    router.replace('/(auth)/welcome');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.logoutConfirm'))) doLogout();
      return;
    }
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: doLogout },
    ]);
  };

  const artistMenuItems = [
    { emoji: '👤', label: t('profile.editProfile'),    action: () => router.push('/(auth)/onboarding/artist') },
    { emoji: '🖼️', label: t('profile.myPortfolio'),    action: () => router.push('/portfolio') },
    { emoji: '🎭', label: t('profile.myObras'),        action: () => router.push('/obras') },
    { emoji: '📱', label: t('profile.myContacts'),     action: () => router.push('/contactos') },
    { emoji: '🎬', label: t('profile.obrasRecomendadas'), action: () => router.push('/obras-recomendadas') },
    { emoji: '🌐', label: t('profile.suggestSource'),  action: () => router.push('/sources/suggest') },
    { emoji: '🔔', label: t('profile.notifications'),  action: () => router.push('/alerts') },
  ];

  const venueMenuItems = [
    { emoji: '🏨', label: t('profile.editVenueProfile'), action: () => router.push('/(auth)/onboarding/venue') },
    { emoji: '🌐', label: t('profile.suggestSource'),    action: () => router.push('/sources/suggest') },
    { emoji: '🔔', label: t('profile.notifications'),    action: () => router.push('/alerts') },
  ];

  const menuItems = isArtist ? artistMenuItems : venueMenuItems;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />

      {/* Avatar con upload */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarPress} disabled={uploadingAvatar} activeOpacity={0.85}>
          <View style={styles.avatarWrapper}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.avatarEditIcon}>📷</Text>
              }
            </View>
          </View>
        </TouchableOpacity>

        {displayName ? (
          <Text style={styles.displayName}>{displayName}</Text>
        ) : null}
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{isArtist ? t('profile.artistRole') : t('profile.venueRole')}</Text>
        </View>

        {/* Redes sociales */}
        {(socials.instagram || socials.tiktok || socials.youtube || socials.facebook || socials.website) && (
          <View style={styles.socialsRow}>
            {socials.instagram && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(`https://instagram.com/${socials.instagram}`)}
              >
                <Text style={styles.socialBtnText}>📸 Instagram</Text>
              </TouchableOpacity>
            )}
            {socials.tiktok && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(`https://tiktok.com/@${socials.tiktok}`)}
              >
                <Text style={styles.socialBtnText}>🎵 TikTok</Text>
              </TouchableOpacity>
            )}
            {socials.youtube && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(socials.youtube!)}
              >
                <Text style={styles.socialBtnText}>▶️ YouTube</Text>
              </TouchableOpacity>
            )}
            {socials.facebook && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(socials.facebook!)}
              >
                <Text style={styles.socialBtnText}>👤 Facebook</Text>
              </TouchableOpacity>
            )}
            {socials.website && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(socials.website!)}
              >
                <Text style={styles.socialBtnText}>🌐 Web</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Complete profile banner — solo si no completó el perfil y ya cargó el dato */}
      {profileChecked && !profileComplete && (
        <TouchableOpacity
          style={styles.warningCard} activeOpacity={0.85}
          onPress={() => router.push(isArtist ? '/(auth)/onboarding/artist' : '/(auth)/onboarding/venue')}
        >
          <Text style={styles.warningEmoji}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>{t('profile.completeProfile')}</Text>
            <Text style={styles.warningSubtitle}>{t('profile.completeProfileSub')}</Text>
          </View>
          <Text style={styles.warningArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Main menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.myAccount')}</Text>
        {menuItems.map(item => (
          <TouchableOpacity key={item.label} style={styles.menuRow} onPress={item.action} activeOpacity={0.7}>
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.support')}</Text>
        {[
          { emoji: '❓', label: t('profile.helpFaq'),    action: () => Alert.alert(t('common.comingSoon')) },
          { emoji: '📣', label: t('profile.suggestions'), action: () => router.push('/sources/suggest') },
          { emoji: '💡', label: t('profile.appFeedback'), action: () => router.push('/feedback') },
          {
            emoji: '🔗',
            label: t('profile.recommendApp'),
            action: () => Share.share({
              message: t('profile.recommendMsg'),
              url: 'https://artnet-circus.vercel.app',
            }),
          },
        ].map(item => (
          <TouchableOpacity key={item.label} style={styles.menuRow} onPress={item.action} activeOpacity={0.7}>
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Language selector */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => { setLangInput(targetLanguage === 'Español' ? '' : targetLanguage); setEditingLang(v => !v); }}
          activeOpacity={0.7}
        >
          <Text style={styles.menuEmoji}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{t('profile.language')}</Text>
            <Text style={styles.langCurrentText}>{isTranslating ? 'Traduciendo...' : targetLanguage}</Text>
          </View>
          {isTranslating
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={styles.menuArrow}>{editingLang ? '▲' : '›'}</Text>
          }
        </TouchableOpacity>

        {editingLang && (
          <View style={styles.langPanel}>
            <TextInput
              style={styles.langInput}
              value={langInput}
              onChangeText={setLangInput}
              placeholder="Ej: Italiano, Deutsch, 日本語, العربية..."
              autoFocus
              autoCapitalize="words"
            />
            {/* Quick suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langSuggestScroll}>
              <View style={styles.langSuggestRow}>
                {LANG_SUGGESTIONS.map(l => (
                  <TouchableOpacity
                    key={l.name}
                    style={[styles.langSuggestChip, targetLanguage === l.name && styles.langSuggestChipActive]}
                    onPress={() => setLangInput(l.name)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.langSuggestFlag}>{l.flag}</Text>
                    <Text style={[styles.langSuggestName, targetLanguage === l.name && styles.langSuggestNameActive]}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.langApplyBtn, (!langInput.trim() || isTranslating) && styles.langApplyBtnDisabled]}
              onPress={async () => {
                const name = langInput.trim() || 'Español';
                setEditingLang(false);
                await setTargetLanguage(name);
              }}
              disabled={!langInput.trim() || isTranslating}
              activeOpacity={0.85}
            >
              {isTranslating
                ? <><ActivityIndicator size="small" color={COLORS.white} /><Text style={styles.langApplyBtnText}>  Traduciendo toda la app...</Text></>
                : <Text style={styles.langApplyBtnText}>Aplicar idioma →</Text>
              }
            </TouchableOpacity>
            <Text style={styles.langHint}>La IA traduce toda la interfaz. Solo se traduce una vez por idioma.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>{t('profile.version')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingTop: HEADER_TOP, paddingBottom: SPACING.xl },
  avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { fontSize: 36, color: COLORS.white, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  avatarEditIcon: { fontSize: 13 },
  displayName: { fontSize: FONTS.sizes.lg ?? 20, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  email: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  roleBadge: {
    backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: SPACING.base,
  },
  roleText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.primary },
  socialsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, flexWrap: 'wrap', justifyContent: 'center' },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.full, paddingVertical: 6, paddingHorizontal: SPACING.md,
  },
  socialBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  warningCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED',
    borderRadius: RADIUS.lg, marginHorizontal: SPACING.xl, marginBottom: SPACING.xl,
    padding: SPACING.base, borderWidth: 1, borderColor: '#FED7AA', gap: SPACING.sm,
  },
  warningEmoji: { fontSize: 24 },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: '#C2410C' },
  warningSubtitle: { fontSize: FONTS.sizes.xs, color: '#EA580C', marginTop: 2 },
  warningArrow: { fontSize: 18, color: '#EA580C', fontWeight: '700' },
  section: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.base, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: SPACING.base, paddingBottom: SPACING.sm,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.base,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: SPACING.md,
  },
  menuEmoji: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '500' },
  menuArrow: { fontSize: 20, color: COLORS.textMuted },
  langCurrentText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600', marginTop: 1 },
  langPanel: { padding: SPACING.base, paddingTop: 0, gap: SPACING.sm },
  langInput: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  langSuggestScroll: { marginHorizontal: -SPACING.xs },
  langSuggestRow: { flexDirection: 'row', gap: SPACING.xs, paddingHorizontal: SPACING.xs, paddingVertical: 4 },
  langSuggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 5, paddingHorizontal: SPACING.sm, backgroundColor: COLORS.background,
  },
  langSuggestChipActive: { borderColor: COLORS.primary, backgroundColor: '#EDE9FE' },
  langSuggestFlag: { fontSize: 16 },
  langSuggestName: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },
  langSuggestNameActive: { color: COLORS.primary },
  langApplyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.sm,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  langApplyBtnDisabled: { opacity: 0.4 },
  langApplyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  langHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 15 },
  logoutBtn: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, padding: SPACING.base,
    borderRadius: RADIUS.lg, backgroundColor: '#FEF2F2', alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: FONTS.sizes.base, color: COLORS.error, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xl },
});
