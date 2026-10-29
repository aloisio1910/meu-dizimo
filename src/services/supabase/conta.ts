import { supabase } from './cliente';

// Excluir a conta (Apple 5.1.1(v), Google). Passa pela Edge Function
// excluir-conta, que confere o login, anonimiza as fichas e o login.

export type ErroDaExclusao =
  'pastor_precisa_trocar' | 'admin_master_pelo_suporte' | 'confirmacao_invalida' | 'sem_conexao' | 'erro_inesperado';

export async function souPastorEmAlgumaIgreja(): Promise<boolean> {
  const { data, error } = await supabase.rpc('sou_pastor_em_alguma_igreja');
  if (error) throw error;
  return data;
}

export async function excluirMinhaConta(
  confirmacao: string,
): Promise<{ ok: true } | { ok: false; erro: ErroDaExclusao }> {
  try {
    const { error } = await supabase.functions.invoke('excluir-conta', { body: { confirmacao } });
    if (!error) {
      // O login já não existe no servidor: limpa a sessão deste aparelho.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return { ok: true };
    }
    const resposta = (error as { context?: Response }).context;
    const corpo = resposta && typeof resposta.json === 'function' ? await resposta.json().catch(() => null) : null;
    if (corpo?.erro) return { ok: false, erro: corpo.erro as ErroDaExclusao };
    return { ok: false, erro: error.name === 'FunctionsFetchError' ? 'sem_conexao' : 'erro_inesperado' };
  } catch {
    return { ok: false, erro: 'sem_conexao' };
  }
}
