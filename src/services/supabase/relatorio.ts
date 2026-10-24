import type { LinhaDoRelatorio, Periodo, StatusDoLancamento } from '@/lib/relatorio';

import { supabase } from './cliente';

// O Supabase devolve no máximo 1.000 linhas por pedido: o relatório busca
// em páginas até acabar.
const TAMANHO_DA_PAGINA = 1000;

export type FiltrosDoRelatorio = {
  periodo: Periodo;
  tipo?: 'dizimo' | 'oferta';
  campanhaId?: string;
  status?: StatusDoLancamento;
};

const COLUNAS =
  'id, tipo, data_contribuicao, registrado_em, valor_informado_centavos, valor_conferido_centavos, moeda, forma, status, confirmado_por_nome, registrado_pela_tesouraria, membros(nome, numero, campos_extras), campanhas(nome), contas(nome)';

// T-06: lançamentos da igreja no período (pela data do dízimo), do mais
// antigo para o mais recente. A RLS só deixa a tesouraria ler os da igreja.
export async function buscarLancamentosDoRelatorio(
  igrejaId: string,
  filtros: FiltrosDoRelatorio,
): Promise<LinhaDoRelatorio[]> {
  const linhas: LinhaDoRelatorio[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_DA_PAGINA) {
    let consulta = supabase
      .from('lancamentos')
      .select(COLUNAS)
      .eq('igreja_id', igrejaId)
      .gte('data_contribuicao', filtros.periodo.de)
      .lte('data_contribuicao', filtros.periodo.ate)
      .order('data_contribuicao')
      .order('registrado_em')
      .order('id')
      .range(inicio, inicio + TAMANHO_DA_PAGINA - 1);
    if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo);
    if (filtros.campanhaId) consulta = consulta.eq('campanha_id', filtros.campanhaId);
    if (filtros.status) consulta = consulta.eq('status', filtros.status);
    const { data, error } = await consulta;
    if (error) throw error;
    linhas.push(...(data as LinhaDoRelatorio[]));
    if (data.length < TAMANHO_DA_PAGINA) return linhas;
  }
}

export type CampanhaDoFiltro = { id: string; nome: string; status: string };

// Ativas e encerradas: as encerradas continuam nos relatórios (D-074).
export async function listarCampanhasDoRelatorio(igrejaId: string): Promise<CampanhaDoFiltro[]> {
  const { data, error } = await supabase
    .from('campanhas')
    .select('id, nome, status')
    .eq('igreja_id', igrejaId)
    .neq('status', 'rascunho')
    .order('permanente', { ascending: false })
    .order('nome');
  if (error) throw error;
  return data;
}
