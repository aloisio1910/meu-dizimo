import { describe, expect, it } from '@jest/globals';

import { minutosRestantes, tempoRestanteParaDesfazer } from '../desfazer';

const EU = 'tesoureiro-1';
const confirmadoAs = (iso: string) => ({
  status: 'confirmado',
  confirmado_por: EU,
  confirmado_em: iso,
  resposta_membro: null,
});

describe('tempoRestanteParaDesfazer', () => {
  const agora = new Date('2026-10-24T12:10:00Z');

  it('dá o tempo que falta dentro dos 15 minutos', () => {
    expect(tempoRestanteParaDesfazer(confirmadoAs('2026-10-24T12:00:00Z'), EU, agora)).toBe(5 * 60 * 1000);
  });

  it('zera depois dos 15 minutos', () => {
    expect(tempoRestanteParaDesfazer(confirmadoAs('2026-10-24T11:54:59Z'), EU, agora)).toBe(0);
  });

  it('zera para outro tesoureiro', () => {
    expect(tempoRestanteParaDesfazer(confirmadoAs('2026-10-24T12:09:00Z'), 'outro', agora)).toBe(0);
  });

  it('zera quando quem decidiu foi o membro (aceitou a divergência)', () => {
    expect(
      tempoRestanteParaDesfazer({ ...confirmadoAs('2026-10-24T12:09:00Z'), resposta_membro: 'aceita' }, EU, agora),
    ).toBe(0);
  });

  it('zera para lançamento que não está confirmado', () => {
    expect(tempoRestanteParaDesfazer({ ...confirmadoAs('2026-10-24T12:09:00Z'), status: 'aguardando' }, EU, agora)).toBe(0);
  });
});

describe('minutosRestantes', () => {
  it.each([
    [5 * 60 * 1000, 5],
    [4 * 60 * 1000 + 1, 5],
    [1, 1],
    [0, 0],
  ])('%i ms viram %i minutos', (ms, minutos) => {
    expect(minutosRestantes(ms)).toBe(minutos);
  });
});
