import type { Database } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

// As artes abrem por link temporário, como os comprovantes (bucket privado).
const VALIDADE_DO_LINK_SEGUNDOS = 60 * 60;

export type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  permanente: boolean;
  link_video: string | null;
  conta_id: string | null;
  arte: string | null; // link temporário da primeira arte, se houver
};

type CampanhaDoBanco = Omit<Campanha, 'arte'> & {
  campanha_midias: { arquivo_path: string; ordem: number; ativa: boolean }[];
};

const COLUNAS = 'id, nome, descricao, objetivo, permanente, link_video, conta_id, campanha_midias(arquivo_path, ordem, ativa)';

async function comArte(campanhas: CampanhaDoBanco[]): Promise<Campanha[]> {
  const primeiraArte = (c: CampanhaDoBanco) =>
    c.campanha_midias.filter((m) => m.ativa).sort((a, b) => a.ordem - b.ordem)[0]?.arquivo_path;
  const caminhos = campanhas.map(primeiraArte).filter((c): c is string => !!c);
  const { data: links } = caminhos.length
    ? await supabase.storage.from('campanhas').createSignedUrls(caminhos, VALIDADE_DO_LINK_SEGUNDOS)
    : { data: [] };
  return campanhas.map(({ campanha_midias: _midias, ...campanha }) => {
    const caminho = primeiraArte({ ...campanha, campanha_midias: _midias });
    return { ...campanha, arte: links?.find((l) => l.path === caminho)?.signedUrl ?? null };
  });
}

// M-06: vitrine das campanhas ativas, com a permanente "Oferta" primeiro.
export async function listarCampanhasAtivas(igrejaId: string): Promise<Campanha[]> {
  const { data, error } = await supabase
    .from('campanhas')
    .select(COLUNAS)
    .eq('igreja_id', igrejaId)
    .eq('status', 'ativa')
    .order('permanente', { ascending: false })
    .order('inicio', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return comArte(data as CampanhaDoBanco[]);
}

// M-07: uma campanha. Só as ativas aceitam oferta; as encerradas aparecem
// no histórico (D-074).
export async function buscarCampanha(id: string): Promise<(Campanha & { status: Enums['status_campanha'] }) | null> {
  const { data, error } = await supabase.from('campanhas').select(`${COLUNAS}, status`).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [campanha] = await comArte([data as CampanhaDoBanco]);
  return { ...campanha, status: (data as { status: Enums['status_campanha'] }).status };
}

export type OfertaDoHistorico = {
  id: string;
  data_contribuicao: string;
  valor_informado_centavos: number;
  valor_conferido_centavos: number | null;
  moeda: string;
  status: Enums['status_lancamento'];
  confirmado_por_nome: string | null;
  campanhas: { nome: string } | null;
};

// M-08: ofertas da própria ficha, separadas do Cartão de Dízimo (RN-037).
export async function listarMinhasOfertas(membroId: string): Promise<OfertaDoHistorico[]> {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id, data_contribuicao, valor_informado_centavos, valor_conferido_centavos, moeda, status, confirmado_por_nome, campanhas(nome)')
    .eq('membro_id', membroId)
    .eq('tipo', 'oferta')
    .order('data_contribuicao', { ascending: false })
    .order('registrado_em', { ascending: false });
  if (error) throw error;
  return data;
}
