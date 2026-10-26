import { AuthError } from '@supabase/supabase-js';

import { normalizarEmail } from '@/lib/email';

import { supabase } from './cliente';
import { desativarEsteAparelho } from './dispositivos';

// Erros que a tela de entrada sabe explicar (cada um tem texto no i18n).
export type ErroDeAcesso =
  | 'convite_nao_encontrado'
  | 'codigo_invalido'
  | 'muitas_tentativas'
  | 'sem_conexao'
  | 'erro_inesperado';

export type Resultado = { ok: true } | { ok: false; erro: ErroDeAcesso };

function traduzirErro(erro: unknown): ErroDeAcesso {
  if (erro instanceof AuthError) {
    // Recusa do hook do banco: e-mail sem convite válido (RN-002).
    if (erro.message === 'convite_nao_encontrado') return 'convite_nao_encontrado';
    if (erro.code === 'otp_expired' || erro.code === 'otp_disabled') return 'codigo_invalido';
    if (erro.status === 429 || erro.code?.startsWith('over_')) return 'muitas_tentativas';
    if (erro.name === 'AuthRetryableFetchError') return 'sem_conexao';
  }
  if (erro instanceof TypeError) return 'sem_conexao';
  return 'erro_inesperado';
}

async function executar(acao: () => Promise<{ error: AuthError | null }>): Promise<Resultado> {
  try {
    const { error } = await acao();
    return error ? { ok: false, erro: traduzirErro(error) } : { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}

// Envia o código de 6 dígitos por e-mail. No primeiro acesso o login é
// criado aqui, se houver convite válido.
export function pedirCodigo(email: string): Promise<Resultado> {
  return executar(() =>
    supabase.auth.signInWithOtp({ email: normalizarEmail(email), options: { shouldCreateUser: true } }),
  );
}

export function entrarComCodigo(email: string, codigo: string): Promise<Resultado> {
  return executar(() => supabase.auth.verifyOtp({ email: normalizarEmail(email), token: codigo, type: 'email' }));
}

export async function sair(): Promise<Resultado> {
  // Antes de perder o login: depois dele o banco já não deixa desligar.
  await desativarEsteAparelho().catch(() => {});
  return executar(() => supabase.auth.signOut());
}
