import { useMemo } from 'react';

import { corSegura } from '@/lib/paleta';
import { corPrincipalPadrao, criarTema, type Tema } from '@/theme';

import { useMinhasFichas } from './use-minhas-fichas';

// Tema da igreja em uso (a primeira em que a pessoa está ativa, como em
// useFichaAtiva). Usa as fichas direto, sem conferir ao focar, porque o tema
// também aparece fora das telas (ex.: bloqueio da digital). Sem login ou
// com cor sem contraste, fica a cor padrão.
export function useTema(): Tema {
  const { fichas } = useMinhasFichas();
  const cor = fichas.find((f) => f.status === 'ativo')?.igrejas?.cor_principal;
  return useMemo(() => criarTema(corSegura(cor, corPrincipalPadrao)), [cor]);
}
