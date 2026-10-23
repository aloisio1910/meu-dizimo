import { describe, expect, it } from '@jest/globals';

import { validarDizimo } from '../validar-dizimo';

const HOJE = '2026-10-22';

describe('validarDizimo', () => {
  it('aceita valor, data de hoje e forma', () => {
    expect(validarDizimo({ valor: '300,00', data: '22/10/2026', forma: 'pix' }, HOJE)).toEqual({
      ok: true,
      dados: { centavos: 30000, data: '2026-10-22', forma: 'pix' },
    });
  });

  it('aceita data retroativa (RN-011)', () => {
    const resultado = validarDizimo({ valor: '10.000,00', data: '01/01/2025', forma: 'dinheiro' }, HOJE);
    expect(resultado).toEqual({ ok: true, dados: { centavos: 1000000, data: '2025-01-01', forma: 'dinheiro' } });
  });

  it('recusa data futura, mesmo que seja amanhã (D-072)', () => {
    expect(validarDizimo({ valor: '300', data: '23/10/2026', forma: 'pix' }, HOJE)).toEqual({
      ok: false,
      erros: { data: 'dataFutura' },
    });
  });

  it('aponta todos os problemas de uma vez', () => {
    expect(validarDizimo({ valor: '', data: '31/02/2026' }, HOJE)).toEqual({
      ok: false,
      erros: { valor: 'valorInvalido', data: 'dataInvalida', forma: 'escolhaForma' },
    });
  });

  it.each(['0', '0,00', 'abc'])('recusa o valor "%s"', (valor) => {
    const resultado = validarDizimo({ valor, data: '22/10/2026', forma: 'pix' }, HOJE);
    expect(resultado.ok).toBe(false);
  });
});
