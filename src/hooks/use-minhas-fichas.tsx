import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { fichaEmUso, nomeDaPreferencia, precisaEscolherIgreja } from '@/lib/igreja-em-uso';
import { gravarPreferencia, lerPreferencia } from '@/services/dispositivo/preferencias';
import { buscarMinhasFichas, type MinhaFicha } from '@/services/supabase/membros';

import { useSessao } from './use-sessao';

type EstadoDasFichas = {
  fichas: MinhaFicha[];
  // Igreja em uso (D-061): a escolhida neste aparelho, ou a primeira ativa.
  fichaEmUso: MinhaFicha | undefined;
  precisaEscolherIgreja: boolean;
  escolherIgreja: (igrejaId: string) => void;
  carregando: boolean;
  falhou: boolean;
  recarregar: () => Promise<void>;
  atualizarEmSilencio: () => void;
};

const ContextoDasFichas = createContext<EstadoDasFichas>({
  fichas: [],
  fichaEmUso: undefined,
  precisaEscolherIgreja: false,
  escolherIgreja: () => {},
  carregando: true,
  falhou: false,
  recarregar: async () => {},
  atualizarEmSilencio: () => {},
});

// Intervalo mínimo entre duas atualizações silenciosas: várias partes da
// mesma tela pedem ao mesmo tempo, e uma busca basta.
const INTERVALO_MINIMO_MS = 5000;

// Com o app aberto, o perfil é conferido de novo a cada minuto.
const INTERVALO_DE_CONFERENCIA_MS = 60 * 1000;

// Resultado de uma busca, marcado com o usuário a que pertence: logo após
// trocar de login, as fichas antigas não valem.
type Carga = { usuarioId: string; fichas: MinhaFicha[]; falhou: boolean; igrejaEscolhida: string | null };

// A escolha de igreja é lida junto com as fichas: a primeira tela já abre na
// igreja certa, sem piscar outra antes.
async function carregar(usuarioId: string): Promise<Carga> {
  const igrejaEscolhida = await lerPreferencia(nomeDaPreferencia(usuarioId));
  try {
    return { usuarioId, fichas: await buscarMinhasFichas(usuarioId), falhou: false, igrejaEscolhida };
  } catch {
    return { usuarioId, fichas: [], falhou: true, igrejaEscolhida };
  }
}

// As fichas da pessoa logada (uma por igreja), buscadas a cada login e
// atualizadas em silêncio ao abrir uma tela e ao voltar ao app. Assim, um
// tesoureiro suspenso ou um membro inativado perde as telas logo, não só no
// próximo login. Os dados já são protegidos pela RLS; isto evita mostrar
// telas que o banco vai recusar.
export function ProvedorDeFichas({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const usuarioId = sessao?.user.id;
  const [carga, setCarga] = useState<Carga>();
  const [recarregando, setRecarregando] = useState(false);
  const ultimaAtualizacao = useRef(0);
  const atualizando = useRef(false);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    carregar(usuarioId).then((resultado) => {
      if (ativo) setCarga(resultado);
    });
    ultimaAtualizacao.current = Date.now();
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const recarregar = useCallback(async () => {
    if (!usuarioId) return;
    setRecarregando(true);
    setCarga(await carregar(usuarioId));
    ultimaAtualizacao.current = Date.now();
    setRecarregando(false);
  }, [usuarioId]);

  // Sem "carregando": a tela continua como está e só muda se o perfil ou o
  // status mudou. Uma falha de rede mantém o que já havia.
  const atualizarEmSilencio = useCallback(() => {
    if (!usuarioId || atualizando.current) return;
    if (Date.now() - ultimaAtualizacao.current < INTERVALO_MINIMO_MS) return;
    atualizando.current = true;
    ultimaAtualizacao.current = Date.now();
    carregar(usuarioId)
      .then((resultado) => {
        if (resultado.falhou) return;
        // Sem mudança, mantém o mesmo objeto: as telas que dependem da
        // ficha (fila, conferência) não buscam tudo de novo à toa.
        setCarga((anterior) =>
          anterior?.usuarioId === resultado.usuarioId &&
          JSON.stringify(anterior.fichas) === JSON.stringify(resultado.fichas)
            ? anterior
            : // A escolha feita nesta sessão vale mais que a lida do aparelho.
              { ...resultado, igrejaEscolhida: anterior?.igrejaEscolhida ?? resultado.igrejaEscolhida },
        );
      })
      .finally(() => {
        atualizando.current = false;
      });
  }, [usuarioId]);

  // Ao voltar ao app e, com ele aberto, a cada minuto: cobre quem fica
  // parado na mesma tela enquanto o Pastor muda o perfil em outro aparelho.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') atualizarEmSilencio();
    });
    const relogio = setInterval(() => {
      if (AppState.currentState === 'active') atualizarEmSilencio();
    }, INTERVALO_DE_CONFERENCIA_MS);
    return () => {
      assinatura.remove();
      clearInterval(relogio);
    };
  }, [atualizarEmSilencio]);

  const escolherIgreja = useCallback(
    (igrejaId: string) => {
      if (!usuarioId) return;
      setCarga((anterior) => (anterior ? { ...anterior, igrejaEscolhida: igrejaId } : anterior));
      gravarPreferencia(nomeDaPreferencia(usuarioId), igrejaId);
    },
    [usuarioId],
  );

  const atual = usuarioId && carga?.usuarioId === usuarioId ? carga : undefined;
  const fichas = atual?.fichas ?? [];
  const igrejaEscolhida = atual?.igrejaEscolhida ?? null;
  const estado: EstadoDasFichas = {
    fichas,
    fichaEmUso: fichaEmUso(fichas, igrejaEscolhida),
    precisaEscolherIgreja: precisaEscolherIgreja(fichas, igrejaEscolhida),
    escolherIgreja,
    falhou: atual?.falhou ?? false,
    carregando: !!usuarioId && (!atual || recarregando),
    recarregar,
    atualizarEmSilencio,
  };

  return <ContextoDasFichas.Provider value={estado}>{children}</ContextoDasFichas.Provider>;
}

export function useMinhasFichas(): EstadoDasFichas {
  return useContext(ContextoDasFichas);
}
