// Textos dos e-mails que o app manda (D-097). Sem dependências: roda no Deno
// (Edge Functions) e no Jest. O envio em si fica em enviar-email.ts.

export type Email = { para: string; assunto: string; texto: string; html: string };

// "maria.silva@gmail.com" -> "ma***@gmail.com": o e-mail antigo pode estar nas
// mãos de outra pessoa, então o novo endereço não aparece inteiro.
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  if (!dominio) return '***';
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}***@${dominio}`;
}

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function montar(para: string, assunto: string, paragrafos: string[]): Email {
  return {
    para,
    assunto,
    texto: paragrafos.join('\n\n'),
    html: paragrafos.map((p) => `<p style="font-family:Arial,sans-serif;font-size:16px">${escapar(p)}</p>`).join(''),
  };
}

// Vai para o e-mail ANTIGO, para a pessoa saber se a troca foi indevida.
export function emailDeTrocaDeEmail(dados: {
  para: string;
  nome: string;
  igreja: string;
  emailNovo: string;
  motivo: string;
  tituloAdministrador: string | null;
}): Email {
  const titulo = dados.tituloAdministrador || 'Pastor de Governo';
  return montar(dados.para, 'Seu e-mail de entrada no Meu Dízimo foi trocado', [
    `Olá, ${dados.nome}.`,
    `A tesouraria da ${dados.igreja} trocou o e-mail que você usa para entrar no app Meu Dízimo para ${mascararEmail(dados.emailNovo)}.`,
    `Motivo informado: ${dados.motivo}`,
    'A partir de agora, este endereço não serve mais para entrar no app.',
    `Se você não pediu essa troca, fale com o ${titulo} da sua igreja.`,
  ]);
}
