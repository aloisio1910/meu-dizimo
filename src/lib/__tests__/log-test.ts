import { describe, expect, it } from '@jest/globals';

import {
  camposAlterados,
  descreverRegistro,
  ehSoTecnico,
  limitesDoPeriodo,
  linhasDaPlanilhaDoLog,
  mudancasDoRegistro,
  temNome,
  valorLegivel,
  type RegistroDoLog,
} from '../log';

const ctx = {
  nomeDoMembro: (id: string) => ({ m1: 'Maria' })[id] ?? '?',
  valorEmMoeda: (c: number) => `R$ ${(c / 100).toFixed(2)}`,
};

function registro(parcial: Partial<RegistroDoLog>): RegistroDoLog {
  return {
    id: 1,
    usuario_id: 'u1',
    perfil: 'tesoureiro',
    acao: 'update',
    tabela: 'lancamentos',
    registro_id: 'l1',
    antes: null,
    depois: null,
    motivo: null,
    criado_em: '2026-10-25T12:00:00Z',
    ...parcial,
  };
}

const lancamento = { membro_id: 'm1', tipo: 'dizimo', valor_informado_centavos: 15000 };

describe('camposAlterados e ehSoTecnico', () => {
  it('ignora os controles internos', () => {
    const aviso = registro({
      antes: { ...lancamento, em_conferencia_desde: '10:00', atualizado_em: 'a' },
      depois: { ...lancamento, em_conferencia_desde: '10:02', atualizado_em: 'b' },
    });
    expect(camposAlterados(aviso)).toEqual([]);
    expect(ehSoTecnico(aviso)).toBe(true);
  });

  it('aponta o que mudou de verdade', () => {
    const mudou = registro({
      antes: { ...lancamento, status: 'aguardando' },
      depois: { ...lancamento, status: 'confirmado' },
    });
    expect(camposAlterados(mudou)).toEqual(['status']);
    expect(ehSoTecnico(mudou)).toBe(false);
  });

  it('inclusão nunca é só técnica', () => {
    expect(ehSoTecnico(registro({ acao: 'insert', depois: lancamento }))).toBe(false);
  });
});

describe('descreverRegistro: lançamentos', () => {
  const comStatus = (de: string, para: string, extra = {}) =>
    descreverRegistro(
      registro({ antes: { ...lancamento, status: de }, depois: { ...lancamento, status: para, ...extra } }),
      ctx,
    ).codigo;

  it('registro e devolução presencial', () => {
    expect(descreverRegistro(registro({ acao: 'insert', depois: lancamento }), ctx)).toEqual({
      codigo: 'lancamentoRegistrado',
      valores: { membro: 'Maria', tipo: 'dizimo', valor: 'R$ 150.00' },
    });
    expect(
      descreverRegistro(registro({ acao: 'insert', depois: { ...lancamento, registrado_pela_tesouraria: true } }), ctx)
        .codigo,
    ).toBe('lancamentoPresencial');
  });

  it('cada mudança de status tem a sua frase', () => {
    expect(comStatus('aguardando', 'em_conferencia')).toBe('conferenciaAberta');
    expect(comStatus('em_conferencia', 'confirmado')).toBe('lancamentoConfirmado');
    expect(comStatus('em_conferencia', 'divergencia')).toBe('divergenciaRegistrada');
    expect(comStatus('divergencia', 'confirmado')).toBe('divergenciaAceita');
    expect(comStatus('aguardando', 'cancelado')).toBe('lancamentoCancelado');
    expect(comStatus('confirmado', 'aguardando')).toBe('lancamentoReaberto');
    expect(comStatus('em_conferencia', 'aguardando')).toBe('conferenciaLiberada');
  });

  it('contestação e edição', () => {
    expect(
      descreverRegistro(
        registro({
          antes: { ...lancamento, status: 'divergencia', resposta_membro: null },
          depois: { ...lancamento, status: 'divergencia', resposta_membro: 'contestada' },
        }),
        ctx,
      ).codigo,
    ).toBe('divergenciaContestada');
    expect(
      descreverRegistro(
        registro({
          antes: { ...lancamento, status: 'aguardando' },
          depois: { ...lancamento, status: 'aguardando', forma: 'pix' },
        }),
        ctx,
      ).codigo,
    ).toBe('lancamentoEditado');
  });
});

