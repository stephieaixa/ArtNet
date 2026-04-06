import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Clipboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import ShareJobSheet from '../../src/components/shared/ShareJobSheet';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { DISCIPLINES } from '../../src/constants/disciplines';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';

type Extracted = {
  title: string;
  description: string;
  venue_name: string;
  venue_type: string;
  location_city: string;
  location_country: string;
  start_date: string;
  end_date: string;
  deadline: string;
  contact_email: string;
  contact_url: string;
  pay_info: string;
  disciplines: string[];
  region: string;
};

const EMPTY: Extracted = {
  title: '', description: '', venue_name: '', venue_type: '',
  location_city: '', location_country: '', start_date: '', end_date: '',
  deadline: '', contact_email: '', contact_url: '', pay_info: '',
  disciplines: [], region: '',
};

function isUrl(text: string) {
  return /^https?:\/\/.{5,}/i.test(text.trim());
}

async function fetchUrlText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Strip tags, collapse whitespace
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000);
  } catch {
    return '';
  }
}

async function extractWithGemini(text: string): Promise<Extracted> {
  const prompt = `Sos un asistente especializado en detectar convocatorias y trabajos para artistas escénicos (circo, danza, teatro, varieté, magia, etc.).

Analizá el siguiente texto y extraé la información de la convocatoria laboral. Si no es una convocatoria laboral, devolvé solo {"title": ""}.

Texto a analizar:
"""
${text.slice(0, 4000)}
"""

Respondé ÚNICAMENTE con JSON válido en este formato exacto:
{
  "title": "título del trabajo o convocatoria",
  "description": "descripción completa de lo que buscan",
  "venue_name": "nombre del venue, empresa o producción",
  "venue_type": "uno de: cruise_ship|hotel|festival|circus|theater|amusement_park|production_company|casino|corporate|restaurant|agency|other",
  "location_city": "ciudad",
  "location_country": "país",
  "region": "uno de: europa|america_latina|america_norte|asia|medio_oriente|oceania|africa|global",
  "start_date": "fecha de inicio (texto libre)",
  "end_date": "fecha de fin (texto libre)",
  "deadline": "fecha límite de postulación",
  "contact_email": "email de contacto",
  "contact_url": "link para postularse o más info",
  "pay_info": "información sobre pago o caché",
  "disciplines": ["lista", "de", "disciplinas", "artísticas", "mencionadas"]
}

Traducí todo al español. Si un campo no está disponible usá string vacío o array vacío.`;

  const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
  ];

  let rawText = '{}';
  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await response.json();
    console.log(`[manual] Gemini ${model} status:`, response.status);
    if (response.ok) {
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      break;
    }
    console.warn(`[manual] ${model} falló:`, data?.error?.message?.slice(0, 120));
    if (response.status === 429) await new Promise(r => setTimeout(r, 3000));
  }
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return EMPTY;
  try {
    return { ...EMPTY, ...JSON.parse(match[0]) };
  } catch {
    return EMPTY;
  }
}

