import { describe, expect, it } from '@jest/globals';

import { dataParaIso, hojeIso, isoParaData, mascararData, partesDaDataHora } from '../data';

describe('partesDaDataHora', () => {
  it('mostra no horário de Brasília um momento gravado em UTC', () => {
    expect(partesDaDataHora('2026-10-22T23:53:00Z', 'pt-BR', 'America/Sao_Paulo')).toEqual({
      dia: '22/10/2026',
      hora: '20:53',
    });
  });

  it('muda de dia quando o UTC já virou e Brasília ainda não', () => {
    expect(partesDaDataHora('2026-10-23T01:30:00Z', 'pt-BR', 'America/Sao_Paulo')).toEqual({
      dia: '22/10/2026',
      hora: '22:30',
    });
  });
});

describe('hojeIso', () => {
  it('usa o dia do relógio local, não o do UTC', () => {
    // 21/10/2026 às 22h30 no horário local
    expect(hojeIso(new Date(2026, 9, 21, 22, 30))).toBe('2026-10-21');
  });

  it('completa mês e dia com zero', () => {
    expect(hojeIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isoParaData', () => {
  it('mostra no formato brasileiro', () => {
    expect(isoParaData('2026-10-12')).toBe('12/10/2026');
  });

  it('volta ao mesmo valor ao converter de novo', () => {
    expect(dataParaIso(isoParaData('2024-02-29'))).toBe('2024-02-29');
  });
});

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
