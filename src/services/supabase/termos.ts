import { supabase } from './cliente';

// Aceite dos termos (RN-041). O aceite é gravado com data e versão pelo
// banco, que exige a declaração de maioridade (D-104).

export async function jaAceitouOsTermos(usuarioId: string, versao: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('aceites_termos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('versao', versao);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export type ErroDoAceite = 'sem_conexao' | 'erro_inesperado';

export async function aceitarTermos(versao: string): Promise<ErroDoAceite | null> {
  try {
    const { error } = await supabase.rpc('aceitar_termos', { p_versao: versao, p_declarou_maioridade: true });
    return error ? 'erro_inesperado' : null;
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
  }
}
