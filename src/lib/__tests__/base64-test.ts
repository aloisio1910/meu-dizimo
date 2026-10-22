import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'node:buffer';

import { base64ParaBytes, bytesParaBase64 } from '../base64';

// Tamanhos de 0 a 70 bytes cobrem os três casos de sobra (0, 1 ou 2 bytes).
const amostras = Array.from({ length: 71 }, (_, tamanho) =>
  Uint8Array.from({ length: tamanho }, (_, i) => (i * 37 + tamanho * 11) % 256),
);

describe('base64', () => {
  it.each(amostras.map((bytes) => [bytes.length, bytes] as const))(
    'gera o mesmo texto que o padrão para %i bytes',
    (_tamanho, bytes) => {
      expect(bytesParaBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    },
  );

  it.each(amostras.map((bytes) => [bytes.length, bytes] as const))('volta aos mesmos %i bytes', (_tamanho, bytes) => {
    expect(Array.from(base64ParaBytes(bytesParaBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('lê texto gerado pelo padrão, com e sem "="', () => {
    const bytes = Uint8Array.from([0, 255, 128, 64, 1]);
    const padrao = Buffer.from(bytes).toString('base64');
    expect(Array.from(base64ParaBytes(padrao))).toEqual(Array.from(bytes));
    expect(Array.from(base64ParaBytes(padrao.replace(/=+$/, '')))).toEqual(Array.from(bytes));
  });

  it.each(['abc$', 'a', 'ab cd'])('recusa o texto inválido "%s"', (texto) => {
    expect(() => base64ParaBytes(texto)).toThrow();
  });
});
