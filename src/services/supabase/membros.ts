import type { PostgrestError } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

export type MinhaFicha = {
  id: string;
  igreja_id: string;
  nome: string;
  celular: string;
  email: string;
  numero: number;
  perfil: Enums['perfil_membro'];
  status: Enums['status_membro'];
  tipo_dizimo: Enums['tipo_dizimo'];
  familiares: Json;
  campos_extras: Json;
  campos_internos: Json;
  igrejas: {
    nome: string;
    titulo_administrador: string;
    moeda: string;
    idioma: string;
    formas_devolucao: string[];
    versiculo_referencia: string;
    versiculo_texto: string | null;
    mensagem_confirmacao: string | null;
    cor_principal: string | null;
    logo_path: string | null;
    capa_path: string | null;
  } | null;
};

export type CampoDoCadastro = Database['public']['Tables']['campos_cadastro']['Row'];

// Liga as fichas convidadas com o e-mail do login (passo 3 do fluxo) e
// devolve as fichas da pessoa em todas as igrejas.
// O filtro por usuario_id é obrigatório: a tesouraria pode ver as fichas de
// todos os membros da igreja (D-057), e sem ele as fichas de outras pessoas
// seriam tratadas como da própria pessoa.
export async function buscarMinhasFichas(usuarioId: string): Promise<MinhaFicha[]> {
  const { error: erroAoAceitar } = await supabase.rpc('aceitar_convites');
  if (erroAoAceitar) throw erroAoAceitar;

  const { data, error } = await supabase
    .from('membros')
    .select(
      'id, igreja_id, nome, celular, email, numero, perfil, status, tipo_dizimo, familiares, campos_extras, campos_internos, igrejas(nome, titulo_administrador, moeda, idioma, formas_devolucao, versiculo_referencia, versiculo_texto, mensagem_confirmacao, cor_principal, logo_path, capa_path)',
    )
    .eq('usuario_id', usuarioId)
    .order('criado_em');
  if (error) throw error;
  return data;
}

// Campos ativos que o membro preenche, na ordem do formulário (RN-004).
export async function buscarCamposDoCadastro(igrejaId: string): Promise<CampoDoCadastro[]> {
  return buscarCampos(igrejaId, 'membro');
}

// Campos ativos que só a tesouraria preenche; o membro só lê (D-093).
export async function buscarCamposDaTesouraria(igrejaId: string): Promise<CampoDoCadastro[]> {
  return buscarCampos(igrejaId, 'tesouraria');
}

async function buscarCampos(igrejaId: string, quemPreenche: 'membro' | 'tesouraria'): Promise<CampoDoCadastro[]> {
  const { data, error } = await supabase
    .from('campos_cadastro')
    .select('*')
    .eq('igreja_id', igrejaId)
    .eq('ativo', true)
    .eq('preenchido_por', quemPreenche)
    .order('ordem');
  if (error) throw error;
  return data;
}

export type DadosDoCadastro = {
  membroId: string;
  nome: string;
  celular: string;
  tipoDizimo: Enums['tipo_dizimo'];
  familiares: { nome: string }[];
  camposExtras: Record<string, string | number>;
  versaoDosTermos: string;
};

export type ErroDoCadastro =
  | { codigo: 'campo_obrigatorio' | 'campo_invalido'; campo: string }
  | { codigo: 'familiares_obrigatorios' | 'cadastro_indisponivel' | 'sem_conexao' | 'erro_inesperado' };

function traduzirErro(erro: PostgrestError | Error): ErroDoCadastro {
  const mensagem = erro.message;
  const detalhe = 'details' in erro ? erro.details : '';
  if ((mensagem === 'campo_obrigatorio' || mensagem === 'campo_invalido') && detalhe) {
    return { codigo: mensagem, campo: detalhe };
  }
  if (mensagem === 'familiares_obrigatorios' || mensagem === 'cadastro_indisponivel') return { codigo: mensagem };
  if (erro instanceof TypeError) return { codigo: 'sem_conexao' };
  return { codigo: 'erro_inesperado' };
}

// RN-009: o membro altera os próprios dados (M-10). O e-mail não muda por
// aqui: a troca exige código no novo e-mail (RN-010).
export async function salvarMeuCadastro(
  membroId: string,
  dados: Omit<DadosDoCadastro, 'membroId' | 'versaoDosTermos'>,
): Promise<ErroDoCadastro | null> {
  try {
    const { error } = await supabase
      .from('membros')
      .update({
        nome: dados.nome,
        celular: dados.celular,
        tipo_dizimo: dados.tipoDizimo,
        familiares: dados.familiares,
        campos_extras: dados.camposExtras,
      })
      .eq('id', membroId);
    return error ? traduzirErro(error) : null;
  } catch (erro) {
    return traduzirErro(erro as Error);
  }
}

// Passo 4: valida os campos no banco, registra o aceite dos termos e ativa a ficha.
export async function concluirCadastro(dados: DadosDoCadastro): Promise<ErroDoCadastro | null> {
  try {
    const { error } = await supabase.rpc('concluir_cadastro', {
      p_membro_id: dados.membroId,
      p_nome: dados.nome,
      p_celular: dados.celular,
      p_tipo_dizimo: dados.tipoDizimo,
      p_familiares: dados.familiares,
      p_campos_extras: dados.camposExtras,
      p_versao_termos: dados.versaoDosTermos,
    });
    return error ? traduzirErro(error) : null;
  } catch (erro) {
    return traduzirErro(erro as Error);
  }
}

// Nomes das igrejas em que a própria ficha está inativa (RN-035). A RLS
// esconde a ficha inativa da pessoa; isto só serve para explicar o motivo.
export async function buscarIgrejasOndeEstouInativo(): Promise<string[]> {
  const { data, error } = await supabase.rpc('igrejas_onde_estou_inativo');
  if (error) throw error;
  return data;
}
