import type { PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

export type ItemDaFila = {
  id: string;
  membro_id: string;
  membro_nome: string;
  membro_numero: number;
  tipo: Enums['tipo_lancamento'];
  data_contribuicao: string;
  registrado_em: string;
  valor_informado_centavos: number;
  valor_conferido_centavos: number | null;
  moeda: string;
  forma: string;
  status: Enums['status_lancamento'];
  em_conferencia_por: string | null;
  em_conferencia_por_nome: string | null;
  conferencia_parada: boolean;
  divergencia_sinalizada: boolean;
  resposta_membro: Enums['resposta_divergencia'] | null;
  mensagem_membro: string | null;
  observacao_tesouraria: string | null;
  tem_comprovante: boolean;
  conta_nome: string | null;
  confirmado_por: string | null;
  confirmado_por_nome: string | null;
  confirmado_em: string | null;
  registrado_pela_tesouraria: boolean;
};

const COLUNAS_DA_FILA =
  'id, membro_id, membro_nome, membro_numero, tipo, data_contribuicao, registrado_em, valor_informado_centavos, valor_conferido_centavos, moeda, forma, status, em_conferencia_por, em_conferencia_por_nome, conferencia_parada, divergencia_sinalizada, resposta_membro, mensagem_membro, observacao_tesouraria, tem_comprovante, conta_nome, confirmado_por, confirmado_por_nome, confirmado_em, registrado_pela_tesouraria';

// Quantos conferidos a lista mostra: os mais recentes, para achar um engano.
const LIMITE_DE_CONFERIDOS = 50;

// Últimos lançamentos confirmados, do mais recente para o mais antigo.
export async function listarConferidos(igrejaId: string, filtros: FiltrosDaFila): Promise<ItemDaFila[]> {
  let consulta = supabase
    .from('lancamentos_detalhados')
    .select(COLUNAS_DA_FILA)
    .eq('igreja_id', igrejaId)
    .eq('status', 'confirmado')
    .order('confirmado_em', { ascending: false })
    .limit(LIMITE_DE_CONFERIDOS);
  if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo);
  if (filtros.comComprovante !== undefined) consulta = consulta.eq('tem_comprovante', filtros.comComprovante);
  const { data, error } = await consulta;
  if (error) throw error;
  return data as ItemDaFila[];
}

export type FiltrosDaFila = {
  tipo?: Enums['tipo_lancamento'];
  comComprovante?: boolean;
};

// T-01: aguardando e em conferência, por ordem de chegada (RN-020).
export async function listarFila(igrejaId: string, filtros: FiltrosDaFila): Promise<ItemDaFila[]> {
  let consulta = supabase
    .from('lancamentos_detalhados')
    .select(COLUNAS_DA_FILA)
    .eq('igreja_id', igrejaId)
    .in('status', ['aguardando', 'em_conferencia'])
    .order('registrado_em');
  if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo);
  if (filtros.comComprovante !== undefined) consulta = consulta.eq('tem_comprovante', filtros.comComprovante);
  const { data, error } = await consulta;
  if (error) throw error;
  return data as ItemDaFila[];
}

// Divergências que pedem a tesouraria: contestadas pelo membro e as sem
// resposta há mais de 15 dias (D-056).
export async function listarDivergenciasPendentes(igrejaId: string): Promise<ItemDaFila[]> {
  const { data, error } = await supabase
    .from('lancamentos_detalhados')
    .select(COLUNAS_DA_FILA)
    .eq('igreja_id', igrejaId)
    .eq('status', 'divergencia')
    .or('resposta_membro.eq.contestada,divergencia_sinalizada.eq.true')
    .order('registrado_em');
  if (error) throw error;
  return data as ItemDaFila[];
}

export async function buscarItem(id: string): Promise<ItemDaFila | null> {
  const { data, error } = await supabase.from('lancamentos_detalhados').select(COLUNAS_DA_FILA).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ItemDaFila | null;
}

