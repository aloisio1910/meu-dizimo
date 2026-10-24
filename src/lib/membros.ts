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

// Busca por nome, e-mail ou número do dizimista. Só números (com ou sem #)
// procura o número exato; texto vazio mostra todos.
export function filtrarMembros<T extends { nome: string; email: string; numero: number }>(
  membros: T[],
  busca: string,
): T[] {
  const termo = simplificar(busca);
  if (!termo) return membros;
  const numero = /^#?\d+$/.test(termo) ? Number(termo.replace('#', '')) : null;
  if (numero !== null) return membros.filter((m) => m.numero === numero);
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
