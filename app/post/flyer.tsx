import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import ShareJobSheet from '../../src/components/shared/ShareJobSheet';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY ?? '';
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function groqVision(base64: string, prompt: string, maxTokens = 1024): Promise<string | null> {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!res.ok) { console.warn('[vision] Groq status:', res.status); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function geminiVision(base64: string, prompt: string, maxTokens = 1024): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { maxOutputTokens: maxTokens },
          contents: [{ parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: prompt },
          ]}],
        }),
      }
    );
    if (!res.ok) { console.warn('[vision] Gemini status:', res.status); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch { return null; }
}

/** Groq vision → Gemini vision cascade */
async function visionAI(base64: string, prompt: string, maxTokens = 1024): Promise<string | null> {
  return (await groqVision(base64, prompt, maxTokens)) ?? (await geminiVision(base64, prompt, maxTokens));
}

async function smartCropFlyer(
  uri: string, base64: string, width: number, height: number
): Promise<{ uri: string; wasCropped: boolean }> {
  try {
    const prompt = `Esta imagen tiene ${width}x${height} píxeles. ¿Contiene un flyer, afiche o poster de convocatoria artística dentro de un screenshot de celular u otra interfaz?

Si SÍ hay un flyer y la imagen ES un screenshot con chrome de app/UI alrededor:
Respondé SOLO con JSON: {"is_screenshot": true, "x": N, "y": N, "w": N, "h": N}
Donde x,y,w,h son los píxeles del área del flyer (sin la UI del teléfono/app).

Si la imagen YA ES solo el flyer (no hay UI alrededor) o no hay ningún flyer:
Respondé SOLO con JSON: {"is_screenshot": false}`;

    const text = await visionAI(base64, prompt, 256);
    if (!text) return { uri, wasCropped: false };
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { uri, wasCropped: false };
    const parsed = JSON.parse(match[0]);
    if (!parsed.is_screenshot || !parsed.w || !parsed.h) return { uri, wasCropped: false };

    const cropped = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX: parsed.x, originY: parsed.y, width: parsed.w, height: parsed.h } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { uri: cropped.uri, wasCropped: true };
  } catch {
    return { uri, wasCropped: false };
  }
}

type ExtractedData = {
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
  disciplines?: string[];
};

