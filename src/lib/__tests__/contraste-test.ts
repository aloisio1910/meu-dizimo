import { describe, expect, it } from '@jest/globals';

import { cores, coresDeStatus, corPrincipalPadrao } from '@/theme';

import { corDoTextoSobre, razaoDeContraste } from '../contraste';

// WCAG AA: texto comum precisa de contraste de pelo menos 4,5:1.
const MINIMO_WCAG_AA = 4.5;

describe('razaoDeContraste', () => {
  it('dá 21:1 entre preto e branco, o máximo possível', () => {
    expect(razaoDeContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('dá 1:1 entre cores iguais', () => {
    expect(razaoDeContraste('#1E4FA3', '#1E4FA3')).toBeCloseTo(1, 5);
  });

  it('não depende da ordem das cores', () => {
    expect(razaoDeContraste('#FFFFFF', '#1E4FA3')).toBeCloseTo(razaoDeContraste('#1E4FA3', '#FFFFFF'), 10);
  });
});

describe('corDoTextoSobre', () => {
  it('usa texto branco sobre cores escuras', () => {
    expect(corDoTextoSobre('#1E4FA3')).toBe('#FFFFFF');
    expect(corDoTextoSobre('#000000')).toBe('#FFFFFF');
  });

  it('usa texto preto sobre cores claras', () => {
    expect(corDoTextoSobre('#FFD54F')).toBe('#000000');
    expect(corDoTextoSobre('#FFFFFF')).toBe('#000000');
  });

  // Varre todos os tons de cinza e uma grade de cores: não há cor de igreja
  // que deixe o texto do botão principal abaixo do mínimo.
  it('garante o contraste mínimo para qualquer cor', () => {
    const passos = [0, 51, 102, 119, 136, 153, 204, 255];
    const paraHex = (n: number) => n.toString(16).padStart(2, '0');
    let pior = Infinity;
    for (const r of passos) {
      for (const g of passos) {
        for (const b of passos) {
          const cor = `#${paraHex(r)}${paraHex(g)}${paraHex(b)}`;
          pior = Math.min(pior, razaoDeContraste(cor, corDoTextoSobre(cor)));
        }
      }
    }
    for (let cinza = 0; cinza <= 255; cinza++) {
      const cor = `#${paraHex(cinza).repeat(3)}`;
      pior = Math.min(pior, razaoDeContraste(cor, corDoTextoSobre(cor)));
    }
    expect(pior).toBeGreaterThanOrEqual(MINIMO_WCAG_AA);
  });

  // Qualquer cor que a igreja escolher continua legível nos botões.
  it.each(['#1E4FA3', '#2E7D32', '#C62828', '#FFD54F', '#00BCD4', '#9C27B0', '#FF9800', '#777777'])(
    'garante contraste mínimo com a cor %s',
    (cor) => {
      expect(razaoDeContraste(cor, corDoTextoSobre(cor))).toBeGreaterThanOrEqual(MINIMO_WCAG_AA);
    },
  );
});

describe('cores do tema', () => {
  it.each([
    ['texto', cores.texto],
    ['textoApoio', cores.textoApoio],
    ['erro', cores.erro],
    ['desabilitado', cores.desabilitado],
    ['corPrincipalPadrao', corPrincipalPadrao],
  ])('%s tem contraste mínimo sobre o fundo branco', (_nome, cor) => {
    expect(razaoDeContraste(cor, cores.fundo)).toBeGreaterThanOrEqual(MINIMO_WCAG_AA);
  });

  it.each(Object.entries(coresDeStatus))('selo de status "%s" tem texto legível', (_status, { fundo, texto }) => {
    expect(razaoDeContraste(texto, fundo)).toBeGreaterThanOrEqual(MINIMO_WCAG_AA);
  });
});
