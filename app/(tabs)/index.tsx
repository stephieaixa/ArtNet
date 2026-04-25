import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, HEADER_TOP } from '../../src/constants/theme';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useDiscoverStore } from '../../src/stores/discoverStore';

import DiscoverScreen from './discover/index';
import ApplicationsScreen from './applications/index';
import MessagesScreen from './messages/index';
import ProfileScreen from './profile/index';
import DirectorioScreen from '../directorio/index';
import ObrasRecomendadasScreen from '../obras-recomendadas/index';

// ── Actividad: mensajes + publiqué en una sola tab ───────────────────────────

function ActividadScreen() {
  const { t } = useTranslation();
  const [inner, setInner] = useState<'messages' | 'applications'>('messages');

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Inner tab bar */}
      <View style={act.innerBar}>
        <TouchableOpacity
          style={[act.innerTab, inner === 'messages' && act.innerTabActive]}
          onPress={() => setInner('messages')}
          activeOpacity={0.8}
        >
          <Text style={[act.innerLabel, inner === 'messages' && act.innerLabelActive]}>
            💬 {t('tabs.messages')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[act.innerTab, inner === 'applications' && act.innerTabActive]}
          onPress={() => setInner('applications')}
          activeOpacity={0.8}
        >
          <Text style={[act.innerLabel, inner === 'applications' && act.innerLabelActive]}>
            📤 {t('tabs.myPosts')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {inner === 'messages' ? <MessagesScreen /> : <ApplicationsScreen />}
      </View>
    </View>
  );
}

const act = StyleSheet.create({
  innerBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: HEADER_TOP,
  },
  innerTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  innerTabActive: {
    borderBottomColor: COLORS.primary,
  },
  innerLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  innerLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});

// ── Wrapper de inspiraciones sin botón back ───────────────────────────────────

function InspirarseScreen() {
  return <ObrasRecomendadasScreen isTab />;
}

// ── Tab bar principal ─────────────────────────────────────────────────────────

export default function TabsIndex() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeTab, setActiveTab } = useDiscoverStore();
  const insets = useSafeAreaInsets();
  // On web/Safari browser, add extra bottom padding so tab bar clears the browser toolbar
  const tabBarBottom = Platform.OS === 'web'
    ? Math.max(insets.bottom, 16)
    : insets.bottom;
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count and subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    async function fetchUnread() {
      // Get user's conversation IDs
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`artist_user_id.eq.${user!.id},other_user_id.eq.${user!.id}`);

      if (!convs?.length) { setUnreadCount(0); return; }

      const convIds = convs.map((c: any) => c.id);
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', user!.id)
        .is('read_at', null);
      setUnreadCount(count ?? 0);
    }

    fetchUnread();

    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Clear badge when actividad tab is opened
  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'actividad') setUnreadCount(0);
  };


  const TABS = [
    { id: 'discover',    emoji: '🔍', label: t('tabs.discover'),   Screen: DiscoverScreen },
    { id: 'directorio', emoji: '🗂️',  label: t('tabs.directory'),  Screen: DirectorioScreen },
    { id: 'inspirarse', emoji: '🎬',  label: t('tabs.inspire'),    Screen: InspirarseScreen },
    { id: 'actividad',  emoji: '📬',  label: t('tabs.activity'),   Screen: ActividadScreen, badge: unreadCount },
    { id: 'profile',    emoji: '👤',  label: t('tabs.profile'),    Screen: ProfileScreen },
  ];
  const ActiveScreen = TABS.find(t => t.id === activeTab)?.Screen ?? DiscoverScreen;

  return (
    <View style={[styles.container, Platform.OS === 'web' && ({ height: '100dvh' } as any)]}>
      <View style={styles.screenArea}>
        <ActiveScreen {...(activeTab === 'profile' ? { onBack: () => setActiveTab('discover') } : {})} />
      </View>

      <View style={[styles.tabBar, { paddingBottom: tabBarBottom }]}>
        {TABS.map(tab => {
          const focused = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconWrap}>
                <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>
                  {tab.emoji}
                </Text>
                {!!(tab as any).badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {(tab as any).badge > 99 ? '99+' : (tab as any).badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenArea: { flex: 1, overflow: 'hidden' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIconWrap: { position: 'relative' },
  tabEmoji: { fontSize: 22, opacity: 0.35 },
  tabEmojiFocused: { opacity: 1 },
  tabLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  tabLabelFocused: { color: COLORS.primary, fontWeight: '700' },
  bell: {
    position: 'absolute', top: 12, right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },
  bellIcon: { fontSize: 20 },
  bellBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: COLORS.error, borderRadius: 9999,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  bellBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: COLORS.error, borderRadius: 9999,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
});
