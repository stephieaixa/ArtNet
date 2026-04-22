import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadLanguageBundle } from '../services/translate';

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

// Restore persisted language on startup (async, non-blocking)
AsyncStorage.getItem('artnet_language')
  .then((saved) => {
    if (saved && saved !== 'Español') {
      useLanguageStore.getState().setTargetLanguage(saved);
    }
  })
  .catch(() => {});
