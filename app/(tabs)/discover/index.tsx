import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, ActivityIndicator, Image, Alert,
  Platform, Linking, Modal,
} from 'react-native';
import { openExternalUrl } from '../../../src/utils/openUrl';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../src/stores/authStore';
import { useDiscoverStore } from '../../../src/stores/discoverStore';
import { useLanguageStore } from '../../../src/stores/languageStore';
import { translateBatch } from '../../../src/services/translate';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';
import { VENUE_TYPES } from '../../../src/constants/venueTypes';
import { DISCIPLINES, DISCIPLINE_GENRES, getDisciplinesByGenre } from '../../../src/constants/disciplines';
import FilterModal, { FilterState } from '../../../src/components/shared/FilterModal';
import SuggestSourceModal from '../../../src/components/shared/SuggestSourceModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchJobs, archiveExpiredJobs, type ScrapedJob } from '../../../src/services/jobs';
import { popDeletedIds } from '../../../src/utils/feedRefresh';
import { supabase } from '../../../src/services/supabase';
import type { JobPost } from '../../../src/types';

const ADMIN_EMAIL = 'circusworldlife@gmail.com';

type ArtistProfile = {
  user_id: string;
  display_name: string;
  bio?: string;
  city?: string;
  country?: string;
  disciplines?: string[];
  avatar_url?: string;
};

