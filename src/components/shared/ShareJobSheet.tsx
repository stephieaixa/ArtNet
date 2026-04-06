import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Share, Linking, Clipboard, Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  venueName?: string;
  city?: string;
  country?: string;
  startDate?: string;
  deadline?: string;
  payInfo?: string;
  description?: string;
  flyerUrl?: string | null;
};

function buildShareText(props: Props): string {
  const { title, venueName, city, country, startDate, deadline, payInfo, description } = props;
  const lines: string[] = [];

  lines.push(`🎪 *${title}*`);
  if (venueName) lines.push(`🏢 ${venueName}`);
  if (city || country) lines.push(`📍 ${[city, country].filter(Boolean).join(', ')}`);
  if (startDate) lines.push(`📅 ${startDate}`);
  if (deadline) lines.push(`⏰ Deadline: ${deadline}`);
  if (payInfo) lines.push(`💰 ${payInfo}`);
  if (description) lines.push(`\n${description.slice(0, 200)}${description.length > 200 ? '...' : ''}`);
  lines.push('\n📲 Publicado en ArtNet – la app de trabajos para artistas escénicos');

  return lines.join('\n');
}

// Descarga el flyer remoto a un archivo local temporal para poder compartirlo como imagen
async function downloadFlyer(url: string): Promise<string | null> {
  try {
    const ext = url.split('?')[0].split('.').pop() ?? 'jpg';
    const localUri = `${FileSystem.cacheDirectory}flyer_share.${ext}`;
    const { uri } = await FileSystem.downloadAsync(url, localUri);
    return uri;
  } catch {
    return null;
  }
}

const PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    emoji: '💬',
    color: '#25D366',
    action: async (text: string, localUri?: string | null) => {
      if (localUri) {
        // Imagen local → sheet nativo (WhatsApp aparece como opción con imagen)
        Share.share({ message: text, url: localUri });
      } else {
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`);
      }
    },
  },
  {
    id: 'telegram',
    label: 'Telegram',
    emoji: '✈️',
    color: '#2AABEE',
    action: async (text: string, localUri?: string | null) => {
      if (localUri) {
        Share.share({ message: text, url: localUri });
      } else {
        Linking.openURL(`https://t.me/share/url?text=${encodeURIComponent(text)}`);
      }
    },
  },
  {
    id: 'instagram',
    label: 'Instagram',
    emoji: '📸',
    color: '#E1306C',
    action: async (text: string, localUri?: string | null) => {
      if (localUri) {
        const storiesUrl = `instagram-stories://share?backgroundImageURL=${encodeURIComponent(localUri)}`;
        const canOpen = await Linking.canOpenURL(storiesUrl);
        if (canOpen) { Linking.openURL(storiesUrl); return; }
      }
      Share.share({ message: text, ...(localUri ? { url: localUri } : {}) });
    },
  },
  {
    id: 'facebook',
    label: 'Facebook',
    emoji: '👥',
    color: '#1877F2',
    action: async (text: string, localUri?: string | null) => {
      Share.share({ message: text, ...(localUri ? { url: localUri } : {}) });
    },
  },
  {
    id: 'more',
    label: 'Más opciones',
    emoji: '⬆️',
    color: COLORS.text,
    action: (text: string, localUri?: string | null) =>
      Share.share({ message: text, ...(localUri ? { url: localUri } : {}) }),
  },
];

export default function ShareJobSheet({ visible, onClose, flyerUrl, ...props }: Props) {
  const shareText = buildShareText({ visible, onClose, flyerUrl, ...props });
  const [localFlyerUri, setLocalFlyerUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible && flyerUrl) {
      downloadFlyer(flyerUrl).then(setLocalFlyerUri);
    } else {
      setLocalFlyerUri(null);
    }
  }, [visible, flyerUrl]);

  const handleCopy = () => {
    Clipboard.setString(shareText);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>✅ ¡Publicado en ArtNet!</Text>
        <Text style={styles.subtitle}>
          Compartilo también en tus grupos para llegar a más artistas
        </Text>

        <View style={styles.jobPreview}>
          {localFlyerUri && (
            <Image source={{ uri: localFlyerUri }} style={styles.flyerThumb} resizeMode="cover" />
          )}
          <Text style={styles.jobTitle} numberOfLines={2}>{props.title}</Text>
          {(props.city || props.country) && (
            <Text style={styles.jobMeta}>📍 {[props.city, props.country].filter(Boolean).join(', ')}</Text>
          )}
          {localFlyerUri && (
            <Text style={styles.flyerNote}>📎 Flyer adjunto</Text>
          )}
        </View>

        <View style={styles.platforms}>
          {PLATFORMS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.platformBtn}
              onPress={() => p.action(shareText, localFlyerUri)}
              activeOpacity={0.75}
            >
              <View style={[styles.platformIcon, { backgroundColor: p.color + '18' }]}>
                <Text style={styles.platformEmoji}>{p.emoji}</Text>
              </View>
              <Text style={styles.platformLabel}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          <Text style={styles.copyBtnText}>📋 Copiar texto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
          <Text style={styles.skipBtnText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.base,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.base,
  },
  jobPreview: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.base,
    overflow: 'hidden',
  },
  flyerThumb: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  flyerNote: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  jobTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  platforms: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.base,
  },
  platformBtn: {
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  platformIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformEmoji: {
    fontSize: 26,
  },
  platformLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  copyBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  copyBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
});
