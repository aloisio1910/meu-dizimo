import { describe, expect, it } from '@jest/globals';

import { crc16, gerarCodigoPix, normalizarChavePix, textoParaPix, type TipoDeChavePix } from '../pix';

// Lê o código campo a campo (ID + tamanho + valor), na ordem em que aparecem.
function lerListaDeCampos(codigo: string): [string, string][] {
  const campos: [string, string][] = [];
  let i = 0;
  while (i < codigo.length) {
    const id = codigo.slice(i, i + 2);
    const tamanho = Number(codigo.slice(i + 2, i + 4));
    campos.push([id, codigo.slice(i + 4, i + 4 + tamanho)]);
    i += 4 + tamanho;
  }
  return campos;
}

function lerCampos(codigo: string): Record<string, string> {
  return Object.fromEntries(lerListaDeCampos(codigo));
}

const contaDaIgreja = {
  chave: 'tesouraria@igrejavideira.org.br',
  tipoDeChave: 'email' as const,
  nomeDoRecebedor: 'Igreja Videira',
  cidade: 'Goiânia',
};

describe('crc16', () => {
  it('dá o valor de verificação oficial do CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('confere com o exemplo do Manual de Padrões do Pix (Banco Central)', () => {
    const exemplo =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(exemplo)).toBe('1D3D');
  });
});

describe('gerarCodigoPix', () => {
  it('reproduz o exemplo do manual quando os dados são os mesmos', () => {
    // O manual usa o nome em minúsculas; aqui os textos vão em maiúsculas,
    // então comparamos a estrutura e um CRC recalculado.
    const codigo = gerarCodigoPix({
      chave: '123e4567-e12b-12d1-a456-426655440000',
      tipoDeChave: 'aleatoria',
      nomeDoRecebedor: 'Fulano de Tal',
      cidade: 'Brasilia',
    });
    expect(codigo).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304' +
        crc16(
          '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304',
        ),
    );
  });

  it('monta os campos obrigatórios na ordem do padrão, com o valor em reais', () => {
    const codigo = gerarCodigoPix({ ...contaDaIgreja, valorEmCentavos: 30000 });
    const campos = lerCampos(codigo);

    expect(lerListaDeCampos(codigo).map(([id]) => id)).toEqual(['00', '26', '52', '53', '54', '58', '59', '60', '62', '63']);
    expect(campos['00']).toBe('01');
    expect(lerCampos(campos['26'])).toEqual({ '00': 'br.gov.bcb.pix', '01': 'tesouraria@igrejavideira.org.br' });
    expect(campos['53']).toBe('986');
    expect(campos['54']).toBe('300.00');
    expect(campos['58']).toBe('BR');
    expect(campos['59']).toBe('IGREJA VIDEIRA');
    expect(campos['60']).toBe('GOIANIA');
    expect(campos['62']).toBe('0503***');
  });

  it('termina com o CRC correto do restante do código', () => {
    const codigo = gerarCodigoPix({ ...contaDaIgreja, valorEmCentavos: 12345 });
    expect(codigo.slice(-8, -4)).toBe('6304');
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)));
  });

  it.each([
    [1, '0.01'],
    [99, '0.99'],
    [100, '1.00'],
    [30050, '300.50'],
    [123456789, '1234567.89'],
  ])('escreve %i centavos como %s', (centavos, esperado) => {
    expect(lerCampos(gerarCodigoPix({ ...contaDaIgreja, valorEmCentavos: centavos }))['54']).toBe(esperado);
  });

  it('sem valor, não inclui o campo 54 (quem paga digita no banco)', () => {
    expect(lerCampos(gerarCodigoPix(contaDaIgreja))['54']).toBeUndefined();
  });

  it('inclui a descrição dentro da conta Pix', () => {
    const conta = lerCampos(gerarCodigoPix({ ...contaDaIgreja, descricao: 'Dízimo' }))['26'];
    expect(lerCampos(conta)['02']).toBe('DIZIMO');
  });

  it('corta nome e cidade nos limites do padrão (25 e 15)', () => {
    const campos = lerCampos(
      gerarCodigoPix({ ...contaDaIgreja, nomeDoRecebedor: 'Igreja Evangélica Videira de Goiânia Centro', cidade: 'São José dos Campos' }),
    );
    expect(campos['59'].length).toBeLessThanOrEqual(25);
    expect(campos['60'].length).toBeLessThanOrEqual(15);
    expect(campos['59']).toBe('IGREJA EVANGELICA VIDEIRA');
    expect(campos['60']).toBe('SAO JOSE DOS CA');
  });

  it.each([0, -100, 10.5])('recusa o valor inválido %p', (centavos) => {
    expect(() => gerarCodigoPix({ ...contaDaIgreja, valorEmCentavos: centavos })).toThrow();
  });

  it('recusa conta sem nome ou cidade', () => {
    expect(() => gerarCodigoPix({ ...contaDaIgreja, cidade: '  ' })).toThrow();
  });
});

describe('normalizarChavePix', () => {
  it.each<[string, TipoDeChavePix, string]>([
    ['123.456.789-09', 'cpf', '12345678909'],
    ['12.345.678/0001-95', 'cnpj', '12345678000195'],
    ['(62) 99999-8888', 'telefone', '+5562999998888'],
    ['+55 62 99999-8888', 'telefone', '+5562999998888'],
    [' Tesouraria@Igreja.org ', 'email', 'tesouraria@igreja.org'],
    ['123E4567-E12B-12D1-A456-426655440000', 'aleatoria', '123e4567-e12b-12d1-a456-426655440000'],
  ])('"%s" (%s) vira "%s"', (chave, tipo, esperado) => {
    expect(normalizarChavePix(chave, tipo)).toBe(esperado);
  });
});

describe('textoParaPix', () => {
  it('tira acentos e símbolos e usa maiúsculas', () => {
    expect(textoParaPix('Igreja São João — Coração', 30)).toBe('IGREJA SAO JOAO CORACAO');
  });
});
