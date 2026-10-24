import type { PostgrestError } from '@supabase/supabase-js';

import type { DadosDaConta } from '@/lib/conta';
import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

// P-03 Contas e Pix (Pastor de Governo). A RLS só deixa o administrador da
// igreja criar e alterar; cada mudança fica no log pela trigger (RN-040).

export type ContaCompleta = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  tipo_chave_pix: Enums['tipo_chave_pix'] | null;
  chave_pix: string | null;
  nome_recebedor: string | null;
  cidade: string | null;
  principal: boolean;
  ativa: boolean;
};

const COLUNAS = 'id, nome, banco, agencia, numero_conta, tipo_chave_pix, chave_pix, nome_recebedor, cidade, principal, ativa';

// Ativas primeiro (a principal no topo), depois as desativadas.
export async function listarTodasAsContas(igrejaId: string): Promise<ContaCompleta[]> {
  const { data, error } = await supabase
    .from('contas')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .order('ativa', { ascending: false })
    .order('principal', { ascending: false })
    .order('nome');
  if (error) throw error;
  return data;
}

export async function buscarConta(igrejaId: string, id: string): Promise<ContaCompleta | null> {
  const { data, error } = await supabase.from('contas').select(COLUNAS).eq('igreja_id', igrejaId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export type ErroDaConta =
  | 'conta_em_uso'
  | 'limite_de_contas'
  | 'principal_nao_desativa'
  | 'pix_incompleto'
  | 'conta_indisponivel'
  | 'sem_permissao'
  | 'sem_conexao'
  | 'erro_inesperado';

function traduzir(erro: PostgrestError | Error): ErroDaConta {
  const mensagem = erro.message;
  if (mensagem === 'conta_em_uso' || mensagem === 'conta_indisponivel') return mensagem;
  if (mensagem.includes('Limite de 5 contas')) return 'limite_de_contas';
  if (mensagem.includes('contas_principal_ativa')) return 'principal_nao_desativa';
  if (mensagem.includes('contas_pix_completo') || mensagem.includes('nome_recebedor') || mensagem.includes('cidade')) {
    return 'pix_incompleto';
  }
  if ('code' in erro && erro.code === '42501') return 'sem_permissao';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroDaConta };

async function executar<T>(acao: () => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<Resultado<T>> {
  try {
    const { data, error } = await acao();
    return error ? { ok: false, erro: traduzir(error) } : { ok: true, dados: data };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

// A primeira conta da igreja já nasce principal: o dízimo precisa de destino.
export async function criarConta(igrejaId: string, dados: DadosDaConta, principal: boolean): Promise<Resultado<string>> {
  const resultado = await executar(() =>
    supabase
      .from('contas')
      .insert({ igreja_id: igrejaId, ...dados, principal })
      .select('id')
      .single(),
  );
  if (!resultado.ok) return resultado;
  return resultado.dados ? { ok: true, dados: resultado.dados.id } : { ok: false, erro: 'sem_permissao' };
}

export async function salvarConta(id: string, dados: DadosDaConta): Promise<Resultado<null>> {
  const resultado = await executar(() => supabase.from('contas').update(dados).eq('id', id).select('id'));
  if (!resultado.ok) return resultado;
  return resultado.dados?.length ? { ok: true, dados: null } : { ok: false, erro: 'sem_permissao' };
}

// Troca a principal numa só operação, no banco (D-091).
export function definirContaPrincipal(id: string) {
  return executar(() => supabase.rpc('definir_conta_principal', { p_conta_id: id }));
}

// Desativar em vez de apagar (regra 3 do CLAUDE.md). O banco recusa a
// principal e a conta usada por campanha em andamento.
export async function mudarAtivacaoDaConta(id: string, ativa: boolean): Promise<Resultado<null>> {
  const resultado = await executar(() => supabase.from('contas').update({ ativa }).eq('id', id).select('id'));
  if (!resultado.ok) return resultado;
  return resultado.dados?.length ? { ok: true, dados: null } : { ok: false, erro: 'sem_permissao' };
}
