import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBR from './locales/pt-BR.json';

export const idiomaPadrao = 'pt-BR';

export const recursos = {
  'pt-BR': { translation: ptBR },
} as const;

// No MVP o app é só em português; o idioma do aparelho (expo-localization)
// e o idioma da igreja entram na Fase 2.
// eslint-disable-next-line import/no-named-as-default-member -- uso recomendado pelo i18next
i18n.use(initReactI18next).init({
  resources: recursos,
  lng: idiomaPadrao,
  fallbackLng: idiomaPadrao,
  interpolation: { escapeValue: false }, // o React já protege contra injeção de HTML
});

export default i18n;
