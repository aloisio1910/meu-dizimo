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
    // Quebra de linha dentro de um parágrafo (ex.: lista de lojas) vira <br>.
    html: paragrafos
      .map((p) => `<p style="font-family:Arial,sans-serif;font-size:16px">${escapar(p).split('\n').join('<br>')}</p>`)
      .join(''),
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

// Data em que o convite vence, no horário de Brasília (o país do piloto).
export function dataDoConvite(expiraEm: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(
    new Date(expiraEm),
  );
}

// Passo 2 do fluxo principal: vai para o e-mail da pessoa convidada.
// Enquanto o app não está nas lojas, sem links: a tesouraria diz onde baixar.
export function emailDeConvite(dados: {
  para: string;
  nome: string;
  igreja: string;
  expiraEm: string;
  links: { android?: string; iphone?: string };
}): Email {
  const lojas = [
    dados.links.android && `Android (Google Play): ${dados.links.android}`,
    dados.links.iphone && `iPhone (App Store): ${dados.links.iphone}`,
  ].filter((linha): linha is string => !!linha);
  const instalar = lojas.length
    ? `1. Instale o app Meu Dízimo no celular:\n${lojas.join('\n')}`
    : '1. Instale o app Meu Dízimo no celular. A tesouraria da igreja informa onde baixar.';
  return montar(dados.para, `Convite da ${dados.igreja} para o Meu Dízimo`, [
    `Olá, ${dados.nome}.`,
    `A ${dados.igreja} convidou você para usar o Meu Dízimo, o Cartão de Dízimo digital da igreja.`,
    instalar,
    `2. Abra o app e entre com este e-mail: ${dados.para}. Você vai receber um código de 6 números para confirmar.`,
    `O convite vale até ${dataDoConvite(dados.expiraEm)}.`,
    'Se você não esperava este convite, pode ignorar este e-mail.',
  ]);
}
