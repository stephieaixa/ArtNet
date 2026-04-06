import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import {
  fetchMyApplications, fetchApplicationsForMyJobs,
  updateApplicationStatus, acceptApplicationAndChat,
  type Application, type ApplicationStatus,
} from '../../../src/services/applications';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';

type Tab = 'received' | 'sent';

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending:  '⏳ Pendiente',
  viewed:   '👀 Vista',
  accepted: '✅ Aceptada',
  rejected: '❌ Rechazada',
};

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  pending:  '#F59E0B',
  viewed:   '#3B82F6',
  accepted: '#10B981',
  rejected: '#EF4444',
};

export default function ApplicationsScreen() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<Application[]>([]);
  const [sent, setSent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

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
      'Aceptar postulación',
      `¿Aceptás la postulación? Se abrirá un chat con ${app.artist?.display_name ?? 'el artista'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar y chatear', onPress: async () => {
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
    Alert.alert('Rechazar', '¿Rechazás esta postulación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar', style: 'destructive', onPress: async () => {
          await updateApplicationStatus(app.id, 'rejected');
          setReceived(prev =>
            prev.map(a => a.id === app.id ? { ...a, status: 'rejected' } : a)
          );
        },
      },
    ]);
  }

  const hasReceived = received.length > 0;
  const hasSent = sent.length > 0;

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.title}>Postulaciones</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'received' && s.tabActive]}
          onPress={() => setTab('received')}
        >
          <Text style={[s.tabText, tab === 'received' && s.tabTextActive]}>
            Recibidas {received.length > 0 ? `(${received.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'sent' && s.tabActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[s.tabText, tab === 'sent' && s.tabTextActive]}>
            Enviadas {sent.length > 0 ? `(${sent.length})` : ''}
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
                  <Text style={s.artistName}>{item.artist?.display_name ?? 'Artista'}</Text>
                  <Text style={s.jobTitle} numberOfLines={1}>{item.job?.title ?? ''}</Text>
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
                  <TouchableOpacity
                    style={s.rejectBtn}
                    onPress={() => handleReject(item)}
                  >
                    <Text style={s.rejectBtnText}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.acceptBtn}
                    onPress={() => handleAccept(item)}
                  >
                    <Text style={s.acceptBtnText}>Aceptar y chatear →</Text>
                  </TouchableOpacity>
                </View>
              ) : item.status === 'accepted' ? (
                <TouchableOpacity
                  style={s.chatBtn}
                  onPress={() => openChat(item.id)}
                >
                  <Text style={s.chatBtnText}>Ir al chat →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyTitle}>Sin postulaciones recibidas</Text>
              <Text style={s.emptySubtitle}>Cuando publiques una convocatoria y alguien se postule, aparecerá aquí.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/post/manual')}>
                <Text style={s.emptyBtnText}>Publicar convocatoria</Text>
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
                  <Text style={s.jobTitle}>{item.job?.title ?? 'Convocatoria'}</Text>
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
                <TouchableOpacity
                  style={s.chatBtn}
                  onPress={() => openChat(item.id)}
                >
                  <Text style={s.chatBtnText}>Ir al chat →</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📤</Text>
              <Text style={s.emptyTitle}>Sin postulaciones enviadas</Text>
              <Text style={s.emptySubtitle}>Cuando te postulés a una convocatoria dentro de ArtNet, aparecerá aquí.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)')}>
                <Text style={s.emptyBtnText}>Ver convocatorias</Text>
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
