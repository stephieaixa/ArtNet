import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, HEADER_TOP } from '../../src/constants/theme';

import DiscoverScreen from './discover/index';
import ApplicationsScreen from './applications/index';
import MessagesScreen from './messages/index';
import ProfileScreen from './profile/index';
import DirectorioScreen from '../directorio/index';
import ObrasRecomendadasScreen from '../obras-recomendadas/index';

// ── Actividad: mensajes + publiqué en una sola tab ───────────────────────────

function ActividadScreen() {
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
            💬 Mensajes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[act.innerTab, inner === 'applications' && act.innerTabActive]}
          onPress={() => setInner('applications')}
          activeOpacity={0.8}
        >
          <Text style={[act.innerLabel, inner === 'applications' && act.innerLabelActive]}>
            📤 Mis publicaciones
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

const TABS = [
  { id: 'discover',     emoji: '🔍', label: 'Explorar',   Screen: DiscoverScreen },
  { id: 'directorio',  emoji: '🗂️',  label: 'Directorio', Screen: DirectorioScreen },
  { id: 'inspirarse',  emoji: '🎬',  label: 'Inspirarse', Screen: InspirarseScreen },
  { id: 'actividad',   emoji: '📬',  label: 'Actividad',  Screen: ActividadScreen },
  { id: 'profile',     emoji: '👤',  label: 'Perfil',     Screen: ProfileScreen },
];

export default function TabsIndex() {
  const [activeTab, setActiveTab] = useState('discover');
  const ActiveScreen = TABS.find(t => t.id === activeTab)?.Screen ?? DiscoverScreen;

  return (
    <View style={styles.container}>
      <View style={styles.screenArea}>
        <ActiveScreen />
      </View>

      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const focused = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>
                {tab.emoji}
              </Text>
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
  screenArea: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 80,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabEmoji: { fontSize: 22, opacity: 0.35 },
  tabEmojiFocused: { opacity: 1 },
  tabLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  tabLabelFocused: { color: COLORS.primary, fontWeight: '700' },
});
