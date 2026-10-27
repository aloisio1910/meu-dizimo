import type { Session } from '@supabase/supabase-js';

import { useSessao } from './use-sessao';

// Admin Master (D-067): marca no app_metadata do login, que só o servidor
// grava. O app usa só para escolher as telas; quem confere é o banco.
export function ehAdminMaster(sessao: Session | null | undefined): boolean {
  return sessao?.user.app_metadata?.admin_master === true;
}

export function useAdminMaster(): { ehAdminMaster: boolean; carregando: boolean } {
  const { sessao, carregando } = useSessao();
  return { ehAdminMaster: ehAdminMaster(sessao), carregando };
}
