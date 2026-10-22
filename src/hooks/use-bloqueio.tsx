import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  autenticar,
  biometriaDisponivel,
  gravarPreferencia,
  lerPreferencia,
  type PreferenciaDeBiometria,
  type ResultadoDaBiometria,
} from '@/services/dispositivo/biometria';

import { useSessao } from './use-sessao';

// Ao voltar para o app depois deste tempo em segundo plano, pede a digital de novo.
const TEMPO_PARA_BLOQUEAR_MS = 5 * 60 * 1000;

type EstadoDoBloqueio = 'verificando' | 'bloqueado' | 'liberado';

type ValorDoBloqueio = {
  estado: EstadoDoBloqueio;
  disponivel: boolean;
  preferencia: PreferenciaDeBiometria | null;
  desbloquear: () => Promise<ResultadoDaBiometria>;
  ativar: () => Promise<ResultadoDaBiometria>;
  recusar: () => Promise<void>;
};

const ContextoDoBloqueio = createContext<ValorDoBloqueio | null>(null);

export function ProvedorDeBloqueio({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { sessao, carregando: carregandoSessao } = useSessao();
  const usuarioId = sessao?.user.id;

  const [estado, setEstado] = useState<EstadoDoBloqueio>('verificando');
  const [disponivel, setDisponivel] = useState(false);
  const [preferencia, setPreferencia] = useState<PreferenciaDeBiometria | null>(null);
  const usuarioAnterior = useRef<string | undefined>(undefined);
  const foiParaSegundoPlanoEm = useRef<number | null>(null);

  // Ao abrir o app: com a digital ativada e alguém logado, começa bloqueado.
  useEffect(() => {
    if (carregandoSessao) return;
    let ativo = true;
    Promise.all([biometriaDisponivel(), lerPreferencia()]).then(([temBiometria, preferenciaGuardada]) => {
      if (!ativo) return;
      setDisponivel(temBiometria);
      setPreferencia(preferenciaGuardada);
      setEstado(usuarioId && preferenciaGuardada === 'ativada' ? 'bloqueado' : 'liberado');
    });
    return () => {
      ativo = false;
    };
    // Só na abertura do app; depois, as mudanças de login são tratadas abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoSessao]);

  // Ao sair da conta, a escolha da digital é esquecida: quem entrar depois
  // neste aparelho decide de novo.
  useEffect(() => {
    if (usuarioAnterior.current && !usuarioId) {
      gravarPreferencia(null).then(() => setPreferencia(null));
    }
    usuarioAnterior.current = usuarioId;
  }, [usuarioId]);

  // Volta do segundo plano depois de 5 minutos: bloqueia de novo.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (situacao) => {
      if (situacao === 'background') {
        foiParaSegundoPlanoEm.current = Date.now();
      } else if (situacao === 'active' && foiParaSegundoPlanoEm.current !== null) {
        const tempoFora = Date.now() - foiParaSegundoPlanoEm.current;
        foiParaSegundoPlanoEm.current = null;
        if (tempoFora >= TEMPO_PARA_BLOQUEAR_MS && usuarioId && preferencia === 'ativada') setEstado('bloqueado');
      }
    });
    return () => assinatura.remove();
  }, [usuarioId, preferencia]);

  const desbloquear = useCallback(async () => {
    const resultado = await autenticar({ motivo: t('biometria.motivoEntrar'), cancelar: t('biometria.cancelar') });
    if (resultado === 'ok') setEstado('liberado');
    return resultado;
  }, [t]);

  const ativar = useCallback(async () => {
    // Pede a digital uma vez para confirmar que funciona antes de ativar.
    const resultado = await autenticar({ motivo: t('biometria.motivoAtivar'), cancelar: t('biometria.cancelar') });
    if (resultado === 'ok') {
      await gravarPreferencia('ativada');
      setPreferencia('ativada');
    }
    return resultado;
  }, [t]);

  const recusar = useCallback(async () => {
    await gravarPreferencia('recusada');
    setPreferencia('recusada');
  }, []);

  // Sem ninguém logado, não há o que proteger.
  const estadoEfetivo: EstadoDoBloqueio = estado === 'bloqueado' && !usuarioId ? 'liberado' : estado;

  return (
    <ContextoDoBloqueio.Provider
      value={{ estado: estadoEfetivo, disponivel, preferencia, desbloquear, ativar, recusar }}
    >
      {children}
    </ContextoDoBloqueio.Provider>
  );
}

export function useBloqueio(): ValorDoBloqueio {
  const valor = useContext(ContextoDoBloqueio);
  if (!valor) throw new Error('useBloqueio precisa estar dentro de ProvedorDeBloqueio');
  return valor;
}
