import { describe, expect, it } from '@jest/globals';
import * as XLSX from 'xlsx';

import { abasDoRelatorio, gerarPlanilhaEmBase64 } from '../planilha-xlsx';

describe('gerarPlanilhaEmBase64', () => {
  const lancamentos = [
    ['ID', 'Nome', 'Tipo', 'Campanha', 'Data', 'Registro', 'Informado', 'Conferido'],
    [3, 'Maria Conceição', 'Dízimo', '', '10/10/2026', '10/10/2026 10:00', 1234.5, null],
  ];
  const totais = [
    ['Total confirmado', 1, 1234.5],
    ['Cancelados', 2, null],
  ];
  const base64 = gerarPlanilhaEmBase64(abasDoRelatorio(lancamentos, totais, { lancamentos: 'Lançamentos', totais: 'Totais' }));
  const pasta = XLSX.read(base64, { type: 'base64', cellNF: true });

  it('cria as duas abas', () => {
    expect(pasta.SheetNames).toEqual(['Lançamentos', 'Totais']);
  });

  it('guarda textos com acento e valores como número, com formato de moeda', () => {
    const folha = pasta.Sheets['Lançamentos'];
    expect(folha.B2.v).toBe('Maria Conceição');
    expect(folha.G2.t).toBe('n');
    expect(folha.G2.v).toBe(1234.5);
    expect(folha.G2.z).toBe('#,##0.00');
    expect(folha.H2).toBeUndefined(); // sem conferido, célula vazia
  });

  it('formata o valor na aba de totais', () => {
    const folha = pasta.Sheets.Totais;
    expect(folha.C1.v).toBe(1234.5);
    expect(folha.C1.z).toBe('#,##0.00');
  });
});
