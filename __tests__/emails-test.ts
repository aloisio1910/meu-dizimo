import { describe, expect, it } from '@jest/globals';

import {
  dataDoConvite,
  emailDeConvite,
  emailDeTrocaDeEmail,
  mascararEmail,
} from '../supabase/functions/_shared/emails';

describe('mascararEmail', () => {
  it('mostra só o começo do endereço e o domínio', () => {
    expect(mascararEmail('maria.silva@gmail.com')).toBe('ma***@gmail.com');
  });

  it('endereço curto não aparece inteiro', () => {
    expect(mascararEmail('jo@x.com')).toBe('j***@x.com');
    expect(mascararEmail('a@x.com')).toBe('a***@x.com');
  });

  it('texto sem @ vira só asteriscos', () => {
    expect(mascararEmail('invalido')).toBe('***');
  });
});

describe('e-mail de troca de e-mail (D-097)', () => {
  const email = emailDeTrocaDeEmail({
    para: 'antigo@x.com',
    nome: 'Maria',
    igreja: 'Igreja Videira',
    emailNovo: 'maria.nova@gmail.com',
    motivo: 'Perdeu o acesso <ao> e-mail',
    tituloAdministrador: 'Pastor Presidente',
  });

  it('vai para o e-mail antigo, com o novo mascarado', () => {
    expect(email.para).toBe('antigo@x.com');
    expect(email.texto).toContain('ma***@gmail.com');
    expect(email.texto).not.toContain('maria.nova@gmail.com');
  });

  it('diz o motivo e com quem falar', () => {
    expect(email.texto).toContain('Motivo informado: Perdeu o acesso <ao> e-mail');
    expect(email.texto).toContain('fale com o Pastor Presidente');
  });

  it('o HTML não deixa o motivo virar código', () => {
    expect(email.html).toContain('&lt;ao&gt;');
    expect(email.html).not.toContain('<ao>');
  });

  it('sem título configurado, usa Pastor de Governo', () => {
    const semTitulo = emailDeTrocaDeEmail({
      para: 'a@x.com',
      nome: 'Rui',
      igreja: 'Igreja A',
      emailNovo: 'rui@y.com',
      motivo: 'Trocou de provedor',
      tituloAdministrador: null,
    });
    expect(semTitulo.texto).toContain('fale com o Pastor de Governo');
  });
});

describe('e-mail de convite', () => {
  const dados = {
    para: 'maria@x.com',
    nome: 'Maria',
    igreja: 'Igreja Videira',
    // 03:00 UTC do dia 3 = 00:00 do dia 3 em Brasília.
    expiraEm: '2026-11-03T03:00:00Z',
    links: {},
  };

  it('diz quem convida, com que e-mail entrar e até quando vale', () => {
    const email = emailDeConvite(dados);
    expect(email.para).toBe('maria@x.com');
    expect(email.assunto).toBe('Convite da Igreja Videira para o Meu Dízimo');
    expect(email.texto).toContain('entre com este e-mail: maria@x.com');
    expect(email.texto).toContain('código de 6 números');
    expect(email.texto).toContain('O convite vale até 3 de novembro de 2026.');
  });

  it('sem links das lojas, a tesouraria diz onde baixar', () => {
    expect(emailDeConvite(dados).texto).toContain('A tesouraria da igreja informa onde baixar.');
  });

  it('com os links, mostra cada loja numa linha', () => {
    const email = emailDeConvite({
      ...dados,
      links: { android: 'https://play.example/x', iphone: 'https://apps.example/y' },
    });
    expect(email.texto).toContain(
      'Android (Google Play): https://play.example/x\niPhone (App Store): https://apps.example/y',
    );
    expect(email.html).toContain('https://play.example/x<br>iPhone');
  });

  it('a data usa o horário de Brasília', () => {
    expect(dataDoConvite('2026-11-03T02:59:00Z')).toBe('2 de novembro de 2026');
  });
});
