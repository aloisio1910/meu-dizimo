import { describe, expect, it } from '@jest/globals';

import {
  camposDaSituacao,
  chaveDoRotulo,
  opcoesRetiradas,
  situacaoDoCampo,
  trocarOrdem,
  validarCampo,
} from '../campos-do-cadastro';

describe('chaveDoRotulo', () => {
  it('tira acentos e espaços', () => {
    expect(chaveDoRotulo('Pastor de rede', [])).toBe('pastor_de_rede');
    expect(chaveDoRotulo('  Célula / Região ', [])).toBe('celula_regiao');
  });

  it('começa sempre por letra e respeita 40 caracteres', () => {
    expect(chaveDoRotulo('1ª igreja', [])).toBe('campo_1_igreja');
    expect(chaveDoRotulo('a'.repeat(60), [])).toHaveLength(40);
    expect(chaveDoRotulo('!!!', [])).toBe('campo');
  });

  it('não repete uma chave que já existe', () => {
    expect(chaveDoRotulo('Líder', ['lider'])).toBe('lider_2');
    expect(chaveDoRotulo('Líder', ['lider', 'lider_2'])).toBe('lider_3');
    expect(chaveDoRotulo('b'.repeat(45), ['b'.repeat(40)])).toBe(`${'b'.repeat(38)}_2`);
  });

  it('o resultado passa na regra do banco', () => {
    for (const rotulo of ['Pastor de rede', '1ª igreja', 'Ministério (Jovens)', 'ÇÃO']) {
      expect(chaveDoRotulo(rotulo, [])).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
  });
});

describe('situação do campo', () => {
  it('vai e volta entre a tela e o banco', () => {
    for (const situacao of ['obrigatorio', 'opcional', 'tesouraria', 'nao_usado'] as const) {
      expect(situacaoDoCampo(camposDaSituacao(situacao))).toBe(situacao);
    }
    expect(situacaoDoCampo({ obrigatorio: true, ativo: false, preenchido_por: 'membro' })).toBe('nao_usado');
  });

  it('campo da tesouraria nunca é obrigatório para o membro (D-093)', () => {
    expect(camposDaSituacao('tesouraria')).toEqual({ obrigatorio: false, ativo: true, preenchido_por: 'tesouraria' });
  });

  it('desligar mantém quem preenchia, para as respostas não mudarem de lugar', () => {
    expect(camposDaSituacao('nao_usado', 'tesouraria')).toEqual({
      obrigatorio: false,
      ativo: false,
      preenchido_por: 'tesouraria',
    });
  });
});

describe('validarCampo', () => {
  it('limpa as opções da lista', () => {
    expect(validarCampo({ rotulo: ' Rede ', tipo: 'lista', opcoes: [' Norte ', '', 'Sul'] })).toEqual({
      ok: true,
      dados: { rotulo: 'Rede', opcoes: ['Norte', 'Sul'] },
    });
  });

  it('só a lista tem opções', () => {
    expect(validarCampo({ rotulo: 'Líder', tipo: 'texto', opcoes: ['sobra'] })).toEqual({
      ok: true,
      dados: { rotulo: 'Líder', opcoes: [] },
    });
  });

  it('recusa nome vazio, lista vazia e opção repetida', () => {
    expect(validarCampo({ rotulo: '', tipo: 'lista', opcoes: ['  '] })).toEqual({
      ok: false,
      erros: { rotulo: 'rotuloObrigatorio', opcoes: 'opcoesObrigatorias' },
    });
    expect(validarCampo({ rotulo: 'Rede', tipo: 'lista', opcoes: ['Norte', 'norte'] })).toEqual({
      ok: false,
      erros: { opcoes: 'opcaoRepetida' },
    });
  });
});

describe('opcoesRetiradas', () => {
  it('aponta só as que saíram', () => {
    expect(opcoesRetiradas(['Norte', 'Sul', 'Leste'], ['Norte', 'Leste', 'Oeste'])).toEqual(['Sul']);
  });
});

describe('trocarOrdem', () => {
  const campos = [
    { id: 'a', ordem: 1 },
    { id: 'b', ordem: 2 },
    { id: 'c', ordem: 2 }, // ordem repetida no banco
  ];

  it('sobe um campo trocando com o de cima, renumerando todos', () => {
    expect(trocarOrdem(campos, 'b', -1)).toEqual([
      { id: 'a', ordem: 2 },
      { id: 'b', ordem: 1 },
      { id: 'c', ordem: 3 },
    ]);
  });

  it('não passa do primeiro nem do último', () => {
    expect(trocarOrdem(campos, 'a', -1)).toBeNull();
    expect(trocarOrdem(campos, 'c', 1)).toBeNull();
  });
});
