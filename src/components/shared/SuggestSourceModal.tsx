import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

const SOURCE_TYPES = [
  { id: 'website',   label: '🌐 Sitio web' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'facebook',  label: '👥 Facebook' },
  { id: 'telegram',  label: '✈️ Telegram' },
  { id: 'other',     label: '➕ Otro' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SuggestSourceModal({ visible, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('website');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('Ingresá la URL o nombre del perfil.');
      return;
    }
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('source_suggestions').insert({
      url: url.trim(),
      name: name.trim() || null,
      type,
      description: description.trim() || null,
      submitted_by: user?.id ?? null,
    });
    setLoading(false);
    if (err) {
      setError('Hubo un error. Intentá de nuevo.');
    } else {
      setDone(true);
    }
  };

  const handleClose = () => {
    setUrl(''); setName(''); setType('website');
    setDescription(''); setDone(false); setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Sugerí una fuente</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {done ? (
            <View style={s.successBox}>
              <Text style={s.successEmoji}>🙌</Text>
              <Text style={s.successTitle}>¡Gracias!</Text>
              <Text style={s.successText}>
                Vamos a revisar tu sugerencia y si es una buena fuente de audiciones la sumamos al scraper.
              </Text>
              <TouchableOpacity style={s.btn} onPress={handleClose}>
                <Text style={s.btnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.intro}>
                ¿Conocés un sitio web, cuenta de Instagram, grupo de Facebook o canal de Telegram con audiciones de circo o artes escénicas? Ayudanos a crecer.
              </Text>

              {/* Tipo */}
              <Text style={s.label}>¿Qué tipo de fuente es?</Text>
              <View style={s.typeRow}>
                {SOURCE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.typeChip, type === t.id && s.typeChipActive]}
                    onPress={() => setType(t.id)}
                  >
                    <Text style={[s.typeChipText, type === t.id && s.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* URL */}
              <Text style={s.label}>
                {type === 'instagram' ? 'Usuario (@nombre)' :
                 type === 'telegram'  ? 'Canal (@nombre o link)' :
                 type === 'facebook'  ? 'URL o nombre del grupo' :
                 'URL del sitio'}
              </Text>
              <TextInput
                style={[s.input, error ? s.inputError : null]}
                placeholder={
                  type === 'instagram' ? '@circusjobs' :
                  type === 'telegram'  ? '@castingcirco' :
                  type === 'facebook'  ? 'facebook.com/groups/...' :
                  'https://...'
                }
                value={url}
                onChangeText={t => { setUrl(t); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {error ? <Text style={s.errorText}>{error}</Text> : null}

              {/* Nombre */}
              <Text style={s.label}>Nombre (opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="Ej: Circus Jobs Board"
                value={name}
                onChangeText={setName}
              />

              {/* Descripción */}
              <Text style={s.label}>¿Por qué es una buena fuente? (opcional)</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Publica audiciones de circo internacionales, cruceros, festivales..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={s.btnText}>Enviar sugerencia →</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  closeBtn: { padding: SPACING.xs },
  closeText: { fontSize: 18, color: COLORS.textSecondary },
  intro: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.xl },
  label: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs, marginTop: SPACING.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  typeChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: SPACING.sm,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeChipText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: COLORS.primary },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  inputError: { borderColor: '#EF4444' },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: FONTS.sizes.xs, color: '#EF4444', marginTop: 4 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginTop: SPACING.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  successBox: { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.md },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  successText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
