import { describe, expect, it } from '@jest/globals';

import { linkDoMapa } from '../mapa';

describe('linkDoMapa', () => {
  it('monta o link do Google Maps com o endereço codificado', () => {
    expect(linkDoMapa(' Rua 10, nº 200 - Setor Oeste, Goiânia ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%2010%2C%20n%C2%BA%20200%20-%20Setor%20Oeste%2C%20Goi%C3%A2nia',
    );
  });
});