export default function ManualPostScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { sharedText } = useLocalSearchParams<{ sharedText?: string }>();
  const [rawText, setRawText] = useState(sharedText ?? '');
  const [analyzing, setAnalyzing] = useState(false);
  const [clipboardText, setClipboardText] = useState('');
  const [clipboardIsUrl, setClipboardIsUrl] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Detectar si hay texto/URL en el portapapeles al abrir
  useEffect(() => {
    Clipboard.getString().then(text => {
      const trimmed = text?.trim() ?? '';
      if (trimmed.length > 10) {
        setClipboardText(trimmed);
        setClipboardIsUrl(isUrl(trimmed));
      }
    });
  }, []);

  // Si llegó texto compartido desde otra app, analizarlo automáticamente
  useEffect(() => {
    if (sharedText && sharedText.length > 20) {
      handleAnalyze();
    }
  }, []);

  function applyExtracted(result: Extracted) {
    setExtracted(result);
    setTitle(result.title);
    setDescription(result.description);
    setVenueName(result.venue_name);
    setCity(result.location_city);
    setCountry(result.location_country);
    setStartDate(result.start_date);
    setEndDate(result.end_date);
    setDeadline(result.deadline);
    setContactEmail(result.contact_email);
    setContactUrl(result.contact_url);
    setPayInfo(result.pay_info);
  }

  const importFromUrl = async (url: string) => {
    setFetchingUrl(true);
    let pageText = await fetchUrlText(url);
    setFetchingUrl(false);
    if (!pageText || pageText.length < 50) {
      Alert.alert('No se pudo leer', 'No se pudo obtener el contenido de la página. Intentá copiar el texto manualmente.');
      return;
    }
    // Prepend URL so Gemini can use it as contact_url
    pageText = `URL_FUENTE: ${url}\n\n${pageText}`;
    setRawText(pageText);
    setAnalyzing(true);
    try {
      const result = await extractWithGemini(pageText);
      if (!result.title) { setExtracted(EMPTY); setAnalyzing(false); return; }
      // If AI didn't capture the source URL, use the original URL
      if (!result.contact_url) result.contact_url = url;
      applyExtracted(result);
    } catch {
      Alert.alert(t('common.error'), 'No se pudo analizar el contenido.');
      setExtracted(EMPTY);
    }
    setAnalyzing(false);
  };

  const handleImportUrl = async () => {
    setClipboardText('');
    await importFromUrl(clipboardText);
  };

  const handleImportFromUrlInput = async () => {
    const url = urlInput.trim();
    if (!isUrl(url)) { Alert.alert('URL inválida', 'Ingresá una URL válida que comience con http:// o https://'); return; }
    setUrlInput('');
    await importFromUrl(url);
  };

  const handlePasteAndAnalyze = async () => {
    const text = clipboardText;
    setRawText(text);
    setClipboardText('');
    setAnalyzing(true);
    try {
      const result = await extractWithGemini(text);
      if (!result.title) { setExtracted(EMPTY); setAnalyzing(false); return; }
      applyExtracted(result);
    } catch {
      Alert.alert(t('common.error'), 'No se pudo analizar el texto.');
      setExtracted(EMPTY);
    }
    setAnalyzing(false);
  };
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [posting, setPosting] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Campos editables
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactUrl, setContactUrl] = useState('');
  const [payInfo, setPayInfo] = useState('');

  const handleAnalyze = async () => {
    if (rawText.trim().length < 20) return;
    setAnalyzing(true);
    try {
      const result = await extractWithGemini(rawText);
      if (!result.title) {
        setExtracted(EMPTY);
        setAnalyzing(false);
        return;
      }
      setExtracted(result);
      setTitle(result.title);
      setDescription(result.description);
      setVenueName(result.venue_name);
      setCity(result.location_city);
      setCountry(result.location_country);
      setStartDate(result.start_date);
      setEndDate(result.end_date);
      setDeadline(result.deadline);
      setContactEmail(result.contact_email);
      setContactUrl(result.contact_url);
      setPayInfo(result.pay_info);
    } catch {
      Alert.alert(t('common.error'), 'No se pudo analizar el texto.');
      setExtracted(EMPTY);
    }
    setAnalyzing(false);
  };

  const handlePublish = async () => {
    if (!title.trim()) { Alert.alert(t('manual.noTitle')); return; }
    if (!user?.id) { Alert.alert(t('common.error'), t('common.loginRequired')); return; }
    setPosting(true);
    const { error } = await supabase.from('scraped_jobs').insert({
      source_id: `community_${user.id}_${Date.now()}`,
      source_name: 'community',
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      venue_name: venueName.trim(),
      venue_type: extracted?.venue_type || 'other',
      location_city: city.trim(),
      location_country: country.trim(),
      region: extracted?.region || '',
      disciplines: extracted?.disciplines ?? [],
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      deadline: deadline.trim(),
      contact_email: contactEmail.trim(),
      contact_url: contactUrl.trim(),
      pay_info: payInfo.trim(),
      status: 'published',
      is_scraped: false,
    });
    setPosting(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    setShowShare(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ShareJobSheet
        visible={showShare}
        onClose={() => { setShowShare(false); router.replace('/(tabs)'); }}
        title={title}
        venueName={venueName}
        city={city}
        country={country}
        startDate={startDate}
        deadline={deadline}
        payInfo={payInfo}
        description={description}
      />
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📋 Compartir publicación</Text>
          {extracted && (
            <TouchableOpacity
              style={[styles.publishBtn, posting && styles.btnDisabled]}
              onPress={handlePublish}
              disabled={posting}
            >
              {posting
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={styles.publishBtnText}>{t('common.publish')}</Text>
              }
            </TouchableOpacity>
          )}
          {!extracted && <View style={{ width: 70 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {!extracted ? (
            <View style={styles.pasteSection}>

              {/* URL input — opción principal */}
              <View style={styles.urlBox}>
                <Text style={styles.urlBoxTitle}>🔗 Importar desde URL</Text>
                <Text style={styles.urlBoxSub}>Pegá el link de Facebook, Instagram, sitio web, o cualquier convocatoria online</Text>
                <View style={styles.urlInputRow}>
                  <TextInput
                    style={styles.urlInput}
                    placeholder="https://..."
                    value={urlInput}
                    onChangeText={setUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholderTextColor={COLORS.textMuted}
                    onSubmitEditing={handleImportFromUrlInput}
                    returnKeyType="go"
                  />
                  <TouchableOpacity
                    style={[styles.urlImportBtn, (!isUrl(urlInput) || fetchingUrl || analyzing) && styles.btnDisabled]}
                    onPress={handleImportFromUrlInput}
                    disabled={!isUrl(urlInput) || fetchingUrl || analyzing}
                    activeOpacity={0.85}
                  >
                    {fetchingUrl || analyzing
                      ? <ActivityIndicator size="small" color={COLORS.white} />
                      : <Text style={styles.urlImportBtnText}>Importar</Text>
                    }
                  </TouchableOpacity>
                </View>
                {fetchingUrl && (
                  <Text style={styles.fetchingText}>Leyendo página...</Text>
                )}
              </View>

              <Text style={styles.orLabel}>— o usá el portapapeles / texto —</Text>

              {/* Banner portapapeles detectado */}
              {clipboardText.length > 0 && !analyzing && (
                <TouchableOpacity
                  style={styles.clipboardBanner}
                  onPress={clipboardIsUrl ? handleImportUrl : handlePasteAndAnalyze}
                  activeOpacity={0.85}
                >
                  <Text style={styles.clipboardBannerEmoji}>{clipboardIsUrl ? '🔗' : '📋'}</Text>
                  <View style={styles.clipboardBannerText}>
                    <Text style={styles.clipboardBannerTitle}>
                      {clipboardIsUrl ? 'URL copiada detectada' : 'Tenés texto copiado'}
                    </Text>
                    <Text style={styles.clipboardBannerSub} numberOfLines={1}>{clipboardText.slice(0, 60)}</Text>
                  </View>
                  <View style={styles.clipboardBannerBtn}>
                    <Text style={styles.clipboardBannerBtnText}>
                      {clipboardIsUrl ? 'Importar →' : 'Analizar →'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TextInput
                style={styles.pasteInput}
                placeholder="O pegá aquí el texto de la publicación..."
                value={rawText}
                onChangeText={setRawText}
                multiline
                textAlignVertical="top"
                placeholderTextColor={COLORS.textMuted}
              />

              <TouchableOpacity
                style={[styles.analyzeBtn, (analyzing || rawText.length < 20) && styles.btnDisabled]}
                onPress={handleAnalyze}
                disabled={analyzing || rawText.length < 20}
                activeOpacity={0.85}
              >
                {analyzing ? (
                  <>
                    <ActivityIndicator color={COLORS.white} size="small" />
                    <Text style={styles.analyzeBtnText}>{t('manual.analyzing')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.analyzeBtnEmoji}>🤖</Text>
                    <Text style={styles.analyzeBtnText}>{t('manual.extractBtn')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setExtracted(EMPTY)} style={styles.manualLink}>
                <Text style={styles.manualLinkText}>{t('manual.manualBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formSection}>
              <View style={styles.successBanner}>
                <Text style={styles.successEmoji}>✅</Text>
                <Text style={styles.successText}>{t('flyer.extracted')}</Text>
              </View>

              <Field label={t('manual.titleField')} value={title} onChange={setTitle} placeholder={t('manual.titlePlaceholder')} />
              <Field label={t('manual.description')} value={description} onChange={setDescription} multiline placeholder={t('flyer.descriptionPlaceholder')} />
              <Field label={t('manual.whoConvokes')} value={venueName} onChange={setVenueName} placeholder={t('flyer.whoConvokesPlaceholder')} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label={t('manual.city')} value={city} onChange={setCity} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t('manual.country')} value={country} onChange={setCountry} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label={t('manual.from')} value={startDate} onChange={setStartDate} placeholder={t('manual.fromPlaceholder')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t('manual.to')} value={endDate} onChange={setEndDate} placeholder={t('manual.toPlaceholder')} />
                </View>
              </View>

              <Field label={t('manual.deadlineField')} value={deadline} onChange={setDeadline} />
              <Field label={t('manual.pay')} value={payInfo} onChange={setPayInfo} placeholder={t('flyer.payPlaceholder')} />
              <Field label={t('manual.contactEmail')} value={contactEmail} onChange={setContactEmail} placeholder="casting@empresa.com" keyboardType="email-address" />
              <Field label={t('manual.contactLink')} value={contactUrl} onChange={setContactUrl} placeholder="https://..." keyboardType="url" />

              {extracted.disciplines.length > 0 && (
                <View style={styles.disciplinesSection}>
                  <Text style={styles.fieldLabel}>Disciplinas detectadas</Text>
                  <View style={styles.disciplinesRow}>
                    {extracted.disciplines.map(d => (
                      <View key={d} style={styles.disciplineTag}>
                        <Text style={styles.disciplineTagText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={() => { setExtracted(null); }} style={styles.retryBtn}>
                <Text style={styles.retryText}>{t('common.back')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
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
  closeBtn: { padding: SPACING.sm },
  closeText: { fontSize: 18, color: COLORS.text },
  headerTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  publishBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base },
  publishBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  btnDisabled: { opacity: 0.5 },
  content: { padding: SPACING.xl, paddingBottom: 60 },
  pasteSection: { gap: SPACING.md },
  pasteEmoji: { fontSize: 56 },
  pasteTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  pasteSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  clipboardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#EDE9FE', borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  clipboardBannerEmoji: { fontSize: 28 },
  clipboardBannerText: { flex: 1 },
  clipboardBannerTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.primary },
  clipboardBannerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  clipboardBannerBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
  },
  clipboardBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.xs },
  urlBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.primary, gap: SPACING.sm,
  },
  urlBoxTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.primary },
  urlBoxSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 17 },
  urlInputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  urlInput: {
    flex: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 14, color: COLORS.text,
  },
  urlImportBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    minWidth: 80, alignItems: 'center', justifyContent: 'center',
  },
  urlImportBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  fetchingText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontStyle: 'italic' },
  orLabel: {
    textAlign: 'center', fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted, marginVertical: SPACING.xs,
  },
  pasteInput: {
    width: '100%', height: 200, backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.base, fontSize: FONTS.sizes.sm, color: COLORS.text,
    textAlignVertical: 'top',
  },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, paddingHorizontal: SPACING.xl, width: '100%', justifyContent: 'center',
  },
  analyzeBtnEmoji: { fontSize: 20 },
  analyzeBtnText: { color: COLORS.white, fontSize: FONTS.sizes.base, fontWeight: '700' },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center' },
  manualLink: { paddingVertical: SPACING.xs },
  manualLinkText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  formSection: { gap: SPACING.xs },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#D1FAE5', borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.md,
  },
  successEmoji: { fontSize: 20 },
  successText: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: '600', color: '#065F46' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  fieldLabel: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text,
  },
  fieldInputMulti: { height: 90, textAlignVertical: 'top' },
  disciplinesSection: { marginTop: SPACING.sm },
  disciplinesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  disciplineTag: { backgroundColor: '#EDE9FE', borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm },
  disciplineTagText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  retryBtn: { marginTop: SPACING.md, alignItems: 'center' },
  retryText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
});