export type ErroDaConferencia =
  | 'proprio_lancamento'
  | 'em_conferencia_por_outro'
  | 'conferencia_nao_aberta'
  | 'lancamento_indisponivel'
  | 'registre_divergencia'
  | 'valor_igual_ao_informado'
  | 'observacao_obrigatoria'
  | 'valor_conferido_obrigatorio'
  | 'desfazer_indisponivel'
  | 'prazo_para_desfazer_vencido'
  | 'motivo_obrigatorio'
  | 'justificativa_obrigatoria'
  | 'so_confirmado_reabre'
  | 'sem_conexao'
  | 'erro_inesperado';

const ERROS_CONHECIDOS: string[] = [
  'desfazer_indisponivel',
  'prazo_para_desfazer_vencido',
  'motivo_obrigatorio',
  'justificativa_obrigatoria',
  'so_confirmado_reabre',
  'proprio_lancamento',
  'em_conferencia_por_outro',
  'conferencia_nao_aberta',
  'lancamento_indisponivel',
  'registre_divergencia',
  'valor_igual_ao_informado',
  'observacao_obrigatoria',
  'valor_conferido_obrigatorio',
];

function traduzir(erro: PostgrestError | Error): ErroDaConferencia {
  if (ERROS_CONHECIDOS.includes(erro.message)) return erro.message as ErroDaConferencia;
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

async function executar<T>(
  acao: () => PromiseLike<{ data: T; error: PostgrestError | null }>,
): Promise<{ ok: true; dados: T } | { ok: false; erro: ErroDaConferencia }> {
  try {
    const { data, error } = await acao();
    return error ? { ok: false, erro: traduzir(error) } : { ok: true, dados: data };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

// Abre o primeiro da fila; devolve o id ou null se a fila estiver vazia.
export async function abrirProximo(igrejaId: string, filtros: FiltrosDaFila) {
  const resultado = await executar(() =>
    supabase.rpc('abrir_proximo_da_fila', {
      p_igreja_id: igrejaId,
      p_tipo: filtros.tipo,
      p_com_comprovante: filtros.comComprovante,
    }),
  );
  if (!resultado.ok) return resultado;
  const aberto = resultado.dados as { id: string | null } | null;
  return { ok: true as const, id: aberto?.id ?? null };
}

export function abrirConferencia(lancamentoId: string) {
  return executar(() => supabase.rpc('abrir_conferencia', { p_lancamento_id: lancamentoId }));
}

export function manterConferencia(lancamentoId: string) {
  return executar(() => supabase.rpc('manter_conferencia', { p_lancamento_id: lancamentoId }));
}

export function liberarConferencia(lancamentoId: string) {
  return executar(() => supabase.rpc('liberar_conferencia', { p_lancamento_id: lancamentoId }));
}

export function confirmarLancamento(lancamentoId: string, valorConferidoCentavos?: number) {
  return executar(() =>
    supabase.rpc('confirmar_lancamento', {
      p_lancamento_id: lancamentoId,
      p_valor_conferido_centavos: valorConferidoCentavos,
    }),
  );
}

// D-084: quem confirmou desfaz em até 15 minutos, com motivo.
export function desfazerConfirmacao(lancamentoId: string, motivo: string) {
  return executar(() => supabase.rpc('desfazer_confirmacao', { p_lancamento_id: lancamentoId, p_motivo: motivo }));
}

// RN-031: o Pastor de Governo reabre um confirmado a qualquer momento, com justificativa.
export function reabrirLancamento(lancamentoId: string, justificativa: string) {
  return executar(() =>
    supabase.rpc('reabrir_lancamento', { p_lancamento_id: lancamentoId, p_justificativa: justificativa }),
  );
}

export function registrarDivergencia(lancamentoId: string, valorConferidoCentavos: number, observacao: string) {
  return executar(() =>
    supabase.rpc('registrar_divergencia', {
      p_lancamento_id: lancamentoId,
      p_valor_conferido_centavos: valorConferidoCentavos,
      p_observacao: observacao,
    }),
  );
}
