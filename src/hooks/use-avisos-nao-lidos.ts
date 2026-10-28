import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { contarAvisosNaoLidos } from '@/services/supabase/avisos';

import { useMinhasFichas } from './use-minhas-fichas';
import { useSessao } from './use-sessao';

// Com o app aberto, a contagem do sino é conferida de novo a cada minuto.
const INTERVALO_MS = 60 * 1000;

// A tela de avisos chama avisosForamLidos() depois de marcar: todo sino na
// tela atualiza na hora, sem esperar o minuto.
const ouvintes = new Set<() => void>();

export function avisosForamLidos() {
  ouvintes.forEach((ouvir) => ouvir());
}

// Quantos avisos a pessoa ainda não leu na igreja em uso: o número do sino.
export function useAvisosNaoLidos(): { naoLidos: number; atualizar: () => void } {
  const { sessao } = useSessao();
  const { fichas } = useMinhasFichas();
  const usuarioId = sessao?.user.id;
  // Todas as igrejas em que a pessoa está ativa (D-061); a lista vira texto
  // para o efeito não rodar de novo a cada busca das fichas.
  const igrejas = fichas
    .filter((f) => f.status === 'ativo')
    .map((f) => f.igreja_id)
    .join(',');
  const [naoLidos, setNaoLidos] = useState(0);

  const atualizar = useCallback(() => {
    if (!usuarioId || !igrejas) return;
    contarAvisosNaoLidos(usuarioId, igrejas.split(','))
      .then(setNaoLidos)
      .catch(() => {});
  }, [usuarioId, igrejas]);

  useFocusEffect(atualizar);

  useEffect(() => {
    const relogio = setInterval(() => {
      if (AppState.currentState === 'active') atualizar();
    }, INTERVALO_MS);
    const assinatura = AppState.addEventListener('change', (estado) => estado === 'active' && atualizar());
    ouvintes.add(atualizar);
    return () => {
      clearInterval(relogio);
      assinatura.remove();
      ouvintes.delete(atualizar);
    };
  }, [atualizar]);

  return { naoLidos, atualizar };
}
