import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { VENUE_TYPES } from '../../src/constants/venueTypes';
import { DISCIPLINE_GENRES } from '../../src/constants/disciplines';

type Alert_ = {
  id: string;
  name: string;
  filters: {
    venueTypes?: string[];
    genres?: string[];
    regions?: string[];
  };
  active: boolean;
  created_at: string;
};

export default function AlertsScreen() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert_[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);

  // New alert form
  const [newName, setNewName] = useState('');
  const [selectedVenueTypes, setSelectedVenueTypes] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  useEffect(() => {
    checkPermissions();
    loadAlerts();
  }, []);

  async function checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    setPermGranted(status === 'granted');
  }

  async function requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermGranted(status === 'granted');
    if (status === 'granted') await registerPushToken();
  }

  async function registerPushToken() {
    if (Platform.OS === 'web' || !user?.id) return;
    try {
      const token = await Notifications.getExpoPushTokenAsync();
      await supabase.from('push_tokens').upsert(
        { user_id: user.id, token: token.data, platform: Platform.OS },
        { onConflict: 'token' }
      );
    } catch (e) {
      // No Expo project ID configured yet — silent fail
    }
  }

  async function loadAlerts() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAlerts(data ?? []);
    setLoading(false);
  }

  async function saveAlert() {
    if (!newName.trim()) { Alert.alert('Ponele un nombre a la alerta'); return; }
    if (!user?.id) return;
    setSaving(true);
    const { data, error } = await supabase.from('user_alerts').insert({
      user_id: user.id,
      name: newName.trim(),
      filters: {
        venueTypes: selectedVenueTypes,
        genres: selectedGenres,
      },
      active: true,
    }).select().single();
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setAlerts(prev => [data, ...prev]);
    setCreating(false);
    setNewName('');
    setSelectedVenueTypes([]);
    setSelectedGenres([]);
  }

  async function toggleAlert(id: string, active: boolean) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active } : a));
    await supabase.from('user_alerts').update({ active }).eq('id', id);
  }

  async function deleteAlert(id: string) {
    Alert.alert('Eliminar alerta', '¿Eliminás esta alerta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          setAlerts(prev => prev.filter(a => a.id !== id));
          await supabase.from('user_alerts').delete().eq('id', id);
        },
      },
    ]);
  }

  function toggleVenueType(id: string) {
    setSelectedVenueTypes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function toggleGenre(id: string) {
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mis alertas</Text>
        <TouchableOpacity onPress={() => setCreating(true)} style={s.addBtn}>
          <Text style={s.addText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Permisos de notificación */}
        {permGranted === false && (
          <TouchableOpacity style={s.permBanner} onPress={requestPermissions}>
            <Text style={s.permEmoji}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.permTitle}>Activar notificaciones</Text>
              <Text style={s.permSub}>Tocá para recibir alertas cuando haya nuevas convocatorias</Text>
            </View>
            <Text style={s.permArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Formulario nueva alerta */}
        {creating && (
          <View style={s.createCard}>
            <Text style={s.createTitle}>Nueva alerta</Text>

            <Text style={s.label}>Nombre de la alerta</Text>
            <TextInput
              style={s.input}
              placeholder="Ej: Cruceros aéreo, Festivales Europa…"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={s.label}>Tipo de venue (opcional)</Text>
            <View style={s.chipRow}>
              {VENUE_TYPES.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.chip, selectedVenueTypes.includes(v.id) && s.chipActive]}
                  onPress={() => toggleVenueType(v.id)}
                >
                  <Text style={s.chipEmoji}>{v.emoji}</Text>
                  <Text style={[s.chipText, selectedVenueTypes.includes(v.id) && s.chipTextActive]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Disciplinas (opcional)</Text>
            <View style={s.chipRow}>
              {DISCIPLINE_GENRES.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[s.chip, selectedGenres.includes(g.id) && s.chipActive]}
                  onPress={() => toggleGenre(g.id)}
                >
                  <Text style={s.chipEmoji}>{g.emoji}</Text>
                  <Text style={[s.chipText, selectedGenres.includes(g.id) && s.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.hint}>
              Sin filtros = te avisamos de TODAS las convocatorias nuevas.
            </Text>

            <View style={s.createBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setCreating(false)}>
                <Text style={s.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && s.btnDisabled]} onPress={saveAlert} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={s.saveBtnText}>Guardar alerta</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Lista de alertas */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : alerts.length === 0 && !creating ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🔔</Text>
            <Text style={s.emptyTitle}>Sin alertas todavía</Text>
            <Text style={s.emptySub}>
              Creá una alerta y te avisamos cuando haya convocatorias que coincidan con lo que buscás.
            </Text>
            <TouchableOpacity style={s.saveBtn} onPress={() => setCreating(true)}>
              <Text style={s.saveBtnText}>+ Crear mi primera alerta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          alerts.map(alert => (
            <View key={alert.id} style={s.alertCard}>
              <View style={s.alertTop}>
                <Text style={s.alertName}>{alert.name}</Text>
                <Switch
                  value={alert.active}
                  onValueChange={v => toggleAlert(alert.id, v)}
                  trackColor={{ true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>
              <View style={s.alertFilters}>
                {(alert.filters.venueTypes ?? []).map(id => {
                  const vt = VENUE_TYPES.find(v => v.id === id);
                  return vt ? (
                    <View key={id} style={s.filterTag}>
                      <Text style={s.filterTagText}>{vt.emoji} {vt.label}</Text>
                    </View>
                  ) : null;
                })}
                {(alert.filters.genres ?? []).map(id => {
                  const g = DISCIPLINE_GENRES.find(x => x.id === id);
                  return g ? (
                    <View key={id} style={s.filterTag}>
                      <Text style={s.filterTagText}>{g.emoji} {g.label}</Text>
                    </View>
                  ) : null;
                })}
                {(alert.filters.venueTypes ?? []).length === 0 && (alert.filters.genres ?? []).length === 0 && (
                  <Text style={s.filterTagAll}>Todas las convocatorias</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => deleteAlert(alert.id)} style={s.deleteBtn}>
                <Text style={s.deleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  backText: { fontSize: 20, color: COLORS.primary },
  headerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  addText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  content: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: 60 },
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: '#FFF7ED', borderRadius: RADIUS.lg, padding: SPACING.base,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  permEmoji: { fontSize: 24 },
  permTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#C2410C' },
  permSub: { fontSize: FONTS.sizes.xs, color: '#C2410C', marginTop: 2 },
  permArrow: { fontSize: 18, color: '#C2410C', fontWeight: '700' },
  createCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  createTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.xs },
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.text },
  chipTextActive: { color: COLORS.white },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 16 },
  createBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center',
  },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONTS.sizes.sm },
  saveBtn: {
    flex: 1, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center',
  },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  btnDisabled: { opacity: 0.6 },
  empty: { alignItems: 'center', paddingTop: 40, gap: SPACING.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  emptySub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  alertCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  alertName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text, flex: 1 },
  alertFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  filterTag: { backgroundColor: '#EDE9FE', borderRadius: RADIUS.full, paddingVertical: 3, paddingHorizontal: SPACING.sm },
  filterTagText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  filterTagAll: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  deleteBtn: { alignSelf: 'flex-end' },
  deleteText: { fontSize: FONTS.sizes.xs, color: '#EF4444', fontWeight: '600' },
});
