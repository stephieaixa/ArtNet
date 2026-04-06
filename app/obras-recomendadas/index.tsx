import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Platform,
  Linking, ScrollView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../src/constants/theme';

type Rec = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: string;
  url: string;
  platform: string;
  created_at: string;
  user_email?: string;
};

const TYPES = [
  { id: 'all',       label: 'Todo',      emoji: '✨' },
  { id: 'circus',    label: 'Circo',     emoji: '🎪' },
  { id: 'acrobatics',label: 'Acrobacia', emoji: '🤸' },
  { id: 'aerial',    label: 'Aéreos',    emoji: '🎭' },
  { id: 'variety',   label: 'Varieté',   emoji: '🎩' },
  { id: 'clown',     label: 'Clown',     emoji: '🤡' },
  { id: 'magic',     label: 'Magia',     emoji: '🪄' },
  { id: 'fire',      label: 'Fuego/LED', emoji: '🔥' },
  { id: 'other',     label: 'Otro',      emoji: '🌟' },
];

const PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',   emoji: '▶️' },
  { id: 'vimeo',     label: 'Vimeo',     emoji: '🎬' },
  { id: 'netflix',   label: 'Netflix',   emoji: '🔴' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
  { id: 'other',     label: 'Otro',      emoji: '🌐' },
];

const EMPTY_FORM = { title: '', description: '', type: 'circus', url: '', platform: 'youtube' };

// Videos fijos — siempre aparecen aunque la DB esté vacía
const SEED_RECS: Rec[] = [
  {
    id: 'seed-1',
    user_id: 'system',
    title: 'SUTRA — Sidi Larbi Cherkaoui + Shaolin Monks',
    description: 'Fusión de acrobacia con monjes Shaolin en Sadler\'s Wells Theatre.',
    type: 'acrobatics',
    url: 'https://vimeo.com/202670621',
    platform: 'vimeo',
    created_at: '2020-01-01T00:00:00Z',
  },
  {
    id: 'seed-2',
    user_id: 'system',
    title: 'Le G.Bistaki — Cooperatzia (Aurillac 2013)',
    description: 'Espectáculo de circo callejero en el Festival de Aurillac.',
    type: 'circus',
    url: 'https://youtu.be/ZS30LdonCfc',
    platform: 'youtube',
    created_at: '2020-01-01T00:00:00Z',
  },
  {
    id: 'seed-3',
    user_id: 'system',
    title: 'Le G.Bistaki — Tancarville (Aurillac 2024)',
    description: 'Circo callejero en el Festival de Aurillac 2024.',
    type: 'circus',
    url: 'https://youtu.be/y-MMHgzVwJU',
    platform: 'youtube',
    created_at: '2020-01-01T00:00:00Z',
  },
];

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';

