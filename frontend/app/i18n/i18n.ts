import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Define translation resources
const resources = {
  en: {
    translation: {
      // English translations will be loaded dynamically
    }
  },
  es: { 
    translation: {
      // Spanish translations will be loaded dynamically
    }
  },
  fr: {
    translation: {
      // French translations will be loaded dynamically
    }
  },
  de: {
    translation: {
      // German translations will be loaded dynamically
    }
  }
};

// Initialize i18next
i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next
  .use(initReactI18next)
  // init i18next
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Dynamically load the translation files
const loadTranslations = async () => {
  try {
    // Use fetch to load JSON files
    const [enResponse, esResponse, frResponse, deResponse] = await Promise.all([
      fetch('/app/i18n/locales/en.json'),
      fetch('/app/i18n/locales/es.json'),
      fetch('/app/i18n/locales/fr.json'),
      fetch('/app/i18n/locales/de.json')
    ]);

    const [enData, esData, frData, deData] = await Promise.all([
      enResponse.json(),
      esResponse.json(),
      frResponse.json(),
      deResponse.json()
    ]);

    // Add loaded translations
    i18n.addResourceBundle('en', 'translation', enData, true, true);
    i18n.addResourceBundle('es', 'translation', esData, true, true);
    i18n.addResourceBundle('fr', 'translation', frData, true, true);
    i18n.addResourceBundle('de', 'translation', deData, true, true);
  } catch (error) {
    console.error('Error loading translations:', error);
  }
};

// Load translations
loadTranslations();

export default i18n; 