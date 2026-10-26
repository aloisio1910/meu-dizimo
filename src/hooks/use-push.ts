import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { destinoDoAviso, type Aviso } from '@/lib/avisos';
import { ouvirNotificacoes, type DadosDoPush } from '@/services/dispositivo/push';
import { marcarAvisosComoLidos } from '@/services/supabase/avisos';
import { registrarEsteAparelho } from '@/services/supabase/dispositivos';

import { avisosForamLidos } from './use-avisos-nao-lidos';
import { useMinhasFichas } from './use-minhas-fichas';
import { useSessao } from './use-sessao';

// Push (D-096): registra este celular para quem está logado e, ao tocar numa
// notificação, marca o aviso como lido e abre a mesma tela que a aba Avisos
// abriria. Só age com o app liberado (ativo): com a digital pendente, o toque
// espera até a pessoa entrar.
export function usePush(ativo: boolean) {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao } = useSessao();
  const { fichas } = useMinhasFichas();
  const usuarioId = sessao?.user.id;
  const temFichaAtiva = fichas.some((f) => f.status === 'ativo');
  const nomeDoCanal = t('avisos.titulo');

  useEffect(() => {
    if (!ativo || !usuarioId || !temFichaAtiva) return;
    registrarEsteAparelho(nomeDoCanal).catch(() => {});
  }, [ativo, usuarioId, temFichaAtiva, nomeDoCanal]);

  // O toque pode chegar antes de o app estar liberado; guarda para depois.
  const pendente = useRef<DadosDoPush | null>(null);
  const abrir = useRef<(dados: DadosDoPush) => void>(() => {});
  useEffect(() => {
    abrir.current = (dados) => {
      if (!ativo || !usuarioId) {
        pendente.current = dados;
        return;
      }
      pendente.current = null;
      if (dados.notificacao_id) {
        marcarAvisosComoLidos([dados.notificacao_id])
          .then(avisosForamLidos)
          .catch(() => {});
      }
      const ficha = fichas.find((f) => f.igreja_id === dados.igreja_id && f.status === 'ativo');
      const destino =
        dados.tipo && ficha
          ? destinoDoAviso(
              { tipo: dados.tipo as Aviso['tipo'], dados: dados.dados ?? {} },
              ficha.perfil === 'administrador',
            )
          : null;
      router.push(destino ?? '/avisos');
    };
  });

  useEffect(() => {
    let desligar = () => {};
    let encerrado = false;
    ouvirNotificacoes((dados) => abrir.current(dados))
      .then((d) => (encerrado ? d() : (desligar = d)))
      .catch(() => {});
    return () => {
      encerrado = true;
      desligar();
    };
  }, []);

  useEffect(() => {
    if (ativo && usuarioId && pendente.current) abrir.current(pendente.current);
  }, [ativo, usuarioId]);
}
