import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import nb from '../../locales/nb.json';

i18n.use(initReactI18next).init({
  resources: {
    nb: { translation: nb },
  },
  lng: 'nb',
  fallbackLng: 'nb',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
