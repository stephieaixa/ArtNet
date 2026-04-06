import { Slot, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

function AppBanner() {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={s.banner}>
      <Text style={s.bannerText}>📱 Para la mejor experiencia descargá la app</Text>
      <TouchableOpacity
        onPress={() => router.push('/(auth)/download')}
        style={s.bannerBtn}
      >
        <Text style={s.bannerBtnText}>Ver cómo →</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppBanner />
      <Slot />
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  bannerText: { color: 'rgba(255,255,255,0.9)', fontSize: FONTS.sizes.xs, flex: 1 },
  bannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  bannerBtnText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: '700' },
});
