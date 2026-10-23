import { randomUUID } from 'expo-crypto';

import {
  TAMANHO_MAXIMO_BYTES,
  TIPO_DO_FORMATO,
  caminhoDoComprovante,
  formatoPeloConteudo,
  type FormatoDoComprovante,
} from '@/lib/comprovante';
import type { ArquivoEscolhido } from '@/services/dispositivo/arquivos';

import { supabase } from './cliente';

// Em desenvolvimento, o erro real aparece na janela do "npx expo start".
function avisarEmDesenvolvimento(etapa: string, erro: unknown) {
  if (__DEV__) console.warn(`[comprovante] falha ao ${etapa}:`, erro);
}

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
  if (arquivo.tamanho !== null && arquivo.tamanho > TAMANHO_MAXIMO_BYTES) return 'arquivo_grande';

  let bytes: Uint8Array;
  try {
    bytes = await arquivo.ler();
  } catch (erro) {
    avisarEmDesenvolvimento('ler o arquivo', erro);
    return 'envio_falhou';
  }
  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) return 'arquivo_grande';

  // O conteúdo decide o formato, não o nome nem o tipo informado pelo celular.
  const formato = formatoPeloConteudo(bytes);
  if (!formato) return 'formato_nao_aceito';

  try {
    const caminho = caminhoDoComprovante(igrejaId, lancamentoId, randomUUID(), formato);
    // ArrayBuffer é o formato que o guia do Supabase para Expo usa no envio.
    const conteudo = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error: erroNoEnvio } = await supabase.storage
      .from('comprovantes')
      .upload(caminho, conteudo, { contentType: TIPO_DO_FORMATO[formato] });
    if (erroNoEnvio) {
      avisarEmDesenvolvimento('enviar ao Storage', erroNoEnvio);
      return 'envio_falhou';
    }

    const { error } = await supabase
      .from('comprovantes')
      .insert({ igreja_id: igrejaId, lancamento_id: lancamentoId, arquivo_path: caminho, formato });
    if (error) avisarEmDesenvolvimento('registrar no banco', error);
    return error ? 'envio_falhou' : null;
  } catch (erro) {
    avisarEmDesenvolvimento('enviar', erro);
    return erro instanceof TypeError ? 'sem_conexao' : 'envio_falhou';
  }
}

// D-083: o membro retira um comprovante errado sem apagar; ele some da lista
// do membro e continua guardado para a tesouraria.
export async function retirarComprovante(
  comprovanteId: string,
): Promise<'comprovante_travado' | 'erro_inesperado' | 'sem_conexao' | null> {
  try {
    const { error } = await supabase.rpc('retirar_comprovante', { p_comprovante_id: comprovanteId });
    if (!error) return null;
    return error.message === 'comprovante_travado' ? 'comprovante_travado' : 'erro_inesperado';
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
  }
}

// Comprovantes ainda válidos do lançamento (os retirados ficam de fora),
// cada um com um link temporário para abrir.
export async function listarComprovantes(lancamentoId: string): Promise<Comprovante[]> {
  const { data, error } = await supabase
    .from('comprovantes')
    .select('id, formato, enviado_em, arquivo_path')
    .eq('lancamento_id', lancamentoId)
    .is('retirado_em', null)
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
