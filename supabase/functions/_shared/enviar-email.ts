// Envio de e-mail pelas Edge Functions. No Supabase local, com MAILPIT_URL,
// tudo vai para o Mailpit (http://127.0.0.1:54324), como os códigos de
// login. Na nuvem, pelo Resend (RESEND_API_KEY). Sem domínio próprio, o
// Resend só entrega para o e-mail da conta.
import type { Email } from './emails.ts';

const REMETENTE_PADRAO = 'Meu Dízimo <onboarding@resend.dev>';

export async function enviarEmail(email: Email): Promise<{ ok: boolean; erro?: string }> {
  const remetente = Deno.env.get('EMAIL_REMETENTE') || REMETENTE_PADRAO;
  const mailpit = Deno.env.get('MAILPIT_URL');
  try {
    if (mailpit) {
      const [, nome = '', endereco = remetente] = remetente.match(/^(.*?)\s*<(.+)>$/) ?? [];
      const resposta = await fetch(`${mailpit}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Name: nome, Email: endereco },
          To: [{ Email: email.para }],
          Subject: email.assunto,
          Text: email.texto,
          HTML: email.html,
        }),
      });
      return resposta.ok ? { ok: true } : { ok: false, erro: `mailpit_${resposta.status}` };
    }

    const chave = Deno.env.get('RESEND_API_KEY');
    if (!chave) return { ok: false, erro: 'sem_resend' };
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remetente,
        to: [email.para],
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      }),
    });
    return resposta.ok ? { ok: true } : { ok: false, erro: `resend_${resposta.status}` };
  } catch (erro) {
    return { ok: false, erro: `rede: ${String(erro)}` };
  }
}
