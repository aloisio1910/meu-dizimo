import { describe, expect, it } from '@jest/globals';

import { descreverRegistroGlobal } from '../logs-globais';

const registro = (tabela: string, acao: string, antes: object | null, depois: object | null) => ({
  tabela,
  acao,
  antes,
  depois,
});

describe('descreverRegistroGlobal', () => {
  it('busca do suporte, com o e-mail buscado', () => {
    expect(descreverRegistroGlobal(registro('membros', 'acesso_suporte', null, { email_buscado: 'm@x.com' }))).toEqual({
      codigo: 'buscaDoSuporte',
      valores: { email: 'm@x.com' },
    });
  });

  it('igreja cadastrada, inativada, reativada e alterada', () => {
    expect(descreverRegistroGlobal(registro('igrejas', 'insert', null, { nome: 'Videira' })).codigo).toBe(
      'igrejaCadastrada',
    );
    expect(
      descreverRegistroGlobal(registro('igrejas', 'update', { status: 'ativa' }, { status: 'inativa', nome: 'V' }))
        .codigo,
    ).toBe('igrejaInativada');
    expect(
      descreverRegistroGlobal(registro('igrejas', 'update', { status: 'inativa' }, { status: 'ativa', nome: 'V' }))
        .codigo,
    ).toBe('igrejaReativada');
    expect(
      descreverRegistroGlobal(
        registro('igrejas', 'update', { status: 'ativa', faixa_plano: null }, { status: 'ativa' }),
      ).codigo,
    ).toBe('igrejaAlterada');
  });

  it('Pastor convidado, definido e retirado', () => {
    expect(
      descreverRegistroGlobal(registro('membros', 'insert', null, { nome: 'Ana', perfil: 'administrador' })),
    ).toEqual({ codigo: 'pastorConvidado', valores: { nome: 'Ana' } });
    expect(
      descreverRegistroGlobal(
        registro('membros', 'update', { perfil: 'membro' }, { perfil: 'administrador', nome: 'T' }),
      ).codigo,
    ).toBe('pastorDefinido');
    expect(
      descreverRegistroGlobal(
        registro('membros', 'update', { perfil: 'administrador' }, { perfil: 'membro', nome: 'A' }),
      ).codigo,
    ).toBe('pastorRetirado');
  });

  it('convite cancelado e e-mail trocado', () => {
    expect(
      descreverRegistroGlobal(
        registro(
          'membros',
          'update',
          { status: 'convidado', perfil: 'membro' },
          { status: 'inativo', perfil: 'membro' },
        ),
      ).codigo,
    ).toBe('conviteCancelado');
    expect(
      descreverRegistroGlobal(registro('membros', 'update', { email: 'a@x' }, { email: 'b@x', nome: 'Maria' })),
    ).toEqual({ codigo: 'emailTrocado', valores: { nome: 'Maria' } });
  });

  it('convite enviado e o que não tem frase própria', () => {
    expect(descreverRegistroGlobal(registro('convites', 'insert', null, {})).codigo).toBe('conviteEnviado');
    expect(descreverRegistroGlobal(registro('campanhas', 'insert', null, { nome: 'Oferta' }))).toEqual({
      codigo: 'campanhaCriada',
      valores: { nome: 'Oferta' },
    });
    expect(descreverRegistroGlobal(registro('contas', 'update', {}, {}))).toEqual({
      codigo: 'outro',
      valores: { tabela: 'contas' },
    });
  });
});
