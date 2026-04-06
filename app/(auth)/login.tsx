import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking, Image,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { signInWithGoogle } from '../../src/services/googleAuth';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { EXPO_GO_URL } from '../../src/constants/config';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('login.fillAll'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error.message === 'Invalid login credentials'
        ? t('login.invalidCredentials')
        : error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result === 'success') {
      router.replace('/(tabs)');
    } else if (result === 'error') {
      Alert.alert(t('common.error'), t('login.googleError'));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StatusBar style="dark" />

        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image source={require('../../assets/logo-icon.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>{t('login.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>{t('login.loginBtn')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerText}>
              {t('login.noAccount')} <Text style={styles.registerTextBold}>{t('login.registerLink')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 60, paddingBottom: 120 },
  back: { marginBottom: SPACING.xl },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  logoImage: { width: 80, height: 80, marginBottom: SPACING.sm },
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
  forgotLink: { alignItems: 'center', marginTop: SPACING.md },
  forgotText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  registerLink: { alignItems: 'center', marginTop: SPACING.lg },
  registerText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  registerTextBold: { color: COLORS.primary, fontWeight: '600' },
});
