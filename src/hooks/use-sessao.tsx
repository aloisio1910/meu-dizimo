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

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      setEstado({ sessao, carregando: false });

      // A cada login, liga as fichas convidadas com este e-mail (passo 3 do
      // fluxo). É seguro repetir. Fica fora do callback, como pede o Supabase.
      if (evento === 'SIGNED_IN') {
        // O .then() é o que dispara a chamada; o resultado é lido pelas telas.
        setTimeout(() => {
          supabase.rpc('aceitar_convites').then(() => undefined);
        }, 0);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return <ContextoDaSessao.Provider value={estado}>{children}</ContextoDaSessao.Provider>;
}

export function useSessao(): EstadoDaSessao {
  return useContext(ContextoDaSessao);
}
