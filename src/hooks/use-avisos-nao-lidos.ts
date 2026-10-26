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
  const igrejaId = fichas.find((f) => f.status === 'ativo')?.igreja_id;
  const [naoLidos, setNaoLidos] = useState(0);

  const atualizar = useCallback(() => {
    if (!usuarioId || !igrejaId) return;
    contarAvisosNaoLidos(usuarioId, igrejaId)
      .then(setNaoLidos)
      .catch(() => {});
  }, [usuarioId, igrejaId]);

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
