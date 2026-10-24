import type { PostgrestError } from '@supabase/supabase-js';

import type { DadosDaIgrejaParaSalvar } from '@/lib/dados-da-igreja';
import type { Json } from '@/types/banco';

import { supabase } from './cliente';

// P-03 Dados e contato da igreja (Pastor de Governo). A RLS só deixa o
// administrador da igreja alterar; cada mudança fica no log.

export type DadosParaEditar = {
  nome: string;
  endereco: string | null;
  horarios_culto: string | null;
  site: string | null;
  redes_sociais: Json;
  whatsapp_contato: string | null;
  versiculo_referencia: string;
  versiculo_texto: string | null;
  mensagem_confirmacao: string | null;
  formas_devolucao: string[];
};

export async function buscarDadosParaEditar(igrejaId: string): Promise<DadosParaEditar | null> {
  const { data, error } = await supabase
    .from('igrejas')
    .select(
      'nome, endereco, horarios_culto, site, redes_sociais, whatsapp_contato, versiculo_referencia, versiculo_texto, mensagem_confirmacao, formas_devolucao',
    )
    .eq('id', igrejaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ErroAoSalvarIgreja = 'sem_permissao' | 'sem_conexao' | 'erro_inesperado';

function traduzir(erro: PostgrestError | Error): ErroAoSalvarIgreja {
  if ('code' in erro && erro.code === '42501') return 'sem_permissao';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

export async function salvarDadosDaIgreja(igrejaId: string, dados: DadosDaIgrejaParaSalvar): Promise<ErroAoSalvarIgreja | null> {
  try {
    const { data, error } = await supabase.from('igrejas').update(dados).eq('id', igrejaId).select('id');
    if (error) return traduzir(error);
    return data.length ? null : 'sem_permissao';
  } catch (erro) {
    return traduzir(erro as Error);
  }
}
