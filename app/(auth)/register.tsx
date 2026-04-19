import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { signInWithGoogle } from '../../src/services/googleAuth';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { EXPO_GO_URL } from '../../src/constants/config';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { role } = useLocalSearchParams<{ role: 'artist' | 'venue' }>();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isArtist = role !== 'venue';
  const isWeb = Platform.OS === 'web';

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${msg}`);
      onOk?.();
    } else {
      Alert.alert(title, msg, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      showAlert(t('common.error'), t('register.fillAll'));
      return;
    }
    if (password !== confirmPassword) {
      showAlert(t('common.error'), t('register.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      showAlert(t('common.error'), t('register.passwordShort'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: role ?? 'artist' },
          emailRedirectTo: 'https://artnet-circus.vercel.app',
        },
      });
      if (error) {
        showAlert(t('common.error'), error.message);
        return;
      }
      if (!data.session) {
        showAlert(
          t('register.verifyEmail'),
          t('register.verifyEmailMsg', { email }),
          () => router.replace('/(auth)/login'),
        );
        return;
      }
      if (isArtist) {
        router.replace('/(auth)/onboarding/artist');
      } else {
        router.replace('/(auth)/onboarding/venue');
      }
    } catch (err: any) {
      showAlert(t('common.error'), err?.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result === 'success') {
      // Guardar el rol elegido en metadata
      await supabase.auth.updateUser({ data: { role: role ?? 'artist' } });
      if (isArtist) {
        router.replace('/(auth)/onboarding/artist');
      } else {
        router.replace('/(auth)/onboarding/venue');
      }
    } else if (result === 'error') {
      Alert.alert(t('common.error'), t('register.googleError'));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StatusBar style="dark" />

        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>{isArtist ? '🎨' : '🏨'}</Text>
          <Text style={styles.title}>{t('register.title')}</Text>
          <Text style={styles.subtitle}>
            {isArtist ? t('register.asArtist') : t('register.forVenues')}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('register.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>{t('register.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>{t('register.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.confirmPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>{t('register.createBtn')}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            {t('register.terms')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 60 },
  back: { marginBottom: SPACING.xl },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  emoji: { fontSize: 48, marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginTop: SPACING.xs },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: { fontSize: FONTS.sizes.base, fontWeight: '600', color: COLORS.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '500' },
  form: { gap: SPACING.xs },
  label: {
    fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  terms: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
    textAlign: 'center', marginTop: SPACING.md, lineHeight: 16,
  },
});