async function aiEnrichVideo(title: string, url: string): Promise<{ description: string; type: string } | null> {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 150,
        messages: [{ role: 'user', content:
          `Sos un asistente para una plataforma de circo y acrobacia. Dado este video:
Título: ${title}
URL: ${url}

1. Escribí una descripción breve en español (1-2 oraciones) que explique de qué se trata.
2. Elegí la categoría más apropiada de esta lista: circus, acrobatics, aerial, variety, clown, magic, fire, other

Respondé SOLO con JSON válido: {"description": "...", "type": "..."}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ── URL helpers ──────────────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/netflix\.com/.test(url)) return 'netflix';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  return 'other';
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^?&\s/]+)/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function getThumbnail(url: string, platform: string): string | null {
  if (platform === 'youtube') {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }
  return null; // Vimeo requires API; shown as placeholder
}

async function fetchOEmbed(url: string, platform: string): Promise<{ title?: string; thumbnail?: string } | null> {
  try {
    let endpoint = '';
    if (platform === 'youtube') {
      endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    } else if (platform === 'vimeo') {
      endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    } else {
      return null;
    }
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, thumbnail: data.thumbnail_url };
  } catch {
    return null;
  }
}

function domainOf(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url.slice(0, 30); }
}

function typeLabel(type: string) {
  return TYPES.find(t => t.id === type && t.id !== 'all')?.label ?? type;
}
function typeEmoji(type: string) {
  return TYPES.find(t => t.id === type)?.emoji ?? '🎬';
}
function platformEmoji(platform: string) {
  return PLATFORMS.find(p => p.id === platform)?.emoji ?? '🌐';
}
function platformLabel(platform: string) {
  return PLATFORMS.find(p => p.id === platform)?.label ?? platform;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ObrasRecomendadasScreen({ isTab = false }: { isTab?: boolean }) {
  const { user } = useAuthStore();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  useFocusEffect(useCallback(() => { loadRecs(); }, []));

  async function loadRecs() {
    setLoading(true);
    const { data } = await supabase
      .from('obra_recommendations')
      .select('*')
      .order('created_at', { ascending: false });
    const dbRecs = data ?? [];
    // Prepend seeds that aren't already in the DB (dedup by URL)
    const dbUrls = new Set(dbRecs.map((r: Rec) => r.url));
    const missing = SEED_RECS.filter(s => !dbUrls.has(s.url));
    setRecs([...missing, ...dbRecs]);
    setLoading(false);
  }

  // Auto-fetch metadata + AI enrichment when URL is pasted
  async function handleUrlChange(url: string) {
    setForm(f => ({ ...f, url }));
    const platform = detectPlatform(url);
    setForm(f => ({ ...f, platform }));
    if (!url.startsWith('http') || url.length < 15) return;
    setFetching(true);

    const meta = await fetchOEmbed(url, platform);
    const title = meta?.title ?? '';
    if (title && !form.title.trim()) {
      setForm(f => ({ ...f, title }));
    }

    // AI: generate description + suggest category from title
    if (title) {
      const enriched = await aiEnrichVideo(title, url);
      if (enriched) {
        setForm(f => ({
          ...f,
          description: f.description.trim() ? f.description : (enriched.description ?? f.description),
          type: enriched.type && enriched.type !== 'other' ? enriched.type : f.type,
        }));
      }
    }

    setFetching(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { Alert.alert('Falta el título'); return; }
    if (!form.url.trim() || !form.url.startsWith('http')) {
      Alert.alert('URL inválida', 'Ingresá una URL válida (https://...)');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('obra_recommendations').insert({
      user_id: user!.id,
      user_email: user?.email,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      url: form.url.trim(),
      platform: detectPlatform(form.url.trim()),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    setForm({ ...EMPTY_FORM });
    loadRecs();
  }

  async function handleDelete(id: string, ownerId: string) {
    if (ownerId !== user?.id) return;
    const doDelete = async () => {
      await supabase.from('obra_recommendations').delete().eq('id', id);
      setRecs(prev => prev.filter(r => r.id !== id));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar esta recomendación?')) doDelete();
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar esta recomendación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doDelete },
    ]);
  }

  const filtered = recs.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
    return true;
  });

  function renderRec({ item }: { item: Rec }) {
    const isOwner = item.user_id === user?.id;
    const thumb = getThumbnail(item.url, item.platform);

    return (
      <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)} activeOpacity={0.88}>
        {/* Thumbnail — solo si existe */}
        {thumb && <Image source={{ uri: thumb }} style={styles.cardThumb} resizeMode="cover" />}

        {/* Badges row */}
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeEmoji(item.type)} {typeLabel(item.type)}</Text>
          </View>
          <View style={styles.platformBadge}>
            <Text style={styles.platformBadgeText}>{platformEmoji(item.platform)} {platformLabel(item.platform)}</Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={() => handleDelete(item.id, item.user_id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardUrl}>{domainOf(item.url)}</Text>
          <View style={styles.watchBtn}>
            <Text style={styles.watchBtnText}>▶ Ver</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const activeFilters = (typeFilter !== 'all' ? 1 : 0) + (platformFilter !== 'all' ? 1 : 0);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        {!isTab && (
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.headerCenter, isTab && { paddingLeft: SPACING.xs }]}>
          <Text style={styles.headerTitle}>🎬 Inspiraciones</Text>
          <Text style={styles.headerSub}>Videos de circo, acrobacia y varieté</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm({ ...EMPTY_FORM }); setModalVisible(true); }}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>Tipo:</Text>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, typeFilter === t.id && styles.chipActive]}
              onPress={() => setTypeFilter(t.id)}
            >
              <Text style={[styles.chipText, typeFilter === t.id && styles.chipTextActive]}>
                {t.emoji} {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>Plataforma:</Text>
          <TouchableOpacity
            style={[styles.chip, platformFilter === 'all' && styles.chipActive]}
            onPress={() => setPlatformFilter('all')}
          >
            <Text style={[styles.chipText, platformFilter === 'all' && styles.chipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {PLATFORMS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, platformFilter === p.id && styles.chipActive]}
              onPress={() => setPlatformFilter(p.id)}
            >
              <Text style={[styles.chipText, platformFilter === p.id && styles.chipTextActive]}>
                {p.emoji} {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{activeFilters > 0 ? '🔍' : '🎭'}</Text>
          <Text style={styles.emptyTitle}>
            {activeFilters > 0 ? 'Sin resultados' : recs.length === 0 ? 'Todavía no hay shows' : 'Sin resultados'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {recs.length === 0
              ? 'Compartí links a shows, espectáculos o actuaciones que valga la pena ver.'
              : 'Probá cambiando los filtros.'}
          </Text>
          {recs.length === 0 && (
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Ser el primero en recomendar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          renderItem={renderRec}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          numColumns={1}
        />
      )}

      {/* Add modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Recomendar un show</Text>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>Publicar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* URL first — auto-fills everything */}
            <Text style={styles.label}>Link del show *</Text>
            <Text style={styles.hint}>
              Pegá el link de YouTube, Vimeo, etc. La IA completa el título, descripción y categoría automáticamente.
            </Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.url}
                onChangeText={handleUrlChange}
                placeholder="https://youtube.com/watch?v=..."
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
              {fetching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
            </View>

            {/* Platform auto-detected */}
            {form.platform && form.platform !== 'other' && (
              <View style={styles.detectedRow}>
                <Text style={styles.detectedText}>
                  {platformEmoji(form.platform)} Plataforma detectada: {platformLabel(form.platform)}
                  {fetching ? '  ·  Analizando con IA...' : ''}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))}
              placeholder="Ej: Alegría – Cirque du Soleil"
            />

            <Text style={styles.label}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
              {TYPES.filter(t => t.id !== 'all').map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, form.type === t.id && styles.typeChipActive]}
                  onPress={() => setForm(f => ({ ...f, type: t.id }))}
                >
                  <Text style={[styles.typeChipText, form.type === t.id && styles.typeChipTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>¿Por qué lo recomendás? (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              multiline
              placeholder="Contá brevemente por qué vale la pena verlo..."
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingTop: HEADER_TOP, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: { padding: SPACING.xs },
  backText: { fontSize: 20, color: COLORS.text },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  addBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '700' },

  filterBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingVertical: SPACING.xs },
  filterRow: { paddingHorizontal: SPACING.base, paddingVertical: 4, gap: SPACING.xs, flexDirection: 'row', alignItems: 'center' },
  filterLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted, marginRight: 4 },
  chip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 4, paddingHorizontal: SPACING.sm, backgroundColor: COLORS.white,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated },
  chipText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },

  list: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 80 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardThumb: { width: '100%', height: 180 },
  cardThumbPlaceholder: {
    width: '100%', height: 140,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  cardThumbEmoji: { fontSize: 48 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, padding: SPACING.sm, paddingBottom: 4 },
  typeBadge: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.full, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  typeBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
  platformBadge: { backgroundColor: '#F3F4F6', borderRadius: RADIUS.full, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  platformBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600' },
  deleteBtn: { marginLeft: 'auto' },
  deleteIcon: { fontSize: 15 },
  cardTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.sm, marginBottom: 4 },
  cardDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight, marginTop: 4 },
  cardUrl: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, flex: 1 },
  watchBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 6, paddingHorizontal: SPACING.md },
  watchBtnText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.base },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm, textAlign: 'center' },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },

  modal: { flex: 1, backgroundColor: COLORS.background, width: '100%', overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 20, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  modalClose: { fontSize: 20, color: COLORS.text, padding: SPACING.xs },
  modalTitle: { flex: 1, fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base },
  saveBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  modalScroll: { flex: 1, width: '100%' },
  modalContent: { padding: SPACING.xl, gap: SPACING.xs },
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: SPACING.sm, marginBottom: 4 },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, lineHeight: 16 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text,
    minWidth: 0,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  detectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  detectedText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  typeChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base,
    marginRight: SPACING.sm, backgroundColor: COLORS.white,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated },
  typeChipText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.primary },
});
