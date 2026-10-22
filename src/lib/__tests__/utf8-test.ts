import { describe, expect, it } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'node:util';

import { bytesParaTexto, textoParaBytes } from '../utf8';

const exemplos = [
  '',
  'abc',
  'Dízimo, oferta e ação',
  'Pão, coração, ÇÃO',
  '{"access_token":"x","user":{"nome":"José Antônio"}}',
  'Emoji 🙏 e símbolos € ✓',
];

describe('utf8', () => {
  it.each(exemplos)('gera os mesmos bytes que o padrão para "%s"', (texto) => {
    expect(Array.from(textoParaBytes(texto))).toEqual(Array.from(new TextEncoder().encode(texto)));
  });

  it.each(exemplos)('volta ao mesmo texto: "%s"', (texto) => {
    expect(bytesParaTexto(textoParaBytes(texto))).toBe(texto);
  });

  it('lê bytes gerados pelo padrão', () => {
    const bytes = new TextEncoder().encode('Cartão de Dízimo 🙏');
    expect(bytesParaTexto(bytes)).toBe(new TextDecoder().decode(bytes));
  });
});
