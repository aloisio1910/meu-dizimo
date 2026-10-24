import type { PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

export type StatusDoLancamento = Enums['status_lancamento'];

export type LancamentoDoCartao = {
  id: string;
  data_contribuicao: string;
  valor_informado_centavos: number;
  valor_conferido_centavos: number | null;
  moeda: string;
  forma: string;
  status: StatusDoLancamento;
  confirmado_por_nome: string | null;
  registrado_pela_tesouraria: boolean;
};

export type ContaParaPix = {
  nome: string;
  chave_pix: string;
  tipo_chave_pix: Enums['tipo_chave_pix'];
  nome_recebedor: string;
  cidade: string;
};

// Dízimos da ficha, do mais recente para o mais antigo (M-03). A RLS só
// devolve os lançamentos da própria ficha.
export async function listarMeusDizimos(membroId: string): Promise<LancamentoDoCartao[]> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(
      'id, data_contribuicao, valor_informado_centavos, valor_conferido_centavos, moeda, forma, status, confirmado_por_nome, registrado_pela_tesouraria',
    )
    .eq('membro_id', membroId)
    .eq('tipo', 'dizimo')
    .order('data_contribuicao', { ascending: false })
    .order('registrado_em', { ascending: false });
  if (error) throw error;
  return data;
}

// Conta que recebe: a conta indicada (a da campanha) ou, sem ela, a
// principal da igreja (D-066, D-073). Null se a conta não tem Pix completo.
export async function buscarContaParaPix(igrejaId: string, contaId?: string | null): Promise<ContaParaPix | null> {
  let consulta = supabase.from('contas').select('nome, chave_pix, tipo_chave_pix, nome_recebedor, cidade').eq('igreja_id', igrejaId);
  consulta = contaId ? consulta.eq('id', contaId) : consulta.eq('principal', true);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  if (!data?.chave_pix || !data.tipo_chave_pix || !data.nome_recebedor || !data.cidade) return null;
  return {
    nome: data.nome,
    chave_pix: data.chave_pix,
    tipo_chave_pix: data.tipo_chave_pix,
    nome_recebedor: data.nome_recebedor,
    cidade: data.cidade,
  };
}

// Conta principal da igreja, que recebe o dízimo.
export function buscarContaPrincipal(igrejaId: string): Promise<ContaParaPix | null> {
  return buscarContaParaPix(igrejaId);
}

// RN-032: o app pergunta antes de registrar o mesmo valor na mesma data.
export async function existeLancamentoIgual(
  membroId: string,
  valorEmCentavos: number,
  data: string,
  tipo: Enums['tipo_lancamento'] = 'dizimo',
): Promise<boolean> {
  const { data: existe, error } = await supabase.rpc('existe_lancamento_igual', {
    p_membro_id: membroId,
    p_tipo: tipo,
    p_valor_centavos: valorEmCentavos,
    p_data: data,
  });
  if (error) throw error;
  return existe;
}

export type DetalheDoLancamento = LancamentoDoCartao & {
  membro_id: string;
  tipo: Enums['tipo_lancamento'];
  campanhas: { nome: string } | null;
  registrado_em: string;
  confirmado_em: string | null;
  observacao_tesouraria: string | null;
  divergencia_em: string | null;
  resposta_membro: Enums['resposta_divergencia'] | null;
  mensagem_membro: string | null;
  respondido_em: string | null;
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
};

