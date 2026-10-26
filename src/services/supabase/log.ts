import type { RegistroDoLog } from '@/lib/log';

import { supabase } from './cliente';

// P-04 Log da igreja. A RLS só deixa o Pastor de Governo da igreja (e o Admin
// Master) ler a auditoria; ninguém altera nem apaga.

// 20 por página, como uma página de resultados de pesquisa.
export const TAMANHO_DA_PAGINA_DO_LOG = 20;

export type FiltrosDoLog = {
  desde: string; // momento ISO
  antesDe: string;
  tabelas?: string[];
  // Pessoa (usuário do login) ou 'sistema' (rotinas automáticas do banco).
  quem?: string;
};

// Uma página do log e o total de registros, contados pelo banco já sem os
// avisos internos (função registros_do_log). A página começa em 0.
export async function listarRegistrosDoLog(
  igrejaId: string,
  filtros: FiltrosDoLog,
  pagina: number,
): Promise<{ registros: RegistroDoLog[]; total: number }> {
  const { data, error } = await supabase.rpc('registros_do_log', {
    p_igreja_id: igrejaId,
    p_desde: filtros.desde,
    p_antes_de: filtros.antesDe,
    p_tabelas: filtros.tabelas,
    p_quem: filtros.quem,
    p_pagina: pagina,
    p_tamanho: TAMANHO_DA_PAGINA_DO_LOG,
  });
  if (error) throw error;
  const linhas = data ?? [];
  return {
    registros: linhas.map(({ total: _total, ...registro }) => registro) as RegistroDoLog[],
    total: Number(linhas[0]?.total ?? 0),
  };
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
