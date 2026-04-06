import { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAuthStore } from '../../../src/stores/authStore';
import { fetchConversations, type Conversation } from '../../../src/services/messages';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../../src/constants/theme';

function timeLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      fetchConversations().then(data => {
        setConvs(data);
        setLoading(false);
      });
    }, [user?.id])
  );

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.title}>Mensajes</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasUnread = (item.unread_count ?? 0) > 0;
            const lastMsg = item.last_message;
            const isMine = lastMsg?.sender_id === user?.id;
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.85}
                onPress={() => router.push(`/chat/${item.id}`)}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {(item.other_display_name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={s.content}>
                  <View style={s.nameRow}>
                    <Text style={[s.name, hasUnread && s.nameBold]}>
                      {item.other_display_name ?? 'Usuario'}
                    </Text>
                    <Text style={s.time}>
                      {lastMsg ? timeLabel(lastMsg.created_at) : ''}
                    </Text>
                  </View>
                  {item.job_title ? (
                    <Text style={s.jobTitle} numberOfLines={1}>📋 {item.job_title}</Text>
                  ) : null}
                  <View style={s.msgRow}>
                    <Text style={[s.message, hasUnread && s.messageBold]} numberOfLines={1}>
                      {lastMsg
                        ? `${isMine ? 'Vos: ' : ''}${lastMsg.body}`
                        : 'Conversación iniciada'}
                    </Text>
                    {hasUnread ? (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{item.unread_count}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>💬</Text>
              <Text style={s.emptyTitle}>Sin mensajes aún</Text>
              <Text style={s.emptySubtitle}>
                Los chats se abren cuando aceptás o te aceptan en una postulación.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingTop: HEADER_TOP, paddingBottom: SPACING.base },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: SPACING.sm, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base,
    backgroundColor: COLORS.white, gap: SPACING.md,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.lg },
  content: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontSize: FONTS.sizes.base, fontWeight: '600', color: COLORS.text },
  nameBold: { fontWeight: '800' },
  time: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  jobTitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 2 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  message: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  messageBold: { color: COLORS.text, fontWeight: '600' },
  badge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 84 },
  empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
