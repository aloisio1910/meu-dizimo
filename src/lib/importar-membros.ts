import * as XLSX from 'xlsx';

import { validarConvite } from './membros';

// Importar membros por planilha (B2, D-107): a tesouraria sobe uma planilha
// (Excel ou CSV) com nome, e-mail e celular, confere a prévia e o app cria os
// convites. Esta parte só lê e confere; quem convida é o banco.

export const LIMITE_POR_IMPORTACAO = 500;

export type PessoaDaPlanilha = { linha: number; nome: string; email: string; celular: string };

export type MotivoDoProblema = 'nomeObrigatorio' | 'emailInvalido' | 'celularObrigatorio' | 'emailRepetidoNaPlanilha';

export type ProblemaDaPlanilha = { linha: number; motivos: MotivoDoProblema[] };

export type LeituraDaPlanilha =
  | { ok: true; pessoas: PessoaDaPlanilha[]; problemas: ProblemaDaPlanilha[]; acimaDoLimite: boolean }
  | { ok: false; erro: 'arquivoIlegivel' | 'semCabecalho' | 'vazia' };

// "E-mail", "e mail" e "EMAIL" viram "email": sem acento, espaço nem traço.
function simplificar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

// Nomes de coluna aceitos, já simplificados.
const COLUNAS = {
  nome: ['nome', 'nomecompleto', 'membro'],
  email: ['email', 'mail', 'correioeletronico'],
  celular: ['celular', 'telefone', 'whatsapp', 'fone', 'cel', 'contato'],
};

type Colunas = { nome: number; email: number; celular: number };

function acharColunas(cabecalho: unknown[]): Colunas | null {
  const nomes = cabecalho.map(simplificar);
  const achar = (aceitos: string[]) => nomes.findIndex((n) => aceitos.includes(n));
  const colunas = { nome: achar(COLUNAS.nome), email: achar(COLUNAS.email), celular: achar(COLUNAS.celular) };
  return colunas.nome >= 0 && colunas.email >= 0 && colunas.celular >= 0 ? colunas : null;
}

const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor).trim());

// O cabeçalho é a primeira das 5 primeiras linhas que tem as três colunas
// (a planilha pode ter um título antes). O número de cada pessoa é a linha
// dela no Excel, que começa em 1, para a tesouraria achar o que corrigir.
export function analisarLinhas(matriz: unknown[][]): LeituraDaPlanilha {
  const inicio = matriz.slice(0, 5).findIndex((linha) => acharColunas(linha) !== null);
  if (inicio < 0) return { ok: false, erro: 'semCabecalho' };
  const colunas = acharColunas(matriz[inicio]) as Colunas;

  const pessoas: PessoaDaPlanilha[] = [];
  const problemas: ProblemaDaPlanilha[] = [];
  const emails = new Set<string>();

  matriz.slice(inicio + 1).forEach((linha, i) => {
    const numero = inicio + i + 2;
    const campos = {
      nome: texto(linha[colunas.nome]),
      email: texto(linha[colunas.email]),
      celular: texto(linha[colunas.celular]),
    };
    if (!campos.nome && !campos.email && !campos.celular) return;
    const validacao = validarConvite(campos);
    if (!validacao.ok) {
      problemas.push({ linha: numero, motivos: Object.values(validacao.erros) as MotivoDoProblema[] });
      return;
    }
    if (emails.has(validacao.dados.email)) {
      problemas.push({ linha: numero, motivos: ['emailRepetidoNaPlanilha'] });
      return;
    }
    emails.add(validacao.dados.email);
    pessoas.push({ linha: numero, ...validacao.dados });
  });

  if (pessoas.length === 0 && problemas.length === 0) return { ok: false, erro: 'vazia' };
  return {
    ok: true,
    pessoas: pessoas.slice(0, LIMITE_POR_IMPORTACAO),
    problemas,
    acimaDoLimite: pessoas.length > LIMITE_POR_IMPORTACAO,
  };
}

// Excel (.xlsx, .xls) ou CSV: usa a primeira aba.
export function lerPlanilhaDeMembros(bytes: Uint8Array): LeituraDaPlanilha {
  try {
    const pasta = XLSX.read(bytes, { type: 'array', raw: false });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    if (!aba) return { ok: false, erro: 'vazia' };
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: '', raw: false });
    return analisarLinhas(matriz);
  } catch {
    return { ok: false, erro: 'arquivoIlegivel' };
  }
}

// O modelo que a tesouraria baixa para preencher.
export const CABECALHO_DO_MODELO = ['Nome', 'E-mail', 'Celular'];
export const EXEMPLO_DO_MODELO = ['Maria da Silva', 'maria@exemplo.com', '(62) 99999-0000'];
