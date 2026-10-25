import { describe, expect, it } from '@jest/globals';

import { atendeAoFiltro, camposFiltraveis, valorDoCampo, type CampoFiltravel } from '../filtro-por-campo';

const campos: CampoFiltravel[] = [
  { chave: 'celula', rotulo: 'Célula', tipo: 'lista', opcoes: ['Norte', 'Sul'], preenchido_por: 'tesouraria' },
  { chave: 'lider', rotulo: 'Líder', tipo: 'texto', opcoes: [], preenchido_por: 'membro' },
  { chave: 'batismo', rotulo: 'Batismo', tipo: 'data', opcoes: [], preenchido_por: 'membro' },
];

const maria = { campos_extras: { lider: 'João Carlos', batismo: '2010-05-17' }, campos_internos: { celula: 'Norte' } };
const pedro = { campos_extras: { lider: 'Paulo' }, campos_internos: {} };

describe('camposFiltraveis', () => {
  it('só lista e texto', () => {
    expect(camposFiltraveis(campos).map((c) => c.chave)).toEqual(['celula', 'lider']);
  });
});

describe('valorDoCampo', () => {
  it('lê da coluna de quem preenche', () => {
    expect(valorDoCampo(maria, campos[0])).toBe('Norte');
    expect(valorDoCampo(maria, campos[1])).toBe('João Carlos');
    expect(valorDoCampo(pedro, campos[0])).toBe('');
  });
});

describe('atendeAoFiltro', () => {
  it('sem filtro, todos passam', () => {
    expect(atendeAoFiltro(pedro, undefined, campos)).toBe(true);
    expect(atendeAoFiltro(pedro, { chave: 'celula', valor: '' }, campos)).toBe(true);
  });

  it('lista: opção exata, das anotações da tesouraria', () => {
    expect(atendeAoFiltro(maria, { chave: 'celula', valor: 'Norte' }, campos)).toBe(true);
    expect(atendeAoFiltro(pedro, { chave: 'celula', valor: 'Norte' }, campos)).toBe(false);
  });

  it('texto: trecho, sem acento nem maiúscula', () => {
    expect(atendeAoFiltro(maria, { chave: 'lider', valor: 'joao' }, campos)).toBe(true);
    expect(atendeAoFiltro(pedro, { chave: 'lider', valor: 'joao' }, campos)).toBe(false);
  });

  it('campo que não existe mais não esconde ninguém', () => {
    expect(atendeAoFiltro(pedro, { chave: 'apagado', valor: 'x' }, campos)).toBe(true);
  });
});
