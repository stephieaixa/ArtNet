import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { VENUE_TYPES } from '../../constants/venueTypes';
import { DISCIPLINES, DISCIPLINE_CATEGORIES, DISCIPLINE_GENRES } from '../../constants/disciplines';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

export type FilterState = {
  venueTypes: string[];
  regions: string[];
  countries: string[];
  genres: string[];      // filtro genérico: aerial, floor, manipulation, fire, led...
  disciplines: string[]; // props específicos: tela, poi, trapecio...
  months: string[];      // mes de inicio: "1"–"12"
};

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
}

const REGION_IDS = [
  { id: 'europa',         emoji: '🇪🇺' },
  { id: 'america_latina', emoji: '🌎' },
  { id: 'america_norte',  emoji: '🇺🇸' },
  { id: 'asia',           emoji: '🌏' },
  { id: 'medio_oriente',  emoji: '🕌' },
  { id: 'oceania',        emoji: '🦘' },
  { id: 'africa',         emoji: '🌍' },
  { id: 'global',         emoji: '🌐' },
];

const COUNTRIES_BY_REGION: Record<string, string[]> = {
  europa: ['España', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Portugal', 'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Noruega', 'Suecia', 'Dinamarca', 'Grecia', 'Croacia', 'Mónaco', 'Polonia', 'Hungría', 'República Checa'],
  america_latina: ['Argentina', 'Brasil', 'México', 'Colombia', 'Chile', 'Perú', 'Uruguay', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Costa Rica', 'Panamá', 'Cuba'],
  america_norte: ['Estados Unidos', 'Canadá'],
  asia: ['Japón', 'China', 'Singapur', 'Tailandia', 'Corea del Sur', 'India', 'Indonesia', 'Filipinas', 'Vietnam', 'Macao'],
  medio_oriente: ['Emiratos Árabes', 'Arabia Saudita', 'Qatar', 'Bahréin', 'Kuwait', 'Omán'],
  oceania: ['Australia', 'Nueva Zelanda'],
  africa: ['Sudáfrica', 'Marruecos', 'Egipto'],
  global: ['Internacional / Crucero', 'Remote / Online'],
};

const MONTHS = [
  { id: '1', es: 'Ene', en: 'Jan' }, { id: '2', es: 'Feb', en: 'Feb' },
  { id: '3', es: 'Mar', en: 'Mar' }, { id: '4', es: 'Abr', en: 'Apr' },
  { id: '5', es: 'May', en: 'May' }, { id: '6', es: 'Jun', en: 'Jun' },
  { id: '7', es: 'Jul', en: 'Jul' }, { id: '8', es: 'Ago', en: 'Aug' },
  { id: '9', es: 'Sep', en: 'Sep' }, { id: '10', es: 'Oct', en: 'Oct' },
  { id: '11', es: 'Nov', en: 'Nov' }, { id: '12', es: 'Dic', en: 'Dec' },
];

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

function Chip({ label, selected, onPress, prefix }: { label: string; selected: boolean; onPress: () => void; prefix?: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipDefault]}
    >
      {prefix ? <Text style={styles.chipEmoji}>{prefix}</Text> : null}
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : styles.chipLabelDefault]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function FilterModal({ visible, onClose, onApply, initialFilters }: FilterModalProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<FilterState>(initialFilters);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const REGIONS = REGION_IDS.map(r => ({ ...r, label: t(`regions.${r.id}`) }));
  const isEn = t('language.en') === 'English';

  useEffect(() => {
    if (visible) setLocal(initialFilters);
  }, [visible]);

  const activeCount =
    local.venueTypes.length + local.regions.length + local.countries.length +
    local.genres.length + local.disciplines.length + local.months.length;

  function handleClear() {
    setLocal({ venueTypes: [], regions: [], countries: [], genres: [], disciplines: [], months: [] });
    setExpandedRegion(null);
  }

  function handleApply() {
    onApply(local);
    onClose();
  }

  function toggleVenueType(id: string) {
    setLocal(prev => ({ ...prev, venueTypes: toggle(prev.venueTypes, id) }));
  }

  function toggleRegion(id: string) {
    setLocal(prev => ({ ...prev, regions: toggle(prev.regions, id) }));
    setExpandedRegion(prev => prev === id ? null : id);
  }

  function toggleCountry(country: string) {
    setLocal(prev => ({ ...prev, countries: toggle(prev.countries, country) }));
  }

  function toggleGenre(id: string) {
    setLocal(prev => ({ ...prev, genres: toggle(prev.genres, id) }));
  }

  function toggleDiscipline(id: string) {
    setLocal(prev => ({ ...prev, disciplines: toggle(prev.disciplines, id) }));
  }

  function toggleMonth(id: string) {
    setLocal(prev => ({ ...prev, months: toggle(prev.months, id) }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.closeLabel}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('filters.title')}</Text>
            {activeCount > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.clearLabel}>{t('filters.clear')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleApply} style={[styles.headerBtn, styles.applyButton]}>
            <Text style={styles.applyLabel}>
              {activeCount > 0 ? t('filters.applyCount', { count: activeCount }) : t('filters.apply')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Tipo de venue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.venueType')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {VENUE_TYPES.map(v => (
                <Chip key={v.id} label={t(`venueTypes.${v.id}`, { defaultValue: v.label })} prefix={v.emoji}
                  selected={local.venueTypes.includes(v.id)} onPress={() => toggleVenueType(v.id)} />
              ))}
            </ScrollView>
          </View>

          {/* Región */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.region')}</Text>
            <View style={styles.wrapGrid}>
              {REGIONS.map(r => (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.7}
                  onPress={() => toggleRegion(r.id)}
                  style={[styles.regionChip, local.regions.includes(r.id) && styles.regionChipActive]}
                >
                  <Text style={styles.regionEmoji}>{r.emoji}</Text>
                  <Text style={[styles.regionLabel, local.regions.includes(r.id) && styles.regionLabelActive]}>
                    {r.label}
                  </Text>
                  {local.regions.includes(r.id) && (
                    <Text style={styles.regionArrow}>
                      {expandedRegion === r.id ? ' ▲' : ' ▼'}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {expandedRegion && COUNTRIES_BY_REGION[expandedRegion] && (
              <View style={styles.countryExpanded}>
                <Text style={styles.countryExpandedTitle}>
                  {t('filters.countriesIn', { region: REGIONS.find(r => r.id === expandedRegion)?.label })}
                </Text>
                <View style={styles.wrapGrid}>
                  {COUNTRIES_BY_REGION[expandedRegion].map(country => (
                    <Chip key={country} label={country}
                      selected={local.countries.includes(country)} onPress={() => toggleCountry(country)} />
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* País directo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.byCountry')}</Text>
            <View style={styles.wrapGrid}>
              {['Argentina', 'España', 'Francia', 'Italia', 'México', 'Brasil', 'Colombia', 'Chile', 'Alemania', 'Reino Unido', 'Estados Unidos', 'Canadá', 'Australia', 'Japón', 'Emiratos Árabes'].map(country => (
                <Chip key={country} label={country}
                  selected={local.countries.includes(country)} onPress={() => toggleCountry(country)} />
              ))}
            </View>
          </View>

          {/* Mes de inicio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.month')}</Text>
            <Text style={styles.sectionHint}>{t('filters.monthHint')}</Text>
            <View style={styles.wrapGrid}>
              {MONTHS.map(m => (
                <Chip
                  key={m.id}
                  label={isEn ? m.en : m.es}
                  selected={local.months.includes(m.id)}
                  onPress={() => toggleMonth(m.id)}
                />
              ))}
            </View>
          </View>

          {/* Tipo de disciplina — genérico */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.disciplineType')}</Text>
            <Text style={styles.sectionHint}>{t('filters.disciplineHint')}</Text>
            <View style={styles.wrapGrid}>
              {DISCIPLINE_GENRES.map(g => (
                <Chip key={g.id} label={g.label} prefix={g.emoji}
                  selected={local.genres.includes(g.id)} onPress={() => toggleGenre(g.id)} />
              ))}
            </View>
          </View>

          {/* Disciplina específica — por prop */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.disciplineSpecific')}</Text>
            <Text style={styles.sectionHint}>{t('filters.disciplineSpecificHint')}</Text>
            {DISCIPLINE_CATEGORIES.map(cat => (
              <View key={cat} style={styles.disciplineGroup}>
                <Text style={styles.disciplineGroupTitle}>{cat}</Text>
                <View style={styles.wrapGrid}>
                  {DISCIPLINES.filter(d => d.category === cat).map(d => (
                    <Chip key={d.id} label={d.label}
                      selected={local.disciplines.includes(d.id)} onPress={() => toggleDiscipline(d.id)} />
                  ))}
                </View>
              </View>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  headerBtn: { minWidth: 72, alignItems: 'center', paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.full },
  closeLabel: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, fontWeight: '500' },
  clearLabel: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  applyButton: { backgroundColor: COLORS.primary },
  applyLabel: { fontSize: FONTS.sizes.sm, color: COLORS.white, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  section: { paddingTop: SPACING.xl, paddingHorizontal: SPACING.base },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  sectionHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.md },
  horizontalRow: { flexDirection: 'row', gap: SPACING.sm, paddingRight: SPACING.base },
  wrapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  regionChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white, marginBottom: 2,
  },
  regionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  regionEmoji: { fontSize: 16 },
  regionLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  regionLabelActive: { color: COLORS.white },
  regionArrow: { fontSize: FONTS.sizes.xs, color: COLORS.white },
  countryExpanded: {
    marginTop: SPACING.md, backgroundColor: COLORS.surfaceElevated ?? '#F0EDFF',
    borderRadius: RADIUS.lg, padding: SPACING.base,
  },
  countryExpandedTitle: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.xs + 2, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full, gap: SPACING.xs,
  },
  chipDefault: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  chipSelected: { backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.primary },
  chipEmoji: { fontSize: FONTS.sizes.sm },
  chipLabel: { fontSize: FONTS.sizes.sm, fontWeight: '500' },
  chipLabelDefault: { color: COLORS.text },
  chipLabelSelected: { color: COLORS.white },
  disciplineGroup: { marginBottom: SPACING.md },
  disciplineGroupTitle: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
});
