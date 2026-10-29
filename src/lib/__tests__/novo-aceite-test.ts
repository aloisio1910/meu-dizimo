import { describe, expect, it } from '@jest/globals';

import { listaDeNomes, precisaDoNovoAceite } from '../novo-aceite';

describe('precisaDoNovoAceite', () => {
  const base = { ehAdminMaster: false, statusDasFichas: ['ativo'], aceitouAVersaoAtual: false };

  it('pede o aceite a quem usa o app e não aceitou a versão atual', () => {
    expect(precisaDoNovoAceite(base)).toBe(true);
    expect(precisaDoNovoAceite({ ...base, statusDasFichas: ['convidado', 'ativo'] })).toBe(true);
  });

  it('não pede a quem já aceitou, nem enquanto confere ou se a conferência falhou', () => {
    expect(precisaDoNovoAceite({ ...base, aceitouAVersaoAtual: true })).toBe(false);
    expect(precisaDoNovoAceite({ ...base, aceitouAVersaoAtual: undefined })).toBe(false);
  });

  it('não pede ao convidado (aceita no Primeiro acesso), a quem não tem igreja nem ao Admin Master', () => {
    expect(precisaDoNovoAceite({ ...base, statusDasFichas: ['convidado'] })).toBe(false);
    expect(precisaDoNovoAceite({ ...base, statusDasFichas: [] })).toBe(false);
    expect(precisaDoNovoAceite({ ...base, ehAdminMaster: true })).toBe(false);
  });
});

describe('listaDeNomes', () => {
  it('junta os nomes como numa frase', () => {
    expect(listaDeNomes([], 'e')).toBe('');
    expect(listaDeNomes(['Videira'], 'e')).toBe('Videira');
    expect(listaDeNomes(['Videira', 'Central'], 'e')).toBe('Videira e Central');
    expect(listaDeNomes(['Videira', 'Central', 'Sede'], 'e')).toBe('Videira, Central e Sede');
  });
});
