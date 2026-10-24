import * as XLSX from 'xlsx';

import { COLUNAS_DE_VALOR, type Celula } from './relatorio';

// Formato das células de valor: separador de milhar e duas casas. O Excel
// mostra conforme o idioma do computador (1.234,50 no Brasil).
const FORMATO_DE_VALOR = '#,##0.00';

export type AbaDaPlanilha = {
  nome: string;
  linhas: Celula[][];
  colunasDeValor: number[];
};

// Primeira aba: os lançamentos; segunda: filtros usados e totais.
export function abasDoRelatorio(lancamentos: Celula[][], totais: Celula[][], nomes: { lancamentos: string; totais: string }) {
  return [
    { nome: nomes.lancamentos, linhas: lancamentos, colunasDeValor: COLUNAS_DE_VALOR },
    { nome: nomes.totais, linhas: totais, colunasDeValor: [2] },
  ];
}

function larguraDaColuna(linhas: Celula[][], coluna: number): number {
  const maior = Math.max(...linhas.map((l) => String(l[coluna] ?? '').length));
  return Math.min(Math.max(maior + 2, 8), 40);
}

// Monta o arquivo .xlsx e devolve em base64, que serve para a web e para o
// celular.
export function gerarPlanilhaEmBase64(abas: AbaDaPlanilha[]): string {
  const pasta = XLSX.utils.book_new();
  for (const aba of abas) {
    const folha = XLSX.utils.aoa_to_sheet(aba.linhas);
    const colunas = Math.max(...aba.linhas.map((l) => l.length));
    folha['!cols'] = Array.from({ length: colunas }, (_, c) => ({ wch: larguraDaColuna(aba.linhas, c) }));
    aba.linhas.forEach((linha, l) => {
      for (const c of aba.colunasDeValor) {
        const celula = folha[XLSX.utils.encode_cell({ r: l, c })];
        if (celula && typeof linha[c] === 'number') celula.z = FORMATO_DE_VALOR;
      }
    });
    XLSX.utils.book_append_sheet(pasta, folha, aba.nome);
  }
  return XLSX.write(pasta, { type: 'base64', bookType: 'xlsx' });
}
