import { describe, expect, it } from '@jest/globals';

import { fichaEmUso, nomeDaPreferencia, precisaEscolherIgreja } from '../igreja-em-uso';

const a = { igreja_id: 'A', status: 'ativo' };
const b = { igreja_id: 'B', status: 'ativo' };
const bInativa = { igreja_id: 'B', status: 'inativo' };
const cConvidada = { igreja_id: 'C', status: 'convidado' };

describe('fichaEmUso', () => {
  it('usa a igreja escolhida', () => {
    expect(fichaEmUso([a, b], 'B')).toBe(b);
  });

  it('sem escolha, a primeira ativa', () => {
    expect(fichaEmUso([cConvidada, a, b], null)).toBe(a);
  });

  it('escolha que não vale mais (inativo lá) cai na primeira ativa', () => {
    expect(fichaEmUso([a, bInativa], 'B')).toBe(a);
  });

  it('sem nenhuma ativa, nada', () => {
    expect(fichaEmUso([cConvidada, bInativa], 'B')).toBeUndefined();
  });
});

describe('precisaEscolherIgreja', () => {
  it('só quem tem mais de uma igreja ativa e ainda não escolheu', () => {
    expect(precisaEscolherIgreja([a, b], null)).toBe(true);
    expect(precisaEscolherIgreja([a, b], 'A')).toBe(false);
    expect(precisaEscolherIgreja([a], null)).toBe(false);
    expect(precisaEscolherIgreja([a, bInativa], null)).toBe(false);
  });

  it('pergunta de novo se a escolhida deixou de valer', () => {
    expect(precisaEscolherIgreja([a, b, { igreja_id: 'X', status: 'inativo' }], 'X')).toBe(true);
  });
});

describe('nomeDaPreferencia', () => {
  it('uma escolha por login no mesmo aparelho', () => {
    expect(nomeDaPreferencia('u1')).toBe('meudizimo.igreja.u1');
  });
});
