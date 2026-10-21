import { useMemo } from 'react';

import { criarTema, type Tema } from '@/theme';

// Tema da igreja ativa. Por enquanto usa a cor padrão; quando o seletor de
// igreja existir, passa a usar igrejas.cor_principal.
export function useTema(): Tema {
  return useMemo(() => criarTema(), []);
}
