import type { PostgrestError } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { formatoDaArte, TAMANHO_MAXIMO_DA_ARTE, TIPO_DA_ARTE } from '@/lib/campanha';
import type { DadosDaIgrejaParaSalvar } from '@/lib/dados-da-igreja';
import type { ArquivoEscolhido } from '@/services/dispositivo/arquivos';
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

export type ImagemDaIgreja = 'logo' | 'capa';

// Coluna da igreja que guarda cada imagem.
function colunaDaImagem(tipo: ImagemDaIgreja, caminho: string | null) {
  return tipo === 'logo' ? { logo_path: caminho } : { capa_path: caminho };
}

const VALIDADE_DO_LINK_SEGUNDOS = 60 * 60;

// Links temporários do logo e da capa (bucket privado "igrejas").
export async function linksDasImagens(caminhos: { logo: string | null; capa: string | null }) {
  const lista = [caminhos.logo, caminhos.capa].filter((c): c is string => !!c);
  if (!lista.length) return { logo: null, capa: null };
  const { data } = await supabase.storage.from('igrejas').createSignedUrls(lista, VALIDADE_DO_LINK_SEGUNDOS);
  const link = (caminho: string | null) => (caminho ? (data?.find((l) => l.path === caminho)?.signedUrl ?? null) : null);
  return { logo: link(caminhos.logo), capa: link(caminhos.capa) };
}

export type ErroDaImagem = 'formato_nao_aceito' | 'arquivo_grande' | 'envio_falhou' | 'sem_conexao';

// Envia um logo ou capa novo. O arquivo anterior fica guardado (nada se
// apaga); a igreja passa a apontar para o novo.
export async function enviarImagemDaIgreja(
  igrejaId: string,
  tipo: ImagemDaIgreja,
  arquivo: ArquivoEscolhido,
): Promise<ErroDaImagem | null> {
  if (arquivo.tamanho !== null && arquivo.tamanho > TAMANHO_MAXIMO_DA_ARTE) return 'arquivo_grande';
  try {
    const bytes = await arquivo.ler();
    if (bytes.byteLength > TAMANHO_MAXIMO_DA_ARTE) return 'arquivo_grande';
    const formato = formatoDaArte(bytes);
    if (!formato) return 'formato_nao_aceito';

    const caminho = `${igrejaId}/${tipo}-${randomUUID()}.${formato}`;
    const conteudo = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error: erroNoEnvio } = await supabase.storage
      .from('igrejas')
      .upload(caminho, conteudo, { contentType: TIPO_DA_ARTE[formato] });
    if (erroNoEnvio) return 'envio_falhou';

    const { data, error } = await supabase
      .from('igrejas')
      .update(colunaDaImagem(tipo, caminho))
      .eq('id', igrejaId)
      .select('id');
    return error || !data.length ? 'envio_falhou' : null;
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'envio_falhou';
  }
}

// Retirar o logo ou a capa: a igreja deixa de mostrar; o arquivo fica.
export async function retirarImagemDaIgreja(igrejaId: string, tipo: ImagemDaIgreja): Promise<boolean> {
  const { data, error } = await supabase
    .from('igrejas')
    .update(colunaDaImagem(tipo, null))
    .eq('id', igrejaId)
    .select('id');
  return !error && !!data?.length;
}

export async function salvarCorDaIgreja(igrejaId: string, cor: string): Promise<boolean> {
  const { data, error } = await supabase.from('igrejas').update({ cor_principal: cor }).eq('id', igrejaId).select('id');
  return !error && !!data?.length;
}
