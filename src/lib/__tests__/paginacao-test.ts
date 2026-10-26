import { describe, expect, it } from '@jest/globals';

import { paginasVisiveis, totalDePaginas } from '../paginacao';

describe('totalDePaginas', () => {
  it('arredonda para cima e nunca é zero', () => {
    expect(totalDePaginas(26, 20)).toBe(2);
    expect(totalDePaginas(20, 20)).toBe(1);
    expect(totalDePaginas(0, 20)).toBe(1);
  });
});

describe('paginasVisiveis', () => {
  it('poucas páginas: todas', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1]);
    expect(paginasVisiveis(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('no meio: primeira, vizinhas da atual e última', () => {
    expect(paginasVisiveis(6, 12)).toEqual([1, 'salto', 4, 5, 6, 7, 8, 'salto', 12]);
  });

  it('no começo e no fim', () => {
    expect(paginasVisiveis(1, 12)).toEqual([1, 2, 3, 'salto', 12]);
    expect(paginasVisiveis(12, 12)).toEqual([1, 'salto', 10, 11, 12]);
  });

  it('buraco de um número só mostra o número, não "…"', () => {
    expect(paginasVisiveis(4, 12)).toEqual([1, 2, 3, 4, 5, 6, 'salto', 12]);
  });
});
