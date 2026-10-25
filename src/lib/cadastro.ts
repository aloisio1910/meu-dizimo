import { dataParaIso } from './data';

// Regras do cadastro do membro, usadas no Primeiro acesso (M-02) e no
// Meu perfil (M-10). O banco valida de novo (validar_dados_cadastrais).

export type CampoDoCadastroBase = {
  chave: string;
  rotulo: string;
  tipo: 'texto' | 'data' | 'numero' | 'lista';
  opcoes: string[];
  obrigatorio: boolean;
};

export type DadosDigitados = {
  nome: string;
  celular: string;
  tipoDizimo: 'individual' | 'familiar';
  familiares: string[];
  valores: Record<string, string>; // texto dos campos extras como está na tela
};

export type CodigoDeErroDoCadastro =
  | 'nomeObrigatorio'
  | 'celularObrigatorio'
  | 'familiaresObrigatorios'
  | 'campoObrigatorio'
  | 'campoInvalido' // vem do banco, quando o valor não passa na regra dele
  | 'dataInvalida'
  | 'numeroInvalido';

// Chaves dos erros: "nome", "celular", "familiares" ou "campo:<chave>".
export type ErrosDoCadastro = Record<string, CodigoDeErroDoCadastro>;

// Valores guardados no banco viram texto para os campos da tela
// (datas AAAA-MM-DD aparecem como DD/MM/AAAA).
export function valoresIniciais(camposExtras: unknown): Record<string, string> {
  const extras = camposExtras && typeof camposExtras === 'object' ? (camposExtras as Record<string, unknown>) : {};
  const valores: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(extras)) {
    const texto = String(valor ?? '');
    valores[chave] = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto.split('-').reverse().join('/') : texto;
  }
  return valores;
}

// Lista de familiares guardada como [{ nome }] vira lista de nomes.
export function familiaresIniciais(familiares: unknown): string[] {
  const lista = Array.isArray(familiares) ? familiares : [];
  return lista
    .map((item) => (item && typeof item === 'object' && 'nome' in item ? String((item as { nome: unknown }).nome) : ''))
    .filter(Boolean);
}

// Confere o que foi digitado e monta os campos extras no formato do banco.
export function validarCadastro(
  dados: DadosDigitados,
  campos: CampoDoCadastroBase[],
): { erros: ErrosDoCadastro; camposExtras: Record<string, string | number> } {
  const erros: ErrosDoCadastro = {};
  const camposExtras: Record<string, string | number> = {};

  if (!dados.nome.trim()) erros.nome = 'nomeObrigatorio';
  if (!dados.celular.trim()) erros.celular = 'celularObrigatorio';
  if (dados.tipoDizimo === 'familiar' && dados.familiares.length === 0) erros.familiares = 'familiaresObrigatorios';

  const convertidos = converterValores(dados.valores, campos, true);
  Object.assign(erros, convertidos.erros);
  Object.assign(camposExtras, convertidos.valores);

  return { erros, camposExtras };
}

// Converte o texto digitado em cada campo para o formato do banco (datas
// AAAA-MM-DD, números como número). Usado pelo membro (com obrigatórios) e
// pela tesouraria nos campos dela (D-093, sem obrigatórios).
export function converterValores(
  valores: Record<string, string>,
  campos: CampoDoCadastroBase[],
  exigirObrigatorios: boolean,
): { erros: ErrosDoCadastro; valores: Record<string, string | number> } {
  const erros: ErrosDoCadastro = {};
  const convertidos: Record<string, string | number> = {};
  for (const campo of campos) {
    const texto = (valores[campo.chave] ?? '').trim();
    const chaveDoErro = `campo:${campo.chave}`;
    if (!texto) {
      if (exigirObrigatorios && campo.obrigatorio) erros[chaveDoErro] = 'campoObrigatorio';
      continue;
    }
    if (campo.tipo === 'data') {
      const iso = dataParaIso(texto);
      if (iso) convertidos[campo.chave] = iso;
      else erros[chaveDoErro] = 'dataInvalida';
    } else if (campo.tipo === 'numero') {
      const numero = Number(texto.replace(',', '.'));
      if (Number.isFinite(numero)) convertidos[campo.chave] = numero;
      else erros[chaveDoErro] = 'numeroInvalido';
    } else {
      convertidos[campo.chave] = texto;
    }
  }
  return { erros, valores: convertidos };
}

// Ao salvar, mantém os valores guardados de campos que não estão no
// formulário (ex.: campo que ficou "não usado"), em vez de apagá-los. Um
// campo do formulário deixado em branco é apagado de propósito.
export function mesclarValores(
  guardados: unknown,
  novos: Record<string, string | number>,
  chavesDoFormulario: string[],
): Record<string, unknown> {
  const antes = guardados && typeof guardados === 'object' ? (guardados as Record<string, unknown>) : {};
  const mantidos = Object.fromEntries(Object.entries(antes).filter(([chave]) => !chavesDoFormulario.includes(chave)));
  return { ...mantidos, ...novos };
}