describe('descreverRegistro: membros', () => {
  const membro = (antes: object, depois: object) =>
    descreverRegistro(
      registro({ tabela: 'membros', antes: { nome: 'Maria', ...antes }, depois: { nome: 'Maria', ...depois } }),
      ctx,
    );

  it('situação e perfil', () => {
    expect(membro({ status: 'convidado' }, { status: 'ativo' }).codigo).toBe('cadastroConcluido');
    expect(membro({ status: 'convidado' }, { status: 'inativo' }).codigo).toBe('conviteCancelado');
    expect(membro({ status: 'ativo' }, { status: 'inativo' }).codigo).toBe('membroInativado');
    expect(membro({ status: 'inativo' }, { status: 'ativo' }).codigo).toBe('membroReativado');
    expect(membro({ perfil: 'membro' }, { perfil: 'tesoureiro' })).toEqual({
      codigo: 'tesoureiroAutorizado',
      valores: { membro: 'Maria' },
    });
    expect(membro({ perfil: 'tesoureiro' }, { perfil: 'membro' }).codigo).toBe('tesoureiroSuspenso');
  });

  it('e-mail, anotações da tesouraria e dados', () => {
    expect(membro({ email: 'a@x' }, { email: 'b@x' }).codigo).toBe('emailTrocado');
    expect(membro({ campos_internos: {} }, { campos_internos: { celula: 'Norte' } }).codigo).toBe(
      'anotacoesDaTesouraria',
    );
    expect(membro({ celular: '1' }, { celular: '2' }).codigo).toBe('cadastroAtualizado');
  });
});

describe('descreverRegistro: contas e campanhas', () => {
  it('troca de chave Pix vem antes de qualquer outra mudança', () => {
    expect(
      descreverRegistro(
        registro({
          tabela: 'contas',
          antes: { nome: 'Dízimos', chave_pix: 'a', principal: false },
          depois: { nome: 'Dízimos', chave_pix: 'b', principal: true },
        }),
        ctx,
      ),
    ).toEqual({ codigo: 'chavePixAlterada', valores: { conta: 'Dízimos' } });
  });

  it('campanha encerrada pelo Pastor ou pela rotina diária', () => {
    const encerrar = (usuario: string | null) =>
      descreverRegistro(
        registro({
          tabela: 'campanhas',
          usuario_id: usuario,
          antes: { nome: 'Missões', status: 'ativa' },
          depois: { nome: 'Missões', status: 'encerrada' },
        }),
        ctx,
      ).codigo;
    expect(encerrar('u1')).toBe('campanhaEncerrada');
    expect(encerrar(null)).toBe('campanhaEncerradaSozinha');
  });
});

describe('limitesDoPeriodo', () => {
  it('do começo do primeiro dia ao fim do último, no horário de Brasília', () => {
    expect(limitesDoPeriodo({ de: '2026-10-01', ate: '2026-10-31' })).toEqual({
      desde: '2026-10-01T03:00:00.000Z',
      antesDe: '2026-11-01T03:00:00.000Z',
    });
  });
});

