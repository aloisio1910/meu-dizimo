import { describe, expect, it } from '@jest/globals';

import {
  acaoDeStatus,
  emailDoConvite,
  emailValido,
  filtrarMembros,
  situacaoDoMembro,
  trocaDeEmail,
  validarConvite,
} from '../membros';

describe('validarConvite', () => {
  it('aceita e normaliza o e-mail', () => {
    expect(validarConvite({ nome: ' Ana ', email: ' Ana@Igreja.COM ', celular: ' 62 99999-0000 ' })).toEqual({
      ok: true,
      dados: { nome: 'Ana', email: 'ana@igreja.com', celular: '62 99999-0000' },
    });
  });

  it('exige nome, e-mail válido e celular (RN-005, RN-006)', () => {
    expect(validarConvite({ nome: ' ', email: 'ana@igreja', celular: '' })).toEqual({
      ok: false,
      erros: { nome: 'nomeObrigatorio', email: 'emailInvalido', celular: 'celularObrigatorio' },
    });
  });
});

describe('emailValido', () => {
  it.each(['a@b.co', ' a.b+c@d.com.br '])('aceita %s', (email) => expect(emailValido(email)).toBe(true));
  it.each(['', 'a@b', 'a b@c.com', '@b.com', 'a@.com'])('recusa "%s"', (email) =>
    expect(emailValido(email)).toBe(false),
  );
});

describe('situacaoDoMembro', () => {
  const agora = new Date('2026-10-24T12:00:00Z');

  it('ativo e inativo não dependem do convite', () => {
    expect(situacaoDoMembro('ativo', [], agora)).toBe('ativo');
    expect(situacaoDoMembro('inativo', [{ expira_em: '2026-10-30T00:00:00Z' }], agora)).toBe('inativo');
  });

  it('convidado com convite no prazo', () => {
    expect(situacaoDoMembro('convidado', [{ expira_em: '2026-10-25T00:00:00Z' }], agora)).toBe('convidado');
  });

  it('convite vencido depois de 7 dias (RN-027)', () => {
    expect(situacaoDoMembro('convidado', [{ expira_em: '2026-10-24T11:59:59Z' }], agora)).toBe('convite_vencido');
    expect(situacaoDoMembro('convidado', [], agora)).toBe('convite_vencido');
  });

  it('vale o reenvio mais recente, em qualquer ordem', () => {
    const convites = [{ expira_em: '2026-10-01T00:00:00Z' }, { expira_em: '2026-10-29T00:00:00Z' }];
    expect(situacaoDoMembro('convidado', convites, agora)).toBe('convidado');
  });
});

describe('filtrarMembros', () => {
  const membros = [
    { nome: 'João da Silva', email: 'joao@teste.local', numero: 12 },
    { nome: 'Maria Souza', email: 'maria@teste.local', numero: 3 },
    { nome: 'Pedro', email: 'pedro123@teste.local', numero: 123 },
  ];

  it('busca vazia mostra todos', () => expect(filtrarMembros(membros, '  ')).toHaveLength(3));

  it('nome sem acento e sem maiúscula', () => {
    expect(filtrarMembros(membros, 'JOAO').map((m) => m.numero)).toEqual([12]);
    expect(filtrarMembros(membros, 'souza').map((m) => m.numero)).toEqual([3]);
  });

  it('e-mail', () => expect(filtrarMembros(membros, 'maria@').map((m) => m.numero)).toEqual([3]));

  it('número exato, com ou sem #', () => {
    expect(filtrarMembros(membros, '12').map((m) => m.numero)).toEqual([12]);
    expect(filtrarMembros(membros, '#3').map((m) => m.numero)).toEqual([3]);
  });

  it('telefone com 6 dígitos ou mais procura no celular, com ou sem pontuação', () => {
    const comCelular = [
      { nome: 'Ana', email: 'ana@teste.local', numero: 7, celular: '(62) 99876-5432' },
      { nome: 'Bia', email: 'bia@teste.local', numero: 8, celular: '62 91111-2222' },
    ];
    expect(filtrarMembros(comCelular, '998765432').map((m) => m.numero)).toEqual([7]);
    expect(filtrarMembros(comCelular, '(62) 9111').map((m) => m.numero)).toEqual([8]);
    expect(filtrarMembros(comCelular, '62').map((m) => m.numero)).toEqual([]);
  });

  it('só números procura o número, não pedaços do e-mail', () => {
    expect(filtrarMembros(membros, '12').map((m) => m.numero)).toEqual([12]);
    expect(filtrarMembros(membros, '99')).toEqual([]);
  });
});

