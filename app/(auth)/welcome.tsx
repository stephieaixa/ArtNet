import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />

      {/* Top purple section */}
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo-icon.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.appName}>ArtNet</Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        </View>
      </View>

      {/* Bottom white section with CTAs */}
      <View style={styles.bottomSection}>
        <Text style={styles.headline}>{t('welcome.headline')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>

        <TouchableOpacity
          style={styles.btnArtist}
          onPress={() => router.push('/(auth)/register?role=artist')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnArtistEmoji}>🎨</Text>
          <View>
            <Text style={styles.btnArtistTitle}>{t('welcome.artistBtn')}</Text>
            <Text style={styles.btnSubtitle}>{t('welcome.artistSub')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnVenue}
          onPress={() => router.push('/(auth)/register?role=venue')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnVenueEmoji}>🏨</Text>
          <View>
            <Text style={styles.btnVenueTitle}>{t('welcome.venueBtn')}</Text>
            <Text style={styles.btnSubtitle2}>{t('welcome.venueSub')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={() => router.push('/post/guest')}
          activeOpacity={0.85}
        >
          <Text style={styles.guestBtnText}>{t('welcome.guestPost')}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('welcome.alreadyAccount')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.loginBtnText}>{t('welcome.loginLink')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    minHeight: height * 0.32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 36,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: 6,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
    marginBottom: 2,
  },
  tagline: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: SPACING.xl,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headline: {
    fontSize: FONTS.sizes.lg ?? 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  btnArtist: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  btnArtistEmoji: { fontSize: 26 },
  btnArtistTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.white,
  },
  btnSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  btnVenue: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  btnVenueEmoji: { fontSize: 26 },
  btnVenueTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
  btnSubtitle2: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  guestBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 11,
    paddingHorizontal: SPACING.base,
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  guestBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 6,
    marginBottom: 6,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '500' },
  loginBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    alignItems: 'center',
  },
  loginBtnText: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
