import type { PostgrestError } from '@supabase/supabase-js';

import type { DadosDoConvite } from '@/lib/membros';
import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

// Telas da tesouraria sobre os membros (T-03). A RLS só deixa a tesouraria
// da própria igreja ler fichas e convites; o filtro por igreja escolhe qual
// igreja, para quem é tesoureiro em mais de uma.

export type MembroDaLista = {
  id: string;
  numero: number;
  nome: string;
  email: string;
  celular: string;
  status: Enums['status_membro'];
  perfil: Enums['perfil_membro'];
  convites: { enviado_em: string; expira_em: string; aceito_em: string | null }[];
};

const COLUNAS = 'id, numero, nome, email, celular, status, perfil, convites(enviado_em, expira_em, aceito_em)';

export async function listarMembrosDaIgreja(igrejaId: string): Promise<MembroDaLista[]> {
  const { data, error } = await supabase
    .from('membros')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .order('nome')
    .order('enviado_em', { referencedTable: 'convites', ascending: false });
  if (error) throw error;
  return data;
}

export async function buscarMembroDaIgreja(igrejaId: string, id: string): Promise<MembroDaLista | null> {
  const { data, error } = await supabase
    .from('membros')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .eq('id', id)
    .order('enviado_em', { referencedTable: 'convites', ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ErroDoConvite = 'email_ja_cadastrado' | 'convite_indisponivel' | 'sem_conexao' | 'erro_inesperado';

function traduzir(erro: PostgrestError | Error): ErroDoConvite {
  // "23505" também é o índice único de e-mail por igreja (RN-028).
  if (erro.message === 'email_ja_cadastrado' || ('code' in erro && erro.code === '23505')) return 'email_ja_cadastrado';
  if (erro.message === 'convite_indisponivel' || ('code' in erro && erro.code === '42501')) return 'convite_indisponivel';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroDoConvite };

async function executar<T>(acao: () => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<Resultado<T>> {
  try {
    const { data, error } = await acao();
    return error ? { ok: false, erro: traduzir(error) } : { ok: true, dados: data };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

// Cria a ficha como Convidado e o convite de 7 dias (passos 1 e 2).
export function convidarMembro(igrejaId: string, dados: DadosDoConvite) {
  return executar(() =>
    supabase.rpc('convidar_membro', {
      p_igreja_id: igrejaId,
      p_nome: dados.nome,
      p_email: dados.email,
      p_celular: dados.celular,
    }),
  );
}

// Novo convite com mais 7 dias (RN-027); só para quem ainda é convidado.
export function reenviarConvite(membroId: string) {
  return executar(() => supabase.rpc('reenviar_convite', { p_membro_id: membroId }));
}

// D-069: a tesouraria corrige o e-mail só enquanto o membro é convidado.
// A trigger de membros recusa nos outros casos.
export async function corrigirEmailDoConvidado(membroId: string, email: string): Promise<Resultado<null>> {
  const resultado = await executar(() =>
    supabase.from('membros').update({ email }).eq('id', membroId).eq('status', 'convidado').select('id'),
  );
  if (!resultado.ok) return resultado;
  // Nenhuma linha alterada: a pessoa já entrou (deixou de ser convidada).
  return resultado.dados?.length ? { ok: true, dados: null } : { ok: false, erro: 'convite_indisponivel' };
}
