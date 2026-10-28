import type { PostgrestError } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

// Telas do Admin Master (A-01, A-02 e atendimento). Tudo passa por funções do
// banco que conferem a marca de Admin Master e registram no log da igreja:
// direto nas tabelas, ele só lê as igrejas.

export type IgrejaDaPlataforma = {
  id: string;
  nome: string;
  status: Enums['status_igreja'];
  faixa_plano: string | null;
  pais: string;
  idioma: string;
  moeda: string;
  titulo_administrador: string;
  criado_em: string;
  membros_ativos: number;
  pastor_id: string | null;
  pastor_nome: string | null;
  pastor_email: string | null;
  pastor_status: Enums['status_membro'] | null;
};

export type ErroDoAdmin =
  | 'so_admin_master'
  | 'nome_obrigatorio'
  | 'pastor_obrigatorio'
  | 'email_invalido'
  | 'email_ja_cadastrado'
  | 'motivo_obrigatorio'
  | 'membro_nao_ativo'
  | 'ja_e_pastor'
  | 'igreja_nao_encontrada'
  | 'membro_nao_encontrado'
  | 'convite_indisponivel'
  | 'texto_invalido'
  | 'sem_conexao'
  | 'erro_inesperado';

const ERROS_CONHECIDOS: string[] = [
  'so_admin_master',
  'nome_obrigatorio',
  'pastor_obrigatorio',
  'email_invalido',
  'email_ja_cadastrado',
  'motivo_obrigatorio',
  'membro_nao_ativo',
  'ja_e_pastor',
  'igreja_nao_encontrada',
  'membro_nao_encontrado',
  'convite_indisponivel',
  'texto_invalido',
];

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroDoAdmin };

function traduzir(erro: PostgrestError | Error): ErroDoAdmin {
  if (ERROS_CONHECIDOS.includes(erro.message)) return erro.message as ErroDoAdmin;
  if ('code' in erro && erro.code === '23505') return 'email_ja_cadastrado';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

async function executar<T>(acao: () => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<Resultado<T>> {
  try {
    const { data, error } = await acao();
    return error ? { ok: false, erro: traduzir(error) } : { ok: true, dados: data };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

export async function listarIgrejasDaPlataforma(): Promise<IgrejaDaPlataforma[]> {
  const { data, error } = await supabase.rpc('admin_listar_igrejas');
  if (error) throw error;
  return data;
}

export type DadosDaIgrejaNova = {
  nome: string;
  pais: string;
  idioma: string;
  moeda: string;
  faixaPlano: string;
  tituloAdministrador: string;
  pastorNome: string;
  pastorEmail: string;
  pastorCelular: string;
};

// Cria a igreja e o convite do Pastor de Governo (o e-mail sai sozinho).
export function cadastrarIgreja(d: DadosDaIgrejaNova) {
  return executar(() =>
    supabase.rpc('admin_cadastrar_igreja', {
      p_nome: d.nome,
      p_pais: d.pais,
      p_idioma: d.idioma,
      p_moeda: d.moeda,
      p_faixa_plano: d.faixaPlano,
      p_titulo_administrador: d.tituloAdministrador,
      p_pastor_nome: d.pastorNome,
      p_pastor_email: d.pastorEmail,
      p_pastor_celular: d.pastorCelular,
    }),
  );
}

export type DadosDaIgreja = {
  nome: string;
  status: Enums['status_igreja'];
  faixaPlano: string;
  pais: string;
  idioma: string;
  moeda: string;
  tituloAdministrador: string;
};

export function atualizarIgreja(igrejaId: string, d: DadosDaIgreja) {
  return executar(() =>
    supabase.rpc('admin_atualizar_igreja', {
      p_igreja_id: igrejaId,
      p_nome: d.nome,
      p_status: d.status,
      p_faixa_plano: d.faixaPlano,
      p_pais: d.pais,
      p_idioma: d.idioma,
      p_moeda: d.moeda,
      p_titulo_administrador: d.tituloAdministrador,
    }),
  );
}

// Novo Pastor por convite; o anterior volta a membro (ou tem o convite cancelado).
export function convidarPastor(
  igrejaId: string,
  pastor: { nome: string; email: string; celular: string },
  motivo: string,
) {
  return executar(() =>
    supabase.rpc('admin_convidar_pastor', {
      p_igreja_id: igrejaId,
      p_nome: pastor.nome,
      p_email: pastor.email,
      p_celular: pastor.celular,
      p_motivo: motivo,
    }),
  );
}

// Novo convite (mais 7 dias) para o Pastor que ainda não entrou.
export function reenviarConviteDoPastor(membroId: string) {
  return executar(() => supabase.rpc('admin_reenviar_convite', { p_membro_id: membroId }));
}

// Novo Pastor entre os membros ativos da igreja.
export function definirPastor(membroId: string, motivo: string) {
  return executar(() => supabase.rpc('admin_definir_pastor', { p_membro_id: membroId, p_motivo: motivo }));
}

export type PessoaEncontrada = {
  membro_id: string;
  igreja_id: string;
  igreja_nome: string;
  nome: string;
  email: string;
  perfil: Enums['perfil_membro'];
  status: Enums['status_membro'];
  tem_login: boolean;
};

// Atendimento: cada ficha encontrada fica no log da igreja dela, com o motivo.
export function buscarPessoa(email: string, motivo: string) {
  return executar(() => supabase.rpc('admin_buscar_pessoa', { p_email: email, p_motivo: motivo }));
}

export type RegistroGlobal = {
  id: number;
  criado_em: string;
  igreja_id: string | null;
  igreja_nome: string | null;
  acao: string;
  tabela: string;
  registro_id: string | null;
  antes: Json;
  depois: Json;
  motivo: string | null;
  total: number;
};

export const TAMANHO_DA_PAGINA_GLOBAL = 20;

// A-02. A página começa em 0 no app e em 1 no banco.
export async function listarLogsGlobais(pagina: number): Promise<{ registros: RegistroGlobal[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_logs_globais', {
    p_pagina: pagina + 1,
    p_tamanho: TAMANHO_DA_PAGINA_GLOBAL,
  });
  if (error) throw error;
  return { registros: data, total: data[0]?.total ?? 0 };
}

// Avisos da plataforma (D-102): todas as igrejas (sem igreja) ou uma só.
export async function previaDoAvisoDaPlataforma(igrejaId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_previa_do_aviso', { p_igreja_id: igrejaId });
  if (error) throw error;
  return data;
}

export function enviarAvisoDaPlataforma(texto: string, igrejaId?: string) {
  return executar(() => supabase.rpc('admin_enviar_aviso_da_plataforma', { p_texto: texto, p_igreja_id: igrejaId }));
}

export type AvisoDaPlataforma = {
  id: string;
  igreja_nome: string | null;
  texto: string;
  destinatarios: number;
  criado_em: string;
};

export async function listarAvisosDaPlataforma(): Promise<AvisoDaPlataforma[]> {
  const { data, error } = await supabase.rpc('admin_avisos_da_plataforma');
  if (error) throw error;
  return data;
}
