import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal, Image, Linking, Share, Clipboard, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../src/constants/theme';
import { DISCIPLINES } from '../../src/constants/disciplines';
import { applyToJob, checkIfApplied, type ApplicationStatus } from '../../src/services/applications';
import { translateJobContent } from '../../src/services/translate';
import { useLanguageStore } from '../../src/stores/languageStore';

const ADMIN_EMAIL = 'circusworldlife@gmail.com';
import { VENUE_TYPES } from '../../src/constants/venueTypes';

// Extract emails from any text string
function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)] : [];
}

type Job = {
  id: string;
  title: string;
  description?: string;
  venue_name?: string;
  venue_type?: string;
  location_city?: string;
  location_country?: string;
  disciplines?: string[];
  start_date?: string;
  end_date?: string;
  deadline?: string;
  contact_email?: string;
  contact_url?: string;
  pay_info?: string;
  source_name?: string;
  source_url?: string;
  flyer_url?: string;
  user_id?: string;
  created_at: string;
  translations?: Record<string, { title: string; description: string }>;
};

export default function JobDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, artistProfile } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [flyerFullscreen, setFlyerFullscreen] = useState(false);
  const [applyModal, setApplyModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [coverMessage, setCoverMessage] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<ApplicationStatus | null>(null);
  const [applying, setApplying] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const { targetLanguage } = useLanguageStore();
  const isDefaultLang = targetLanguage === 'Español';
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('scraped_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setJob(data ?? null);
        setLoading(false);
      });
  }, [id]);

  // Auto-translate when language changes or job loads
  useEffect(() => {
    if (!job || isDefaultLang) { setTranslation(null); return; }
    const stored = (job as any).translations?.[targetLanguage];
    if (stored?.title) { setTranslation(stored); return; }
    // Auto-translate
    setTranslating(true);
    translateJobContent(job.title, job.description ?? '', targetLanguage).then(result => {
      if (result) {
        setTranslation(result);
        const existing = (job as any).translations ?? {};
        supabase.from('scraped_jobs').update({
          translations: { ...existing, [targetLanguage]: result },
        }).eq('id', job.id);
      }
      setTranslating(false);
    });
  }, [job?.id, targetLanguage]);

  // Load artist profile for portfolio sharing
  useEffect(() => {
    if (!user?.id) return;
    if (artistProfile) { setProfile(artistProfile); return; }
    supabase.from('artist_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user?.id, artistProfile]);

  // Check if already applied
  useEffect(() => {
    if (!id || !user?.id) return;
    checkIfApplied(id).then(setAppliedStatus);
  }, [id, user?.id]);

  // Build portfolio text from profile data
  function buildPortfolioText(): string {
    const lines: string[] = [];
    const name = profile?.display_name || user?.email?.split('@')[0] || '';
    if (name) lines.push(`Mi nombre es ${name}.`);
    if (profile?.bio) lines.push(profile.bio);
    if (profile?.disciplines?.length) {
      const discLabels = profile.disciplines
        .map((d: string) => DISCIPLINES.find(x => x.id === d)?.label ?? d)
        .join(', ');
      lines.push(`Disciplinas: ${discLabels}.`);
    }
    if (profile?.city || profile?.country) {
      lines.push(`Ubicación: ${[profile.city, profile.country].filter(Boolean).join(', ')}.`);
    }
    lines.push('');
    lines.push('🔗 Portfolio y contacto:');
    if (profile?.website_url) lines.push(profile.website_url);
    if (profile?.instagram_handle) lines.push(`https://instagram.com/${profile.instagram_handle}`);
    if (profile?.youtube_url) lines.push(profile.youtube_url);
    if (profile?.tiktok_handle) lines.push(`https://tiktok.com/@${profile.tiktok_handle}`);
    return lines.join('\n');
  }

  function copyPortfolio() {
    Clipboard.setString(buildPortfolioText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function generateCoverLetter() {
    if (!job) return;
    const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY;
    if (!GROQ_KEY) { Alert.alert('Error', 'No hay clave de IA configurada.'); return; }

    const name = profile?.display_name || user?.email?.split('@')[0] || 'el/la artista';
    const discLabels = (profile?.disciplines ?? [])
      .map((d: string) => DISCIPLINES.find(x => x.id === d)?.label ?? d)
      .join(', ');
    const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
    const socials = [
      profile?.instagram_handle ? `Instagram: @${profile.instagram_handle}` : '',
      profile?.youtube_url ? `YouTube: ${profile.youtube_url}` : '',
      profile?.website_url ? `Web: ${profile.website_url}` : '',
    ].filter(Boolean).join(' | ');

    const langInstruction = targetLanguage && targetLanguage !== 'Español'
      ? `Write the letter in ${targetLanguage}.`
      : 'Escribí la carta en español rioplatense.';

    const prompt = `Sos un artista de circo y artes escénicas que se postula a una convocatoria. ${langInstruction}

CONVOCATORIA:
Título: ${job.title}
${job.venue_name ? `Lugar: ${job.venue_name}` : ''}
${job.location_city || job.location_country ? `Ubicación: ${[job.location_city, job.location_country].filter(Boolean).join(', ')}` : ''}
${job.description ? `Descripción: ${job.description.slice(0, 600)}` : ''}

ARTISTA:
Nombre: ${name}
${discLabels ? `Disciplinas: ${discLabels}` : ''}
${location ? `Ubicación: ${location}` : ''}
${profile?.bio ? `Bio: ${profile.bio}` : ''}
${socials ? `Contacto/Portfolio: ${socials}` : ''}

Redactá una carta de presentación breve y profesional (3-4 párrafos) para esta convocatoria de circo/artes escénicas. Debe sonar humana, apasionada y directa. No uses frases genéricas. Adaptá el tono al tipo de convocatoria. Solo devolvé el texto de la carta, sin explicaciones ni título.`;

    setGeneratingCover(true);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.75,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) setCoverMessage(text);
      else Alert.alert('Error', 'No se pudo generar el texto. Intentá de nuevo.');
    } catch {
      Alert.alert('Error', 'No se pudo conectar con la IA.');
    } finally {
      setGeneratingCover(false);
    }
  }

  async function handleInAppApply() {
    if (!job || !user) return;
    setApplying(true);
    const { error } = await applyToJob(job.id, coverMessage.trim() || undefined);
    setApplying(false);
    if (error === 'already_applied') {
      Alert.alert('Ya aplicaste', 'Ya tenés una postulación activa para esta convocatoria.');
      setAppliedStatus('pending');
      return;
    }
    if (error) {
      Alert.alert('Error', 'No se pudo enviar. Intentá de nuevo.');
      return;
    }
    setAppliedStatus('pending');
    setApplyModal(false);
    Alert.alert('¡Postulación enviada!', 'Te avisamos cuando el publicador responda.');
  }

  function openMailWithPortfolio(email: string) {
    const subject = encodeURIComponent(`Postulación: ${job?.title ?? ''}`);
    const body = encodeURIComponent(`Hola,\n\nMe interesa postularme para "${job?.title}".\n\n${buildPortfolioText()}\n\nQuedo a disposición.\nSaludos`);
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t('job.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const venueType = VENUE_TYPES.find(v => v.id === job.venue_type);
  const disciplines = (job.disciplines ?? []).map(d => DISCIPLINES.find(x => x.id === d)?.label ?? d);

  const isOwner = job && user && (job as any).user_id === user.id;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const canDelete = isOwner || isAdmin;

  const handleDelete = () => {
    Alert.alert(
      t('myPosts.deletePost'),
      t('myPosts.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('scraped_jobs').delete().eq('id', job!.id);
            if (error) Alert.alert(t('common.error'), error.message);
            else router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleShare = () => {
    if (!job) return;
    const lines: string[] = [];
    lines.push(`🎪 *${job.title}*`);
    if (job.venue_name) lines.push(`🏢 ${job.venue_name}`);
    if (job.location_city || job.location_country)
      lines.push(`📍 ${[job.location_city, job.location_country].filter(Boolean).join(', ')}`);
    if (job.start_date) lines.push(`📅 ${job.start_date}`);
    if (job.deadline) lines.push(`⏰ Deadline: ${job.deadline}`);
    if (job.pay_info) lines.push(`💰 ${job.pay_info}`);
    if (job.description) lines.push(`\n${job.description.slice(0, 200)}${job.description.length > 200 ? '...' : ''}`);
    lines.push(`\n🔗 Ver en ArtNet: https://artnet-circus.vercel.app/jobs/${job.id}`);
    const text = lines.join('\n');
    Share.share({ message: text, ...(job.flyer_url ? { url: job.flyer_url } : {}) });
  };

  // Collect all possible contact emails: explicit field + extracted from description
  const contactEmails: string[] = (() => {
    const emails: string[] = [];
    if (job?.contact_email) emails.push(job.contact_email);
    const fromDesc = extractEmails([job?.description, job?.pay_info].filter(Boolean).join(' '));
    fromDesc.forEach(e => { if (!emails.includes(e)) emails.push(e); });
    return emails;
  })();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {translating && (
            <View style={styles.translatingBadge}>
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.translatingText}>🌐</Text>
            </View>
          )}
          {!isDefaultLang && translation && !translating && (
            <View style={styles.translatedBadge}>
              <Text style={styles.translatedBadgeText}>🌐 {targetLanguage}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Flyer image with share overlay */}
        {job.flyer_url ? (
          <View style={styles.flyerWrapper}>
            <TouchableOpacity onPress={() => setFlyerFullscreen(true)} activeOpacity={0.9}>
              <Image source={{ uri: job.flyer_url }} style={styles.flyerImage} resizeMode="cover" />
              <View style={styles.flyerHint}>
                <Text style={styles.flyerHintText}>{t('job.tapToZoom')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Venue type tag */}
        <View style={styles.venueTag}>
          <Text style={styles.venueTagEmoji}>{venueType?.emoji ?? '🎭'}</Text>
          <Text style={styles.venueTagText}>{venueType?.label ?? job.venue_type ?? 'Otro'}</Text>
          {job.source_name === 'community' && <Text style={styles.communityBadge}>{t('job.communityBadge')}</Text>}
          {job.source_name === 'flyer' && <Text style={styles.communityBadge}>{t('job.flyerBadge')}</Text>}
        </View>

        <Text style={styles.title}>{translation?.title ?? job.title}</Text>

        {job.venue_name ? (
          <View style={styles.venueRow}>
            <View style={styles.venueAvatar}>
              <Text style={styles.venueAvatarText}>{job.venue_name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueName}>{job.venue_name}</Text>
              {(job.location_city || job.location_country) && (
                <Text style={styles.venueLocation}>
                  {[job.location_city, job.location_country].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.shareIconBtn} onPress={handleShare} activeOpacity={0.8}>
              <Text style={styles.shareIconBtnText}>⬆️</Text>
            </TouchableOpacity>
          </View>
        ) : (job.location_city || job.location_country) ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>📍</Text>
            <Text style={styles.infoText}>
              {[job.location_city, job.location_country].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* Dates */}
        {(job.start_date || job.end_date || job.deadline) && (
          <View style={styles.datesRow}>
            {job.start_date && (
              <View style={styles.dateChip}>
                <Text style={styles.dateChipLabel}>{t('job.dateFrom')}</Text>
                <Text style={styles.dateChipValue}>{job.start_date}</Text>
              </View>
            )}
            {job.end_date && (
              <View style={styles.dateChip}>
                <Text style={styles.dateChipLabel}>{t('job.dateTo')}</Text>
                <Text style={styles.dateChipValue}>{job.end_date}</Text>
              </View>
            )}
            {job.deadline && (
              <View style={[styles.dateChip, styles.deadlineChip]}>
                <Text style={styles.dateChipLabel}>{t('job.deadline')}</Text>
                <Text style={[styles.dateChipValue, styles.deadlineText]}>{job.deadline}</Text>
              </View>
            )}
          </View>
        )}

        {/* Pay */}
        {job.pay_info && (
          <View style={styles.payCard}>
            <Text style={styles.payEmoji}>💰</Text>
            <View>
              <Text style={styles.payLabel}>{t('job.compensation')}</Text>
              <Text style={styles.payValue}>{job.pay_info}</Text>
            </View>
          </View>
        )}

        {/* Disciplines */}
        {disciplines.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('job.disciplines')}</Text>
            <View style={styles.tags}>
              {disciplines.map(d => (
                <View key={d} style={styles.tag}>
                  <Text style={styles.tagText}>{d}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Description */}
        {(translation?.description || job.description) && (
          <>
            <Text style={styles.sectionTitle}>{t('job.description')}</Text>
            <Text style={styles.body}>{translation?.description || job.description}</Text>
          </>
        )}

        {/* Contact */}
        {(job.contact_email || job.contact_url) && (
          <>
            <Text style={styles.sectionTitle}>{t('job.contact')}</Text>
            <View style={styles.contactCard}>
              {job.contact_email && (
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${job.contact_email}`)}>
                  <Text style={styles.contactLink}>✉️ {job.contact_email}</Text>
                </TouchableOpacity>
              )}
              {job.contact_url && (
                <TouchableOpacity onPress={() => Linking.openURL(job.contact_url!)}>
                  <Text style={styles.contactLink}>{t('job.fullListing')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Source link at bottom */}
        {job.source_url && (
          <TouchableOpacity style={styles.sourceLinkBtn} onPress={() => Linking.openURL(job.source_url!)} activeOpacity={0.7}>
            <Text style={styles.sourceLinkText}>🔗 {t('job.viewSource')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => setApplyModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.applyBtnText}>
            {contactEmails.length > 0 ? '✉️ Postularme' : job.contact_url ? '🔗 Ver convocatoria' : '📋 Cómo postularme'}
          </Text>
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️ Eliminar publicación</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Flyer fullscreen */}
      <Modal visible={flyerFullscreen} transparent animationType="fade" onRequestClose={() => setFlyerFullscreen(false)}>
        <View style={styles.fullscreenModal}>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFlyerFullscreen(false)}>
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </TouchableOpacity>
          {job.flyer_url && (
            <Image source={{ uri: job.flyer_url }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Apply modal */}
      <Modal visible={applyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setApplyModal(false)}>
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Postularme</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalJobTitle}>{job.title}</Text>

            {/* In-app application (when job was posted by a user) */}
            {job.user_id && job.user_id !== user?.id && (
              <>
                <Text style={styles.modalSection}>📩 Postularme en ArtNet</Text>
                {appliedStatus ? (
                  <View style={[styles.applyEmailBtn, styles.appliedBox]}>
                    <Text style={styles.appliedText}>
                      {appliedStatus === 'accepted' ? '✅ Postulación aceptada' :
                       appliedStatus === 'rejected' ? '❌ No seleccionado/a' :
                       appliedStatus === 'viewed'   ? '👀 Vista por el publicador' :
                       '⏳ Postulación enviada — pendiente'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.aiGenerateBtn, generatingCover && { opacity: 0.6 }]}
                      onPress={generateCoverLetter}
                      disabled={generatingCover}
                      activeOpacity={0.8}
                    >
                      {generatingCover
                        ? <><ActivityIndicator color={COLORS.primary} size="small" /><Text style={styles.aiGenerateBtnText}> Generando...</Text></>
                        : <Text style={styles.aiGenerateBtnText}>✨ Generar carta con IA</Text>
                      }
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.inputMulti]}
                      placeholder="Mensaje de presentación (opcional)"
                      value={coverMessage}
                      onChangeText={setCoverMessage}
                      multiline
                      numberOfLines={5}
                    />
                    <TouchableOpacity
                      style={[styles.inAppApplyBtn, applying && { opacity: 0.6 }]}
                      onPress={handleInAppApply}
                      disabled={applying}
                      activeOpacity={0.85}
                    >
                      {applying
                        ? <ActivityIndicator color={COLORS.white} />
                        : <Text style={styles.inAppApplyBtnText}>Enviar postulación →</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* Email contacts detected */}
            {contactEmails.length > 0 && (
              <>
                <Text style={styles.modalSection}>✉️ Enviar postulación por email</Text>
                {contactEmails.map(email => (
                  <TouchableOpacity
                    key={email}
                    style={styles.applyEmailBtn}
                    onPress={() => openMailWithPortfolio(email)}
                  >
                    <Text style={styles.applyEmailText}>{email}</Text>
                    <Text style={styles.applyEmailSub}>Abre tu app de correo con tu portfolio incluido</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* URL apply */}
            {job.contact_url && (
              <>
                <Text style={styles.modalSection}>🔗 Postulación online</Text>
                <TouchableOpacity style={styles.applyEmailBtn} onPress={() => Linking.openURL(job.contact_url!)}>
                  <Text style={styles.applyEmailText}>Ir a la convocatoria original</Text>
                  <Text style={styles.applyEmailSub}>{job.contact_url}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Source URL fallback */}
            {!contactEmails.length && !job.contact_url && job.source_url && (
              <>
                <Text style={styles.modalSection}>🌐 Publicación original</Text>
                <TouchableOpacity style={styles.applyEmailBtn} onPress={() => Linking.openURL(job.source_url!)}>
                  <Text style={styles.applyEmailText}>Ir al sitio de la fuente</Text>
                  <Text style={styles.applyEmailSub} numberOfLines={1}>{job.source_url}</Text>
                </TouchableOpacity>
                <Text style={styles.sourceWarning}>
                  Puede abrir la página principal del sitio. Buscá el título de la convocatoria una vez dentro.
                </Text>
              </>
            )}

            {/* Portfolio copy */}
            <Text style={styles.modalSection}>📎 Tu portfolio para compartir</Text>
            <View style={styles.portfolioBox}>
              <Text style={styles.portfolioText}>{buildPortfolioText()}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyPortfolio}>
              <Text style={styles.copyBtnText}>{copied ? '✓ Copiado' : 'Copiar portfolio'}</Text>
            </TouchableOpacity>
            {(!profile?.website_url && !profile?.instagram_handle) && (
              <TouchableOpacity onPress={() => { setApplyModal(false); router.push('/(tabs)/profile'); }}>
                <Text style={styles.profileTip}>💡 Agregá tu web o Instagram en tu perfil para tener un portfolio más completo</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  notFoundText: { fontSize: FONTS.sizes.lg, color: COLORS.text },
  backLink: { color: COLORS.primary, fontSize: FONTS.sizes.base },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingTop: HEADER_TOP, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  backBtn: { padding: SPACING.sm },
  backText: { fontSize: 22, color: COLORS.text },
  shareBtn: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 5, paddingHorizontal: SPACING.sm, backgroundColor: COLORS.white,
  },
  shareText: { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: '600' },
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: 180 },
  flyerWrapper: { position: 'relative', marginBottom: 0 },
  flyerImage: {
    width: '100%', height: 280, borderRadius: RADIUS.xl,
    marginBottom: 4, backgroundColor: COLORS.borderLight,
  },
  flyerHint: { alignItems: 'center', marginBottom: SPACING.base },
  flyerHintText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  flyerShareBtn: {
    position: 'absolute', bottom: 28, right: SPACING.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  flyerShareIcon: { fontSize: 18 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.sm, flexWrap: 'wrap',
  },
  shareIconBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.full, paddingVertical: 6, paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  shareIconBtnText: { fontSize: 15 },
  inlineShareBtn: {
    alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 5, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white, marginBottom: SPACING.sm,
  },
  inlineShareText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '600' },
  venueTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  venueTagEmoji: { fontSize: 16 },
  venueTagText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  communityBadge: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700', backgroundColor: '#EDE9FE', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, lineHeight: 32, marginBottom: SPACING.sm },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm, justifyContent: 'space-between' },
  sourceLinkBtn: { alignSelf: 'flex-start', paddingVertical: SPACING.sm, marginTop: SPACING.sm },
  sourceLinkText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  venueAvatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  venueAvatarText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.lg },
  venueName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.primary },
  venueLocation: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.base },
  infoEmoji: { fontSize: 16 },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '500' },
  datesRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.base, flexWrap: 'wrap' },
  dateChip: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight, minWidth: 90 },
  deadlineChip: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  dateChipLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  dateChipValue: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '700', marginTop: 2 },
  deadlineText: { color: '#C2410C' },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#EDE9FE', borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.sm },
  payEmoji: { fontSize: 28 },
  payLabel: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600', textTransform: 'uppercase' },
  payValue: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.primaryDark },
  sectionTitle: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.base, marginBottom: SPACING.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  tag: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.full, paddingVertical: 5, paddingHorizontal: SPACING.sm },
  tagText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  body: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, lineHeight: 24 },
  contactCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight, gap: SPACING.sm },
  contactLink: { fontSize: FONTS.sizes.base, color: COLORS.primary, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.xl, paddingBottom: 34, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.borderLight, gap: SPACING.sm },
  applyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center' },
  applyBtnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: SPACING.xs },
  deleteBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.error ?? '#EF4444', fontWeight: '600' },
  fullscreenModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullscreenClose: { position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  fullscreenImage: { width: '100%', height: '85%' },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.xl, paddingTop: HEADER_TOP, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  modalClose: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  modalTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  modalContent: { padding: SPACING.xl },
  modalJobTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.xl },
  modalSection: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm, marginTop: SPACING.xl },
  applyEmailBtn: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: SPACING.sm },
  applyEmailText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.primary },
  applyEmailSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  portfolioBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.sm },
  portfolioText: { fontSize: FONTS.sizes.sm, color: COLORS.text, lineHeight: 20 },
  aiGenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base,
    marginBottom: SPACING.sm, backgroundColor: '#EDE9FE',
  },
  aiGenerateBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '700' },
  copyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center', marginBottom: SPACING.sm },
  copyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  profileTip: { fontSize: FONTS.sizes.sm, color: COLORS.primary, textAlign: 'center', lineHeight: 18, marginTop: SPACING.sm },
  sourceWarning: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, lineHeight: 16, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', marginBottom: SPACING.sm },
  inAppApplyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center', marginBottom: SPACING.sm,
  },
  inAppApplyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  appliedBox: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  appliedText: { fontSize: FONTS.sizes.sm, color: '#166534', fontWeight: '600' },
  translatingBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
  },
  translatingText: { fontSize: FONTS.sizes.xs, color: COLORS.primary },
  translatedBadge: {
    flexDirection: 'row', alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.full,
    paddingVertical: 4, paddingHorizontal: SPACING.sm, marginBottom: SPACING.base,
  },
  translatedBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
});
