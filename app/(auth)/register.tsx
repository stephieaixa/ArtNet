import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { signInWithGoogle } from '../../src/services/googleAuth';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { EXPO_GO_URL } from '../../src/constants/config';

const CAPACITY_ERRORS = [
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'too many requests',
  'rate limit',
  'signup_disabled',
  'unexpected_failure',
];

function isCapacityError(msg: string) {
  return CAPACITY_ERRORS.some(e => msg.toLowerCase().includes(e.toLowerCase()));
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { role } = useLocalSearchParams<{ role: 'artist' | 'venue' }>();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitlistMode, setWaitlistMode] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  const isArtist = role !== 'venue';

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
        if (isCapacityError(error.message)) {
          setWaitlistEmail(email);
          setWaitlistMode(true);
          return;
        }
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

  const handleJoinWaitlist = async () => {
    if (!waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    try {
      await supabase.from('waitlist').insert({
        email: waitlistEmail.trim().toLowerCase(),
        role: role ?? 'artist',
      });
      setWaitlistDone(true);
    } catch {
      setWaitlistDone(true);
    } finally {
      setWaitlistLoading(false);
    }
  };

  // ── Pantalla de lista de espera ──────────────────────────────────────────
  if (waitlistMode) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { justifyContent: 'center', flex: 1 }]}>
          <StatusBar style="dark" />
          {waitlistDone ? (
            <View style={styles.waitlistBox}>
              <Text style={styles.waitlistIcon}>✓</Text>
              <Text style={styles.waitlistTitle}>Ya estás en la lista</Text>
              <Text style={styles.waitlistMsg}>
                Vas a recibir un email en las próximas horas para completar tu registro. Revisá también tu carpeta de spam.
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/welcome')} style={styles.waitlistBtn}>
                <Text style={styles.waitlistBtnText}>Volver al inicio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waitlistBox}>
              <Text style={styles.waitlistIcon}>⏳</Text>
              <Text style={styles.waitlistTitle}>Alta temporalmente no disponible</Text>
              <Text style={styles.waitlistMsg}>
                Hay mucha demanda en este momento. Dejá tu email y te avisamos en cuanto podamos darte acceso.
              </Text>
              <TextInput
                style={styles.input}
                value={waitlistEmail}
                onChangeText={setWaitlistEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="tu@email.com"
              />
              <TouchableOpacity
                style={[styles.btn, waitlistLoading && styles.btnDisabled]}
                onPress={handleJoinWaitlist}
                disabled={waitlistLoading}
                activeOpacity={0.85}
              >
                {waitlistLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnText}>Avisame cuando esté disponible</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setWaitlistMode(false)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Intentar de nuevo</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.white, borderWidth: 1.5,
    borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.lg,
  },
  googleLogo: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
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
  waitlistBox: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  waitlistIcon: { fontSize: 48, marginBottom: SPACING.sm },
  waitlistTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  waitlistMsg: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  waitlistBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', width: '100%', marginTop: SPACING.sm,
  },
  waitlistBtnText: { color: COLORS.white, fontSize: FONTS.sizes.base, fontWeight: '700' },
});
