import type { PostgrestError } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { caminhoDaArte, formatoDaArte, TAMANHO_MAXIMO_DA_ARTE, TIPO_DA_ARTE, type DadosDaCampanha } from '@/lib/campanha';
import type { ArquivoEscolhido } from '@/services/dispositivo/arquivos';
import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

// P-02 Campanhas (Pastor de Governo). A RLS só deixa o administrador da
// igreja criar e alterar; o filtro por igreja escolhe qual.

const VALIDADE_DO_LINK_SEGUNDOS = 60 * 60;

export type CampanhaDaIgreja = {
  id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  inicio: string | null;
  fim: string | null;
  link_video: string | null;
  conta_id: string | null;
  status: Enums['status_campanha'];
  permanente: boolean;
};

export type ArteDaCampanha = { id: string; ordem: number; link: string | null };

const COLUNAS = 'id, nome, descricao, objetivo, inicio, fim, link_video, conta_id, status, permanente';

// Rascunhos primeiro (pedem ação), depois ativas e encerradas.
const ORDEM_DO_STATUS: Record<Enums['status_campanha'], number> = { rascunho: 0, ativa: 1, encerrada: 2 };

export async function listarCampanhasDaIgreja(igrejaId: string): Promise<CampanhaDaIgreja[]> {
  const { data, error } = await supabase
    .from('campanhas')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .order('permanente', { ascending: false })
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return [...data].sort((a, b) => Number(b.permanente) - Number(a.permanente) || ORDEM_DO_STATUS[a.status] - ORDEM_DO_STATUS[b.status]);
}

export async function buscarCampanhaDaIgreja(
  igrejaId: string,
  id: string,
): Promise<{ campanha: CampanhaDaIgreja; artes: ArteDaCampanha[] } | null> {
  const { data, error } = await supabase
    .from('campanhas')
    .select(`${COLUNAS}, campanha_midias(id, arquivo_path, ordem, ativa)`)
    .eq('igreja_id', igrejaId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { campanha_midias: midias, ...campanha } = data;
  const ativas = midias.filter((m) => m.ativa).sort((a, b) => a.ordem - b.ordem);
  const { data: links } = ativas.length
    ? await supabase.storage.from('campanhas').createSignedUrls(
        ativas.map((m) => m.arquivo_path),
        VALIDADE_DO_LINK_SEGUNDOS,
      )
    : { data: [] };
  return {
    campanha,
    artes: ativas.map((m) => ({
      id: m.id,
      ordem: m.ordem,
      link: links?.find((l) => l.path === m.arquivo_path)?.signedUrl ?? null,
    })),
  };
}

export type ContaDaIgreja = { id: string; nome: string; principal: boolean };

// Contas que podem receber as ofertas da campanha (D-066).
export async function listarContasDaIgreja(igrejaId: string): Promise<ContaDaIgreja[]> {
  const { data, error } = await supabase
    .from('contas')
    .select('id, nome, principal')
    .eq('igreja_id', igrejaId)
    .eq('ativa', true)
    .order('principal', { ascending: false })
    .order('nome');
  if (error) throw error;
  return data;
}

export type ErroDaCampanha =
  | 'fim_no_passado'
  | 'status_invalido'
  | 'periodo_invalido'
  | 'link_invalido'
  | 'status_mudou'
  | 'sem_permissao'
  | 'sem_conexao'
  | 'erro_inesperado';

function traduzir(erro: PostgrestError | Error): ErroDaCampanha {
  const mensagem = erro.message;
  if (mensagem === 'fim_no_passado' || mensagem === 'status_invalido') return mensagem;
  if (mensagem.includes('campanhas_periodo')) return 'periodo_invalido';
  if (mensagem.includes('link_video')) return 'link_invalido';
  if ('code' in erro && erro.code === '42501') return 'sem_permissao';
  return erro instanceof TypeError ? 'sem_conexao' : 'erro_inesperado';
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroDaCampanha };

async function executar<T>(acao: () => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<Resultado<T>> {
  try {
    const { data, error } = await acao();
    return error ? { ok: false, erro: traduzir(error) } : { ok: true, dados: data };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro as Error) };
  }
}

// Nova campanha: o banco grava como rascunho.
export async function criarCampanha(
  igrejaId: string,
  dados: DadosDaCampanha & { conta_id: string | null },
): Promise<Resultado<string>> {
  const resultado = await executar(() =>
    supabase
      .from('campanhas')
      .insert({ igreja_id: igrejaId, ...dados })
      .select('id')
      .single(),
  );
  if (!resultado.ok) return resultado;
  return resultado.dados ? { ok: true, dados: resultado.dados.id } : { ok: false, erro: 'sem_permissao' };
}

export async function salvarCampanha(
  id: string,
  dados: DadosDaCampanha & { conta_id: string | null },
): Promise<Resultado<null>> {
  const resultado = await executar(() => supabase.from('campanhas').update(dados).eq('id', id).select('id'));
  if (!resultado.ok) return resultado;
  return resultado.dados?.length ? { ok: true, dados: null } : { ok: false, erro: 'sem_permissao' };
}

// Publicar, encerrar ou reabrir (D-088). O filtro pelo status atual evita
// mudar uma campanha que outra pessoa ou a rotina diária acabou de alterar.
export async function mudarStatusDaCampanha(
  id: string,
  de: Enums['status_campanha'],
  para: Enums['status_campanha'],
): Promise<Resultado<null>> {
  const resultado = await executar(() =>
    supabase.from('campanhas').update({ status: para }).eq('id', id).eq('status', de).select('id'),
  );
  if (!resultado.ok) return resultado;
  return resultado.dados?.length ? { ok: true, dados: null } : { ok: false, erro: 'status_mudou' };
}

export type ErroDaArte = 'formato_nao_aceito' | 'arquivo_grande' | 'envio_falhou' | 'sem_conexao';

// Envia a arte ao bucket privado "campanhas" e registra em campanha_midias,
// no fim da lista.
export async function enviarArte(
  igrejaId: string,
  campanhaId: string,
  arquivo: ArquivoEscolhido,
  proximaOrdem: number,
): Promise<ErroDaArte | null> {
  if (arquivo.tamanho !== null && arquivo.tamanho > TAMANHO_MAXIMO_DA_ARTE) return 'arquivo_grande';
  try {
    const bytes = await arquivo.ler();
    if (bytes.byteLength > TAMANHO_MAXIMO_DA_ARTE) return 'arquivo_grande';
    const formato = formatoDaArte(bytes);
    if (!formato) return 'formato_nao_aceito';

    const caminho = caminhoDaArte(igrejaId, campanhaId, randomUUID(), formato);
    const conteudo = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error: erroNoEnvio } = await supabase.storage
      .from('campanhas')
      .upload(caminho, conteudo, { contentType: TIPO_DA_ARTE[formato] });
    if (erroNoEnvio) return 'envio_falhou';

    const { error } = await supabase
      .from('campanha_midias')
      .insert({ igreja_id: igrejaId, campanha_id: campanhaId, arquivo_path: caminho, ordem: proximaOrdem });
    return error ? 'envio_falhou' : null;
  } catch (erro) {
    return erro instanceof TypeError ? 'sem_conexao' : 'envio_falhou';
  }
}

// Retirar sem apagar (regra 3 do CLAUDE.md): a arte sai da campanha, mas o
// arquivo e o registro ficam.
export async function retirarArte(midiaId: string): Promise<boolean> {
  const { data, error } = await supabase.from('campanha_midias').update({ ativa: false }).eq('id', midiaId).select('id');
  return !error && !!data?.length;
}
