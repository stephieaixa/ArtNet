import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform, Clipboard, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { EXPO_GO_URL } from '../../src/constants/config';

const IS_VALID_URL = EXPO_GO_URL && !EXPO_GO_URL.includes('TU_USUARIO');

export default function DownloadScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <StatusBar style="dark" />

      <View style={s.box}>
        <Text style={s.emoji}>🎪</Text>
        <Text style={s.title}>¡Ya tenés tu cuenta!</Text>
        <Text style={s.sub}>
          ArtNet es una app móvil. Para usarla en tu celular seguí estos dos pasos:
        </Text>

        {/* Paso 1 */}
        <View style={s.step}>
          <View style={s.num}><Text style={s.numText}>1</Text></View>
          <View style={s.stepBody}>
            <Text style={s.stepTitle}>Instalá Expo Go en tu celular</Text>
            <Text style={s.stepDesc}>
              Es la app gratuita que necesitás para correr ArtNet
            </Text>
            <View style={s.storeRow}>
              <TouchableOpacity
                style={s.storeBtn}
                onPress={() => Linking.openURL('https://apps.apple.com/app/expo-go/id982107779')}
                activeOpacity={0.8}
              >
                <Text style={s.storeBtnText}>📱 iPhone — App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.storeBtn}
                onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=host.exp.exponent')}
                activeOpacity={0.8}
              >
                <Text style={s.storeBtnText}>🤖 Android — Play Store</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Paso 2 */}
        <View style={s.step}>
          <View style={s.num}><Text style={s.numText}>2</Text></View>
          <View style={s.stepBody}>
            <Text style={s.stepTitle}>Abrí ArtNet en Expo Go</Text>
            {IS_VALID_URL ? (
              <Text style={s.stepDesc}>
                Con Expo Go instalado, tocá el botón de abajo para abrir ArtNet directamente.
              </Text>
            ) : (
              <Text style={s.stepDesc}>
                Abrí Expo Go, tocá el ícono de búsqueda y escribí el link que te compartimos. También podés escanear el código QR si lo tenés disponible.
              </Text>
            )}
          </View>
        </View>

        {IS_VALID_URL ? (
          <TouchableOpacity
            style={s.openBtn}
            onPress={() => Linking.openURL(EXPO_GO_URL)}
            activeOpacity={0.85}
          >
            <Text style={s.openBtnText}>Abrir ArtNet →</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.urlBox}>
            <Text style={s.urlLabel}>Link para Expo Go</Text>
            <Text style={s.urlText}>{EXPO_GO_URL}</Text>
            <TouchableOpacity
              style={s.openBtn}
              onPress={() => {
                Clipboard.setString(EXPO_GO_URL);
                Alert.alert('Copiado', 'Pegalo en Expo Go → "Enter URL manually"');
              }}
              activeOpacity={0.85}
            >
              <Text style={s.openBtnText}>Copiar link</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.divider} />

        {Platform.OS === 'web' && (
          <TouchableOpacity style={s.webBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
            <Text style={s.webBtnText}>🌐 Continuar en el navegador</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={s.loginHint}>
          <Text style={s.hint}>¿Preferís iniciar sesión de nuevo? <Text style={s.hintLink}>Ir al login</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xl, alignItems: 'center' },
  box: { width: '100%', maxWidth: 500, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: SPACING.md },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.xs },
  sub: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },

  step: {
    flexDirection: 'row', gap: SPACING.md, width: '100%',
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  num: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  numText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.base },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  stepDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  storeRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  storeBtn: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    paddingVertical: 7, paddingHorizontal: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  storeBtnText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.text },

  openBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: SPACING.base,
    alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.xl,
  },
  openBtnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  urlBox: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, marginTop: SPACING.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  urlLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  urlText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontFamily: 'monospace' },

  divider: { width: '100%', height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.lg },
  webBtn: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: SPACING.base,
    alignItems: 'center', marginBottom: SPACING.md,
  },
  webBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '700' },
  loginHint: { alignItems: 'center' },
  hint: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
  hintLink: { color: COLORS.primary, fontWeight: '600' },
});