describe('valorLegivel', () => {
  const textos = { sim: 'Sim', nao: 'Não', alterado: '(alterado)', emMoeda: (c: number) => `R$ ${c / 100}` };

  it('dinheiro, sim/não e datas', () => {
    expect(valorLegivel('valor_informado_centavos', 15000, textos)).toBe('R$ 150');
    expect(valorLegivel('principal', true, textos)).toBe('Sim');
    expect(valorLegivel('data_contribuicao', '2026-10-25', textos)).toBe('25/10/2026');
  });

  it('esconde identificadores internos', () => {
    expect(valorLegivel('conta_id', '3a000000-0000-0000-0000-000000000001', textos)).toBe('(alterado)');
    expect(valorLegivel('logo_path', 'igreja/logo-1.png', textos)).toBe('(alterado)');
  });

  it('listas e objetos de forma legível', () => {
    expect(valorLegivel('formas_devolucao', ['pix', 'dinheiro'], textos)).toBe('pix, dinheiro');
    expect(valorLegivel('campos_internos', { celula: 'Norte' }, textos)).toBe('celula: Norte');
    expect(valorLegivel('nome', null, textos)).toBe('');
  });
});

describe('temNome', () => {
  it('reconhece os campos com nome legível', () => {
    expect(temNome('chave_pix')).toBe(true);
    expect(temNome('coluna_nova')).toBe(false);
  });
});

describe('mudancasDoRegistro', () => {
  const rotulos = { celula: 'Célula', batismo: 'Data de batismo' };

  it('abre as respostas do cadastro com o nome que a igreja deu', () => {
    expect(
      mudancasDoRegistro({ antes: { campos_internos: {} }, depois: { campos_internos: { celula: 'José' } } }, rotulos),
    ).toEqual([{ campo: 'celula', rotuloDaIgreja: 'Célula', de: undefined, para: 'José' }]);
  });

  it('só as respostas que mudaram; campo sem nome conhecido fica com a chave', () => {
    expect(
      mudancasDoRegistro(
        {
          antes: { campos_extras: { batismo: '2010-05-17', lider: 'Carlos' } },
          depois: { campos_extras: { batismo: '2011-06-01', lider: 'Carlos', antigo: 'x' } },
        },
        rotulos,
      ),
    ).toEqual([
      { campo: 'batismo', rotuloDaIgreja: 'Data de batismo', de: '2010-05-17', para: '2011-06-01' },
      { campo: 'antigo', rotuloDaIgreja: 'antigo', de: undefined, para: 'x' },
    ]);
  });

  it('os outros campos continuam como estão', () => {
    expect(mudancasDoRegistro({ antes: { principal: false }, depois: { principal: true } }, rotulos)).toEqual([
      { campo: 'principal', de: false, para: true },
    ]);
  });
});

describe('download do log (D-095)', () => {
  it('a frase traz o período e a quantidade, no horário de Brasília', () => {
    expect(
      descreverRegistro(
        registro({
          tabela: 'auditoria',
          acao: 'download',
          depois: { desde: '2026-10-01T03:00:00.000Z', antes_de: '2026-11-01T03:00:00.000Z', quantidade: 150 },
        }),
        ctx,
      ),
    ).toEqual({ codigo: 'logBaixado', valores: { de: '01/10/2026', ate: '31/10/2026', quantidade: '150' } });
  });

  it('monta a planilha com as frases da tela', () => {
    const [cabecalho, primeira] = linhasDaPlanilhaDoLog([registro({ motivo: 'Engano' })], {
      colunas: ['Data', 'Hora', 'Quem', 'Perfil', 'O quê', 'Motivo', 'Mudou'],
      dataHora: () => ({ dia: '25/10/2026', hora: '09:00' }),
      quemFez: () => 'Tiago',
      perfil: () => 'Tesoureiro',
      frase: () => 'Confirmou o dízimo.',
      mudancas: () => ['Situação: aguardando → confirmado', 'Valor: R$ 1 → R$ 2'],
    });
    expect(cabecalho).toEqual(['Data', 'Hora', 'Quem', 'Perfil', 'O quê', 'Motivo', 'Mudou']);
    expect(primeira).toEqual([
      '25/10/2026',
      '09:00',
      'Tiago',
      'Tesoureiro',
      'Confirmou o dízimo.',
      'Engano',
      'Situação: aguardando → confirmado; Valor: R$ 1 → R$ 2',
    ]);
  });
});
