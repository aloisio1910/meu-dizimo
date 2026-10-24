import { describe, expect, it } from '@jest/globals';

import { linkDoWhatsApp } from '../whatsapp';

describe('linkDoWhatsApp', () => {
  it.each([
    ['(62) 99999-8888', 'https://wa.me/5562999998888'],
    ['62 3333-4444', 'https://wa.me/556233334444'],
    ['+55 62 99999-8888', 'https://wa.me/5562999998888'],
    ['5562999998888', 'https://wa.me/5562999998888'],
  ])('"%s" abre %s', (numero, link) => {
    expect(linkDoWhatsApp(numero)).toBe(link);
  });

  it.each([null, undefined, '', '9999-8888', 'sem número'])('sem número válido (%p), não há link', (numero) => {
    expect(linkDoWhatsApp(numero)).toBeNull();
  });
});
