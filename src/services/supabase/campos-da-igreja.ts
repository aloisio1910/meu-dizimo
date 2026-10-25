import type { PostgrestError } from '@supabase/supabase-js';

import type { QuemPreenche, TipoDoCampo } from '@/lib/campos-do-cadastro';

import { supabase } from './cliente';

// P-03 Campos do cadastro (RN-004). A RLS só deixa o Pastor de Governo
// criar e alterar; quem é da igreja lê para montar o formulário.

export type CampoDaIgreja = {
  id: string;
  chave: string;
  rotulo: string;
  tipo: TipoDoCampo;
  opcoes: string[];
  obrigatorio: boolean;
  ativo: boolean;
  preenchido_por: QuemPreenche;
  ordem: number;
};

const COLUNAS = 'id, chave, rotulo, tipo, opcoes, obrigatorio, ativo, preenchido_por, ordem';

// Todos, inclusive os não usados (ativo = false), na ordem do formulário.
export async function listarTodosOsCampos(igrejaId: string): Promise<CampoDaIgreja[]> {
  const { data, error } = await supabase
    .from('campos_cadastro')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .order('ordem')
    .order('criado_em');
  if (error) throw error;
  return data as CampoDaIgreja[];
}

export type ErroDoCampo = 'chave_repetida' | 'sem_permissao' | 'sem_conexao' | 'erro_inesperado';

function traduzir(erro: PostgrestError | Error): ErroDoCampo {
  if ('code' in erro && erro.code === '23505') return 'chave_repetida';
  if ('code' in erro && erro.code === '42501') return 'sem_permissao';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

async function executar(acao: () => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>) {
  try {
    const { data, error } = await acao();
    if (error) return traduzir(error);
    return data?.length ? null : 'sem_permissao';
  } catch (erro) {
    return traduzir(erro as Error);
  }
}

export function criarCampo(igrejaId: string, campo: Omit<CampoDaIgreja, 'id'>): Promise<ErroDoCampo | null> {
  return executar(() =>
    supabase
      .from('campos_cadastro')
      .insert({ igreja_id: igrejaId, ...campo })
      .select('id'),
  );
}

// Chave e tipo não mudam depois de criados (o banco recusa).
export function salvarCampo(
  id: string,
  mudancas: Pick<CampoDaIgreja, 'rotulo' | 'opcoes' | 'obrigatorio' | 'ativo' | 'preenchido_por'>,
): Promise<ErroDoCampo | null> {
  return executar(() => supabase.from('campos_cadastro').update(mudancas).eq('id', id).select('id'));
}

export async function salvarOrdem(ordens: { id: string; ordem: number }[]): Promise<ErroDoCampo | null> {
  for (const { id, ordem } of ordens) {
    const falha = await executar(() => supabase.from('campos_cadastro').update({ ordem }).eq('id', id).select('id'));
    if (falha) return falha;
  }
  return null;
}