describe('acaoDeStatus (D-085)', () => {
  const tesoureiro = { ehAdministrador: false, ehEuMesmo: false };
  const pastor = { ehAdministrador: true, ehEuMesmo: false };
  const concluido = '2026-10-01T10:00:00Z';

  it('tesoureiro só cancela convite', () => {
    expect(acaoDeStatus({ status: 'convidado', cadastro_concluido_em: null }, tesoureiro)).toEqual({
      acao: 'cancelar_convite',
      para: 'inativo',
    });
    expect(acaoDeStatus({ status: 'ativo', cadastro_concluido_em: concluido }, tesoureiro)).toBeNull();
    expect(acaoDeStatus({ status: 'inativo', cadastro_concluido_em: concluido }, tesoureiro)).toBeNull();
  });

  it('Pastor de Governo inativa membro ativo', () => {
    expect(acaoDeStatus({ status: 'ativo', cadastro_concluido_em: concluido }, pastor)).toEqual({
      acao: 'inativar',
      para: 'inativo',
    });
  });

  it('reativar leva a Ativo só quem concluiu o cadastro', () => {
    expect(acaoDeStatus({ status: 'inativo', cadastro_concluido_em: concluido }, pastor)).toEqual({
      acao: 'reativar',
      para: 'ativo',
    });
    expect(acaoDeStatus({ status: 'inativo', cadastro_concluido_em: null }, pastor)).toEqual({
      acao: 'reativar',
      para: 'convidado',
    });
  });

  it('ninguém muda o próprio status', () => {
    expect(
      acaoDeStatus({ status: 'ativo', cadastro_concluido_em: concluido }, { ...pastor, ehEuMesmo: true }),
    ).toBeNull();
  });
});

describe('trocaDeEmail (D-097)', () => {
  const ficha = (status: 'convidado' | 'ativo' | 'inativo', perfil: 'membro' | 'tesoureiro' | 'administrador') => ({
    status,
    perfil,
  });

  it('a tesouraria troca o de membros, convidados ou ativos, e o de outros tesoureiros', () => {
    expect(trocaDeEmail(ficha('convidado', 'membro'), { ehEuMesmo: false })).toBe('pode');
    expect(trocaDeEmail(ficha('ativo', 'membro'), { ehEuMesmo: false })).toBe('pode');
    expect(trocaDeEmail(ficha('ativo', 'tesoureiro'), { ehEuMesmo: false })).toBe('pode');
  });

  it('o do Pastor de Governo só pelo suporte', () => {
    expect(trocaDeEmail(ficha('ativo', 'administrador'), { ehEuMesmo: false })).toBe('pastor');
  });

  it('ninguém troca o próprio, nem o Pastor', () => {
    expect(trocaDeEmail(ficha('ativo', 'tesoureiro'), { ehEuMesmo: true })).toBe('proprio');
    expect(trocaDeEmail(ficha('ativo', 'administrador'), { ehEuMesmo: true })).toBe('proprio');
  });

  it('inativo precisa ser reativado antes', () => {
    expect(trocaDeEmail(ficha('inativo', 'membro'), { ehEuMesmo: false })).toBe('inativo');
  });
});

describe('emailDoConvite', () => {
  it('enviado quando o envio deu certo', () => {
    expect(emailDoConvite({ email_enviado_em: '2026-10-27T10:00:00Z', email_tentativas: 1 })).toBe('enviado');
  });

  it('enviando enquanto ainda há tentativas', () => {
    expect(emailDoConvite({ email_enviado_em: null, email_tentativas: 0 })).toBe('enviando');
    expect(emailDoConvite({ email_enviado_em: null, email_tentativas: 2 })).toBe('enviando');
  });

  it('falhou depois de 3 tentativas', () => {
    expect(emailDoConvite({ email_enviado_em: null, email_tentativas: 3 })).toBe('falhou');
  });
});
