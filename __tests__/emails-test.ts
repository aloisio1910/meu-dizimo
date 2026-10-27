import { describe, expect, it } from '@jest/globals';

import { emailDeTrocaDeEmail, mascararEmail } from '../supabase/functions/_shared/emails';

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
