import type { PostgrestError } from '@supabase/supabase-js';

import type { FiltroPorCampo } from '@/lib/filtro-por-campo';

import { supabase } from './cliente';

// Mensagens da igreja aos membros (D-102). As regras ficam no banco: quem
// envia (tesouraria), quem recebe (ativos, no grupo, que não desligaram) e o
// limite de 1 por semana por igreja.

export type ErroDaMensagem =
  'sem_permissao' | 'texto_invalido' | 'grupo_invalido' | 'limite_semanal' | 'sem_conexao' | 'erro_inesperado';

const ERROS: string[] = ['sem_permissao', 'texto_invalido', 'grupo_invalido', 'limite_semanal'];

function traduzir(erro: PostgrestError | Error): ErroDaMensagem {
  if (ERROS.includes(erro.message)) return erro.message as ErroDaMensagem;
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

const grupo = (filtro?: FiltroPorCampo) =>
  filtro?.valor.trim()
    ? { p_campo: filtro.chave, p_valor: filtro.valor.trim() }
    : { p_campo: undefined, p_valor: undefined };

export type Previa = { destinatarios: number; proximaEm: string | null };

export async function previaDaMensagem(igrejaId: string, filtro?: FiltroPorCampo): Promise<Previa> {
  const { data, error } = await supabase.rpc('previa_da_mensagem', { p_igreja_id: igrejaId, ...grupo(filtro) });
  if (error) throw error;
  const previa = data as { destinatarios: number; proxima_em: string | null };
  return { destinatarios: previa.destinatarios, proximaEm: previa.proxima_em };
}

export async function enviarMensagemDaIgreja(
  igrejaId: string,
  texto: string,
  filtro?: FiltroPorCampo,
): Promise<{ ok: true; destinatarios: number } | { ok: false; erro: ErroDaMensagem }> {
  try {
    const { data, error } = await supabase.rpc('enviar_mensagem_da_igreja', {
      p_igreja_id: igrejaId,
      p_texto: texto,
      ...grupo(filtro),
    });
    if (error) return { ok: false, erro: traduzir(error) };
    return { ok: true, destinatarios: (data as { destinatarios: number }).destinatarios };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

export type MensagemEnviada = {
  id: string;
  autor_nome: string;
  texto: string;
  grupo_campo: string | null;
  grupo_valor: string | null;
  destinatarios: number;
  criado_em: string;
};

export async function listarMensagensDaIgreja(igrejaId: string): Promise<MensagemEnviada[]> {
  const { data, error } = await supabase
    .from('mensagens')
    .select('id, autor_nome, texto, grupo_campo, grupo_valor, destinatarios, criado_em')
    .eq('igreja_id', igrejaId)
    .eq('origem', 'igreja')
    .order('criado_em', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
