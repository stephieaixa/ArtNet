import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import es from './locales/es';
import en from './locales/en';
import fr from './locales/fr';

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLanguage = ['es', 'en', 'fr'].includes(deviceLanguage) ? deviceLanguage : 'en';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      es: { translation: es },
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: supportedLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