function ArtistCard({ profile }: { profile: ArtistProfile }) {
  const initial = profile.display_name?.[0]?.toUpperCase() ?? '?';
  const discs = (profile.disciplines ?? []).slice(0, 3);
  return (
    <TouchableOpacity
      style={styles.artistCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/artists/${profile.user_id}` as any)}
    >
      <View style={styles.artistAvatar}>
        {profile.avatar_url
          ? <Image source={{ uri: profile.avatar_url }} style={styles.artistAvatarImage} />
          : <Text style={styles.artistAvatarText}>{initial}</Text>
        }
      </View>
      <View style={styles.artistInfo}>
        <Text style={styles.artistName}>{profile.display_name}</Text>
        {(profile.city || profile.country) && (
          <Text style={styles.artistLocation}>📍 {[profile.city, profile.country].filter(Boolean).join(', ')}</Text>
        )}
        {discs.length > 0 && (
          <View style={styles.artistDisciplinesRow}>
            {discs.map(d => <Text key={d} style={styles.artistChip}>{d}</Text>)}
          </View>
        )}
        {profile.bio ? <Text style={styles.artistBio} numberOfLines={2}>{profile.bio}</Text> : null}
      </View>
      <Text style={styles.artistArrow}>›</Text>
    </TouchableOpacity>
  );
}



function formatPay(job: JobPost, payNegotiable: string) {
  if (job.pay_type === 'negotiable' || (!job.pay_min && !job.pay_max)) return payNegotiable;
  const currency = job.pay_currency === 'USD' ? 'US$' : job.pay_currency === 'EUR' ? '€' : job.pay_currency;
  if (job.pay_min && job.pay_max) return `${currency}${job.pay_min}–${job.pay_max}`;
  if (job.pay_min) return `${currency}${job.pay_min}+`;
  return `${currency}${job.pay_max}`;
}

function timeAgo(dateStr: string, today: string, yesterday: string, daysAgoFn: (count: number) => string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return today;
  if (days === 1) return yesterday;
  return daysAgoFn(days);
}

function JobCard({ job, translatedTitle, translatedDesc, selecting = false, isSelected = false, onSelect, onLongPress }: {
  job: JobPost;
  translatedTitle?: string;
  translatedDesc?: string;
  selecting?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const venueType = VENUE_TYPES.find(v => v.id === job.venue_type);
  const score = job.match_score ? Math.round(job.match_score * 100) : null;
  const flyerUrl = (job as any)._flyer_url as string | null | undefined;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      activeOpacity={0.88}
      onPress={() => {
        if (selecting) { onSelect?.(); return; }
        router.push(`/jobs/${job.id}`);
      }}
      onLongPress={() => onLongPress?.()}
    >
      {selecting && (
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      )}
      {flyerUrl ? (
        <Image source={{ uri: flyerUrl }} style={styles.cardFlyer} resizeMode="cover" />
      ) : null}
      <View style={[styles.cardInner, flyerUrl ? styles.cardInnerWithFlyer : null]}>
      <View style={styles.cardHeader}>
        <View style={styles.venueTag}>
          <Text style={styles.venueTagEmoji}>{venueType?.emoji}</Text>
          <Text style={styles.venueTagText}>{venueType?.label}</Text>
        </View>
        {score && (
          <View style={[styles.matchBadge, score >= 85 ? styles.matchHigh : score >= 70 ? styles.matchMid : styles.matchLow]}>
            <Text style={styles.matchText}>{score}% match</Text>
          </View>
        )}
      </View>

      <Text style={styles.jobTitle}>{decodeEntities(translatedTitle ?? job.title ?? '')}</Text>

      <View style={styles.venueRow}>
        <Text style={styles.venueName}>{job.venue?.name}</Text>
        {job.venue?.verified && <Text style={styles.verifiedBadge}> ✓</Text>}
        <Text style={styles.dot}> · </Text>
        <Text style={styles.location}>{job.location_city}, {job.location_country}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>{decodeEntities(translatedDesc ?? job.description ?? '')}</Text>

      <View style={styles.disciplineTags}>
        {job.disciplines_needed.slice(0, 3).map(d => {
          const disc = DISCIPLINES.find(x => x.id === d);
          return (
            <View key={d} style={styles.tag}>
              <Text style={styles.tagText}>{disc?.label ?? d}</Text>
            </View>
          );
        })}
        {job.disciplines_needed.length > 3 && (
          <Text style={styles.moreTag}>+{job.disciplines_needed.length - 3}</Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.pay}>{formatPay(job, t('discover.payNegotiable'))}{job.pay_type !== 'negotiable' && job.pay_min && <Text style={styles.payPer}> / {job.pay_type === 'monthly' ? t('discover.perMonth') : job.pay_type === 'per_show' ? t('discover.perShow') : job.pay_type}</Text>}</Text>
        <View style={styles.footerRight}>
          <Text style={styles.apps}>{t('discover.applications_other', { count: job.application_count })}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.timeAgo}>{timeAgo(job.created_at, t('discover.today'), t('discover.yesterday'), (count) => t('discover.daysAgo', { count }))}</Text>
        </View>
      </View>
      </View>
    </TouchableOpacity>
  );
}

const PLATFORM_CARD_TITLES = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'whatsapp', 'telegram'];
const PLATFORM_IMAGE_CDN = [
  'cdninstagram.com', 'instagram.com', 'fbcdn.net', 'facebook.com',
  'ytimg.com', 'ggpht.com', 'pbs.twimg.com', 'static.tiktokcdn.com', 'rsrc.php',
];

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&oacute;/g, 'ó').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ');
}

// Adapta un ScrapedJob (de Supabase) al formato JobPost que usa JobCard
function adaptScrapedJob(j: ScrapedJob): JobPost {
  const isPlatformTitle = PLATFORM_CARD_TITLES.includes((j.title ?? '').toLowerCase().trim());
  const socialLink = j.contact_url || j.source_url || '';
  const platformName = socialLink.includes('instagram') ? 'Instagram'
    : socialLink.includes('facebook') || socialLink.includes('fb.com') ? 'Facebook'
    : socialLink.includes('whatsapp') || socialLink.includes('wa.me') ? 'WhatsApp'
    : socialLink.includes('tiktok') ? 'TikTok'
    : socialLink.includes('youtube') || socialLink.includes('youtu.be') ? 'YouTube'
    : socialLink.includes('telegram') || socialLink.includes('t.me') ? 'Telegram'
    : null;

  const displayTitle = isPlatformTitle && platformName
    ? `Publicación en ${platformName}`
    : decodeEntities(j.title ?? '');

  const isFlyerUseful = !!j.flyer_url &&
    !PLATFORM_IMAGE_CDN.some(d => j.flyer_url!.includes(d));

  return {
    id: j.id,
    venue_id: '',
    title: displayTitle,
    description: decodeEntities(j.description ?? ''),
    disciplines_needed: j.disciplines ?? [],
    venue_type: j.venue_type ?? 'other',
    contract_type: 'seasonal',
    location_city: j.location_city ?? '',
    location_country: j.location_country ?? '',
    remote_possible: false,
    pay_type: 'negotiable',
    pay_currency: 'USD',
    status: 'published',
    view_count: 0,
    application_count: 0,
    created_at: j.scraped_at ?? j.created_at,
    updated_at: j.created_at,
    match_score: undefined,
    venue: {
      id: '', user_id: '', name: j.venue_name ?? '',
      venue_type: j.venue_type ?? 'other',
      description: '', location_city: j.location_city ?? '',
      location_country: j.location_country ?? '',
      contact_name: '', contact_title: '',
      verified: false, created_at: '', updated_at: '',
    },
    // Extra fields for scraped jobs
    _translations: (j as any).translations,
    _source_name: j.source_name,
    _source_url: j.source_url,
    _contact_url: j.contact_url,
    _pay_info: j.pay_info,
    _is_scraped: j.is_scraped,
    _flyer_url: isFlyerUseful ? j.flyer_url : null,
  } as any;
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { filters, search, setFilters, setSearch } = useDiscoverStore();
  const { targetLanguage } = useLanguageStore();
  const isDefaultLang = targetLanguage === 'Español';
  const [titleMap, setTitleMap] = useState<Record<string, string>>({});
  const [descMap, setDescMap] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [liveJobs, setLiveJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSourcesBanner, setShowSourcesBanner] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [showPending, setShowPending] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? sessionStorage.getItem('artnet_pending_open') === '1'
      : false
  );
  const [editingTitles, setEditingTitles] = useState<Record<string, string | null>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState<Record<string, boolean>>({});
  const [uploadingImage, setUploadingImage] = useState<Record<string, boolean>>({});
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, boolean>>({});
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const [openedLinks, setOpenedLinks] = useState<Record<string, boolean>>({});
  const [fetchingPreview, setFetchingPreview] = useState<Record<string, boolean>>({});
  const [linkPreviews, setLinkPreviews] = useState<Record<string, { image: string | null; title: string | null; is_login_wall: boolean } | null>>({});
  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const flatListRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);

  // Persist pending panel open state so it survives tab switches on iOS Safari
  function openPendingPanel() {
    if (Platform.OS === 'web') sessionStorage.setItem('artnet_pending_open', '1');
    setShowPending(true);
  }
  function closePendingPanel() {
    if (Platform.OS === 'web') sessionStorage.removeItem('artnet_pending_open');
    setShowPending(false);
  }

  useFocusEffect(useCallback(() => {
    // Remove any jobs deleted from the detail screen
    const deleted = popDeletedIds();
    if (deleted.size > 0) {
      setLiveJobs(prev => prev.filter(j => !deleted.has(j.id)));
      setPendingJobs(prev => prev.filter(j => !deleted.has(j.id)));
    }
    // Restore scroll position when returning from a detail screen
    const offset = scrollOffsetRef.current;
    if (offset <= 0) return;
    const t1 = setTimeout(() => flatListRef.current?.scrollToOffset?.({ offset, animated: false }), 100);
    const t2 = setTimeout(() => flatListRef.current?.scrollToOffset?.({ offset, animated: false }), 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []));
  const isArtist = user?.role !== 'venue';
  const isAdmin = user?.email === ADMIN_EMAIL;

  const activeFilterCount =
    filters.venueTypes.length + filters.regions.length + filters.countries.length +
    filters.genres.length + filters.disciplines.length + filters.months.length;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const session = await supabase.auth.getSession();
    const jwt = session.data.session?.access_token;
    const results = await Promise.all(ids.map(id =>
      fetch('/api/admin-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'delete', jobId: id }),
      }).then(r => r.ok ? id : null)
    ));
    const deleted = new Set(results.filter(Boolean));
    setLiveJobs(prev => prev.filter(j => !deleted.has(j.id)));
    setSelected(new Set());
    setSelecting(false);
  }

  // Cargar pending_review para admin + auto-archivar expirados
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('scraped_jobs')
      .select('id,title,venue_name,contact_email,contact_url,source_url,source_name,location_city,location_country,description,pay_info,disciplines,ai_insights,flyer_url,scraped_at')
      .eq('status', 'pending_review').order('scraped_at', { ascending: false })
      .then(({ data }) => setPendingJobs(data ?? []));
    // archiveExpiredJobs deshabilitado — se corre solo desde el cron de Vercel
  }, [isAdmin]);

  async function adminAction(action: 'approve' | 'delete', id: string): Promise<boolean> {
    try {
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token;
      const r = await fetch('/api/admin-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify({ action, jobId: id }),
      });
      if (!r.ok) {
        const err = await r.text().catch(() => String(r.status));
        Alert.alert('Error', `No se pudo ${action === 'delete' ? 'eliminar' : 'publicar'}: ${err}`);
        return false;
      }
      return true;
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Error de red');
      return false;
    }
  }

  async function approveJob(id: string) {
    const ok = await adminAction('approve', id);
    if (ok) setPendingJobs(prev => prev.filter(j => j.id !== id));
  }

  async function rejectJob(id: string) {
    const ok = await adminAction('delete', id);
    if (ok) setPendingJobs(prev => prev.filter(j => j.id !== id));
  }

  async function toggleGenreOnJob(job: any, genreId: string) {
    const genreIds = getDisciplinesByGenre(genreId);
    const current: string[] = job.disciplines || [];
    const hasAny = genreIds.some((d: string) => current.includes(d));
    const updated = hasAny
      ? current.filter((d: string) => !genreIds.includes(d))
      : [...new Set([...current, ...genreIds])];
    setSavingTags(s => ({ ...s, [job.id]: true }));
    await supabase.from('scraped_jobs').update({ disciplines: updated }).eq('id', job.id);
    setSavingTags(s => ({ ...s, [job.id]: false }));
    setPendingJobs(prev => prev.map(j => j.id === job.id ? { ...j, disciplines: updated } : j));
  }

  async function savePendingTitle(job: any, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === job.title) {
      setEditingTitles(s => ({ ...s, [job.id]: null }));
      return;
    }
    await supabase.from('scraped_jobs').update({ title: trimmed }).eq('id', job.id);
    setPendingJobs(prev => prev.map(j => j.id === job.id ? { ...j, title: trimmed } : j));
    setEditingTitles(s => ({ ...s, [job.id]: null }));
  }

  async function uploadJobScreenshot(job: any, file: File) {
    // Show local preview immediately so user sees the image right away
    const localUrl = URL.createObjectURL(file);
    setLocalPreviews(s => ({ ...s, [job.id]: localUrl }));
    setUploadingImage(s => ({ ...s, [job.id]: true }));
    setUploadSuccess(s => ({ ...s, [job.id]: false }));
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `pending/${job.id}-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('job-flyers').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('job-flyers').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await supabase.from('scraped_jobs').update({ flyer_url: publicUrl }).eq('id', job.id);
      setPendingJobs(prev => prev.map(j => j.id === job.id ? { ...j, flyer_url: publicUrl } : j));
      setUploadSuccess(s => ({ ...s, [job.id]: true }));
      setTimeout(() => setUploadSuccess(s => ({ ...s, [job.id]: false })), 3000);
    }
    setUploadingImage(s => ({ ...s, [job.id]: false }));
  }

  async function fetchLinkPreview(job: any, link: string) {
    setFetchingPreview(s => ({ ...s, [job.id]: true }));
    try {
      const res = await fetch(`/api/fetch-og?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      setLinkPreviews(s => ({ ...s, [job.id]: { image: data.image ?? null, title: data.title ?? null, is_login_wall: !!data.is_login_wall } }));
    } catch {
      setLinkPreviews(s => ({ ...s, [job.id]: { image: null, title: null, is_login_wall: false } }));
    }
    setFetchingPreview(s => ({ ...s, [job.id]: false }));
  }

  async function useOgImageAsFlyer(job: any, imageUrl: string) {
    await supabase.from('scraped_jobs').update({ flyer_url: imageUrl }).eq('id', job.id);
    setPendingJobs(prev => prev.map(j => j.id === job.id ? { ...j, flyer_url: imageUrl } : j));
  }

  // Intentar cargar datos reales de Supabase
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJobs(filters, search)
      .then(jobs => {
        if (cancelled) return;
        if (jobs.length > 0) {
          setLiveJobs(jobs.map(adaptScrapedJob));
        } else {
          // Sin datos reales → usar mock
          setLiveJobs([]);
        }
      })
      .catch(() => setLiveJobs([]))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, search]);

  // Translate job titles + descriptions when language or jobs change — with AsyncStorage cache
  useEffect(() => {
    if (isDefaultLang || !liveJobs.length) {
      setTitleMap({});
      setDescMap({});
      return;
    }

    let cancelled = false;
    const cacheKey = `artnet_content_cache_${targetLanguage.toLowerCase().replace(/\s+/g, '_')}`;

    (async () => {
      // 1. Load cache
      let cachedMap: Record<string, { title: string; description: string }> = {};
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) cachedMap = JSON.parse(raw);
      } catch {}
      if (cancelled) return;

      // 2. Show cached translations immediately
      if (Object.keys(cachedMap).length > 0 && !cancelled) {
        const titles: Record<string, string> = {};
        const descs: Record<string, string> = {};
        for (const [id, val] of Object.entries(cachedMap)) {
          titles[id] = val.title;
          descs[id] = val.description;
        }
        setTitleMap(titles);
        setDescMap(descs);
      }

      // 3. Find uncached jobs
      const needsBatch = liveJobs.filter(j => !cachedMap[j.id]);
      if (!needsBatch.length || cancelled) return;

      // 4. Translate in chunks of 10 (titles + descriptions per job)
      const CHUNK = 10;
      const allNew: Record<string, { title: string; description: string }> = {};
      for (let i = 0; i < needsBatch.length; i += CHUNK) {
        if (cancelled) break;
        const chunk = needsBatch.slice(i, i + CHUNK).map(j => ({
          id: j.id, title: j.title, description: j.description,
        }));
        const result = await translateBatch(chunk, targetLanguage);
        if (cancelled) break;
        if (result && Object.keys(result).length > 0) {
          const newTitles: Record<string, string> = {};
          const newDescs: Record<string, string> = {};
          for (const [id, val] of Object.entries(result)) {
            allNew[id] = val;
            newTitles[id] = val.title;
            newDescs[id] = val.description;
          }
          setTitleMap(prev => ({ ...prev, ...newTitles }));
          setDescMap(prev => ({ ...prev, ...newDescs }));
        }
      }

      // 5. Persist to cache
      if (Object.keys(allNew).length > 0) {
        AsyncStorage.setItem(cacheKey, JSON.stringify({ ...cachedMap, ...allNew })).catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [liveJobs, targetLanguage]);

  // Fetch artist profiles when user is a venue
  useEffect(() => {
    if (isArtist) return;
    setArtistsLoading(true);
    supabase
      .from('artist_profiles')
      .select('user_id, display_name, bio, city, country, disciplines, avatar_url')
      .not('display_name', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setArtists(data ?? []); setArtistsLoading(false); });
  }, [isArtist]);

  const filtered = liveJobs;

  // ── Pending review screen (replaces discover entirely) ──────────────────────
  if (isAdmin && showPending) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.pendingModalHeader}>
          <TouchableOpacity onPress={() => closePendingPanel()} style={styles.pendingBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.pendingBackBtnText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.pendingModalTitle}>
            🔔 {pendingJobs.length} pendiente{pendingJobs.length > 1 ? 's' : ''}
          </Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView contentContainerStyle={styles.pendingModalContent} showsVerticalScrollIndicator={false}>
          {pendingJobs.map(job => {
            const link = job.contact_url || job.source_url;
            const plat = !link ? null
              : link.includes('facebook.com') || link.includes('fb.com') ? { label: 'Facebook', emoji: '👥', color: '#1877F2' }
              : link.includes('instagram.com') ? { label: 'Instagram', emoji: '📷', color: '#E1306C' }
              : link.includes('youtube.com') || link.includes('youtu.be') ? { label: 'YouTube', emoji: '▶️', color: '#FF0000' }
              : link.includes('whatsapp.com') || link.includes('wa.me') ? { label: 'WhatsApp', emoji: '💬', color: '#25D366' }
              : link.includes('t.me') || link.includes('telegram') ? { label: 'Telegram', emoji: '✈️', color: '#2AABEE' }
              : link.includes('tiktok.com') ? { label: 'TikTok', emoji: '🎵', color: '#010101' }
              : { label: 'Web', emoji: '🌐', color: '#6366F1' };
            const ins = (job as any).ai_insights;
            const rawDesc = ins?.description || job.description || '';
            // Strip the source link from description if it's already shown in the link block
            const description = link
              ? rawDesc.replace(link, '').replace(/https?:\/\/\S+/g, (m: string) => link.includes(m.slice(0, 30)) ? '' : m).replace(/\s+/g, ' ').trim()
              : rawDesc;
            const isPrivate = link && !description && !job.venue_name;
            const isEmailSource = job.source_name === 'email';
            const gmailLink = isEmailSource && link?.includes('mail.google.com') ? link : null;

            function copyLink() {
              if (Platform.OS === 'web') {
                try { (navigator as any).clipboard?.writeText(link); } catch {}
              }
              Alert.alert('Link copiado', link);
            }

            return (
              <View key={job.id} style={styles.pendingCard}>
                {editingTitles[job.id] !== null && editingTitles[job.id] !== undefined ? (
                  <TextInput
                    style={[styles.pendingTitle, styles.pendingTitleInput]}
                    value={editingTitles[job.id] as string}
                    onChangeText={v => setEditingTitles(s => ({ ...s, [job.id]: v }))}
                    onBlur={() => savePendingTitle(job, editingTitles[job.id] as string)}
                    onSubmitEditing={() => savePendingTitle(job, editingTitles[job.id] as string)}
                    autoFocus
                    returnKeyType="done"
                  />
                ) : (
                  <TouchableOpacity onPress={() => setEditingTitles(s => ({ ...s, [job.id]: job.title || '' }))} activeOpacity={0.7}>
                    <Text style={styles.pendingTitle}>{job.title || '(sin título)'} <Text style={styles.pendingTitleEditHint}>✎</Text></Text>
                  </TouchableOpacity>
                )}

                <View style={styles.pendingMetaRow}>
                  {job.venue_name ? <Text style={styles.pendingMeta}>🏢 {job.venue_name}</Text> : null}
                  {(job.location_city || job.location_country) ? (
                    <Text style={styles.pendingMeta}>📍 {[job.location_city, job.location_country].filter(Boolean).join(', ')}</Text>
                  ) : null}
                  {job.pay_info ? <Text style={styles.pendingMeta}>💰 {job.pay_info}</Text> : null}
                  {job.disciplines?.length > 0 ? (
                    <Text style={styles.pendingMeta}>🎪 {job.disciplines.slice(0, 4).join(', ')}</Text>
                  ) : null}
                  {job.contact_email ? <Text style={styles.pendingMeta}>✉️ {job.contact_email}</Text> : null}
                </View>

                {/* Botón "Ver email original" para entradas de email sin imagen subida */}
                {gmailLink && (
                  <TouchableOpacity style={styles.pendingGmailBtn} onPress={() => openExternalUrl(gmailLink)} activeOpacity={0.8}>
                    <Text style={styles.pendingGmailBtnText}>✉️ Ver email original con imagen →</Text>
                  </TouchableOpacity>
                )}

                {link && plat && !gmailLink && (
                  <View style={[styles.pendingLinkBlock, { borderColor: plat.color + '40' }]}>
                    <View style={styles.pendingLinkHeader}>
                      <View style={[styles.pendingLinkBadge, { backgroundColor: plat.color + '18' }]}>
                        <Text style={[styles.pendingLinkBadgeText, { color: plat.color }]}>{plat.emoji} {plat.label}</Text>
                      </View>
                      {isPrivate && (
                        <View style={styles.pendingPrivateBadge}>
                          <Text style={styles.pendingPrivateBadgeText}>🔒 Privado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.pendingLinkUrl} selectable>{link}</Text>
                    <View style={styles.pendingLinkActions}>
                      <TouchableOpacity style={styles.pendingLinkOpenBtn} onPress={() => { setOpenedLinks(s => ({ ...s, [job.id]: true })); fetchLinkPreview(job, link); openExternalUrl(link); }} activeOpacity={0.7}>
                        <Text style={styles.pendingLinkOpenBtnText}>↗ Abrir</Text>
                      </TouchableOpacity>
                      {!linkPreviews[job.id] && !fetchingPreview[job.id] && (
                        <TouchableOpacity style={styles.pendingPreviewBtn} onPress={() => fetchLinkPreview(job, link)} activeOpacity={0.7}>
                          <Text style={styles.pendingPreviewBtnText}>🔍 Preview</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.pendingLinkCopyBtn} onPress={copyLink} activeOpacity={0.7}>
                        <Text style={styles.pendingLinkCopyBtnText}>⎘ Copiar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Link preview result */}
                {fetchingPreview[job.id] && (
                  <View style={styles.pendingPreviewLoading}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.pendingPreviewLoadingText}>Obteniendo preview...</Text>
                  </View>
                )}
                {linkPreviews[job.id] && !fetchingPreview[job.id] && (() => {
                  const preview = linkPreviews[job.id]!;
                  if (preview.is_login_wall) return (
                    <View style={styles.pendingPrivateWarn}>
                      <Text style={styles.pendingPrivateWarnText}>
                        🔒 Requiere login — abrí el link, tomá un screenshot y subilo aquí abajo.
                      </Text>
                    </View>
                  );
                  if (!preview.image && !preview.title) return (
                    <View style={styles.pendingPrivateWarn}>
                      <Text style={styles.pendingPrivateWarnText}>
                        ⚠️ No se encontró preview — podría ser privado o no tener og:image.
                      </Text>
                    </View>
                  );
                  return (
                    <View style={styles.pendingPreviewCard}>
                      {preview.image ? (
                        <Image source={{ uri: preview.image }} style={styles.pendingPreviewImg} resizeMode="cover" />
                      ) : null}
                      {preview.title ? <Text style={styles.pendingPreviewTitle} numberOfLines={2}>{preview.title}</Text> : null}
                      {preview.image && !job.flyer_url && (
                        <TouchableOpacity style={styles.pendingPreviewUseBtn} onPress={() => useOgImageAsFlyer(job, preview.image!)} activeOpacity={0.7}>
                          <Text style={styles.pendingPreviewUseBtnText}>✓ Usar como imagen del post</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })()}

                {isPrivate && !linkPreviews[job.id] && (
                  <View style={styles.pendingPrivateWarn}>
                    <Text style={styles.pendingPrivateWarnText}>
                      ⚠️ Contenido privado — abrí el link para ver si es una audición.
                    </Text>
                  </View>
                )}

                {description ? <Text style={styles.pendingDesc}>{description}</Text> : null}
                {ins?.website && (
                  <TouchableOpacity onPress={() => openExternalUrl(ins.website)} activeOpacity={0.7}>
                    <Text style={styles.pendingWebsite}>🌐 {ins.website}</Text>
                  </TouchableOpacity>
                )}

                {/* Genre tag editor */}
                <View style={styles.pendingTagsSection}>
                  <Text style={styles.pendingTagsLabel}>Disciplinas</Text>
                  <View style={styles.pendingTagsRow}>
                    {DISCIPLINE_GENRES.map(genre => {
                      const ids = getDisciplinesByGenre(genre.id);
                      const active = ids.some((d: string) => (job.disciplines || []).includes(d));
                      return (
                        <TouchableOpacity
                          key={genre.id}
                          style={[styles.pendingGenreTag, active && styles.pendingGenreTagActive]}
                          onPress={() => toggleGenreOnJob(job, genre.id)}
                          disabled={!!savingTags[job.id]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.pendingGenreTagText, active && styles.pendingGenreTagTextActive]}>
                            {genre.emoji} {genre.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Screenshot / image card — always visible */}
                {Platform.OS === 'web' && (() => {
                  const previewUrl = localPreviews[job.id] || job.flyer_url;
                  function pickFile() {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    (input as any).onchange = (e: any) => {
                      const file = e.target?.files?.[0];
                      if (file) uploadJobScreenshot(job, file);
                    };
                    input.click();
                  }
                  return (
                    <View style={[styles.pendingScreenshotCard, !previewUrl && styles.pendingScreenshotCardPrompt]}>
                      {previewUrl ? (
                        /* Preview — tap to expand, separate "Cambiar" button */
                        <View style={{ position: 'relative' }}>
                          <TouchableOpacity onPress={() => setLightboxUrl(previewUrl)} activeOpacity={0.85}>
                            <Image source={{ uri: previewUrl }} style={styles.pendingFlyerPreviewLarge} resizeMode="cover" />
                            {uploadingImage[job.id] && (
                              <View style={styles.pendingFlyerUploadOverlay}>
                                <ActivityIndicator color={COLORS.white} />
                                <Text style={styles.pendingFlyerUploadOverlayText}>Subiendo...</Text>
                              </View>
                            )}
                            {uploadSuccess[job.id] && (
                              <View style={[styles.pendingFlyerUploadOverlay, { backgroundColor: 'rgba(22,101,52,0.82)' }]}>
                                <Text style={{ fontSize: 22 }}>✓</Text>
                                <Text style={styles.pendingFlyerUploadOverlayText}>Guardada</Text>
                              </View>
                            )}
                            <View style={styles.pendingFlyerExpandBadge}>
                              <Text style={styles.pendingFlyerChangeBadgeText}>⤢ Ver</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.pendingFlyerChangeBadge} onPress={pickFile} activeOpacity={0.8}>
                            <Text style={styles.pendingFlyerChangeBadgeText}>🖼 Cambiar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.pendingScreenshotTitle}>📸 Agregar imagen</Text>
                          <Text style={styles.pendingScreenshotHint}>
                            {link ? 'Abrí el link → sacá screenshot → volvé y subila.' : 'Subí el flyer o imagen de la publicación.'}
                          </Text>
                          <TouchableOpacity style={styles.pendingUploadBtnProminent} onPress={pickFile} activeOpacity={0.7}>
                            {uploadingImage[job.id]
                              ? <ActivityIndicator size="small" color={COLORS.primary} />
                              : <Text style={[styles.pendingUploadBtnText, { color: COLORS.primary, fontWeight: '700', textAlign: 'center', paddingVertical: 4 }]}>📷 Elegir imagen</Text>
                            }
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })()}

                <View style={styles.pendingActions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveJob(job.id)}>
                    <Text style={styles.approveBtnText}>✓ Publicar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pendingViewBtn} onPress={() => { closePendingPanel(); router.push(`/jobs/${job.id}`); }}>
                    <Text style={styles.pendingViewBtnText}>👁 Ver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectJob(job.id)}>
                    <Text style={styles.rejectBtnText}>✕ Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Lightbox — fullscreen image viewer */}
        <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
          <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUrl(null)}>
            <Image source={{ uri: lightboxUrl ?? '' }} style={styles.lightboxImage} resizeMode="contain" />
            <View style={styles.lightboxClose}><Text style={styles.lightboxCloseText}>✕</Text></View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Image source={require('../../../assets/logo-full.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.headerTitle}>
            {isArtist ? t('discover.titleArtist') : t('discover.titleVenue')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          {isAdmin && liveJobs.length > 0 && (
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => { setSelecting(v => !v); setSelected(new Set()); }}
            >
              <Text style={styles.selectBtnText}>{selecting ? 'Cancelar' : 'Seleccionar'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? '?'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk delete bar */}
      {selecting && selected.size > 0 && (
        <TouchableOpacity style={styles.bulkDeleteBar} onPress={deleteSelected}>
          <Text style={styles.bulkDeleteText}>🗑️ Eliminar {selected.size} seleccionada{selected.size > 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}


      {/* Community card — fuente + mail (artists only) */}
      {isArtist && showSourcesBanner && (
        <View style={styles.communityCard}>
          <TouchableOpacity style={styles.communityMain} onPress={() => setShowSuggest(true)} activeOpacity={0.85}>
            <Text style={styles.communityEmoji}>🔍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.communityTitle}>¿Conocés una fuente de audiciones?</Text>
              <Text style={styles.communitySub}>Sugerí un sitio, Instagram o grupo y lo sumamos</Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); setShowSourcesBanner(false); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.communityClose}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <View style={styles.communityDivider} />
          <View style={styles.communityShareRow}>
            <Text style={styles.communityMailText}>¿Encontraste una audición? Podés enviarla a</Text>
            <TouchableOpacity
              onPress={() => {
                const subject = encodeURIComponent('Nueva audición para ArtNet');
                const body = encodeURIComponent('Hola! Encontré esta audición:\n\n[pegá el texto aquí]\n\nFuente: [link si tenés]');
                import('react-native').then(({ Linking }) =>
                  Linking.openURL(`mailto:artnetcircus@gmail.com?subject=${subject}&body=${body}`)
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.communityMailLink}>artnetcircus@gmail.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Admin: pending review banner */}
      {isAdmin && pendingJobs.length > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => openPendingPanel()}
          activeOpacity={0.85}
        >
          <Text style={styles.pendingBannerText}>
            🔔 {pendingJobs.length} publicación{pendingJobs.length > 1 ? 'es' : ''} pendiente{pendingJobs.length > 1 ? 's' : ''} de revisión
          </Text>
          <Text style={styles.pendingBannerArrow}>▶</Text>
        </TouchableOpacity>
      )}


      {/* Venue view: artist profiles */}
      {!isArtist && (
        <FlatList
          data={artists}
          keyExtractor={item => item.user_id}
          renderItem={({ item }) => <ArtistCard profile={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.artistsCount}>
              {artistsLoading ? '…' : `${artists.length} artistas`}
            </Text>
          }
          ListEmptyComponent={
            artistsLoading
              ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
              : <View style={styles.empty}><Text style={styles.emptyEmoji}>🎭</Text><Text style={styles.emptyText}>No hay perfiles aún</Text></View>
          }
        />
      )}

      {/* Filter + search bar (artists only) */}
      {isArtist && <View style={styles.resultsRow}>
        {showSearch ? (
          <>
            <TextInput
              style={styles.searchInline}
              placeholder={t('discover.search')}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => { setShowSearch(false); setSearch(''); }}
              style={styles.searchCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchCloseText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
              <Text style={styles.resultsText}>{t('discover.opportunities_other', { count: filtered.length })}</Text>
              {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
              {!loading && liveJobs.length > 0 && <Text style={styles.liveTag}>{t('discover.live')}</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.searchIconBtn}>
                <Text style={styles.searchIconBtnText}>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
                onPress={() => setShowFilters(true)}
              >
                <Text style={styles.filterBtnEmoji}>⚙️</Text>
                <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
                  {activeFilterCount > 0 ? t('discover.filtersActive', { count: activeFilterCount }) : t('discover.filters')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>}

      {isArtist && <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => setFilters(f)}
        initialFilters={filters}
      />}

      {/* Job list (artists only) */}
      {isArtist && <FlatList
        ref={flatListRef}
        data={(() => {
          if (filtered.length <= 5) return filtered;
          return [...filtered.slice(0, 5), { id: '__suggest__' } as any, ...filtered.slice(5)];
        })()}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          if (item.id === '__suggest__') {
            return (
              <TouchableOpacity style={styles.suggestCta} onPress={() => setShowSuggest(true)} activeOpacity={0.85}>
                <Text style={styles.suggestCtaEmoji}>🔍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestCtaTitle}>¿Encontraste una audición?</Text>
                  <Text style={styles.suggestCtaSub}>Mandala a artnetcircus@gmail.com o sugerí la fuente y la sumamos al feed</Text>
                </View>
                <Text style={styles.suggestCtaArrow}>→</Text>
              </TouchableOpacity>
            );
          }
          return (
          <JobCard
            job={item}
            translatedTitle={titleMap[item.id]}
            translatedDesc={descMap[item.id]}
            selecting={selecting}
            isSelected={selected.has(item.id)}
            onSelect={() => toggleSelect(item.id)}
            onLongPress={() => {
              if (!isAdmin) return;
              if (!selecting) setSelecting(true);
              toggleSelect(item.id);
            }}
          />
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => { scrollOffsetRef.current = nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>{t('discover.noResults')}</Text>
          </View>
        }
      />}

      {isArtist && <SuggestSourceModal visible={showSuggest} onClose={() => setShowSuggest(false)} />}

      {/* FAB (artists only) */}
      {isArtist && showFabMenu && (
        <TouchableOpacity style={styles.fabBackdrop} activeOpacity={1} onPress={() => setShowFabMenu(false)} />
      )}

      {isArtist && showFabMenu && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFabMenu(false); router.push('/post/manual'); }}>
            <Text style={styles.fabMenuEmoji}>📋</Text>
            <View>
              <Text style={styles.fabMenuTitle}>{t('discover.pastePost')}</Text>
              <Text style={styles.fabMenuSub}>{t('discover.pastePostSub')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFabMenu(false); router.push('/post/flyer'); }}>
            <Text style={styles.fabMenuEmoji}>🤖</Text>
            <View>
              <Text style={styles.fabMenuTitle}>{t('discover.uploadFlyer')}</Text>
              <Text style={styles.fabMenuSub}>{t('discover.uploadFlyerSub')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFabMenu(false); router.push('/sources/suggest'); }}>
            <Text style={styles.fabMenuEmoji}>🌐</Text>
            <View>
              <Text style={styles.fabMenuTitle}>{t('discover.suggestSource')}</Text>
              <Text style={styles.fabMenuSub}>{t('discover.suggestSourceSub')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {isArtist && (
        <TouchableOpacity
          style={[styles.fab, showFabMenu && styles.fabOpen]}
          activeOpacity={0.85}
          onPress={() => setShowFabMenu(v => !v)}
        >
          <Text style={[styles.fabText, showFabMenu && styles.fabTextOpen]}>{showFabMenu ? '✕' : '+'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xl,
    paddingTop: 36,
    paddingBottom: SPACING.base,
  },
  logoImage: {
    width: 120,
    height: 36,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONTS.sizes.md,
  },
  searchInline: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    minWidth: 0,
  },
  searchCloseBtn: { padding: 4 },
  searchCloseText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  searchIconBtn: {
    width: 34, height: 34,
    borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  searchIconBtnText: { fontSize: 15 },
  // legacy — kept so old references don't crash
  searchInput: {
    flex: 1,
    padding: SPACING.base,
    fontSize: 16,
    color: COLORS.text,
  },
  filtersScroll: {
    marginBottom: SPACING.sm,
  },
  filtersContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterEmoji: {
    fontSize: 14,
  },
  filterLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  filterLabelActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  resultsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  liveTag: {
    fontSize: FONTS.sizes.xs,
    color: '#10B981',
    fontWeight: '700',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBtnEmoji: { fontSize: 13 },
  filterBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterBtnTextActive: { color: COLORS.white },
  selectBtn: {
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border,
  },
  selectBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '600' },
  bulkDeleteBar: {
    backgroundColor: '#EF4444', marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center',
  },
  bulkDeleteText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.base },
  checkbox: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm, zIndex: 10,
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardFlyer: {
    width: '100%',
    height: 160,
  },
  cardInner: {
    padding: SPACING.base,
  },
  cardInnerWithFlyer: {
    borderTopWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueTagEmoji: {
    fontSize: 14,
  },
  venueTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchBadge: {
    borderRadius: RADIUS.full,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
  },
  matchHigh: {
    backgroundColor: '#D1FAE5',
  },
  matchMid: {
    backgroundColor: '#EDE9FE',
  },
  matchLow: {
    backgroundColor: '#F3F4F6',
  },
  matchText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    lineHeight: 22,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  venueName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  verifiedBadge: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: '700',
  },
  dot: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
  location: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  disciplineTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tag: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
  },
  tagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  moreTag: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    alignSelf: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  pay: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  payPer: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: COLORS.textMuted,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apps: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  timeAgo: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
    gap: SPACING.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: '#FFF7ED', borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    borderWidth: 1.5, borderColor: '#FED7AA',
  },
  pendingBannerText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#C2410C', flex: 1 },
  pendingBannerArrow: { fontSize: FONTS.sizes.sm, color: '#C2410C', fontWeight: '700' },
  // Pending review screen header
  pendingModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: HEADER_TOP + SPACING.sm, paddingBottom: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pendingModalTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: '#C2410C', flex: 1, textAlign: 'center' },
  pendingBackBtn: { minWidth: 70 },
  pendingBackBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.primary },
  pendingModalContent: { padding: SPACING.base, paddingBottom: 48 },
  // Card
  pendingCard: {
    marginBottom: SPACING.base,
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1.5, borderColor: '#FED7AA',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pendingTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm, lineHeight: 22 },
  pendingTitleInput: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, backgroundColor: COLORS.white },
  pendingTitleEditHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '400' },
  pendingMetaRow: { gap: 3, marginBottom: SPACING.sm },
  pendingGmailBtn: { backgroundColor: '#EEF2FF', borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: SPACING.base, alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: '#C7D2FE' },
  pendingGmailBtnText: { color: '#4338CA', fontWeight: '700', fontSize: FONTS.sizes.sm },
  pendingMeta: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 16 },
  pendingDesc: { fontSize: FONTS.sizes.sm, color: COLORS.text, marginTop: SPACING.sm, lineHeight: 20 },
  pendingWebsite: { fontSize: FONTS.sizes.xs, color: '#4338CA', marginTop: 4, textDecorationLine: 'underline' },
  pendingTagsSection: { marginTop: SPACING.sm },
  pendingTagsLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pendingTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pendingGenreTag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  pendingGenreTagActive: { backgroundColor: '#EDE9FE', borderColor: '#A78BFA' },
  pendingGenreTagText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  pendingGenreTagTextActive: { color: '#6D28D9', fontWeight: '700' },
  pendingPreviewBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md,
    backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE',
  },
  pendingPreviewBtnText: { fontSize: FONTS.sizes.xs, color: '#4338CA', fontWeight: '700' },
  pendingPreviewLoading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  pendingPreviewLoadingText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  pendingPreviewCard: { marginTop: SPACING.sm, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: COLORS.white },
  pendingPreviewImg: { width: '100%', height: 160 },
  pendingPreviewTitle: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, padding: SPACING.sm, paddingBottom: 4 },
  pendingPreviewUseBtn: {
    margin: SPACING.sm, marginTop: 4, backgroundColor: '#D1FAE5', borderRadius: RADIUS.md,
    paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC',
  },
  pendingPreviewUseBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#166534' },
  pendingScreenshotCard: { marginTop: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.sm, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pendingScreenshotCardPrompt: { backgroundColor: '#F0EDFF', borderColor: '#A78BFA' },
  pendingScreenshotTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#5B21B6', marginBottom: 2 },
  pendingScreenshotHint: { fontSize: FONTS.sizes.xs, color: '#7C3AED', lineHeight: 16, marginBottom: SPACING.sm },
  pendingImageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pendingFlyerThumb: { width: 60, height: 60, borderRadius: RADIUS.md, backgroundColor: '#F1F5F9' },
  pendingUploadBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.md,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', minHeight: 36,
  },
  pendingUploadBtnProminent: { backgroundColor: '#EDE9FE', borderColor: '#A78BFA', borderWidth: 1.5, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 14 },
  pendingUploadBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  pendingUploadSuccessBanner: { backgroundColor: '#D1FAE5', borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#86EFAC' },
  pendingUploadSuccessText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#166534', textAlign: 'center' },
  pendingFlyerPreviewLarge: { width: '100%', height: 180, borderRadius: RADIUS.md },
  pendingFlyerUploadOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  pendingFlyerUploadOverlayText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  pendingFlyerChangeBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.full,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  pendingFlyerExpandBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.full,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  pendingFlyerChangeBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  pendingActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.base },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '85%' },
  lightboxClose: { position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  approveBtn: {
    flex: 1, backgroundColor: '#D1FAE5', borderRadius: RADIUS.md,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC',
  },
  approveBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#166534' },
  rejectBtn: {
    flex: 1, backgroundColor: '#FEF2F2', borderRadius: RADIUS.md,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
  },
  rejectBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#991B1B' },
  pendingViewBtn: {
    flex: 1, backgroundColor: '#EFF6FF', borderRadius: RADIUS.md,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE',
  },
  pendingViewBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#1D4ED8' },
  // Link block
  pendingLinkBlock: {
    marginTop: SPACING.sm, borderRadius: RADIUS.lg,
    padding: SPACING.sm, borderWidth: 1.5, backgroundColor: '#FAFAFA',
  },
  pendingLinkHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  pendingLinkBadge: { borderRadius: RADIUS.md, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  pendingLinkBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  pendingPrivateBadge: { borderRadius: RADIUS.md, paddingVertical: 3, paddingHorizontal: SPACING.sm, backgroundColor: '#FEF3C7' },
  pendingPrivateBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: '#92400E' },
  pendingLinkUrl: { fontSize: FONTS.sizes.xs, color: '#374151', lineHeight: 18, marginBottom: SPACING.sm },
  pendingLinkActions: { flexDirection: 'row', gap: SPACING.sm },
  pendingLinkOpenBtn: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  pendingLinkOpenBtnText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: '#1D4ED8' },
  pendingLinkCopyBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  pendingLinkCopyBtnText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: '#374151' },
  pendingPrivateWarn: {
    marginTop: SPACING.sm, backgroundColor: '#FFFBEB', borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingPrivateWarnText: { fontSize: FONTS.sizes.xs, color: '#92400E', lineHeight: 16 },
  communityCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  communityMain: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.base, paddingHorizontal: SPACING.base,
  },
  communityEmoji: { fontSize: 20 },
  communityTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  communitySub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 15 },
  communityClose: { fontSize: 13, color: COLORS.textMuted, fontWeight: '700', padding: 4 },
  communityDivider: { height: 1, backgroundColor: COLORS.border },
  communityMailRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    backgroundColor: '#F9F7FF',
  },
  communityShareRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    backgroundColor: '#F9F7FF',
  },
  communityMailText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  communityMailLink: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
  suggestCta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    margin: SPACING.base, marginTop: SPACING.xl,
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.primaryLight,
    borderStyle: 'dashed',
  },
  suggestCtaEmoji: { fontSize: 24 },
  suggestCtaTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  suggestCtaSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 16 },
  suggestCtaArrow: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  artistsCount: {
    fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: '600',
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
  },
  artistCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.sm, marginBottom: SPACING.sm,
    padding: SPACING.base, gap: SPACING.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  artistAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  artistAvatarImage: { width: 52, height: 52, borderRadius: 26 },
  artistAvatarText: { fontSize: 22, color: COLORS.white, fontWeight: '700' },
  artistInfo: { flex: 1, gap: 3 },
  artistName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  artistLocation: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  artistDisciplinesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  artistChip: {
    fontSize: 11, color: COLORS.primary, fontWeight: '600',
    backgroundColor: '#F0EAFF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  artistBio: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 16, marginTop: 2 },
  artistArrow: { fontSize: 22, color: COLORS.textMuted },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabOpen: { backgroundColor: COLORS.text },
  fabText: {
    fontSize: 32,
    color: COLORS.white,
    lineHeight: 36,
    fontWeight: '300',
  },
  fabTextOpen: { fontSize: 22, lineHeight: 26 },
  fabBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  fabMenu: {
    position: 'absolute',
    bottom: 94,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 240,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  fabMenuEmoji: { fontSize: 28 },
  fabMenuTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  fabMenuSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
});
