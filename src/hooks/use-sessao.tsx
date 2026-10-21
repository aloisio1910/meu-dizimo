import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/services/supabase/cliente';

type EstadoDaSessao = {
  sessao: Session | null;
  carregando: boolean;
};

const ContextoDaSessao = createContext<EstadoDaSessao>({ sessao: null, carregando: true });

// Mantém a sessão de login disponível para todas as telas.
export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaSessao>({ sessao: null, carregando: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEstado({ sessao: data.session, carregando: false }));

    // O vínculo com os convites é feito ao carregar as fichas (use-minhas-fichas).
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEstado({ sessao, carregando: false });
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return <ContextoDaSessao.Provider value={estado}>{children}</ContextoDaSessao.Provider>;
}

export function useSessao(): EstadoDaSessao {
  return useContext(ContextoDaSessao);
}
