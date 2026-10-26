import { Platform } from 'react-native';

import { pedirTokenDePush } from '@/services/dispositivo/push';

import { supabase } from './cliente';

// Aparelhos que recebem push (tabela dispositivos). O banco liga o token a
// quem está logado; se o aparelho trocar de conta, o token muda de dono.

let tokenDesteAparelho: string | null = null;

export async function registrarEsteAparelho(nomeDoCanal: string): Promise<boolean> {
  const token = await pedirTokenDePush(nomeDoCanal);
  if (!token) return false;
  const { error } = await supabase.rpc('registrar_dispositivo', {
    p_token: token,
    p_plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  tokenDesteAparelho = token;
  return true;
}

// Ao sair, o aparelho para de receber os avisos dessa pessoa.
export async function desativarEsteAparelho(): Promise<void> {
  if (!tokenDesteAparelho) return;
  const { error } = await supabase.rpc('desativar_dispositivo', { p_token: tokenDesteAparelho });
  if (error) throw error;
  tokenDesteAparelho = null;
}
