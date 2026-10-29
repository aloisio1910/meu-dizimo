import { AuthError } from '@supabase/supabase-js';

import { ehEmailDeDemonstracao } from '@/lib/demonstracao';
import { normalizarEmail } from '@/lib/email';

import { supabase } from './cliente';
import { desativarEsteAparelho } from './dispositivos';

// Erros que a tela de entrada sabe explicar (cada um tem texto no i18n).
export type ErroDeAcesso =
  'convite_nao_encontrado' | 'codigo_invalido' | 'muitas_tentativas' | 'sem_conexao' | 'erro_inesperado';

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
  // Contas de demonstração: não há e-mail; o código é o fixo do servidor.
  if (ehEmailDeDemonstracao(email)) return Promise.resolve({ ok: true });
  return executar(() =>
    supabase.auth.signInWithOtp({ email: normalizarEmail(email), options: { shouldCreateUser: true } }),
  );
}

export function entrarComCodigo(email: string, codigo: string): Promise<Resultado> {
  if (ehEmailDeDemonstracao(email)) return entrarNaDemonstracao(email, codigo);
  return executar(() => supabase.auth.verifyOtp({ email: normalizarEmail(email), token: codigo, type: 'email' }));
}

// Revisores das lojas: a função confere o código fixo e devolve um token de
// uso único, trocado aqui pela sessão.
async function entrarNaDemonstracao(email: string, codigo: string): Promise<Resultado> {
  try {
    const { data, error } = await supabase.functions.invoke('entrar-demonstracao', {
      body: { email: normalizarEmail(email), codigo },
    });
    if (error) {
      const resposta = (error as { context?: Response }).context;
      const corpo = resposta && typeof resposta.json === 'function' ? await resposta.json().catch(() => null) : null;
      if (corpo?.erro === 'codigo_invalido' || corpo?.erro === 'muitas_tentativas')
        return { ok: false, erro: corpo.erro };
      return { ok: false, erro: error.name === 'FunctionsFetchError' ? 'sem_conexao' : 'erro_inesperado' };
    }
    return executar(() => supabase.auth.verifyOtp({ token_hash: data.token, type: 'magiclink' }));
  } catch (erro) {
    return { ok: false, erro: traduzirErro(erro) };
  }
}

export async function sair(): Promise<Resultado> {
  // Antes de perder o login: depois dele o banco já não deixa desligar.
  await desativarEsteAparelho().catch(() => {});
  return executar(() => supabase.auth.signOut());
}
