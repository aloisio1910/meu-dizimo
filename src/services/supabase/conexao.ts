import { urlDoSupabase } from './cliente';

// Confere se o servidor do Supabase responde (usado na tela provisória para
// testar a rede entre o celular e o computador).
export async function servidorRespondendo(): Promise<boolean> {
  try {
    const resposta = await fetch(`${urlDoSupabase}/auth/v1/health`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    });
    return resposta.ok;
  } catch {
    return false;
  }
}
