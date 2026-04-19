import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useLanguageStore } from '../../../src/stores/languageStore';
import { translateTitlesBatch } from '../../../src/services/translate';
import {
  fetchMyApplications, fetchApplicationsForMyJobs,
  updateApplicationStatus, acceptApplicationAndChat,
  type Application, type ApplicationStatus,
} from '../../../src/services/applications';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';

type Tab = 'received' | 'sent';

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  pending:  '#F59E0B',
  viewed:   '#3B82F6',
  accepted: '#10B981',
  rejected: '#EF4444',
};

export default function ApplicationsScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { targetLanguage } = useLanguageStore();
  const isDefaultLang = targetLanguage === 'Español';
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<Application[]>([]);
  const [sent, setSent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [titleMap, setTitleMap] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      load();
    }, [user?.id])
  );

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    const [recv, snt] = await Promise.all([
      fetchApplicationsForMyJobs(),
      fetchMyApplications(),
    ]);
    setReceived(recv);
    setSent(snt);
    setLoading(false);
  }

  // Translate job titles when language or data changes
  useEffect(() => {
    if (isDefaultLang) { setTitleMap({}); return; }
    const allApps = [...received, ...sent];
    const items = allApps
      .filter(a => a.job?.title && a.job_id)
      .map(a => ({ id: a.job_id, title: a.job!.title! }))
      .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i); // unique by id
    if (!items.length) return;
    let cancelled = false;
    translateTitlesBatch(items, targetLanguage).then(result => {
      if (!cancelled && result) setTitleMap(result);
    });
    return () => { cancelled = true; };
  }, [received, sent, targetLanguage]);

  const STATUS_LABEL: Record<ApplicationStatus, string> = {
    pending:  t('applications.statusPending'),
    viewed:   t('applications.statusViewed'),
    accepted: t('applications.statusAccepted'),
    rejected: t('applications.statusRejected'),
  };

  async function openChat(applicationId: string) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (data?.id) router.push(`/chat/${data.id}`);
  }

  async function handleAccept(app: Application) {
    Alert.alert(
      t('applications.acceptTitle'),
      t('applications.acceptMsg', { name: app.artist?.display_name ?? t('applications.artistFallback') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('applications.accept'), onPress: async () => {
            const convId = await acceptApplicationAndChat(app);
            setReceived(prev =>
              prev.map(a => a.id === app.id ? { ...a, status: 'accepted' } : a)
            );
            if (convId) router.push(`/chat/${convId}`);
          },
        },
      ]
    );
  }

  async function handleReject(app: Application) {
    Alert.alert(t('applications.rejectTitle'), t('applications.rejectMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('applications.reject'), style: 'destructive', onPress: async () => {
          await updateApplicationStatus(app.id, 'rejected');
          setReceived(prev =>
            prev.map(a => a.id === app.id ? { ...a, status: 'rejected' } : a)
          );
        },
      },
    ]);
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.title}>{t('applications.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'received' && s.tabActive]}
          onPress={() => setTab('received')}
        >
          <Text style={[s.tabText, tab === 'received' && s.tabTextActive]}>
            {t('applications.received')} {received.length > 0 ? `(${received.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'sent' && s.tabActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[s.tabText, tab === 'sent' && s.tabTextActive]}>
            {t('applications.sent')} {sent.length > 0 ? `(${sent.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : tab === 'received' ? (
        <FlatList
          data={received}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.artistName}>{item.artist?.display_name ?? t('applications.artistFallback')}</Text>
                  <Text style={s.jobTitle} numberOfLines={1}>
                    {titleMap[item.job_id] ?? item.job?.title ?? ''}
                  </Text>
                  {item.artist?.disciplines?.length ? (
                    <Text style={s.disciplines} numberOfLines={1}>
                      {item.artist.disciplines.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                  <Text style={[s.statusText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              {item.cover_message ? (
                <Text style={s.coverMsg} numberOfLines={2}>"{item.cover_message}"</Text>
              ) : null}
              {item.artist?.instagram_handle ? (
                <Text style={s.igHandle}>@{item.artist.instagram_handle}</Text>
              ) : null}
              {item.status === 'pending' || item.status === 'viewed' ? (
                <View style={s.actions}>
                  <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(item)}>
                    <Text style={s.rejectBtnText}>{t('applications.reject')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(item)}>
                    <Text style={s.acceptBtnText}>{t('applications.accept')}</Text>
                  </TouchableOpacity>
                </View>
              ) : item.status === 'accepted' ? (
                <TouchableOpacity style={s.chatBtn} onPress={() => openChat(item.id)}>
                  <Text style={s.chatBtnText}>{t('applications.goToChat')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyTitle}>{t('applications.emptyReceivedTitle')}</Text>
              <Text style={s.emptySubtitle}>{t('applications.emptyReceivedSub')}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/post/manual')}>
                <Text style={s.emptyBtnText}>{t('applications.emptyReceivedBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sent}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/jobs/${item.job_id}`)}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.jobTitle}>
                    {titleMap[item.job_id] ?? item.job?.title ?? t('applications.title')}
                  </Text>
                  {item.job?.venue_name ? (
                    <Text style={s.venueName}>{item.job.venue_name}</Text>
                  ) : null}
                  {(item.job?.location_city || item.job?.location_country) ? (
                    <Text style={s.location}>
                      📍 {[item.job?.location_city, item.job?.location_country].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                  <Text style={[s.statusText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              {item.cover_message ? (
                <Text style={s.coverMsg} numberOfLines={2}>"{item.cover_message}"</Text>
              ) : null}
              {item.status === 'accepted' && (
                <TouchableOpacity style={s.chatBtn} onPress={() => openChat(item.id)}>
                  <Text style={s.chatBtnText}>{t('applications.goToChat')}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📤</Text>
              <Text style={s.emptyTitle}>{t('applications.emptySentTitle')}</Text>
              <Text style={s.emptySubtitle}>{t('applications.emptySentSub')}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)')}>
                <Text style={s.emptyBtnText}>{t('applications.emptySentBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingTop: HEADER_TOP, paddingBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  tabs: {
    flexDirection: 'row', paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tab: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, marginRight: SPACING.base },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  artistName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  jobTitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  venueName: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  location: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  disciplines: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  igHandle: { fontSize: FONTS.sizes.xs, color: COLORS.primary },
  statusBadge: { borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  coverMsg: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  rejectBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center',
  },
  rejectBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  acceptBtn: {
    flex: 2, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center',
  },
  acceptBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.white, fontWeight: '700' },
  chatBtn: {
    backgroundColor: '#EDE9FE', borderRadius: RADIUS.lg,
    padding: SPACING.sm, alignItems: 'center',
  },
  chatBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl, alignItems: 'center' },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
});
