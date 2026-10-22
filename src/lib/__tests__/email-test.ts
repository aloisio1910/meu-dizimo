import { describe, expect, it } from '@jest/globals';

import { emailValido, normalizarEmail } from '../email';

describe('normalizarEmail', () => {
  it('tira espaços e deixa em minúsculas, como o banco guarda', () => {
    expect(normalizarEmail('  Maria.Silva@Email.COM ')).toBe('maria.silva@email.com');
  });
});

describe('emailValido', () => {
  it.each(['maria@email.com', 'joao.silva+dizimo@igreja.org.br', ' Maria@Email.com '])('aceita %s', (email) => {
    expect(emailValido(email)).toBe(true);
  });

  it.each(['', 'maria', 'maria@', 'maria@email', '@email.com', 'maria silva@email.com', 'maria@@email.com'])(
    'recusa "%s"',
    (email) => {
      expect(emailValido(email)).toBe(false);
    },
  );
});