// M-05: o lançamento completo. Null se não existir ou não for da pessoa (RLS).
export async function buscarLancamento(id: string): Promise<DetalheDoLancamento | null> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(
      'id, membro_id, tipo, campanhas(nome), data_contribuicao, valor_informado_centavos, valor_conferido_centavos, moeda, forma, status, confirmado_por_nome, registrado_pela_tesouraria, registrado_em, confirmado_em, observacao_tesouraria, divergencia_em, resposta_membro, mensagem_membro, respondido_em, motivo_cancelamento, cancelado_em',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Erros das ações do membro sobre o lançamento, cada um com texto no i18n.
export type ErroDaAcao =
  | 'lancamento_bloqueado'
  | 'motivo_obrigatorio'
  | 'mensagem_obrigatoria'
  | 'divergencia_indisponivel'
  | 'forma_invalida'
  | 'data_futura'
  | 'sem_conexao'
  | 'erro_inesperado';

const ERROS_CONHECIDOS: ErroDaAcao[] = [
  'lancamento_bloqueado',
  'motivo_obrigatorio',
  'mensagem_obrigatoria',
  'divergencia_indisponivel',
  'forma_invalida',
  'data_futura',
];

async function executarAcao(acao: () => PromiseLike<{ error: PostgrestError | null }>): Promise<ErroDaAcao | null> {
  try {
    const { error } = await acao();
    if (!error) return null;
    return (ERROS_CONHECIDOS as string[]).includes(error.message) ? (error.message as ErroDaAcao) : 'erro_inesperado';
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
  }
}

// RN-013: editar valor, data e forma enquanto aguarda conferência. O banco
// recusa (lancamento_bloqueado) se a tesouraria já abriu o lançamento.
export function editarDizimo(id: string, dados: { centavos: number; data: string; forma: string }) {
  return executarAcao(() =>
    supabase
      .from('lancamentos')
      .update({ valor_informado_centavos: dados.centavos, data_contribuicao: dados.data, forma: dados.forma })
      .eq('id', id),
  );
}

// RN-015 e RN-016: cancelar com motivo; o lançamento continua no histórico.
export function cancelarLancamento(id: string, motivo: string) {
  return executarAcao(() => supabase.rpc('cancelar_lancamento', { p_lancamento_id: id, p_motivo: motivo }));
}

// RN-030: aceitar (confirma com o valor conferido) ou contestar com mensagem.
export function responderDivergencia(id: string, aceitar: boolean, mensagem?: string) {
  return executarAcao(() =>
    supabase.rpc('responder_divergencia', { p_lancamento_id: id, p_aceitar: aceitar, p_mensagem: mensagem }),
  );
}

export type NovoDizimo = {
  igrejaId: string;
  membroId: string;
  valorEmCentavos: number;
  moeda: string;
  data: string; // AAAA-MM-DD
  forma: string;
  // Oferta: sempre de uma campanha (RN-038). Sem campanha, é dízimo.
  campanhaId?: string;
};

export type ErroAoRegistrar =
  | 'forma_invalida'
  | 'data_futura'
  | 'campanha_indisponivel'
  | 'sem_conexao'
  | 'erro_inesperado';

function traduzirErro(erro: PostgrestError | Error): ErroAoRegistrar {
  if (erro.message === 'forma_invalida' || erro.message === 'data_futura' || erro.message === 'campanha_indisponivel') {
    return erro.message;
  }
  if (erro instanceof TypeError) return 'sem_conexao';
  return 'erro_inesperado';
}

// Dízimo e oferta usam o mesmo lançamento (D-050). O banco define status
// (aguardando), conta de destino, autor e data do registro.
export async function registrarDizimo(
  dizimo: NovoDizimo,
): Promise<{ ok: true; id: string } | { ok: false; erro: ErroAoRegistrar }> {
  try {
    const { data, error } = await supabase
      .from('lancamentos')
      .insert({
        igreja_id: dizimo.igrejaId,
        membro_id: dizimo.membroId,
        tipo: dizimo.campanhaId ? 'oferta' : 'dizimo',
        campanha_id: dizimo.campanhaId,
        valor_informado_centavos: dizimo.valorEmCentavos,
        moeda: dizimo.moeda,
        data_contribuicao: dizimo.data,
        forma: dizimo.forma,
      })
      .select('id')
      .single();
    if (error) return { ok: false, erro: traduzirErro(error) };
    return { ok: true, id: data.id };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro as Error) };
  }
}
