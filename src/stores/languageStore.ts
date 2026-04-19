import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { loadLanguageBundle } from '../services/translate';

const DEVICE_LANG_MAP: Record<string, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  pt: 'Português',
  ja: '日本語',
  ar: 'العربية',
};

type LanguageStore = {
  targetLanguage: string;   // Display name: 'Español', 'English', 'Italiano', etc.
  isTranslating: boolean;
  setTargetLanguage: (name: string) => Promise<boolean>;
};

export const useLanguageStore = create<LanguageStore>((set) => ({
  targetLanguage: 'Español',
  isTranslating: false,

  setTargetLanguage: async (name: string) => {
    const normalized = name.trim() || 'Español';
    set({ isTranslating: true });
    const ok = await loadLanguageBundle(normalized);
    if (ok) {
      set({ targetLanguage: normalized });
    }
    set({ isTranslating: false });
    return ok;
  },
}));

// Restore persisted language on startup, or auto-detect device language on first launch
AsyncStorage.getItem('artnet_language')
  .then((saved) => {
    if (saved) {
      useLanguageStore.getState().setTargetLanguage(saved);
    } else {
      // First launch: use device language
      const code = Localization.getLocales()[0]?.languageCode ?? 'es';
      const name = DEVICE_LANG_MAP[code] ?? 'Español';
      useLanguageStore.getState().setTargetLanguage(name);
    }
  })
  .catch(() => {});
