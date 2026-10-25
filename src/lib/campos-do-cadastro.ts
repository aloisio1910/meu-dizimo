// Regras da tela Campos do cadastro (P-03). O banco confere de novo: chave
// e tipo fixos depois de criados, lista sempre com opções.

export type TipoDoCampo = 'texto' | 'data' | 'numero' | 'lista';
// Obrigatório e opcional: o membro preenche. Tesouraria: só o tesoureiro e o
// Pastor preenchem, e o membro só lê (D-093). Não usado: desligado.
export type SituacaoDoCampo = 'obrigatorio' | 'opcional' | 'tesouraria' | 'nao_usado';
export type QuemPreenche = 'membro' | 'tesouraria';

// Até 40 caracteres, começando por letra (regra da tabela campos_cadastro).
const TAMANHO_DA_CHAVE = 40;

// "Pastor de rede" -> "pastor_de_rede". Se já existir, ganha um número.
export function chaveDoRotulo(rotulo: string, existentes: string[]): string {
  const base =
    rotulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'campo_$1')
      .slice(0, TAMANHO_DA_CHAVE)
      .replace(/_+$/, '') || 'campo';
  if (!existentes.includes(base)) return base;
  for (let numero = 2; ; numero += 1) {
    const sufixo = `_${numero}`;
    const candidata = base.slice(0, TAMANHO_DA_CHAVE - sufixo.length) + sufixo;
    if (!existentes.includes(candidata)) return candidata;
  }
}

export function situacaoDoCampo(campo: {
  obrigatorio: boolean;
  ativo: boolean;
  preenchido_por: string;
}): SituacaoDoCampo {
  if (!campo.ativo) return 'nao_usado';
  if (campo.preenchido_por === 'tesouraria') return 'tesouraria';
  return campo.obrigatorio ? 'obrigatorio' : 'opcional';
}

// Campo desligado guarda quem preenchia antes, para as respostas não
// mudarem de lugar à toa.
export function camposDaSituacao(
  situacao: SituacaoDoCampo,
  quemPreenchiaAntes: QuemPreenche = 'membro',
): { obrigatorio: boolean; ativo: boolean; preenchido_por: QuemPreenche } {
  if (situacao === 'nao_usado') return { obrigatorio: false, ativo: false, preenchido_por: quemPreenchiaAntes };
  if (situacao === 'tesouraria') return { obrigatorio: false, ativo: true, preenchido_por: 'tesouraria' };
  return { obrigatorio: situacao === 'obrigatorio', ativo: true, preenchido_por: 'membro' };
}

export type ErrosDoCampo = {
  rotulo?: 'rotuloObrigatorio';
  opcoes?: 'opcoesObrigatorias' | 'opcaoRepetida';
};

// Opções sem espaços sobrando e sem linhas vazias, na ordem digitada.
export function limparOpcoes(opcoes: string[]): string[] {
  return opcoes.map((o) => o.trim()).filter(Boolean);
}

export function validarCampo(campos: {
  rotulo: string;
  tipo: TipoDoCampo;
  opcoes: string[];
}): { ok: true; dados: { rotulo: string; opcoes: string[] } } | { ok: false; erros: ErrosDoCampo } {
  const erros: ErrosDoCampo = {};
  const opcoes = campos.tipo === 'lista' ? limparOpcoes(campos.opcoes) : [];
  if (!campos.rotulo.trim()) erros.rotulo = 'rotuloObrigatorio';
  if (campos.tipo === 'lista') {
    if (opcoes.length === 0) erros.opcoes = 'opcoesObrigatorias';
    else if (new Set(opcoes.map((o) => o.toLowerCase())).size !== opcoes.length) erros.opcoes = 'opcaoRepetida';
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { rotulo: campos.rotulo.trim(), opcoes } };
}

// Opções que saíram da lista: quem já escolheu uma delas vai precisar
// escolher outra ao editar o perfil.
export function opcoesRetiradas(antes: string[], depois: string[]): string[] {
  return antes.filter((opcao) => !depois.includes(opcao));
}

// Troca a ordem de dois campos vizinhos; devolve as ordens novas.
export function trocarOrdem<T extends { id: string; ordem: number }>(
  campos: T[],
  id: string,
  direcao: -1 | 1,
): { id: string; ordem: number }[] | null {
  const ordenados = [...campos].sort((a, b) => a.ordem - b.ordem);
  const i = ordenados.findIndex((c) => c.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= ordenados.length) return null;
  // Renumera de 1 em 1 para não depender de ordens repetidas no banco.
  const renumerados = ordenados.map((c, k) => ({ id: c.id, ordem: k + 1 }));
  [renumerados[i].ordem, renumerados[j].ordem] = [renumerados[j].ordem, renumerados[i].ordem];
  return renumerados;
}
