import { describe, expect, it } from '@jest/globals';

import { familiaresIniciais, validarCadastro, valoresIniciais, type CampoDoCadastroBase } from '../cadastro';

const campos: CampoDoCadastroBase[] = [
  { chave: 'lider', rotulo: 'Líder', tipo: 'texto', opcoes: [], obrigatorio: true },
  { chave: 'nascimento', rotulo: 'Nascimento', tipo: 'data', opcoes: [], obrigatorio: false },
  { chave: 'filhos', rotulo: 'Filhos', tipo: 'numero', opcoes: [], obrigatorio: false },
  { chave: 'rede', rotulo: 'Rede', tipo: 'lista', opcoes: ['Norte', 'Sul'], obrigatorio: false },
];

const base = {
  nome: 'Maria',
  celular: '62999990000',
  tipoDizimo: 'individual' as const,
  familiares: [],
  valores: { lider: 'Carolina' },
};

describe('valoresIniciais', () => {
  it('mostra datas do banco no formato brasileiro e converte números em texto', () => {
    expect(valoresIniciais({ lider: 'Carolina', nascimento: '1990-05-17', filhos: 2 })).toEqual({
      lider: 'Carolina',
      nascimento: '17/05/1990',
      filhos: '2',
    });
  });

  it.each([null, undefined, 'texto', 3])('aceita valor guardado inesperado (%p) sem quebrar', (valor) => {
    expect(valoresIniciais(valor)).toEqual({});
  });
});

describe('familiaresIniciais', () => {
  it('lê os nomes guardados e ignora itens sem nome', () => {
    expect(familiaresIniciais([{ nome: 'Joana' }, { parentesco: 'filho' }, { nome: 'Pedro', parentesco: 'filho' }])).toEqual([
      'Joana',
      'Pedro',
    ]);
  });

  it('aceita lista vazia ou ausente', () => {
    expect(familiaresIniciais(null)).toEqual([]);
  });
});

describe('validarCadastro', () => {
  it('monta os campos extras no formato do banco', () => {
    const { erros, camposExtras } = validarCadastro(
      { ...base, valores: { lider: ' Carolina ', nascimento: '17/05/1990', filhos: '2', rede: 'Sul' } },
      campos,
    );
    expect(erros).toEqual({});
    expect(camposExtras).toEqual({ lider: 'Carolina', nascimento: '1990-05-17', filhos: 2, rede: 'Sul' });
  });

  it('deixa de fora os campos opcionais vazios', () => {
    expect(validarCadastro(base, campos).camposExtras).toEqual({ lider: 'Carolina' });
  });

  it('aponta todos os erros de uma vez', () => {
    const { erros } = validarCadastro(
      { nome: ' ', celular: '', tipoDizimo: 'familiar', familiares: [], valores: { nascimento: '31/02/2000', filhos: 'dois' } },
      campos,
    );
    expect(erros).toEqual({
      nome: 'nomeObrigatorio',
      celular: 'celularObrigatorio',
      familiares: 'familiaresObrigatorios',
      'campo:lider': 'campoObrigatorio',
      'campo:nascimento': 'dataInvalida',
      'campo:filhos': 'numeroInvalido',
    });
  });

  it('aceita número com vírgula', () => {
    expect(validarCadastro({ ...base, valores: { lider: 'X', filhos: '1,5' } }, campos).camposExtras.filhos).toBe(1.5);
  });

  it('dízimo familiar com familiares é válido', () => {
    expect(validarCadastro({ ...base, tipoDizimo: 'familiar', familiares: ['Joana'] }, campos).erros).toEqual({});
  });
});
