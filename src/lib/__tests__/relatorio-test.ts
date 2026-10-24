import { describe, expect, it } from '@jest/globals';

import {
  centavosParaPlanilha,
  colunasDeValor,
  linhasDaPlanilha,
  nomeDoArquivo,
  periodoDoMes,
  totalizar,
  validarPeriodo,
  valorConsiderado,
  type LinhaDoRelatorio,
} from '../relatorio';

function linha(parcial: Partial<LinhaDoRelatorio>): LinhaDoRelatorio {
  return {
    id: 'x',
    tipo: 'dizimo',
    data_contribuicao: '2026-10-10',
    registrado_em: '2026-10-10T13:00:00Z',
    valor_informado_centavos: 10000,
    valor_conferido_centavos: null,
    moeda: 'BRL',
    forma: 'pix',
    status: 'confirmado',
    confirmado_por_nome: 'Tiago',
    registrado_pela_tesouraria: false,
    membros: { nome: 'Maria', numero: 3, campos_extras: { lider: 'Carlos', nascimento: '1990-05-17', setor: 4 } },
    campanhas: null,
    contas: { nome: 'Dízimos e ofertas' },
    ...parcial,
  };
}

describe('periodoDoMes', () => {
  it('este mês, do dia 1 ao último dia', () => {
    expect(periodoDoMes('2026-10-24')).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('mês passado, atravessando o ano', () => {
    expect(periodoDoMes('2026-01-15', -1)).toEqual({ de: '2025-12-01', ate: '2025-12-31' });
  });

  it('fevereiro de ano bissexto', () => {
    expect(periodoDoMes('2028-03-01', -1)).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
  });
});

describe('validarPeriodo', () => {
  it('aceita e converte para AAAA-MM-DD', () => {
    expect(validarPeriodo({ de: '01/10/2026', ate: '31/10/2026' })).toEqual({
      ok: true,
      periodo: { de: '2026-10-01', ate: '2026-10-31' },
    });
  });

  it('aceita um dia só', () => {
    expect(validarPeriodo({ de: '05/10/2026', ate: '05/10/2026' }).ok).toBe(true);
  });

  it('recusa data inválida e fim antes do início', () => {
    expect(validarPeriodo({ de: '31/02/2026', ate: '' })).toEqual({
      ok: false,
      erros: { de: 'dataInvalida', ate: 'dataInvalida' },
    });
    expect(validarPeriodo({ de: '10/10/2026', ate: '09/10/2026' })).toEqual({
      ok: false,
      erros: { ate: 'fimAntesDoInicio' },
    });
  });
});

describe('valorConsiderado', () => {
  it('confirmado vale pelo conferido', () => {
    expect(valorConsiderado(linha({ valor_conferido_centavos: 9000 }))).toBe(9000);
  });

  it('confirmado sem conferido (presencial) vale pelo informado', () => {
    expect(valorConsiderado(linha({ registrado_pela_tesouraria: true }))).toBe(10000);
  });

  it('não confirmado vale pelo informado', () => {
    expect(valorConsiderado(linha({ status: 'divergencia', valor_conferido_centavos: 9000 }))).toBe(10000);
  });
});

describe('totalizar', () => {
  const linhas = [
    linha({ valor_informado_centavos: 30000, valor_conferido_centavos: 30000 }),
    linha({ valor_informado_centavos: 10000, valor_conferido_centavos: 9000 }),
    linha({ tipo: 'oferta', campanhas: { nome: 'Oferta' }, valor_informado_centavos: 5000 }),
    linha({ tipo: 'oferta', campanhas: { nome: 'Construção' }, valor_informado_centavos: 2000 }),
    linha({ tipo: 'oferta', campanhas: { nome: 'Construção' }, valor_informado_centavos: 3000 }),
    linha({ status: 'aguardando', valor_informado_centavos: 7000 }),
    linha({ status: 'divergencia', valor_informado_centavos: 1000, valor_conferido_centavos: 500 }),
    linha({ status: 'cancelado', valor_informado_centavos: 99900 }),
  ];
  const totais = totalizar(linhas);

  it('soma só o confirmado, pelo valor considerado', () => {
    expect(totais.confirmado).toEqual({ quantidade: 5, centavos: 49000 });
    expect(totais.porTipo.dizimo).toEqual({ quantidade: 2, centavos: 39000 });
    expect(totais.porTipo.oferta).toEqual({ quantidade: 3, centavos: 10000 });
  });

  it('ofertas por campanha, em ordem alfabética', () => {
    expect(totais.porCampanha).toEqual([
      { nome: 'Construção', quantidade: 2, centavos: 5000 },
      { nome: 'Oferta', quantidade: 1, centavos: 5000 },
    ]);
  });

  it('pendente à parte e cancelado fora das somas', () => {
    expect(totais.pendente).toEqual({ quantidade: 2, centavos: 8000 });
    expect(totais.cancelados).toBe(1);
  });

  it('lista vazia', () => {
    expect(totalizar([]).confirmado).toEqual({ quantidade: 0, centavos: 0 });
  });
});

describe('planilha', () => {
  it('centavos viram reais sem erro de arredondamento', () => {
    expect(centavosParaPlanilha(30050)).toBe(300.5);
    expect(centavosParaPlanilha(1)).toBe(0.01);
    expect(centavosParaPlanilha(123456789)).toBe(1234567.89);
  });

  it('monta cabeçalho e linhas na ordem das colunas do Requisitos', () => {
    const textos = {
      colunas: ['ID', 'Nome'],
      camposDoCadastro: [],
      tipo: (t: string) => t.toUpperCase(),
      status: (s: string) => `[${s}]`,
      forma: (f: string) => f,
      data: (iso: string) => iso.split('-').reverse().join('/'),
      dataHora: () => '10/10/2026 10:00',
      quemRegistrou: (l: LinhaDoRelatorio) => (l.registrado_pela_tesouraria ? 'Tesouraria' : 'Membro'),
    };
    const [cabecalho, primeira] = linhasDaPlanilha(
      [linha({ tipo: 'oferta', campanhas: { nome: 'Construção' }, valor_conferido_centavos: 9950 })],
      textos,
    );
    expect(cabecalho).toEqual(['ID', 'Nome']);
    expect(primeira).toEqual([
      3,
      'Maria',
      'OFERTA',
      'Construção',
      '10/10/2026',
      '10/10/2026 10:00',
      100,
      99.5,
      'pix',
      'Dízimos e ofertas',
      '[confirmado]',
      'Tiago',
      'Membro',
    ]);
  });

  it('sem valor conferido, a célula fica vazia', () => {
    const textos = {
      colunas: [],
      camposDoCadastro: [],
      tipo: String,
      status: String,
      forma: String,
      data: String,
      dataHora: String,
      quemRegistrou: () => '',
    };
    expect(linhasDaPlanilha([linha({})], textos)[1][7]).toBeNull();
  });

  it('campos do cadastro da igreja entram logo depois do nome (D-086)', () => {
    const textos = {
      colunas: ['ID', 'Nome', 'Tipo'],
      camposDoCadastro: [
        { chave: 'lider', rotulo: 'Líder' },
        { chave: 'nascimento', rotulo: 'Nascimento' },
        { chave: 'setor', rotulo: 'Setor' },
        { chave: 'rede', rotulo: 'Rede' },
      ],
      tipo: () => 'Dízimo',
      status: String,
      forma: String,
      data: String,
      dataHora: String,
      quemRegistrou: () => '',
    };
    const [cabecalho, primeira] = linhasDaPlanilha([linha({})], textos);
    expect(cabecalho).toEqual(['ID', 'Nome', 'Líder', 'Nascimento', 'Setor', 'Rede', 'Tipo']);
    // Data vira DD/MM/AAAA, número continua número, campo não preenchido fica vazio.
    expect(primeira.slice(0, 7)).toEqual([3, 'Maria', 'Carlos', '17/05/1990', 4, '', 'Dízimo']);
  });

  it('colunas de valor andam uma casa por campo do cadastro', () => {
    expect(colunasDeValor(0)).toEqual([6, 7]);
    expect(colunasDeValor(3)).toEqual([9, 10]);
  });

  it('nome do arquivo com o período', () => {
    expect(nomeDoArquivo({ de: '2026-10-01', ate: '2026-10-31' })).toBe('relatorio-2026-10-01-a-2026-10-31.xlsx');
  });
});
