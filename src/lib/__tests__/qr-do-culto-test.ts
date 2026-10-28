import { describe, expect, it } from '@jest/globals';

import { guardarDestinoDepoisDoLogin, retirarDestinoDepoisDoLogin } from '../destino-depois-do-login';
import { caminhoDoQr, lerQr, linkDoQr } from '../qr-do-culto';

const IGREJA = '00000000-0000-4000-8000-000000000001';
const CAMPANHA = '6a000000-0000-4000-8000-0000000000aa';

describe('linkDoQr', () => {
  it('dízimo e campanha, com a igreja junto', () => {
    expect(linkDoQr('https://meudizimo.app/', IGREJA, { tipo: 'dizimo' })).toBe(
      `https://meudizimo.app/qr?igreja=${IGREJA}&ir=dizimo`,
    );
    expect(linkDoQr('https://meudizimo.app', IGREJA, { tipo: 'campanha', campanhaId: CAMPANHA })).toBe(
      `https://meudizimo.app/qr?igreja=${IGREJA}&ir=campanha&campanha=${CAMPANHA}`,
    );
  });

  it('o caminho interno é o mesmo link sem o domínio', () => {
    expect(caminhoDoQr(IGREJA, { tipo: 'dizimo' })).toBe(`/qr?igreja=${IGREJA}&ir=dizimo`);
  });
});

describe('lerQr', () => {
  it('lê o que o link montou', () => {
    expect(lerQr({ igreja: IGREJA, ir: 'dizimo' })).toEqual({ igrejaId: IGREJA, destino: { tipo: 'dizimo' } });
    expect(lerQr({ igreja: IGREJA, ir: 'campanha', campanha: CAMPANHA })).toEqual({
      igrejaId: IGREJA,
      destino: { tipo: 'campanha', campanhaId: CAMPANHA },
    });
  });

  it('QR estranho ou adulterado não leva a lugar nenhum', () => {
    expect(lerQr({ igreja: 'abc', ir: 'dizimo' })).toBeNull();
    expect(lerQr({ igreja: IGREJA, ir: 'apagar' })).toBeNull();
    expect(lerQr({ igreja: IGREJA, ir: 'campanha', campanha: '../admin' })).toBeNull();
    expect(lerQr({})).toBeNull();
  });
});

describe('destino depois do login', () => {
  it('guarda, devolve uma vez e esquece', () => {
    guardarDestinoDepoisDoLogin('/qr?igreja=x&ir=dizimo');
    expect(retirarDestinoDepoisDoLogin()).toBe('/qr?igreja=x&ir=dizimo');
    expect(retirarDestinoDepoisDoLogin()).toBeNull();
  });

  it('nunca guarda endereço de fora do app', () => {
    guardarDestinoDepoisDoLogin('https://golpe.example');
    guardarDestinoDepoisDoLogin('//golpe.example');
    expect(retirarDestinoDepoisDoLogin()).toBeNull();
  });
});
