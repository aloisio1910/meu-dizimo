import { describe, expect, it } from '@jest/globals';

import { MAXIMO_EM_CENTAVOS, formatarMoeda, mascararValor, textoParaCentavos } from '../dinheiro';

describe('textoParaCentavos', () => {
  it.each([
    ['300', 30000],
    ['300,00', 30000],
    ['300,5', 30050],
    ['0,01', 1],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['999.999.999,99', MAXIMO_EM_CENTAVOS],
  ])('"%s" vira %i centavos', (texto, centavos) => {
    expect(textoParaCentavos(texto)).toBe(centavos);
  });

  it.each(['', '0', '0,00', 'abc', '300,001', '1.23,45', '-50', '300.00', '1.000.000.000,00'])(
    'recusa "%s"',
    (texto) => {
      expect(textoParaCentavos(texto)).toBeNull();
    },
  );

  it('nunca usa float: 0,1 + 0,2 continua exato em centavos', () => {
    expect((textoParaCentavos('0,1') ?? 0) + (textoParaCentavos('0,2') ?? 0)).toBe(30);
  });
});

describe('formatarMoeda', () => {
  // O Intl separa "R$" do número com um espaço que não quebra a linha.
  const semEspacoEspecial = (texto: string) => texto.replace(/ /g, ' ');

  it.each([
    [30000, 'R$ 300,00'],
    [1, 'R$ 0,01'],
    [123456789, 'R$ 1.234.567,89'],
  ])('%i centavos aparece como %s', (centavos, esperado) => {
    expect(semEspacoEspecial(formatarMoeda(centavos, 'BRL', 'pt-BR'))).toBe(esperado);
  });
});

describe('mascararValor', () => {
  it.each([
    ['3', '3'],
    ['300', '300'],
    ['300,', '300,'],
    ['300,5', '300,5'],
    ['300,555', '300,55'],
    ['00300', '300'],
    [',5', '0,5'],
    ['3a0b0', '300'],
    ['1,2,3', '1,23'],
  ])('enquanto digita "%s" mostra "%s"', (digitado, esperado) => {
    expect(mascararValor(digitado)).toBe(esperado);
  });
});
