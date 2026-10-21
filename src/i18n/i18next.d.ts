import 'i18next';

import { recursos } from './index';

// Faz o TypeScript conhecer as chaves do pt-BR: t('chave-errada') vira erro.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: (typeof recursos)['pt-BR'];
  }
}
