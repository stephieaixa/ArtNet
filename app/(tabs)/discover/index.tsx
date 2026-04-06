import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, ActivityIndicator, Image, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';
import { VENUE_TYPES } from '../../../src/constants/venueTypes';
import { DISCIPLINES } from '../../../src/constants/disciplines';
import FilterModal, { FilterState } from '../../../src/components/shared/FilterModal';
import SuggestSourceModal from '../../../src/components/shared/SuggestSourceModal';
import { fetchJobs, type ScrapedJob } from '../../../src/services/jobs';
import { supabase } from '../../../src/services/supabase';
import type { JobPost } from '../../../src/types';

const ADMIN_EMAIL = 'artnetcircus@gmail.com';



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

function JobCard({ job, selecting = false, isSelected = false, onSelect, onLongPress }: {
  job: JobPost;
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

      <Text style={styles.jobTitle}>{job.title}</Text>

      <View style={styles.venueRow}>
        <Text style={styles.venueName}>{job.venue?.name}</Text>
        {job.venue?.verified && <Text style={styles.verifiedBadge}> ✓</Text>}
        <Text style={styles.dot}> · </Text>
        <Text style={styles.location}>{job.location_city}, {job.location_country}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>{job.description}</Text>

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
        <Text style={styles.pay}>{formatPay(job, t('discover.payNegotiable'))}<Text style={styles.payPer}> / {job.pay_type === 'monthly' ? t('discover.perMonth') : job.pay_type === 'per_show' ? t('discover.perShow') : job.pay_type}</Text></Text>
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

// Adapta un ScrapedJob (de Supabase) al formato JobPost que usa JobCard
function adaptScrapedJob(j: ScrapedJob): JobPost {
  return {
    id: j.id,
    venue_id: '',
    title: j.title,
    description: j.description ?? '',
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
    _source_name: j.source_name,
    _source_url: j.source_url,
    _contact_url: j.contact_url,
    _pay_info: j.pay_info,
    _is_scraped: j.is_scraped,
    _flyer_url: j.flyer_url,
  } as any;
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ venueTypes: [], regions: [], countries: [], genres: [], disciplines: [] });
  const [liveJobs, setLiveJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSourcesBanner, setShowSourcesBanner] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [showPending, setShowPending] = useState(false);
  const flatListRef = useRef<any>(null);

  useFocusEffect(useCallback(() => {
    // Re-enable scroll after returning from a detail screen
    flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, []));
  const isArtist = user?.role !== 'venue';
  const isAdmin = user?.email === ADMIN_EMAIL;

  const activeFilterCount = filters.venueTypes.length + filters.regions.length + filters.countries.length + filters.genres.length + filters.disciplines.length;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    Alert.alert('Eliminar publicaciones', `¿Eliminás las ${ids.length} publicaciones seleccionadas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          setLiveJobs(prev => prev.filter(j => !ids.includes(j.id)));
          setSelected(new Set());
          setSelecting(false);
          for (const id of ids) {
            await supabase.from('scraped_jobs').delete().eq('id', id);
          }
        },
      },
    ]);
  }

  // Cargar pending_review para admin
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('scraped_jobs').select('id,title,venue_name,contact_email,location_city,location_country,description')
      .eq('status', 'pending_review').order('scraped_at', { ascending: false })
      .then(({ data }) => setPendingJobs(data ?? []));
  }, [isAdmin]);

  async function approveJob(id: string) {
    await supabase.from('scraped_jobs').update({ status: 'published' }).eq('id', id);
    setPendingJobs(prev => prev.filter(j => j.id !== id));
  }

  async function rejectJob(id: string) {
    await supabase.from('scraped_jobs').delete().eq('id', id);
    setPendingJobs(prev => prev.filter(j => j.id !== id));
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

  const filtered = liveJobs;

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
            <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? '?'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk delete bar */}
      {selecting && selected.size > 0 && (
        <TouchableOpacity style={styles.bulkDeleteBar} onPress={deleteSelected}>
          <Text style={styles.bulkDeleteText}>🗑️ Eliminar {selected.size} seleccionada{selected.size > 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}


      {/* Community card — fuente + mail */}
      {showSourcesBanner && (
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
            <Text style={styles.communityMailText}>¿Encontraste una audición? También podés enviarla a </Text>
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
          onPress={() => setShowPending(v => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.pendingBannerText}>
            🔔 {pendingJobs.length} publicación{pendingJobs.length > 1 ? 'es' : ''} pendiente{pendingJobs.length > 1 ? 's' : ''} de revisión
          </Text>
          <Text style={styles.pendingBannerArrow}>{showPending ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      )}

      {/* Admin: pending jobs list */}
      {isAdmin && showPending && pendingJobs.map(job => (
        <View key={job.id} style={styles.pendingCard}>
          <Text style={styles.pendingTitle} numberOfLines={2}>{job.title}</Text>
          {job.venue_name ? <Text style={styles.pendingMeta}>{job.venue_name}</Text> : null}
          {(job.location_city || job.location_country) ? (
            <Text style={styles.pendingMeta}>📍 {[job.location_city, job.location_country].filter(Boolean).join(', ')}</Text>
          ) : null}
          {job.contact_email ? <Text style={styles.pendingMeta}>✉️ {job.contact_email}</Text> : null}
          {job.description ? (
            <Text style={styles.pendingDesc} numberOfLines={3}>{job.description}</Text>
          ) : null}
          <View style={styles.pendingActions}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => approveJob(job.id)}>
              <Text style={styles.approveBtnText}>✓ Publicar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectJob(job.id)}>
              <Text style={styles.rejectBtnText}>✕ Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Filter + search bar */}
      <View style={styles.resultsRow}>
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
      </View>


      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => setFilters(f)}
        initialFilters={filters}
      />

      {/* Job list */}
      <FlatList
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
                  <Text style={styles.suggestCtaTitle}>¿Conocés una fuente de audiciones?</Text>
                  <Text style={styles.suggestCtaSub}>Sugerí un sitio, Instagram o grupo y lo sumamos</Text>
                </View>
                <Text style={styles.suggestCtaArrow}>→</Text>
              </TouchableOpacity>
            );
          }
          return (
          <JobCard
            job={item}
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>{t('discover.noResults')}</Text>
          </View>
        }
      />

      <SuggestSourceModal visible={showSuggest} onClose={() => setShowSuggest(false)} />

      {/* FAB menu backdrop */}
      {showFabMenu && (
        <TouchableOpacity style={styles.fabBackdrop} activeOpacity={1} onPress={() => setShowFabMenu(false)} />
      )}

      {/* FAB menu options */}
      {showFabMenu && (
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, showFabMenu && styles.fabOpen]}
        activeOpacity={0.85}
        onPress={() => setShowFabMenu(v => !v)}
      >
        <Text style={[styles.fabText, showFabMenu && styles.fabTextOpen]}>{showFabMenu ? '✕' : '+'}</Text>
      </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  pendingCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.base, borderWidth: 1.5, borderColor: '#FED7AA',
  },
  pendingTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pendingMeta: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 2 },
  pendingDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 16 },
  pendingActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  approveBtn: {
    flex: 1, backgroundColor: '#D1FAE5', borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: '#86EFAC',
  },
  approveBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#166534' },
  rejectBtn: {
    flex: 1, backgroundColor: '#FEF2F2', borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
  },
  rejectBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#991B1B' },
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
