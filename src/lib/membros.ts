// Regras da tela Membros (T-03): convite, situação e busca. O banco confere
// de novo (convidar_membro e a trigger de membros).

// Mesmo formato que o banco aceita (membros.email).
const FORMATO_DO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type DadosDoConvite = { nome: string; email: string; celular: string };

export type ErrosDoConvite = {
  nome?: 'nomeObrigatorio';
  email?: 'emailInvalido';
  celular?: 'celularObrigatorio';
};

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return FORMATO_DO_EMAIL.test(normalizarEmail(email));
}

export function validarConvite(
  campos: DadosDoConvite,
): { ok: true; dados: DadosDoConvite } | { ok: false; erros: ErrosDoConvite } {
  const erros: ErrosDoConvite = {};
  if (!campos.nome.trim()) erros.nome = 'nomeObrigatorio';
  if (!emailValido(campos.email)) erros.email = 'emailInvalido';
  if (!campos.celular.trim()) erros.celular = 'celularObrigatorio';
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    dados: { nome: campos.nome.trim(), email: normalizarEmail(campos.email), celular: campos.celular.trim() },
  };
}

export type StatusDoMembro = 'convidado' | 'ativo' | 'inativo';
export type SituacaoDoMembro = StatusDoMembro | 'convite_vencido';

// Convidado com o último convite vencido (RN-027) precisa de reenvio.
// "agora" vem de fora para a regra ser testável.
export function situacaoDoMembro(
  status: StatusDoMembro,
  convites: { expira_em: string }[],
  agora: Date,
): SituacaoDoMembro {
  if (status !== 'convidado') return status;
  const ultimoPrazo = convites.map((c) => new Date(c.expira_em).getTime()).sort((a, b) => b - a)[0];
  return ultimoPrazo === undefined || ultimoPrazo < agora.getTime() ? 'convite_vencido' : 'convidado';
}

// Sem acento e sem maiúscula: "joão" acha "Joao" e vice-versa.
function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Até 5 dígitos é o número do dizimista; mais que isso, um telefone.
const MAIOR_NUMERO_DE_DIZIMISTA = 5;

// Busca por nome, e-mail, número do dizimista ou celular, os dados que o
// envelope traz. Texto vazio mostra todos.
export function filtrarMembros<T extends { nome: string; email: string; numero: number; celular?: string }>(
  membros: T[],
  busca: string,
): T[] {
  const termo = simplificar(busca);
  if (!termo) return membros;
  if (/^#?[\d\s().+-]+$/.test(termo)) {
    const digitos = termo.replace(/\D/g, '');
    if (termo.startsWith('#') || digitos.length <= MAIOR_NUMERO_DE_DIZIMISTA) {
      return membros.filter((m) => m.numero === Number(digitos));
    }
    return membros.filter((m) => (m.celular ?? '').replace(/\D/g, '').includes(digitos));
  }
  return membros.filter((m) => simplificar(m.nome).includes(termo) || simplificar(m.email).includes(termo));
}

export type AcaoDeStatus =
  | { acao: 'cancelar_convite'; para: 'inativo' }
  | { acao: 'inativar'; para: 'inativo' }
  | { acao: 'reativar'; para: 'ativo' | 'convidado' };

// Qual mudança de status a ficha oferece (D-085). Espelha a trigger
// validar_membro, que confere de novo:
// - cancelar convite: tesoureiro ou Pastor de Governo;
// - inativar e reativar: só o Pastor de Governo;
// - reativar leva a Ativo quem concluiu o cadastro e a Convidado quem não;
// - ninguém muda o próprio status.
export function acaoDeStatus(
  membro: { status: StatusDoMembro; cadastro_concluido_em: string | null },
  quemVe: { ehAdministrador: boolean; ehEuMesmo: boolean },
): AcaoDeStatus | null {
  if (quemVe.ehEuMesmo) return null;
  if (membro.status === 'convidado') return { acao: 'cancelar_convite', para: 'inativo' };
  if (!quemVe.ehAdministrador) return null;
  if (membro.status === 'ativo') return { acao: 'inativar', para: 'inativo' };
  return { acao: 'reativar', para: membro.cadastro_concluido_em ? 'ativo' : 'convidado' };
}

// Troca de e-mail (D-097): o que a ficha oferece. Espelha o banco
// (trocar_email_do_membro), que confere de novo, inclusive a regra de quem
// também está em outra igreja, que só o banco sabe.
// - pode: tesoureiro ou Pastor troca o de membros e de outros tesoureiros;
// - pastor: o do Pastor de Governo só pelo suporte;
// - proprio: ninguém troca o próprio;
// - inativo: reativar antes.
export type TrocaDeEmail = 'pode' | 'pastor' | 'proprio' | 'inativo';

export function trocaDeEmail(
  membro: { status: StatusDoMembro; perfil: 'membro' | 'tesoureiro' | 'administrador' },
  quemVe: { ehEuMesmo: boolean },
): TrocaDeEmail {
  if (quemVe.ehEuMesmo) return 'proprio';
  if (membro.perfil === 'administrador') return 'pastor';
  if (membro.status === 'inativo') return 'inativo';
  return 'pode';
}

// Como está o e-mail do convite mais recente, para a tesouraria saber se a
// pessoa recebeu. Até 3 tentativas, de 2 em 2 minutos; depois, desiste.
export type EmailDoConvite = 'enviado' | 'enviando' | 'falhou';

export function emailDoConvite(convite: { email_enviado_em: string | null; email_tentativas: number }): EmailDoConvite {
  if (convite.email_enviado_em) return 'enviado';
  return convite.email_tentativas >= 3 ? 'falhou' : 'enviando';
}
