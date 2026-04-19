import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/services/supabase';
import { getOrCreateConversation } from '../../src/services/messages';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

type ArtistProfile = {
  user_id: string;
  display_name: string;
  bio?: string;
  city?: string;
  country?: string;
  disciplines?: string[];
  available_from?: string;
  available_to?: string;
  instagram_handle?: string;
  tiktok_handle?: string;
  youtube_url?: string;
  facebook_url?: string;
  website_url?: string;
};

type PortfolioItem = {
  id: string;
  type: 'photo' | 'video';
  url: string;
  sort_order: number;
};

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('artist_profiles').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order'),
    ]).then(([{ data: profileData }, { data: portfolioData }]) => {
      setProfile(profileData ?? null);
      setPortfolio((portfolioData ?? []) as PortfolioItem[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Perfil no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFallback}>
          <Text style={styles.backBtnFallbackText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initial = profile.display_name?.[0]?.toUpperCase() ?? '?';
  const disciplines = profile.disciplines ?? [];
  const hasSocials = profile.instagram_handle || profile.tiktok_handle ||
    profile.youtube_url || profile.facebook_url || profile.website_url;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />

      {/* Back button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Volver</Text>
      </TouchableOpacity>

      {/* Avatar + nombre */}
      <View style={styles.headerSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        {(profile.city || profile.country) && (
          <Text style={styles.location}>
            📍 {[profile.city, profile.country].filter(Boolean).join(', ')}
          </Text>
        )}
      </View>

      {/* Disciplinas */}
      {disciplines.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disciplinas</Text>
          <View style={styles.chipsRow}>
            {disciplines.map(d => (
              <View key={d} style={styles.chip}>
                <Text style={styles.chipText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bio */}
      {!!profile.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      )}

      {/* Disponibilidad */}
      {(profile.available_from || profile.available_to) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disponibilidad</Text>
          <Text style={styles.availText}>
            {profile.available_from ? `Desde: ${profile.available_from}` : ''}
            {profile.available_from && profile.available_to ? '  ·  ' : ''}
            {profile.available_to ? `Hasta: ${profile.available_to}` : ''}
          </Text>
        </View>
      )}

      {/* Redes sociales */}
      {hasSocials && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redes sociales</Text>
          <View style={styles.socialsRow}>
            {profile.instagram_handle && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram_handle}`)}
              >
                <Text style={styles.socialBtnText}>📸 Instagram</Text>
              </TouchableOpacity>
            )}
            {profile.tiktok_handle && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(`https://tiktok.com/@${profile.tiktok_handle}`)}
              >
                <Text style={styles.socialBtnText}>🎵 TikTok</Text>
              </TouchableOpacity>
            )}
            {profile.youtube_url && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(profile.youtube_url!)}
              >
                <Text style={styles.socialBtnText}>▶️ YouTube</Text>
              </TouchableOpacity>
            )}
            {profile.facebook_url && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(profile.facebook_url!)}
              >
                <Text style={styles.socialBtnText}>👤 Facebook</Text>
              </TouchableOpacity>
            )}
            {profile.website_url && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Linking.openURL(profile.website_url!)}
              >
                <Text style={styles.socialBtnText}>🌐 Web</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          <View style={styles.portfolioGrid}>
            {portfolio.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.portfolioThumb}
                onPress={() => Linking.openURL(item.url)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.url }} style={styles.portfolioImage} resizeMode="cover" />
                {item.type === 'video' && (
                  <View style={styles.videoTag}>
                    <Text style={styles.videoTagText}>▶</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Botón contactar */}
      <TouchableOpacity
        style={[styles.contactBtn, contacting && { opacity: 0.6 }]}
        onPress={async () => {
          if (!id || contacting) return;
          setContacting(true);
          const convId = await getOrCreateConversation(id);
          setContacting(false);
          if (convId) router.push(`/chat/${convId}` as any);
        }}
        disabled={contacting}
        activeOpacity={0.85}
      >
        {contacting
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.contactBtnText}>💬 Contactar artista</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  notFoundText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, marginBottom: SPACING.md },
  backBtn: { paddingTop: 56, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  backBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  backBtnFallback: { marginTop: SPACING.md },
  backBtnFallbackText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  headerSection: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.xl },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: { fontSize: 40, color: COLORS.white, fontWeight: '700' },
  displayName: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  location: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  section: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.base,
    padding: SPACING.base,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.primaryLight,
  },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  bioText: { fontSize: FONTS.sizes.base, color: COLORS.text, lineHeight: 22 },
  availText: { fontSize: FONTS.sizes.base, color: COLORS.text },
  socialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.full, paddingVertical: 7, paddingHorizontal: SPACING.md,
  },
  socialBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  portfolioThumb: { width: '30%', aspectRatio: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  portfolioImage: { width: '100%', height: '100%' },
  videoTag: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  videoTagText: { fontSize: 10, color: COLORS.white },
  contactBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    padding: SPACING.base, alignItems: 'center',
  },
  contactBtnText: { color: COLORS.white, fontSize: FONTS.sizes.base, fontWeight: '700' },
});
