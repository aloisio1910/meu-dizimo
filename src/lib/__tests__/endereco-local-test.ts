import { describe, expect, it } from '@jest/globals';

import { ajustarEnderecoLocal, enderecoDeProducaoValido } from '../endereco-local';

describe('ajustarEnderecoLocal', () => {
  it('troca o IP antigo do .env pelo IP atual do computador', () => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321', '192.168.100.31:8081')).toBe('http://192.168.100.31:54321');
  });

  it('mantém o caminho depois da porta', () => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321/rest/v1', '10.0.0.5:8081')).toBe('http://10.0.0.5:54321/rest/v1');
  });

  it('no navegador do próprio computador, usa localhost', () => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321', 'localhost:8081')).toBe('http://localhost:54321');
  });

  it('nunca altera o endereço do Supabase na nuvem', () => {
    expect(ajustarEnderecoLocal('https://jcwogclevhpvrdsohzuf.supabase.co', '192.168.100.31:8081')).toBe(
      'https://jcwogclevhpvrdsohzuf.supabase.co',
    );
  });

  it('no modo túnel, não há IP para usar e o .env vale', () => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321', 'abc-anonymous-8081.exp.direct')).toBe(
      'http://192.168.100.30:54321',
    );
  });

  it.each([null, undefined, ''])('sem informação do Expo (%p), o .env vale', (host) => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321', host)).toBe('http://192.168.100.30:54321');
  });

  it('não confunde um IP público com rede local', () => {
    expect(ajustarEnderecoLocal('http://192.168.100.30:54321', '200.150.10.1:8081')).toBe('http://192.168.100.30:54321');
  });
});

describe('enderecoDeProducaoValido', () => {
  it('aceita o Supabase na nuvem', () => {
    expect(enderecoDeProducaoValido('https://jcwogclevhpvrdsohzuf.supabase.co')).toBe(true);
  });

  it('recusa o Supabase do computador e endereços sem https', () => {
    expect(enderecoDeProducaoValido('http://192.168.100.30:54321')).toBe(false);
    expect(enderecoDeProducaoValido('https://192.168.100.30:54321')).toBe(false);
    expect(enderecoDeProducaoValido('https://localhost:54321')).toBe(false);
    expect(enderecoDeProducaoValido('http://jcwogclevhpvrdsohzuf.supabase.co')).toBe(false);
    expect(enderecoDeProducaoValido('')).toBe(false);
  });
});
