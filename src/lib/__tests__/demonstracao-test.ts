import { describe, expect, it } from '@jest/globals';

import { ehEmailDeDemonstracao } from '../demonstracao';

describe('ehEmailDeDemonstracao', () => {
  it('reconhece as contas de demonstração, sem diferença de maiúsculas e espaços', () => {
    expect(ehEmailDeDemonstracao('membro@demonstracao.invalid')).toBe(true);
    expect(ehEmailDeDemonstracao(' Pastor@Demonstracao.INVALID ')).toBe(true);
  });

  it('não confunde com outros e-mails', () => {
    expect(ehEmailDeDemonstracao('maria@teste.local')).toBe(false);
    expect(ehEmailDeDemonstracao('demonstracao.invalid@gmail.com')).toBe(false);
    expect(ehEmailDeDemonstracao('membro@demonstracao.invalid.com')).toBe(false);
  });
});
