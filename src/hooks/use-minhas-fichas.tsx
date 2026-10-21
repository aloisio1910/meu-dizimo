import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { buscarMinhasFichas, type MinhaFicha } from '@/services/supabase/membros';

import { useSessao } from './use-sessao';

type EstadoDasFichas = {
  fichas: MinhaFicha[];
  carregando: boolean;
  falhou: boolean;
  recarregar: () => Promise<void>;
};

const ContextoDasFichas = createContext<EstadoDasFichas>({
  fichas: [],
  carregando: true,
  falhou: false,
  recarregar: async () => {},
});

// Resultado de uma busca, marcado com o usuário a que pertence: logo após
// trocar de login, as fichas antigas não valem.
type Carga = { usuarioId: string; fichas: MinhaFicha[]; falhou: boolean };

async function carregar(usuarioId: string): Promise<Carga> {
  try {
    return { usuarioId, fichas: await buscarMinhasFichas(), falhou: false };
  } catch {
    return { usuarioId, fichas: [], falhou: true };
  }
}

// As fichas da pessoa logada (uma por igreja), buscadas a cada login.
export function ProvedorDeFichas({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const usuarioId = sessao?.user.id;
  const [carga, setCarga] = useState<Carga>();
  const [recarregando, setRecarregando] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    carregar(usuarioId).then((resultado) => {
      if (ativo) setCarga(resultado);
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const recarregar = useCallback(async () => {
    if (!usuarioId) return;
    setRecarregando(true);
    setCarga(await carregar(usuarioId));
    setRecarregando(false);
  }, [usuarioId]);

  const atual = usuarioId && carga?.usuarioId === usuarioId ? carga : undefined;
  const estado: EstadoDasFichas = {
    fichas: atual?.fichas ?? [],
    falhou: atual?.falhou ?? false,
    carregando: !!usuarioId && (!atual || recarregando),
    recarregar,
  };

  return <ContextoDasFichas.Provider value={estado}>{children}</ContextoDasFichas.Provider>;
}

export function useMinhasFichas(): EstadoDasFichas {
  return useContext(ContextoDasFichas);
}
