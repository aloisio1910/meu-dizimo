import { describe, expect, it } from '@jest/globals';

import { dataParaIso, mascararData } from '../data';

describe('mascararData', () => {
  it.each([
    ['1', '1'],
    ['17', '17'],
    ['170', '17/0'],
    ['1705', '17/05'],
    ['17051990', '17/05/1990'],
  ])('enquanto digita "%s" mostra "%s"', (digitado, esperado) => {
    expect(mascararData(digitado)).toBe(esperado);
  });

  it('ignora letras e símbolos', () => {
    expect(mascararData('17/05/1990')).toBe('17/05/1990');
    expect(mascararData('17-05-1990x')).toBe('17/05/1990');
  });

  it('não passa de 8 números', () => {
    expect(mascararData('170519901234')).toBe('17/05/1990');
  });
});

describe('dataParaIso', () => {
  it('converte para o formato do banco', () => {
    expect(dataParaIso('17/05/1990')).toBe('1990-05-17');
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(dataParaIso('29/02/2024')).toBe('2024-02-29');
  });

  it.each(['30/02/2026', '29/02/2026', '31/04/2026', '00/01/2026', '15/13/2026'])('recusa a data inexistente %s', (data) => {
    expect(dataParaIso(data)).toBeNull();
  });

  it.each(['1/5/1990', '17/05/90', '17051990', '', '17/05/1990 '])('recusa o formato incompleto "%s"', (data) => {
    expect(dataParaIso(data)).toBeNull();
  });
});
