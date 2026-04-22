import { Platform, Linking } from 'react-native';

/**
 * Opens an external URL safely.
 * On web (iOS Safari PWA): uses window.open to open in a new tab,
 * preventing the PWA from navigating away and reloading to home on return.
 * On native: uses Linking.openURL as usual.
 */
export function openExternalUrl(url: string): void {
  if (!url) return;
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}
