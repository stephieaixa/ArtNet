import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput,
  Linking, Dimensions, Platform, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../src/services/supabase';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '../../src/stores/authStore';
import { getDisciplineLabel } from '../../src/constants/disciplines';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');
const GRID_GAP = SPACING.sm ?? 8;
const GRID_ITEM = (width - (SPACING.base ?? 16) * 2 - GRID_GAP) / 2;

type ItemType = 'photo' | 'video' | 'document' | 'link';

type PortfolioItem = {
  id: string;
  type: ItemType;
  url: string;
  title?: string;
  storage_path?: string;
  sort_order: number;
  created_at: string;
};

type ArtistProfile = {
  display_name: string;
  bio: string;
  city: string;
  country: string;
  disciplines: string[];
  instagram_handle?: string;
  tiktok_handle?: string;
  youtube_url?: string;
  facebook_url?: string;
  website_url?: string;
};

function domainOf(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function iconForLink(url: string) {
  const d = url.toLowerCase();
  if (d.includes('instagram'))                               return '📸';
  if (d.includes('tiktok'))                                  return '🎵';
  if (d.includes('youtube') || d.includes('youtu.be'))      return '▶️';
  if (d.includes('facebook') || d.includes('fb.com'))       return '👤';
  if (d.includes('vimeo'))                                   return '🎬';
  if (d.includes('linkedin'))                                return '💼';
  if (d.includes('drive.google') || d.includes('dropbox'))  return '📁';
  if (d.includes('linktree') || d.includes('linktr.ee'))    return '🌿';
  return '🔗';
}

// ── Cross-platform action sheet ───────────────────────────────────────────────

type MenuOption = { label: string; onPress: () => void; destructive?: boolean };

function OptionsMenu({ visible, onClose, options }: {
  visible: boolean;
  onClose: () => void;
  options: MenuOption[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={menuStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={menuStyles.sheet}>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[menuStyles.option, opt.destructive && menuStyles.optionDestructive,
                      i < options.length - 1 && menuStyles.optionBorder]}
              onPress={() => { onClose(); opt.onPress(); }}
              activeOpacity={0.7}
            >
              <Text style={[menuStyles.optionText, opt.destructive && menuStyles.optionTextDestructive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[menuStyles.option, menuStyles.cancelOption]} onPress={onClose} activeOpacity={0.7}>
            <Text style={menuStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, overflow: 'hidden',
  },
  option: { paddingVertical: 18, paddingHorizontal: 24 },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border ?? '#E5E7EB' },
  optionDestructive: {},
  optionText: { fontSize: FONTS.sizes.base ?? 16, fontWeight: '600', color: COLORS.text },
  optionTextDestructive: { color: COLORS.error ?? '#EF4444' },
  cancelOption: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border ?? '#E5E7EB' },
  cancelText: { fontSize: FONTS.sizes.base ?? 16, color: COLORS.textSecondary ?? '#6B7280', textAlign: 'center' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const { user } = useAuthStore();
  const [profile, setProfile]   = useState<ArtistProfile | null>(null);
  const [items, setItems]       = useState<PortfolioItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  // Add link modal
  const [linkModal, setLinkModal] = useState(false);
  const [linkUrl, setLinkUrl]     = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [profileRes, itemsRes] = await Promise.all([
      supabase.from('artist_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('portfolio_items').select('*').eq('user_id', user.id).order('sort_order'),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (itemsRes.data)   setItems(itemsRes.data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const mediaItems = items.filter(i => i.type === 'photo' || i.type === 'video');
  const docItems   = items.filter(i => i.type === 'document');
  const linkItems  = items.filter(i => i.type === 'link');

  // ── Delete ────────────────────────────────────────────
  async function deleteItem(item: PortfolioItem) {
    Alert.alert('Eliminar', '¿Eliminar este elemento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          setItems(prev => prev.filter(i => i.id !== item.id));
          if (item.storage_path) {
            await supabase.storage.from('Portfolio').remove([item.storage_path]);
          }
          await supabase.from('portfolio_items').delete().eq('id', item.id);
        },
      },
    ]);
  }

  // ── Upload file ───────────────────────────────────────
  async function uploadFile(uri: string, type: ItemType, nameOverride?: string) {
    const ext = uri.split('?')[0].split('.').pop()?.toLowerCase()
      ?? (type === 'video' ? 'mp4' : type === 'document' ? 'pdf' : 'jpg');
    const fileName = `${user!.id}/${Date.now()}.${ext}`;
    const contentType =
      type === 'video'    ? `video/${ext}` :
      type === 'document' ? (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream') :
      `image/${ext}`;

    try {
      if (type === 'video') {
        // Videos: upload nativo con FileSystem para no cargar el archivo entero en RAM
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? SUPABASE_ANON_KEY;
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/Portfolio/${fileName}`;

        const result = await FileSystem.uploadAsync(uploadUrl, uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': contentType,
          },
        });

        if (result.status >= 300) {
          throw new Error(`Upload failed: ${result.body}`);
        }
      } else {
        // Fotos y documentos: approach normal (son pequeños, caben en RAM)
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const { error } = await supabase.storage
          .from('Portfolio')
          .upload(fileName, arrayBuffer, { contentType, upsert: false });
        if (error) throw error;
      }

      const { data: urlData } = supabase.storage.from('Portfolio').getPublicUrl(fileName);
      const { data: dbData, error: dbError } = await supabase.from('portfolio_items').insert({
        user_id: user!.id, type, storage_path: fileName,
        url: urlData.publicUrl,
        title: nameOverride ?? null,
        sort_order: items.length,
      }).select().single();

      if (!dbError && dbData) setItems(prev => [...prev, dbData]);
    } catch (e: any) {
      Alert.alert('Error al subir', 'Verificá tu conexión o intentá con un clip más corto.');
      console.error('[portfolio upload]', e.message);
    }
  }

  // ── Add media ─────────────────────────────────────────
  async function addMedia() {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 90, // 90 seg máx para mantener tamaño razonable
    });
    if (result.canceled || !result.assets.length) return;

    for (const asset of result.assets) {
      const isVideo = asset.type === 'video';
      setUploading(isVideo ? 'Subiendo video…' : 'Subiendo foto…');
      await uploadFile(asset.uri, isVideo ? 'video' : 'photo');
    }
    setUploading(null);
  }

  // ── Add document ──────────────────────────────────────
  async function addDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const doc = result.assets[0];
    setUploading(`Subiendo ${doc.name}…`);
    await uploadFile(doc.uri, 'document', doc.name);
    setUploading(null);
  }

  // ── Save link ─────────────────────────────────────────
  async function saveLink() {
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    setSavingLink(true);
    const { data, error } = await supabase.from('portfolio_items').insert({
      user_id: user!.id, type: 'link', url,
      title: linkTitle.trim() || domainOf(url),
      storage_path: '', sort_order: items.length,
    }).select().single();
    setSavingLink(false);

    if (!error && data) {
      setItems(prev => [...prev, data]);
      setLinkModal(false);
      setLinkUrl('');
      setLinkTitle('');
    } else {
      Alert.alert('Error', 'No se pudo guardar el link.');
    }
  }

  // ── Render ────────────────────────────────────────────
  if (loading) {
    return <View style={s.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mi Portfolio</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowMenu(true)}>
          <Text style={s.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Artist card ── */}
        <View style={s.card}>
          <View style={s.cardTop}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarLetter}>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
            }
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{profile?.display_name ?? user?.email}</Text>
              {!!profile?.city && (
                <Text style={s.cardLocation}>
                  📍 {profile.city}{profile.country ? `, ${profile.country}` : ''}
                </Text>
              )}
              {!!profile?.bio && (
                <Text style={s.cardBio} numberOfLines={3}>{profile.bio}</Text>
              )}
            </View>
          </View>

          {/* Discipline tags */}
          {(profile?.disciplines?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={s.tagsScroll} contentContainerStyle={s.tagsRow}>
              {profile!.disciplines.map(id => (
                <View key={id} style={s.tag}>
                  <Text style={s.tagText}>{getDisciplineLabel(id)}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Social / web links */}
          {(profile?.website_url || profile?.instagram_handle || profile?.tiktok_handle ||
            profile?.youtube_url || profile?.facebook_url) && (
            <View style={s.socialRow}>
              {profile?.website_url && (
                <TouchableOpacity style={s.socialChip} onPress={() => Linking.openURL(profile.website_url!)}>
                  <Text style={s.socialText}>🌐 Sitio web</Text>
                </TouchableOpacity>
              )}
              {profile?.instagram_handle && (
                <TouchableOpacity style={s.socialChip}
                  onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram_handle}`)}>
                  <Text style={s.socialText}>📸 Instagram</Text>
                </TouchableOpacity>
              )}
              {profile?.tiktok_handle && (
                <TouchableOpacity style={s.socialChip}
                  onPress={() => Linking.openURL(`https://tiktok.com/@${profile.tiktok_handle}`)}>
                  <Text style={s.socialText}>🎵 TikTok</Text>
                </TouchableOpacity>
              )}
              {profile?.youtube_url && (
                <TouchableOpacity style={s.socialChip} onPress={() => Linking.openURL(profile.youtube_url!)}>
                  <Text style={s.socialText}>▶️ YouTube</Text>
                </TouchableOpacity>
              )}
              {profile?.facebook_url && (
                <TouchableOpacity style={s.socialChip} onPress={() => Linking.openURL(profile.facebook_url!)}>
                  <Text style={s.socialText}>👤 Facebook</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Upload progress */}
        {!!uploading && (
          <View style={s.uploadBar}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={s.uploadText}>{uploading}</Text>
          </View>
        )}

        {/* ── Fotos & Videos ── */}
        {mediaItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Fotos & Videos</Text>
              <View style={s.badge}><Text style={s.badgeText}>{mediaItems.length}</Text></View>
            </View>
            <View style={s.grid}>
              {mediaItems.map(item => (
                <TouchableOpacity key={item.id} style={s.gridCell}
                  onPress={() => item.type === 'video' ? Linking.openURL(item.url) : setFullscreenUrl(item.url)}
                  onLongPress={() => deleteItem(item)}
                  activeOpacity={0.85}
                >
                  {item.type === 'video' ? (
                    <View style={s.videoPlaceholder}>
                      <View style={s.playCircle}>
                        <Text style={s.playIcon}>▶</Text>
                      </View>
                      {item.title ? (
                        <Text style={s.videoTitle} numberOfLines={2}>{item.title}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Image source={{ uri: item.url }} style={s.gridImg} resizeMode="cover" />
                  )}
                  <TouchableOpacity style={s.deleteBtn} onPress={() => deleteItem(item)}>
                    <Text style={s.deleteX}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Documentos ── */}
        {docItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Documentos</Text>
              <View style={s.badge}><Text style={s.badgeText}>{docItems.length}</Text></View>
            </View>
            {docItems.map(item => (
              <TouchableOpacity key={item.id} style={s.rowCard}
                onPress={() => Linking.openURL(item.url)}
                onLongPress={() => deleteItem(item)}
                activeOpacity={0.85}
              >
                <View style={s.docIconBox}>
                  <Text style={s.docEmoji}>📄</Text>
                </View>
                <View style={s.rowInfo}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.title ?? 'Documento'}</Text>
                </View>
                <Text style={s.rowArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Links ── */}
        {linkItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Links</Text>
              <View style={s.badge}><Text style={s.badgeText}>{linkItems.length}</Text></View>
            </View>
            {linkItems.map(item => (
              <TouchableOpacity key={item.id} style={s.rowCard}
                onPress={() => Linking.openURL(item.url)}
                onLongPress={() => deleteItem(item)}
                activeOpacity={0.85}
              >
                <Text style={s.linkEmoji}>{iconForLink(item.url)}</Text>
                <View style={s.rowInfo}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.title ?? domainOf(item.url)}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>{domainOf(item.url)}</Text>
                </View>
                <Text style={s.rowArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {items.length === 0 && !uploading && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🎪</Text>
            <Text style={s.emptyTitle}>Tu portfolio está vacío</Text>
            <Text style={s.emptySub}>
              Agregá fotos, videos, documentos PDF o links para mostrar tu trabajo a los venues
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowMenu(true)}>
              <Text style={s.emptyBtnText}>+ Agregar primer elemento</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add options menu ── */}
      <OptionsMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        options={[
          { label: '📷  Fotos y Videos',      onPress: addMedia },
          { label: '📄  Documento (PDF)',      onPress: addDocument },
          { label: '🔗  Agregar link o página', onPress: () => setLinkModal(true) },
        ]}
      />

      {/* ── Fullscreen photo viewer ── */}
      <Modal visible={!!fullscreenUrl} transparent animationType="fade" onRequestClose={() => setFullscreenUrl(null)}>
        <View style={s.fullscreenBg}>
          <SafeAreaView style={s.fullscreenSafe}>
            <TouchableOpacity style={s.fullscreenClose} onPress={() => setFullscreenUrl(null)}>
              <Text style={s.fullscreenCloseText}>✕</Text>
            </TouchableOpacity>
          </SafeAreaView>
          {fullscreenUrl && (
            <Image source={{ uri: fullscreenUrl }} style={s.fullscreenImg} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* ── Add link modal ── */}
      <Modal visible={linkModal} animationType="slide" presentationStyle="formSheet"
        onRequestClose={() => setLinkModal(false)}>
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setLinkModal(false)}>
              <Text style={s.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Agregar link</Text>
            <TouchableOpacity onPress={saveLink} disabled={savingLink || !linkUrl.trim()}>
              {savingLink
                ? <ActivityIndicator color={COLORS.primary} />
                : <Text style={[s.modalSave, !linkUrl.trim() && { opacity: 0.3 }]}>Guardar</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.inputLabel}>URL *</Text>
            <TextInput
              style={s.textInput}
              placeholder="https://misitioweb.com"
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
              autoFocus
            />
            <Text style={s.inputHint}>
              Puede ser tu sitio web, showreel (YouTube / Vimeo), Linktree, Google Drive, Dropbox, etc.
            </Text>

            <Text style={[s.inputLabel, { marginTop: SPACING.lg ?? 24 }]}>Título (opcional)</Text>
            <TextInput
              style={s.textInput}
              placeholder="Ej: Showreel 2024, Technical Rider, Linktree…"
              value={linkTitle}
              onChangeText={setLinkTitle}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingTop: 56, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: SPACING.sm },
  backText:    { fontSize: 22, color: COLORS.primary },
  headerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  addBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 7, paddingHorizontal: SPACING.md },
  addBtnText:  { fontSize: FONTS.sizes.sm, color: COLORS.white, fontWeight: '700' },
  scroll:      { paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: COLORS.white, margin: SPACING.base,
    borderRadius: RADIUS.xl, padding: SPACING.base,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
      default: { boxShadow: '0 2px 12px rgba(0,0,0,0.07)' } as any,
    }),
  },
  cardTop:     { flexDirection: 'row', gap: SPACING.base, marginBottom: SPACING.md },
  avatar:      { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:   { fontSize: 28, color: COLORS.white, fontWeight: '700' },
  cardInfo:    { flex: 1 },
  cardName:    { fontSize: FONTS.sizes.lg ?? 20, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  cardLocation:{ fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  cardBio:     { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18 },
  tagsScroll:  { marginBottom: SPACING.sm },
  tagsRow:     { flexDirection: 'row', gap: SPACING.xs, paddingRight: SPACING.sm },
  tag:         { backgroundColor: COLORS.surfaceElevated ?? '#F0EDFF', borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm },
  tagText:     { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.primary },
  socialRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  socialChip:  { backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingVertical: 5, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  socialText:  { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.text },

  // Upload bar
  uploadBar:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.white, marginHorizontal: SPACING.base, marginBottom: SPACING.sm, borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1, borderColor: (COLORS.primary ?? '#7C3AED') + '30' },
  uploadText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '500' },

  // Section
  section:     { marginHorizontal: SPACING.base, marginBottom: SPACING.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  sectionTitle:{ fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  badge:       { backgroundColor: COLORS.surfaceElevated ?? '#F0EDFF', borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:   { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },
  hint:        { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs },

  // Grid
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  gridCell:    { width: GRID_ITEM, height: GRID_ITEM, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.border },
  gridImg:     { width: '100%', height: '100%' },
  videoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', gap: 8, padding: SPACING.sm },
  playCircle:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  playIcon:    { fontSize: 18, color: '#fff', marginLeft: 3 },
  videoTitle:  { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 14 },
  deleteBtn:   { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  deleteX:     { color: COLORS.white, fontSize: 16, fontWeight: '700', lineHeight: 18 },

  // Row cards (docs & links)
  rowCard:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  docIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  docEmoji:   { fontSize: 22 },
  linkEmoji:  { fontSize: 22, width: 32, textAlign: 'center' },
  rowInfo:    { flex: 1 },
  rowTitle:   { fontSize: FONTS.sizes.base, fontWeight: '600', color: COLORS.text },
  rowMeta:    { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  rowArrow:   { fontSize: 18, color: COLORS.textMuted },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: SPACING.xxl ?? 48, paddingHorizontal: SPACING.xl },
  emptyEmoji:  { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle:  { fontSize: FONTS.sizes.lg ?? 20, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  emptySub:    { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl },
  emptyBtnText:{ fontSize: FONTS.sizes.base, color: COLORS.white, fontWeight: '700' },

  // Fullscreen
  fullscreenBg:    { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  fullscreenSafe:  { position: 'absolute', top: 0, right: 0, zIndex: 10 },
  fullscreenClose: { margin: SPACING.base, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fullscreenImg:   { width: '100%', height: '100%' },

  // Modal
  modalWrap:   { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.base, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:  { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  modalCancel: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  modalSave:   { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.primary },
  modalBody:   { padding: SPACING.xl },
  inputLabel:  { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  textInput:   { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text },
  inputHint:   { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 16 },
});
