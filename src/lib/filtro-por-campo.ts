// Filtro por campo do cadastro (ex.: Célula = Norte), usado na lista de
// Membros e nos relatórios. O valor vem das respostas do membro ou das
// anotações da tesouraria (D-093), conforme quem preenche o campo.

export type CampoFiltravel = {
  chave: string;
  rotulo: string;
  tipo: 'texto' | 'data' | 'numero' | 'lista';
  opcoes: string[];
  preenchido_por: 'membro' | 'tesouraria';
};

export type FiltroPorCampo = { chave: string; valor: string };

// Lista filtra pela opção; texto, por um trecho. Data e número ficam de fora
// por enquanto: agrupar por eles não ajuda a organizar dizimistas.
export function camposFiltraveis<T extends CampoFiltravel>(campos: T[]): T[] {
  return campos.filter((c) => c.tipo === 'lista' || c.tipo === 'texto');
}

type MembroComCampos = { campos_extras: unknown; campos_internos: unknown };

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
}

export function valorDoCampo(membro: MembroComCampos, campo: Pick<CampoFiltravel, 'chave' | 'preenchido_por'>): string {
  const origem = campo.preenchido_por === 'tesouraria' ? membro.campos_internos : membro.campos_extras;
  const valor = objeto(origem)[campo.chave];
  return valor === undefined || valor === null ? '' : String(valor);
}

function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Sem filtro (ou campo desconhecido), todos passam.
export function atendeAoFiltro(
  membro: MembroComCampos,
  filtro: FiltroPorCampo | undefined,
  campos: CampoFiltravel[],
): boolean {
  if (!filtro || !filtro.valor.trim()) return true;
  const campo = campos.find((c) => c.chave === filtro.chave);
  if (!campo) return true;
  const valor = valorDoCampo(membro, campo);
  if (campo.tipo === 'lista') return valor === filtro.valor;
  return simplificar(valor).includes(simplificar(filtro.valor));
}
