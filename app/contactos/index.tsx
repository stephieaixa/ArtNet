import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

type Contacto = {
  id: string;
  name: string;
  profession: string;
  company: string;
  email: string;
  phone: string;
  instagram: string;
  notes: string;
  created_at: string;
};

const EMPTY_FORM = {
  name: '', profession: '', company: '', email: '', phone: '', instagram: '', notes: '',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export default function ContactosScreen() {
  const { user } = useAuthStore();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.id) loadContactos();
  }, [user?.id]);

  async function loadContactos() {
    setLoading(true);
    const { data } = await supabase
      .from('contactos')
      .select('*')
      .eq('user_id', user!.id)
      .order('name', { ascending: true });
    setContactos(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setModalVisible(true);
  }

  function openEdit(c: Contacto) {
    setForm({
      name: c.name,
      profession: c.profession ?? '',
      company: c.company ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      instagram: c.instagram ?? '',
      notes: c.notes ?? '',
    });
    setEditingId(c.id);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Falta el nombre', 'Completá el nombre del contacto.');
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user!.id,
      name: form.name.trim(),
      profession: form.profession.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      instagram: form.instagram.trim().replace(/^@/, ''),
      notes: form.notes.trim(),
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('contactos').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('contactos').insert(payload));
    }
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    loadContactos();
  }

  async function handleDelete(id: string) {
    const doDelete = async () => {
      await supabase.from('contactos').delete().eq('id', id);
      setContactos(prev => prev.filter(c => c.id !== id));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este contacto?')) doDelete();
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar este contacto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doDelete },
    ]);
  }

  const filtered = search.trim()
    ? contactos.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.profession ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.company ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : contactos;

  // Group alphabetically
  const grouped: Record<string, Contacto[]> = {};
  filtered.forEach(c => {
    const letter = c.name[0]?.toUpperCase() ?? '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Contactos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : (
        <>
          {contactos.length > 0 && (
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar..."
                placeholderTextColor={COLORS.textMuted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📱</Text>
              <Text style={styles.emptyTitle}>
                {contactos.length === 0 ? 'Sin contactos todavía' : 'Sin resultados'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {contactos.length === 0
                  ? 'Guardá los contactos que conocés en la industria: directores, técnicos, agentes, artistas...'
                  : 'Probá otra búsqueda.'
                }
              </Text>
              {contactos.length === 0 && (
                <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
                  <Text style={styles.emptyBtnText}>Agregar primer contacto</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {Object.keys(grouped).sort().map(letter => (
                <View key={letter}>
                  <Text style={styles.sectionLetter}>{letter}</Text>
                  {grouped[letter].map(c => (
                    <TouchableOpacity key={c.id} style={styles.card} onPress={() => openEdit(c)} activeOpacity={0.8}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials(c.name)}</Text>
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName}>{c.name}</Text>
                        {(c.profession || c.company) ? (
                          <Text style={styles.cardSub}>
                            {[c.profession, c.company].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                        <View style={styles.cardActions}>
                          {c.email ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${c.email}`)}>
                              <Text style={styles.actionBtn}>✉️</Text>
                            </TouchableOpacity>
                          ) : null}
                          {c.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                              <Text style={styles.actionBtn}>📞</Text>
                            </TouchableOpacity>
                          ) : null}
                          {c.instagram ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${c.instagram}`)}>
                              <Text style={styles.actionBtn}>📸</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Editar contacto' : 'Nuevo contacto'}</Text>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Nombre completo" />

            <Text style={styles.label}>Profesión / rol</Text>
            <TextInput style={styles.input} value={form.profession} onChangeText={v => setForm(f => ({ ...f, profession: v }))} placeholder="Ej: Director de casting, Agente, Coreógrafo..." />

            <Text style={styles.label}>Empresa / compañía</Text>
            <TextInput style={styles.input} value={form.company} onChangeText={v => setForm(f => ({ ...f, company: v }))} placeholder="Ej: Cirque du Soleil, MSC, Festival..." />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="contacto@empresa.com" />

            <Text style={styles.label}>Teléfono / WhatsApp</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+54 9 11 1234 5678" />

            <Text style={styles.label}>Instagram</Text>
            <TextInput style={styles.input} value={form.instagram} onChangeText={v => setForm(f => ({ ...f, instagram: v }))} autoCapitalize="none" placeholder="@usuario" />

            <Text style={styles.label}>Notas</Text>
            <TextInput style={[styles.input, styles.textarea]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline placeholder="Cómo se conocieron, qué hace, recordatorios..." />
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
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  searchInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    fontSize: 16, color: COLORS.text,
  },
  clearSearch: { marginLeft: SPACING.sm, padding: SPACING.xs },
  clearSearchText: { color: COLORS.textMuted, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.base },
  emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.base, paddingHorizontal: SPACING.xl },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  list: { paddingBottom: SPACING.xl },
  sectionLetter: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.base,
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.primary },
  cardBody: { flex: 1 },
  cardName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  actionBtn: { fontSize: 18 },
  deleteBtn: { fontSize: 18, padding: SPACING.sm },
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
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
});
