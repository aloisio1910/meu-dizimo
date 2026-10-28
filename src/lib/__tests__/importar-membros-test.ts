import { describe, expect, it } from '@jest/globals';
import * as XLSX from 'xlsx';

import { analisarLinhas, LIMITE_POR_IMPORTACAO, lerPlanilhaDeMembros } from '../importar-membros';

describe('analisarLinhas', () => {
  it('acha as colunas pelo nome, com acento, maiúscula ou em outra ordem', () => {
    const leitura = analisarLinhas([
      ['Celular', 'NOME COMPLETO', 'E-mail'],
      ['62 99999-0001', 'Maria', 'Maria@Exemplo.com '],
    ]);
    expect(leitura).toEqual({
      ok: true,
      pessoas: [{ linha: 2, nome: 'Maria', email: 'maria@exemplo.com', celular: '62 99999-0001' }],
      problemas: [],
      acimaDoLimite: false,
    });
  });

  it('aceita um título antes do cabeçalho e pula linhas vazias', () => {
    const leitura = analisarLinhas([
      ['Membros da Igreja Videira'],
      [],
      ['Nome', 'Email', 'WhatsApp'],
      ['', '', ''],
      ['João', 'joao@x.com', '62988887777'],
    ]);
    expect(leitura.ok && leitura.pessoas).toEqual([
      { linha: 5, nome: 'João', email: 'joao@x.com', celular: '62988887777' },
    ]);
  });

  it('aponta os problemas com o número da linha no Excel', () => {
    const leitura = analisarLinhas([
      ['Nome', 'E-mail', 'Celular'],
      ['Ana', 'ana@x.com', '1'],
      ['', 'sem-arroba', ''],
      ['Ana de novo', 'ANA@x.com', '2'],
    ]);
    expect(leitura.ok && leitura.problemas).toEqual([
      { linha: 3, motivos: ['nomeObrigatorio', 'emailInvalido', 'celularObrigatorio'] },
      { linha: 4, motivos: ['emailRepetidoNaPlanilha'] },
    ]);
    expect(leitura.ok && leitura.pessoas.length).toBe(1);
  });

  it('sem as três colunas, ou sem ninguém, não há o que importar', () => {
    expect(
      analisarLinhas([
        ['Nome', 'Endereço'],
        ['Ana', 'Rua A'],
      ]),
    ).toEqual({ ok: false, erro: 'semCabecalho' });
    expect(analisarLinhas([['Nome', 'E-mail', 'Celular']])).toEqual({ ok: false, erro: 'vazia' });
  });

  it('importa até o limite de uma vez e avisa o excesso', () => {
    const linhas = Array.from({ length: LIMITE_POR_IMPORTACAO + 3 }, (_, i) => [`P${i}`, `p${i}@x.com`, '1']);
    const leitura = analisarLinhas([['Nome', 'E-mail', 'Celular'], ...linhas]);
    expect(leitura.ok && leitura.pessoas.length).toBe(LIMITE_POR_IMPORTACAO);
    expect(leitura.ok && leitura.acimaDoLimite).toBe(true);
  });
});

describe('lerPlanilhaDeMembros', () => {
  it('lê um Excel de verdade, com celular digitado como número', () => {
    const pasta = XLSX.utils.book_new();
    const folha = XLSX.utils.aoa_to_sheet([
      ['Nome', 'E-mail', 'Celular'],
      ['Rui', 'rui@x.com', 62999990000],
    ]);
    XLSX.utils.book_append_sheet(pasta, folha, 'Membros');
    const bytes = new Uint8Array(XLSX.write(pasta, { type: 'array', bookType: 'xlsx' }));
    const leitura = lerPlanilhaDeMembros(bytes);
    expect(leitura.ok && leitura.pessoas).toEqual([
      { linha: 2, nome: 'Rui', email: 'rui@x.com', celular: '62999990000' },
    ]);
  });

  it('lê CSV separado por ponto e vírgula (o padrão do Excel no Brasil)', () => {
    const bytes = new TextEncoder().encode('Nome;E-mail;Celular\nLia;lia@x.com;62911112222\n');
    const leitura = lerPlanilhaDeMembros(bytes);
    expect(leitura.ok && leitura.pessoas[0]).toEqual({
      linha: 2,
      nome: 'Lia',
      email: 'lia@x.com',
      celular: '62911112222',
    });
  });

  it('arquivo que não é planilha', () => {
    expect(lerPlanilhaDeMembros(new Uint8Array([0, 1, 2, 3, 255, 254]))).toEqual({ ok: false, erro: 'semCabecalho' });
  });
});
