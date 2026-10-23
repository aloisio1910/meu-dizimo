import { describe, expect, it } from '@jest/globals';

import { caminhoDoComprovante, formatoPeloConteudo } from '../comprovante';

const bytes = (texto: string, ...prefixo: number[]) =>
  Uint8Array.from([...prefixo, ...Array.from(texto, (c) => c.charCodeAt(0))]);

describe('formatoPeloConteudo', () => {
  it('reconhece PDF pelo início %PDF', () => {
    expect(formatoPeloConteudo(bytes('%PDF-1.7\n...'))).toBe('pdf');
  });

  it('reconhece PNG pela assinatura de 8 bytes', () => {
    expect(formatoPeloConteudo(bytes('IHDR', 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });

  it('reconhece JPEG pelo início FF D8 FF', () => {
    expect(formatoPeloConteudo(bytes('JFIF', 0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
  });

  it.each([
    ['Word', bytes('rest', 0xd0, 0xcf, 0x11, 0xe0)],
    ['HEIC', bytes('ftypheic', 0x00, 0x00, 0x00, 0x18)],
    ['texto', bytes('Comprovante')],
    ['vazio', new Uint8Array()],
  ])('recusa %s', (_nome, conteudo) => {
    expect(formatoPeloConteudo(conteudo)).toBeNull();
  });
});

describe('caminhoDoComprovante', () => {
  it('segue o formato que a regra do Storage exige: igreja/lançamento/arquivo', () => {
    expect(caminhoDoComprovante('igreja-1', 'lanc-2', 'abc', 'pdf')).toBe('igreja-1/lanc-2/abc.pdf');
  });
});
