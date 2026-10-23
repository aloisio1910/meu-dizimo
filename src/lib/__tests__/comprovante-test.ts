import { describe, expect, it } from '@jest/globals';

import { caminhoDoComprovante, formatoDoArquivo } from '../comprovante';

describe('formatoDoArquivo', () => {
  it.each([
    ['application/pdf', null, 'pdf'],
    ['image/jpeg', null, 'jpg'],
    ['IMAGE/PNG', null, 'png'],
    [null, 'comprovante.PDF', 'pdf'],
    [null, 'foto.jpeg', 'jpg'],
    [undefined, 'print.png', 'png'],
  ] as [string | null | undefined, string | null, string][])('tipo %p e nome %p viram %s', (tipo, nome, esperado) => {
    expect(formatoDoArquivo(tipo, nome)).toBe(esperado);
  });

  it.each([
    ['image/heic', 'foto.heic'],
    ['application/msword', 'recibo.doc'],
    [null, 'sem-extensao'],
    [null, null],
    // O tipo informado vale mais que o nome: um HEIC renomeado para .jpg não passa.
    ['image/heic', 'foto.jpg'],
  ])('recusa tipo %p com nome %p', (tipo, nome) => {
    expect(formatoDoArquivo(tipo, nome)).toBeNull();
  });
});

describe('caminhoDoComprovante', () => {
  it('segue o formato que a regra do Storage exige: igreja/lançamento/arquivo', () => {
    expect(caminhoDoComprovante('igreja-1', 'lanc-2', 'abc', 'pdf')).toBe('igreja-1/lanc-2/abc.pdf');
  });
});
