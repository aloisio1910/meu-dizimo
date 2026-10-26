import type { RegistroDoLog } from '@/lib/log';

import { supabase } from './cliente';

// P-04 Log da igreja. A RLS só deixa o Pastor de Governo da igreja (e o Admin
// Master) ler a auditoria; ninguém altera nem apaga.

export const TAMANHO_DA_PAGINA_DO_LOG = 50;

export type FiltrosDoLog = {
  desde: string; // momento ISO
  antesDe: string;
  tabelas?: string[];
  // Pessoa (usuário do login) ou 'sistema' (rotinas automáticas do banco).
  quem?: string;
};

export async function listarRegistrosDoLog(
  igrejaId: string,
  filtros: FiltrosDoLog,
  pagina: number,
): Promise<RegistroDoLog[]> {
  const inicio = pagina * TAMANHO_DA_PAGINA_DO_LOG;
  let consulta = supabase
    .from('auditoria')
    .select('id, usuario_id, perfil, acao, tabela, registro_id, antes, depois, motivo, criado_em')
    .eq('igreja_id', igrejaId)
    .gte('criado_em', filtros.desde)
    .lt('criado_em', filtros.antesDe)
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false })
    .range(inicio, inicio + TAMANHO_DA_PAGINA_DO_LOG - 1);
  if (filtros.tabelas?.length) consulta = consulta.in('tabela', filtros.tabelas);
  if (filtros.quem === 'sistema') consulta = consulta.is('usuario_id', null);
  else if (filtros.quem) consulta = consulta.eq('usuario_id', filtros.quem);
  const { data, error } = await consulta;
  if (error) throw error;
  return data as RegistroDoLog[];
}

export type PessoaDaIgreja = {
  id: string;
  nome: string;
  usuario_id: string | null;
  perfil: 'membro' | 'tesoureiro' | 'administrador';
};

// Nomes para "quem fez" (pelo login) e "de quem é" (pela ficha).
export async function listarPessoasDaIgreja(igrejaId: string): Promise<PessoaDaIgreja[]> {
  const { data, error } = await supabase
    .from('membros')
    .select('id, nome, usuario_id, perfil')
    .eq('igreja_id', igrejaId)
    .order('nome');
  if (error) throw error;
  return data;
}
