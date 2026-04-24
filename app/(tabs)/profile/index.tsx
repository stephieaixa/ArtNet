import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Linking, Share, Platform, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../src/services/supabase';
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

export default function ProfileScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const { targetLanguage, isTranslating, setTargetLanguage } = useLanguageStore();
  const { user, setUser, reset } = useAuthStore();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [socials, setSocials] = useState<{ instagram?: string; tiktok?: string; youtube?: string; facebook?: string; website?: string }>({});

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

  async function pickAndUploadAvatar() {
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
      const mime = asset.mimeType ?? 'image/jpeg';
      let ext = mime.split('/')[1] ?? 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      const contentType = `image/${ext}`;
      const fileName = `${user!.id}/avatar.${ext}`;

      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/Avatars/${fileName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());

      const { data } = supabase.storage.from('Avatars').getPublicUrl(fileName);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      await supabase.from('artist_profiles').update({ avatar_url: avatarUrl }).eq('user_id', user!.id);
      setUser({ ...user!, avatar_url: avatarUrl });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('profile.photoError'));
      console.error('[avatar] Upload error:', err);
    }
    setUploadingAvatar(false);
  }

  function handleAvatarPress() {
    if (user?.avatar_url) {
      setShowAvatarMenu(true);
    } else {
      pickAndUploadAvatar();
    }
  }

  async function handleRemoveAvatar() {
    setShowAvatarMenu(false);
    setUploadingAvatar(true);
    try {
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      setUser({ ...user!, avatar_url: undefined });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('profile.photoError'));
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

      {(onBack || router.canGoBack()) && (
        <TouchableOpacity onPress={onBack ?? (() => router.back())} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹ Explorar</Text>
        </TouchableOpacity>
      )}

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

      {/* Language selector — dropdown */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.langRow}
          onPress={() => !isTranslating && setShowLangModal(true)}
          activeOpacity={0.7}
          disabled={isTranslating}
        >
          <Text style={styles.menuEmoji}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{t('profile.language')}</Text>
            <Text style={styles.langCurrentText}>
              {isTranslating ? t('language.translating') : targetLanguage}
            </Text>
          </View>
          {isTranslating
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={styles.menuArrow}>›</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Avatar action menu */}
      <Modal visible={showAvatarMenu} transparent animationType="slide" onRequestClose={() => setShowAvatarMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAvatarMenu(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>📷 Foto de perfil</Text>
            <TouchableOpacity
              style={styles.langOption}
              activeOpacity={0.7}
              onPress={() => { setShowAvatarMenu(false); pickAndUploadAvatar(); }}
            >
              <Text style={styles.langOptionFlag}>🖼️</Text>
              <Text style={styles.langOptionName}>Cambiar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langOption}
              activeOpacity={0.7}
              onPress={handleRemoveAvatar}
            >
              <Text style={styles.langOptionFlag}>🗑️</Text>
              <Text style={[styles.langOptionName, { color: COLORS.error }]}>Eliminar foto</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language picker modal */}
      <Modal visible={showLangModal} transparent animationType="slide" onRequestClose={() => setShowLangModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('language.select')}</Text>
            {LANG_SUGGESTIONS.map(l => {
              const active = targetLanguage === l.name;
              return (
                <TouchableOpacity
                  key={l.name}
                  style={[styles.langOption, active && styles.langOptionActive]}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setShowLangModal(false);
                    if (active) return;
                    const ok = await setTargetLanguage(l.name);
                    if (!ok) Alert.alert(t('common.error'), t('language.translationError'));
                  }}
                >
                  <Text style={styles.langOptionFlag}>{l.flag}</Text>
                  <Text style={[styles.langOptionName, active && styles.langOptionNameActive]}>{l.name}</Text>
                  {active && <Text style={styles.langCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <Text style={styles.langHint}>{t('language.hint')}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>{t('profile.version')}</Text>

      <TouchableOpacity style={styles.poweredBy} onPress={() => Linking.openURL('https://the.tat.rocks/')} activeOpacity={0.7}>
        <Text style={styles.poweredByText}>Powered by</Text>
        <Image source={require('../../../assets/tat-logo.png')} style={styles.poweredByLogo} resizeMode="contain" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  backBtn: { paddingTop: HEADER_TOP, paddingHorizontal: SPACING.lg, paddingBottom: 4 },
  backBtnText: { fontSize: 17, color: COLORS.primary, fontWeight: '600' },
  avatarSection: { alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.xl },
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
  langRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.base,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: SPACING.md,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, paddingTop: SPACING.sm,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.base,
  },
  modalTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm,
  },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: 14, paddingHorizontal: SPACING.xl,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  langOptionActive: { backgroundColor: '#F5F3FF' },
  langOptionFlag: { fontSize: 24 },
  langOptionName: { flex: 1, fontSize: FONTS.sizes.base, fontWeight: '500', color: COLORS.text },
  langOptionNameActive: { color: COLORS.primary, fontWeight: '700' },
  langCheck: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  langHint: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.base, lineHeight: 16,
  },
  logoutBtn: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, padding: SPACING.base,
    borderRadius: RADIUS.lg, backgroundColor: '#FEF2F2', alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: FONTS.sizes.base, color: COLORS.error, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xl },
  poweredBy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SPACING.sm, marginBottom: SPACING.xl },
  poweredByText: { fontSize: 10, color: COLORS.textMuted },
  poweredByLogo: { width: 20, height: 20 },
});
