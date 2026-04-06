import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  // En web, Supabase necesita procesar el token del hash de la URL primero
  const [sessionReady, setSessionReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    async function handleRecovery() {
      // Supabase v2 PKCE: manda ?code=xxx en la URL
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchErr) {
          setError('El link expiró o no es válido. Solicitá uno nuevo desde la app.');
        }
        setSessionReady(true);
        return;
      }

      // Flujo legacy: token en el hash (#access_token=...&type=recovery)
      if (window.location.hash.includes('type=recovery')) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            setSessionReady(true);
            subscription.unsubscribe();
          }
        });
        return;
      }

      // Ya hay sesión activa
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        setError('El link expiró. Solicitá uno nuevo desde la app.');
        setSessionReady(true);
      }
    }

    handleRecovery();
  }, []);

  const handleUpdate = async () => {
    if (!password || !confirm) {
      setError('Completá ambos campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.successBox}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>¡Contraseña actualizada!</Text>
          <Text style={styles.successText}>
            Tu contraseña fue cambiada correctamente. Ya podés iniciar sesión.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.btnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!sessionReady) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.waitingText}>Verificando enlace...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StatusBar style="dark" />

        <View style={styles.header}>
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>Nueva contraseña</Text>
          <Text style={styles.subtitle}>Elegí una contraseña nueva y segura.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            autoFocus
          />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Repetí la contraseña"
            value={confirm}
            onChangeText={t => { setConfirm(t); setError(''); }}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>Guardar nueva contraseña</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 80 },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  emoji: { fontSize: 48, marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  form: { gap: SPACING.xs },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs, marginTop: SPACING.md },
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
  successText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  waitingText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginTop: SPACING.sm },
});
