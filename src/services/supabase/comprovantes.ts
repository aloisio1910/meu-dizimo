import { randomUUID } from 'expo-crypto';

import {
  TAMANHO_MAXIMO_BYTES,
  TIPO_DO_FORMATO,
  caminhoDoComprovante,
  formatoDoArquivo,
  type FormatoDoComprovante,
} from '@/lib/comprovante';
import type { ArquivoEscolhido } from '@/services/dispositivo/arquivos';

import { supabase } from './cliente';

// Links temporários: o comprovante abre por 5 minutos e o link expira.
const VALIDADE_DO_LINK_SEGUNDOS = 5 * 60;

export type Comprovante = {
  id: string;
  formato: FormatoDoComprovante;
  enviado_em: string;
  link: string | null;
};

export type ErroDoComprovante = 'formato_nao_aceito' | 'arquivo_grande' | 'envio_falhou' | 'sem_conexao';

// Envia o arquivo ao bucket privado e registra o comprovante no lançamento.
// A RLS do Storage só aceita o arquivo se o lançamento for da pessoa (ou da
// tesouraria) e não estiver cancelado.
export async function enviarComprovante(
  igrejaId: string,
  lancamentoId: string,
  arquivo: ArquivoEscolhido,
): Promise<ErroDoComprovante | null> {
  const formato = formatoDoArquivo(arquivo.tipo, arquivo.nome);
  if (!formato) return 'formato_nao_aceito';
  if (arquivo.tamanho !== null && arquivo.tamanho > TAMANHO_MAXIMO_BYTES) return 'arquivo_grande';

  try {
    const bytes = await arquivo.ler();
    if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) return 'arquivo_grande';

    const caminho = caminhoDoComprovante(igrejaId, lancamentoId, randomUUID(), formato);
    // ArrayBuffer é o formato que o guia do Supabase para Expo usa no envio.
    const conteudo = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error: erroNoEnvio } = await supabase.storage
      .from('comprovantes')
      .upload(caminho, conteudo, { contentType: TIPO_DO_FORMATO[formato] });
    if (erroNoEnvio) return 'envio_falhou';

    const { error } = await supabase
      .from('comprovantes')
      .insert({ igreja_id: igrejaId, lancamento_id: lancamentoId, arquivo_path: caminho, formato });
    return error ? 'envio_falhou' : null;
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'envio_falhou';
  }
}

// Comprovantes do lançamento, cada um com um link temporário para abrir.
export async function listarComprovantes(lancamentoId: string): Promise<Comprovante[]> {
  const { data, error } = await supabase
    .from('comprovantes')
    .select('id, formato, enviado_em, arquivo_path')
    .eq('lancamento_id', lancamentoId)
    .order('enviado_em');
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: links } = await supabase.storage
    .from('comprovantes')
    .createSignedUrls(
      data.map((c) => c.arquivo_path),
      VALIDADE_DO_LINK_SEGUNDOS,
    );

  return data.map((c) => ({
    id: c.id,
    formato: c.formato,
    enviado_em: c.enviado_em,
    link: links?.find((l) => l.path === c.arquivo_path)?.signedUrl ?? null,
  }));
}
