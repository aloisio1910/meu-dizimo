import { describe, expect, it } from '@jest/globals';

import { confirmacaoValida } from '../excluir-conta';

describe('confirmacaoValida', () => {
  it('aceita EXCLUIR, com ou sem maiúsculas e espaços nas pontas', () => {
    expect(confirmacaoValida('EXCLUIR')).toBe(true);
    expect(confirmacaoValida(' excluir ')).toBe(true);
  });

  it('recusa qualquer outra coisa', () => {
    expect(confirmacaoValida('')).toBe(false);
    expect(confirmacaoValida('excluir conta')).toBe(false);
    expect(confirmacaoValida('EXCLUI')).toBe(false);
  });
});
