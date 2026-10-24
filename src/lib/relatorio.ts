import { dataParaIso } from './data';

// Regras do relatório da tesouraria (T-06). Valores sempre em centavos;
// só a planilha converte para reais, porque o Excel precisa somar números.

export type StatusDoLancamento = 'aguardando' | 'em_conferencia' | 'confirmado' | 'divergencia' | 'cancelado';

export type LinhaDoRelatorio = {
  id: string;
  tipo: 'dizimo' | 'oferta';
  data_contribuicao: string; // AAAA-MM-DD
  registrado_em: string; // momento ISO
  valor_informado_centavos: number;
  valor_conferido_centavos: number | null;
  moeda: string;
  forma: string;
  status: StatusDoLancamento;
  confirmado_por_nome: string | null;
  registrado_pela_tesouraria: boolean;
  membros: { nome: string; numero: number; campos_extras: unknown } | null;
  campanhas: { nome: string } | null;
  contas: { nome: string } | null;
};

export type Periodo = { de: string; ate: string }; // AAAA-MM-DD

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// Primeiro e último dia do mês de "hoje" deslocado em meses (0 = este mês,
// -1 = o mês passado).
export function periodoDoMes(hoje: string, deslocamento = 0): Periodo {
  const [ano, mes] = hoje.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1));
  const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
  const iso = (d: Date) => `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
  return { de: iso(inicio), ate: iso(fim) };
}

export type ErrosDoPeriodo = { de?: 'dataInvalida'; ate?: 'dataInvalida' | 'fimAntesDoInicio' };

// O período vale para a data do dízimo, que pode ser retroativa (RN-011).
export function validarPeriodo(
  campos: { de: string; ate: string },
): { ok: true; periodo: Periodo } | { ok: false; erros: ErrosDoPeriodo } {
  const de = dataParaIso(campos.de);
  const ate = dataParaIso(campos.ate);
  const erros: ErrosDoPeriodo = {};
  if (!de) erros.de = 'dataInvalida';
  if (!ate) erros.ate = 'dataInvalida';
  else if (de && ate < de) erros.ate = 'fimAntesDoInicio';
  if (!de || !ate || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, periodo: { de, ate } };
}

// Confirmado vale pelo conferido (a divergência aceita confirma com ele);
// a devolução presencial não tem conferido e vale pelo informado.
export function valorConsiderado(linha: LinhaDoRelatorio): number {
  return linha.status === 'confirmado'
    ? (linha.valor_conferido_centavos ?? linha.valor_informado_centavos)
    : linha.valor_informado_centavos;
}

export type Soma = { quantidade: number; centavos: number };

export type Totais = {
  confirmado: Soma;
  porTipo: { dizimo: Soma; oferta: Soma };
  porCampanha: ({ nome: string } & Soma)[];
  pendente: Soma; // aguardando, em conferência ou em divergência: valor informado
  cancelados: number;
};

function somar(soma: Soma, centavos: number) {
  soma.quantidade += 1;
  soma.centavos += centavos;
}

// Totais por tipo e por campanha contam só o confirmado; o que ainda não foi
// conferido aparece à parte, e o cancelado não entra em soma nenhuma.
export function totalizar(linhas: LinhaDoRelatorio[]): Totais {
  const vazio = (): Soma => ({ quantidade: 0, centavos: 0 });
  const totais: Totais = {
    confirmado: vazio(),
    porTipo: { dizimo: vazio(), oferta: vazio() },
    porCampanha: [],
    pendente: vazio(),
    cancelados: 0,
  };
  const campanhas = new Map<string, { nome: string } & Soma>();

  for (const linha of linhas) {
    if (linha.status === 'cancelado') {
      totais.cancelados += 1;
      continue;
    }
    if (linha.status !== 'confirmado') {
      somar(totais.pendente, linha.valor_informado_centavos);
      continue;
    }
    const valor = valorConsiderado(linha);
    somar(totais.confirmado, valor);
    somar(totais.porTipo[linha.tipo], valor);
    if (linha.tipo === 'oferta') {
      const nome = linha.campanhas?.nome ?? '';
      const daCampanha = campanhas.get(nome) ?? { nome, ...vazio() };
      somar(daCampanha, valor);
      campanhas.set(nome, daCampanha);
    }
  }

  totais.porCampanha = [...campanhas.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  return totais;
}

// Centavos para o número que a célula do Excel soma (300,50 -> 300.5). O
// formato da célula mostra sempre duas casas.
export function centavosParaPlanilha(centavos: number): number {
  return Math.round(centavos) / 100;
}

export type Celula = string | number | null;

// Campo de cadastro definido pela igreja (RN-004), como Líder ou Rede.
export type CampoDaPlanilha = { chave: string; rotulo: string };

export type TextosDaPlanilha = {
  colunas: string[];
  camposDoCadastro: CampoDaPlanilha[];
  tipo: (tipo: LinhaDoRelatorio['tipo']) => string;
  status: (status: StatusDoLancamento) => string;
  forma: (forma: string) => string;
  data: (iso: string) => string;
  dataHora: (momento: string) => string;
  quemRegistrou: (linha: LinhaDoRelatorio) => string;
};

// Valor guardado nos campos extras como aparece para quem lê: datas
// AAAA-MM-DD viram DD/MM/AAAA; números continuam números.
function valorDoCampo(camposExtras: unknown, chave: string): Celula {
  const extras = camposExtras && typeof camposExtras === 'object' ? (camposExtras as Record<string, unknown>) : {};
  const valor = extras[chave];
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor === 'number') return valor;
  const texto = String(valor);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto.split('-').reverse().join('/') : texto;
}

// Colunas da seção 9 do Requisitos, na mesma ordem: ID e nome do membro,
// tipo, campanha, data do dízimo, data do registro, valor informado, valor
// conferido, forma, conta de destino, status, tesoureiro, quem registrou.
// Logo depois do nome entram os campos de cadastro da igreja, para separar
// pessoas com nomes parecidos (D-086).
export function linhasDaPlanilha(linhas: LinhaDoRelatorio[], textos: TextosDaPlanilha): Celula[][] {
  const [id, nome, ...resto] = textos.colunas;
  return [
    [id, nome, ...textos.camposDoCadastro.map((c) => c.rotulo), ...resto],
    ...linhas.map((l) => [
      l.membros?.numero ?? null,
      l.membros?.nome ?? '',
      ...textos.camposDoCadastro.map((c) => valorDoCampo(l.membros?.campos_extras, c.chave)),
      textos.tipo(l.tipo),
      l.campanhas?.nome ?? '',
      textos.data(l.data_contribuicao),
      textos.dataHora(l.registrado_em),
      centavosParaPlanilha(l.valor_informado_centavos),
      l.valor_conferido_centavos === null ? null : centavosParaPlanilha(l.valor_conferido_centavos),
      textos.forma(l.forma),
      l.contas?.nome ?? '',
      textos.status(l.status),
      l.confirmado_por_nome ?? '',
      textos.quemRegistrou(l),
    ]),
  ];
}

// Colunas de valor (informado e conferido), para o formato de moeda. Andam
// para a direita uma casa por campo de cadastro.
export function colunasDeValor(quantidadeDeCampos: number): number[] {
  return [6 + quantidadeDeCampos, 7 + quantidadeDeCampos];
}

export function nomeDoArquivo(periodo: Periodo): string {
  return `relatorio-${periodo.de}-a-${periodo.ate}.xlsx`;
}
