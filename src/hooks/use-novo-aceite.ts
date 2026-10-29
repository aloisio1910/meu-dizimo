import { useCallback, useEffect, useState } from 'react';

import { versaoDosTermos } from '@/i18n/termos/pt-BR';
import { precisaDoNovoAceite } from '@/lib/novo-aceite';
import { aceitarTermos, jaAceitouOsTermos, type ErroDoAceite } from '@/services/supabase/termos';

import { ehAdminMaster } from './use-admin-master';
import { useMinhasFichas } from './use-minhas-fichas';
import { useSessao } from './use-sessao';

// Confere, a cada login, se a pessoa já aceitou a versão atual dos termos. A
// versão só muda com uma atualização do app, que abre tudo de novo; por isso
// uma conferência por login basta. Se ela falhar (sem internet), o app não
// trava: confere de novo na próxima abertura.
export function useNovoAceite() {
  const { sessao } = useSessao();
  const { fichas } = useMinhasFichas();
  const usuarioId = sessao?.user.id;
  const [conferido, setConferido] = useState<{ usuarioId: string; aceitou: boolean | undefined }>();

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    jaAceitouOsTermos(usuarioId, versaoDosTermos)
      .then((aceitou) => ativo && setConferido({ usuarioId, aceitou }))
      .catch(() => ativo && setConferido({ usuarioId, aceitou: undefined }));
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const pendente =
    !!sessao &&
    precisaDoNovoAceite({
      ehAdminMaster: ehAdminMaster(sessao),
      statusDasFichas: fichas.map((f) => f.status),
      aceitouAVersaoAtual: conferido?.usuarioId === usuarioId ? conferido?.aceitou : undefined,
    });

  const aceitar = useCallback(async (): Promise<ErroDoAceite | null> => {
    const erro = await aceitarTermos(versaoDosTermos);
    if (!erro && usuarioId) setConferido({ usuarioId, aceitou: true });
    return erro;
  }, [usuarioId]);

  return { pendente, aceitar };
}
