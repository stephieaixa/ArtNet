import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

type Obra = {
  id: string;
  title: string;
  type: string;
  venue_company: string;
  city: string;
  country: string;
  year: string;
  role: string;
  url: string;
  notes: string;
  created_at: string;
};

const OBRA_TYPES = [
  { id: 'circus', label: '🎪 Circo' },
  { id: 'theater', label: '🎭 Teatro' },
  { id: 'festival', label: '🎉 Festival' },
  { id: 'cruise', label: '🚢 Crucero' },
  { id: 'hotel', label: '🏨 Hotel / Resort' },
  { id: 'dance', label: '💃 Danza' },
  { id: 'variety', label: '✨ Varieté' },
  { id: 'other', label: '🎶 Otro' },
];

const EMPTY_FORM = {
  title: '', type: 'circus', venue_company: '', city: '', country: '',
  year: '', role: '', url: '', notes: '',
};

export default function ObrasScreen() {
  const { user } = useAuthStore();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (user?.id) loadObras();
  }, [user?.id]);

  async function loadObras() {
    setLoading(true);
    const { data } = await supabase
      .from('obras')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setObras(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setModalVisible(true);
  }

  function openEdit(obra: Obra) {
    setForm({
      title: obra.title,
      type: obra.type,
      venue_company: obra.venue_company ?? '',
      city: obra.city ?? '',
      country: obra.country ?? '',
      year: obra.year ?? '',
      role: obra.role ?? '',
      url: obra.url ?? '',
      notes: obra.notes ?? '',
    });
    setEditingId(obra.id);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert('Falta el título', 'Completá el nombre de la obra.');
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user!.id,
      title: form.title.trim(),
      type: form.type,
      venue_company: form.venue_company.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      year: form.year.trim(),
      role: form.role.trim(),
      url: form.url.trim(),
      notes: form.notes.trim(),
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('obras').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('obras').insert(payload));
    }
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    loadObras();
  }

  async function handleDelete(id: string) {
    const doDelete = async () => {
      await supabase.from('obras').delete().eq('id', id);
      setObras(prev => prev.filter(o => o.id !== id));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar esta obra?')) doDelete();
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar esta obra?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doDelete },
    ]);
  }

  const typeLabel = (id: string) => OBRA_TYPES.find(t => t.id === id)?.label ?? id;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Obras</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : obras.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎭</Text>
          <Text style={styles.emptyTitle}>Nada aquí todavía</Text>
          <Text style={styles.emptySubtitle}>Registrá las obras o espectáculos en los que participaste.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
            <Text style={styles.emptyBtnText}>Agregar mi primera obra</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {obras.map(obra => (
            <TouchableOpacity key={obra.id} style={styles.card} onPress={() => openEdit(obra)} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <Text style={styles.cardType}>{typeLabel(obra.type)}</Text>
                <TouchableOpacity onPress={() => handleDelete(obra.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardTitle}>{obra.title}</Text>
              {obra.venue_company ? <Text style={styles.cardSub}>{obra.venue_company}</Text> : null}
              <View style={styles.cardMeta}>
                {obra.role ? <Text style={styles.cardMetaText}>🎯 {obra.role}</Text> : null}
                {(obra.city || obra.country) ? (
                  <Text style={styles.cardMetaText}>📍 {[obra.city, obra.country].filter(Boolean).join(', ')}</Text>
                ) : null}
                {obra.year ? <Text style={styles.cardMetaText}>📅 {obra.year}</Text> : null}
              </View>
              {obra.notes ? <Text style={styles.cardNotes}>{obra.notes}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Editar obra' : 'Nueva obra'}</Text>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Tipo *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {OBRA_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, form.type === t.id && styles.typeChipActive]}
                  onPress={() => setForm(f => ({ ...f, type: t.id }))}
                >
                  <Text style={[styles.typeChipText, form.type === t.id && styles.typeChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Nombre de la obra / show *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Ej: Cirque Nouveau, Gala de Magia..." />

            <Text style={styles.label}>Empresa / compañía / venue</Text>
            <TextInput style={styles.input} value={form.venue_company} onChangeText={v => setForm(f => ({ ...f, venue_company: v }))} placeholder="Ej: Circo del Sol, MSC Cruises..." />

            <Text style={styles.label}>Tu rol</Text>
            <TextInput style={styles.input} value={form.role} onChangeText={v => setForm(f => ({ ...f, role: v }))} placeholder="Ej: Artista aéreo, Director, Coreógrafo..." />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ciudad</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>País</Text>
                <TextInput style={styles.input} value={form.country} onChangeText={v => setForm(f => ({ ...f, country: v }))} />
              </View>
            </View>

            <Text style={styles.label}>Año(s)</Text>
            <TextInput style={styles.input} value={form.year} onChangeText={v => setForm(f => ({ ...f, year: v }))} placeholder="Ej: 2023, 2022-2024..." keyboardType="default" />

            <Text style={styles.label}>Link (web, video, etc.)</Text>
            <TextInput style={styles.input} value={form.url} onChangeText={v => setForm(f => ({ ...f, url: v }))} autoCapitalize="none" placeholder="https://..." />

            <Text style={styles.label}>Notas</Text>
            <TextInput style={[styles.input, styles.textarea]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline placeholder="Detalles adicionales..." />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  backText: { fontSize: 20, color: COLORS.text },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base },
  addBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.base },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  list: { padding: SPACING.base, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  cardType: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700' },
  deleteBtn: { fontSize: 18 },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 2 },
  cardMetaText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  cardNotes: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: 'italic' },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: 20, paddingBottom: SPACING.base,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalClose: { fontSize: 20, color: COLORS.text, padding: SPACING.sm },
  modalTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base },
  saveBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalContent: { padding: SPACING.xl, gap: SPACING.xs },
  typeScroll: { marginBottom: SPACING.sm },
  typeChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base,
    marginRight: SPACING.sm, backgroundColor: COLORS.white,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated },
  typeChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: COLORS.primary },
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm },
});