export default function FlyerPostScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [posting, setPosting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [publishedFlyerUrl, setPublishedFlyerUrl] = useState<string | null>(null);
  const [wasCropped, setWasCropped] = useState(false);
  const [cropping, setCropping] = useState(false);

  // Editable fields after extraction
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
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [newDiscipline, setNewDiscipline] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), t('flyer.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1.0,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropping(true);
      const { uri: croppedUri, wasCropped: didCrop } = await smartCropFlyer(
        asset.uri, asset.base64 ?? '', asset.width ?? 1080, asset.height ?? 1920
      );
      setCropping(false);
      setWasCropped(didCrop);
      setImage(croppedUri);

      // Re-encode cropped image to base64 for analysis
      const finalBase64 = didCrop
        ? (await ImageManipulator.manipulateAsync(croppedUri, [], { base64: true, format: ImageManipulator.SaveFormat.JPEG })).base64 ?? ''
        : asset.base64 ?? '';
      setImageBase64(finalBase64);
      analyzeFlyer(finalBase64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), t('flyer.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setImageBase64(asset.base64 ?? '');
      analyzeFlyer(asset.base64 ?? '');
    }
  };

  const showManualForm = () => {
    const empty: ExtractedData = {
      title: '', description: '', venue_name: '', venue_type: 'other',
      location_city: '', location_country: '', start_date: '',
      end_date: '', deadline: '', contact_email: '', contact_url: '',
      pay_info: '', disciplines: [],
    };
    setExtracted(empty);
  };

  const analyzeFlyer = async (base64: string) => {
    setAnalyzing(true);
    try {
      const PROMPT = `Analizá esta imagen. Es un flyer, afiche o publicación de trabajo para artistas escénicos (circo, danza, teatro, magia, acrobacia, varieté, etc.).

PASO 1 — Leé con atención ABSOLUTAMENTE TODO el texto visible en la imagen.
PASO 2 — Completá este JSON. Traducí todo al español. Si un dato no aparece, usá string vacío "".

⚠️ REGLA CRÍTICA: En "description" y "disciplines" incluí ÚNICAMENTE lo que el convocante SÍ busca o requiere. Si el flyer dice "no buscamos X" o "excepto X", ignoralo completamente. Solo lo positivo.

Respondé ÚNICAMENTE con el JSON (sin markdown, sin bloques de código):
{
  "title": "título claro de la convocatoria",
  "description": "perfil y requisitos que SÍ buscan: experiencia requerida, condiciones, idiomas, etc. (omitir exclusiones y lo que NO buscan)",
  "venue_name": "nombre del circo, empresa, festival, hotel o quien convoca",
  "venue_type": "cruise_ship|hotel|festival|circus|amusement_park|production_company|theater|casino|corporate|restaurant|agency|competition|other",
  "location_city": "ciudad",
  "location_country": "país",
  "start_date": "fecha de inicio",
  "end_date": "fecha de fin",
  "deadline": "fecha límite para postularse",
  "contact_email": "email de contacto",
  "contact_url": "URL para postularse",
  "pay_info": "información de salario o caché",
  "disciplines": ["SOLO las disciplinas artísticas que SÍ buscan, en español"]
}`;

      const text = await visionAI(base64, PROMPT, 1024);
      if (!text) {
        showManualForm();
        setAnalyzing(false);
        return;
      }

      console.log('[flyer] Texto extraído:', text.slice(0, 200));
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: ExtractedData = JSON.parse(jsonMatch[0]);
        setExtracted(parsed);
        setTitle(parsed.title ?? '');
        setDescription(parsed.description ?? '');
        setVenueName(parsed.venue_name ?? '');
        setCity(parsed.location_city ?? '');
        setCountry(parsed.location_country ?? '');
        setStartDate(parsed.start_date ?? '');
        setEndDate(parsed.end_date ?? '');
        setDeadline(parsed.deadline ?? '');
        setContactEmail(parsed.contact_email ?? '');
        setContactUrl(parsed.contact_url ?? '');
        setPayInfo(parsed.pay_info ?? '');
        setDisciplines(parsed.disciplines ?? []);
      } else {
        console.warn('[flyer] No JSON encontrado en respuesta, mostrando formulario vacío');
        showManualForm();
      }
    } catch (e: any) {
      console.error('[flyer] Error en analyzeFlyer:', e?.message);
      showManualForm();
    }
    setAnalyzing(false);
  };

  const handlePost = async () => {
    if (!title) { Alert.alert(t('flyer.addTitle')); return; }
    if (!user?.id) { Alert.alert(t('common.error'), t('common.loginRequired')); return; }
    setPosting(true);

    // Subir imagen del flyer a Storage usando base64
    let flyerUrl: string | null = null;
    if (image && imageBase64) {
      try {
        const fileName = `flyers/${user.id}/${Date.now()}.jpg`;
        console.log('[flyer] Subiendo imagen:', fileName);
        const byteArray = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
        const { error: uploadErr } = await supabase.storage
          .from('Portfolio')
          .upload(fileName, byteArray, { contentType: 'image/jpeg', upsert: false });
        if (uploadErr) {
          console.error('[flyer] Error al subir imagen:', uploadErr.message);
        } else {
          flyerUrl = supabase.storage.from('Portfolio').getPublicUrl(fileName).data.publicUrl;
          console.log('[flyer] Imagen subida OK:', flyerUrl);
        }
      } catch (e: any) {
        console.error('[flyer] Error upload catch:', e?.message);
      }
    }

    const { error } = await supabase.from('scraped_jobs').insert({
      source_id: `flyer_${user.id}_${Date.now()}`,
      source_name: 'flyer',
      source_url: sourceUrl.trim() || null,
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      venue_name: venueName.trim(),
      venue_type: extracted?.venue_type || 'other',
      location_city: city.trim(),
      location_country: country.trim(),
      disciplines,
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      deadline: deadline.trim(),
      contact_email: contactEmail.trim(),
      contact_url: contactUrl.trim(),
      pay_info: payInfo.trim(),
      flyer_url: flyerUrl,
      status: 'published',
      is_scraped: false,
    });
    setPosting(false);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setPublishedFlyerUrl(flyerUrl);
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
        flyerUrl={publishedFlyerUrl}
      />
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('flyer.headerTitle')}</Text>
          {(extracted && title) && (
            <TouchableOpacity style={[styles.postBtn, posting && styles.btnDisabled]} onPress={handlePost} disabled={posting}>
              {posting ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.postBtnText}>{t('flyer.publish')}</Text>}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {!image ? (
            <View style={styles.uploadArea}>
              <Text style={styles.uploadEmoji}>🤖</Text>
              <Text style={styles.uploadTitle}>{t('flyer.aiTitle')}</Text>
              <Text style={styles.uploadSubtitle}>{t('flyer.aiSubtitle')}</Text>

              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                <Text style={styles.uploadBtnText}>{t('flyer.pickGallery')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.uploadBtn, styles.uploadBtnSecondary]} onPress={takePhoto}>
                <Text style={[styles.uploadBtnText, { color: COLORS.text }]}>{t('flyer.takePhoto')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.uploadBtn, styles.uploadBtnSecondary]} onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') { Alert.alert(t('common.permissionNeeded'), t('flyer.galleryPermission')); return; }
                const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, quality: 1.0, base64: true });
                if (!result.canceled && result.assets[0]) {
                  const asset = result.assets[0];
                  setImage(asset.uri);
                  setImageBase64(asset.base64 ?? '');
                  analyzeFlyer(asset.base64 ?? '');
                }
              }}>
                <Text style={[styles.uploadBtnText, { color: COLORS.text }]}>{t('flyer.manualCrop')}</Text>
              </TouchableOpacity>

              <Text style={styles.supportedText}>{t('flyer.supported')}</Text>
            </View>
          ) : (
            <>
              {/* Flyer preview */}
              <View>
                <Image source={{ uri: image }} style={styles.flyerPreview} resizeMode="contain" />
                {cropping && (
                  <View style={styles.cropBadge}>
                    <ActivityIndicator size="small" color={COLORS.white} />
                    <Text style={styles.cropBadgeText}>{t('flyer.cropping')}</Text>
                  </View>
                )}
                {wasCropped && !cropping && (
                  <View style={styles.cropBadge}>
                    <Text style={styles.cropBadgeText}>{t('flyer.cropped')}</Text>
                  </View>
                )}
              </View>

              {analyzing ? (
                <View style={styles.analyzingCard}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.analyzingText}>{t('flyer.analyzing')}</Text>
                </View>
              ) : !extracted ? (
                <TouchableOpacity style={styles.manualBtn} onPress={showManualForm}>
                  <Text style={styles.manualBtnText}>{t('flyer.fillManually')}</Text>
                </TouchableOpacity>
              ) : extracted ? (
                <View style={styles.extractedCard}>
                  <Text style={styles.extractedTitle}>
                    {title ? t('flyer.extracted') : t('flyer.manualTitle')}
                  </Text>

                  <Text style={styles.label}>{t('flyer.titleField')}</Text>
                  <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('flyer.titlePlaceholder')} />

                  <Text style={styles.label}>{t('flyer.whoConvokes')}</Text>
                  <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholder={t('flyer.whoConvokesPlaceholder')} />

                  <Text style={styles.label}>{t('flyer.descriptionField')}</Text>
                  <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} multiline placeholder={t('flyer.descriptionPlaceholder')} />

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('flyer.city')}</Text>
                      <TextInput style={styles.input} value={city} onChangeText={setCity} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('flyer.country')}</Text>
                      <TextInput style={styles.input} value={country} onChangeText={setCountry} />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('flyer.from')}</Text>
                      <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder={t('flyer.fromPlaceholder')} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t('flyer.to')}</Text>
                      <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder={t('flyer.toPlaceholder')} />
                    </View>
                  </View>

                  <Text style={styles.label}>{t('flyer.deadlineField')}</Text>
                  <TextInput style={styles.input} value={deadline} onChangeText={setDeadline} placeholder={t('flyer.deadlinePlaceholder')} />

                  <Text style={styles.label}>{t('flyer.pay')}</Text>
                  <TextInput style={styles.input} value={payInfo} onChangeText={setPayInfo} placeholder={t('flyer.payPlaceholder')} />

                  <Text style={styles.label}>{t('flyer.contactEmail')}</Text>
                  <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />

                  <Text style={styles.label}>{t('flyer.contactLink')}</Text>
                  <TextInput style={styles.input} value={contactUrl} onChangeText={setContactUrl} autoCapitalize="none" placeholder="https://..." />

                  <Text style={styles.label}>{t('flyer.sourceUrl')}</Text>
                  <TextInput style={styles.input} value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" placeholder="https://..." />

                  <Text style={styles.label}>{t('flyer.disciplines')}</Text>
                  <View style={styles.disciplineRow}>
                    {disciplines.map(d => (
                      <TouchableOpacity key={d} style={styles.disciplineTag} onPress={() => setDisciplines(disciplines.filter(x => x !== d))}>
                        <Text style={styles.disciplineTagText}>{d} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={newDiscipline}
                      onChangeText={setNewDiscipline}
                      placeholder={t('flyer.addDiscipline')}
                      onSubmitEditing={() => {
                        const d = newDiscipline.trim();
                        if (d && !disciplines.includes(d)) setDisciplines([...disciplines, d]);
                        setNewDiscipline('');
                      }}
                    />
                    <TouchableOpacity style={styles.addDisciplineBtn} onPress={() => {
                      const d = newDiscipline.trim();
                      if (d && !disciplines.includes(d)) setDisciplines([...disciplines, d]);
                      setNewDiscipline('');
                    }}>
                      <Text style={styles.addDisciplineBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity onPress={() => { setImage(null); setImageBase64(''); setExtracted(null); setTitle(''); setDescription(''); setVenueName(''); setCity(''); setCountry(''); setStartDate(''); setEndDate(''); setDeadline(''); setContactEmail(''); setContactUrl(''); setPayInfo(''); setDisciplines([]); setSourceUrl(''); }} style={styles.retryBtn}>
                <Text style={styles.retryText}>{t('flyer.changeImage')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  postBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base },
  btnDisabled: { opacity: 0.6 },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
  content: { padding: SPACING.xl },
  uploadArea: { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.md },
  uploadEmoji: { fontSize: 56 },
  uploadTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  uploadSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.md },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, paddingHorizontal: SPACING.xl, width: '100%', justifyContent: 'center',
  },
  uploadBtnSecondary: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  uploadBtnEmoji: { fontSize: 20 },
  uploadBtnText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.white },
  supportedText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center', lineHeight: 17 },
  flyerPreview: { width: '100%', height: 240, borderRadius: RADIUS.lg, backgroundColor: COLORS.borderLight },
  cropBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: RADIUS.full,
    paddingVertical: 5, paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start', margin: SPACING.sm,
  },
  cropBadgeText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: '600' },
  analyzingCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.base },
  analyzingText: { fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '500' },
  extractedCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.xs, borderWidth: 1, borderColor: COLORS.borderLight },
  extractedTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.success ?? '#10B981', marginBottom: SPACING.sm },
  label: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text, marginTop: SPACING.sm, marginBottom: 4 },
  input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  disciplineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  disciplineTag: { backgroundColor: COLORS.surfaceElevated ?? '#F0EDFF', borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm },
  disciplineTagText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  retryBtn: { marginTop: SPACING.base },
  retryText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  manualBtn: {
    marginTop: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  manualBtnText: { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  addDisciplineBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, justifyContent: 'center', alignItems: 'center',
  },
  addDisciplineBtnText: { color: COLORS.white, fontSize: 22, fontWeight: '700', lineHeight: 28 },
});
