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

// Conta principal da igreja, que recebe o dízimo (D-066). Null se a igreja
// ainda não cadastrou uma conta com Pix.
export async function buscarContaPrincipal(igrejaId: string): Promise<ContaParaPix | null> {
  const { data, error } = await supabase
    .from('contas')
    .select('nome, chave_pix, tipo_chave_pix, nome_recebedor, cidade')
    .eq('igreja_id', igrejaId)
    .eq('principal', true)
    .maybeSingle();
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

// RN-032: o app pergunta antes de registrar o mesmo valor na mesma data.
export async function existeDizimoIgual(membroId: string, valorEmCentavos: number, data: string): Promise<boolean> {
  const { data: existe, error } = await supabase.rpc('existe_lancamento_igual', {
    p_membro_id: membroId,
    p_tipo: 'dizimo',
    p_valor_centavos: valorEmCentavos,
    p_data: data,
  });
  if (error) throw error;
  return existe;
}

export type NovoDizimo = {
  igrejaId: string;
  membroId: string;
  valorEmCentavos: number;
  moeda: string;
  data: string; // AAAA-MM-DD
  forma: string;
};

export type ErroAoRegistrar = 'forma_invalida' | 'data_futura' | 'sem_conexao' | 'erro_inesperado';

function traduzirErro(erro: PostgrestError | Error): ErroAoRegistrar {
  if (erro.message === 'forma_invalida' || erro.message === 'data_futura') return erro.message;
  if (erro instanceof TypeError) return 'sem_conexao';
  return 'erro_inesperado';
}

// O banco define status (aguardando), conta de destino, autor e data do registro.
export async function registrarDizimo(
  dizimo: NovoDizimo,
): Promise<{ ok: true; id: string } | { ok: false; erro: ErroAoRegistrar }> {
  try {
    const { data, error } = await supabase
      .from('lancamentos')
      .insert({
        igreja_id: dizimo.igrejaId,
        membro_id: dizimo.membroId,
        tipo: 'dizimo',
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
