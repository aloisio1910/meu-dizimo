import { describe, expect, it } from '@jest/globals';

import { MAXIMO_EM_CENTAVOS, completarValor, formatarMoeda, mascararValor, textoParaCentavos } from '../dinheiro';

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
    ['1000', '1.000'],
    ['10000', '10.000'],
    ['1000000', '1.000.000'],
    ['300,', '300,'],
    ['300,5', '300,5'],
    ['300,555', '300,55'],
    ['10.000,5', '10.000,5'],
    ['00300', '300'],
    [',5', '0,5'],
    ['3a0b0', '300'],
    ['1,2,3', '1,23'],
    // Teclado que usa ponto como vírgula decimal: o ponto no fim vira vírgula.
    ['300.', '300,'],
    ['300.5', '3.005'], // ponto no meio não é decimal: o campo nunca deixa um ponto assim
    // Apagando um dígito, os pontos se reorganizam.
    ['10.00', '1.000'],
    ['1.0000', '10.000'],
    // Limite de R$ 999.999.999,99.
    ['9999999999', '999.999.999'],
  ])('enquanto digita "%s" mostra "%s"', (digitado, esperado) => {
    expect(mascararValor(digitado)).toBe(esperado);
  });

  it('digitar número a número mostra a pontuação a cada passo', () => {
    let campo = '';
    const telas: string[] = [];
    for (const tecla of '1000050') {
      campo = mascararValor(campo + tecla);
      telas.push(campo);
    }
    expect(telas).toEqual(['1', '10', '100', '1.000', '10.000', '100.005', '1.000.050']);
  });

  it('digitar com vírgula decimal pelo ponto do teclado chega no valor certo', () => {
    let campo = '';
    for (const tecla of '300.50') campo = mascararValor(campo + tecla);
    expect(campo).toBe('300,50');
    expect(textoParaCentavos(campo)).toBe(30050);
  });
});

describe('completarValor', () => {
  it.each([
    ['10.000', '10.000,00'],
    ['300,5', '300,50'],
    ['300,', '300,00'],
    [',5', '0,50'],
    ['', ''],
  ])('ao sair do campo, "%s" vira "%s"', (digitado, esperado) => {
    expect(completarValor(digitado)).toBe(esperado);
  });

  it('o valor completado é lido corretamente', () => {
    expect(textoParaCentavos(completarValor('10.000'))).toBe(1000000);
  });
});
