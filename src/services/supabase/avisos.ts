import type { Aviso, AvisoQueDesliga } from '@/lib/avisos';

import { supabase } from './cliente';

// Avisos do sino (D-096). A RLS só devolve os avisos da própria pessoa; o
// filtro por usuario_id também fica aqui, como em todas as telas do membro.

const LIMITE_DA_LISTA = 50;

export async function listarAvisos(usuarioId: string, igrejaId: string): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, igreja_id, tipo, dados, criado_em, lida_em')
    .eq('usuario_id', usuarioId)
    .eq('igreja_id', igrejaId)
    .order('criado_em', { ascending: false })
    .limit(LIMITE_DA_LISTA);
  if (error) throw error;
  return data as Aviso[];
}

export async function contarAvisosNaoLidos(usuarioId: string, igrejaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('igreja_id', igrejaId)
    .is('lida_em', null);
  if (error) throw error;
  return count ?? 0;
}

// Sem ids, marca todos os da pessoa.
export async function marcarAvisosComoLidos(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc('marcar_avisos_como_lidos', { p_ids: ids });
  if (error) throw error;
}

// Só a própria pessoa muda (o banco recusa os demais).
export async function salvarAvisosDesligados(membroId: string, desligados: AvisoQueDesliga[]): Promise<boolean> {
  const { data, error } = await supabase
    .from('membros')
    .update({ avisos_desligados: desligados })
    .eq('id', membroId)
    .select('id');
  return !error && !!data?.length;
}
