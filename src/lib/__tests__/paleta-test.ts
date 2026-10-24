import { describe, expect, it } from '@jest/globals';

import { razaoDeContraste } from '../contraste';
import { CONTRASTE_MINIMO, corSegura, PALETA } from '../paleta';

describe('PALETA', () => {
  it.each(PALETA.map((p) => [p.nome, p.cor]))('%s (%s) tem contraste de 7:1 com o branco', (_nome, cor) => {
    expect(razaoDeContraste(cor, '#FFFFFF')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
  });

  it('não repete cores nem nomes', () => {
    expect(new Set(PALETA.map((p) => p.cor)).size).toBe(PALETA.length);
    expect(new Set(PALETA.map((p) => p.nome)).size).toBe(PALETA.length);
  });
});

describe('corSegura', () => {
  const padrao = '#1E4FA3';

  it('usa a cor da igreja quando tem contraste', () => {
    expect(corSegura('#5B2C83', padrao)).toBe('#5B2C83');
  });

  it('volta à padrão com cor clara, inválida ou vazia', () => {
    expect(corSegura('#FFD54F', padrao)).toBe(padrao); // amarelo claro
    expect(corSegura('#4A90E2', padrao)).toBe(padrao); // azul médio: 3,3:1
    expect(corSegura('azul', padrao)).toBe(padrao);
    expect(corSegura(null, padrao)).toBe(padrao);
  });
});
