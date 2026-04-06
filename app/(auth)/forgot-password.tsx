import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Ingresá tu email.');
      return;
    }
    setLoading(true);
    setError('');
    // Siempre redirigir a la web — funciona desde cualquier email client
    // sin depender del servidor local ni de Expo Go corriendo
    const redirectTo = 'https://artnet-circus.vercel.app/reset-password';
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.successBox}>
          <Text style={styles.successEmoji}>📬</Text>
          <Text style={styles.successTitle}>Revisá tu email</Text>
          <Text style={styles.successText}>
            Te enviamos un link a <Text style={styles.emailHighlight}>{email}</Text> para restablecer tu contraseña.
          </Text>
          <Text style={styles.successSub}>
            Revisá también tu carpeta de spam.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.btnText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StatusBar style="dark" />

        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>🔑</Text>
          <Text style={styles.title}>Olvidé mi contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresá tu email y te enviamos un link para crear una nueva contraseña.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="tu@email.com"
            value={email}
            onChangeText={t => { setEmail(t); setError(''); }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>Enviar link de recuperación</Text>
            )}
          </TouchableOpacity>
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
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: {
    fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginTop: SPACING.xs,
    textAlign: 'center', lineHeight: 22,
  },
  form: { gap: SPACING.xs },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: FONTS.sizes.sm, color: '#EF4444', marginTop: 4 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  successBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: SPACING.xl, gap: SPACING.md,
  },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  successText: {
    fontSize: FONTS.sizes.base, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  emailHighlight: { color: COLORS.primary, fontWeight: '700' },
  successSub: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
});
