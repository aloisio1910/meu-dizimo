import { describe, expect, it } from '@jest/globals';

import {
  converterValores,
  familiaresIniciais,
  mesclarValores,
  validarCadastro,
  valoresIniciais,
  type CampoDoCadastroBase,
} from '../cadastro';

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

describe('mesclarValores', () => {
  it('mantém o valor de campo que não está no formulário (ex.: não usado)', () => {
    expect(mesclarValores({ lider: 'Carlos', antigo: 'guardado' }, { lider: 'Paulo' }, ['lider'])).toEqual({
      antigo: 'guardado',
      lider: 'Paulo',
    });
  });

  it('campo do formulário deixado em branco é apagado de propósito', () => {
    expect(mesclarValores({ lider: 'Carlos', batismo: '2010-05-17' }, { lider: 'Carlos' }, ['lider', 'batismo'])).toEqual({
      lider: 'Carlos',
    });
  });

  it('sem nada guardado', () => {
    expect(mesclarValores(null, { lider: 'Carlos' }, ['lider'])).toEqual({ lider: 'Carlos' });
  });
});

describe('converterValores', () => {
  const campos = [
    { chave: 'celula', rotulo: 'Célula', tipo: 'lista' as const, opcoes: ['Norte'], obrigatorio: false },
    { chave: 'entrada', rotulo: 'Entrada', tipo: 'data' as const, opcoes: [], obrigatorio: true },
  ];

  it('sem exigir obrigatórios (campos da tesouraria)', () => {
    expect(converterValores({ celula: 'Norte' }, campos, false)).toEqual({ erros: {}, valores: { celula: 'Norte' } });
  });

  it('converte a data e aponta a inválida', () => {
    expect(converterValores({ entrada: '17/05/2010' }, campos, false).valores).toEqual({ entrada: '2010-05-17' });
    expect(converterValores({ entrada: '31/02/2010' }, campos, false).erros).toEqual({ 'campo:entrada': 'dataInvalida' });
  });
});
