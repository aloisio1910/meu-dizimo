import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { ajustarEnderecoLocal } from '@/lib/endereco-local';
import { fetchComLimite } from '@/lib/fetch-com-limite';
import type { Database } from '@/types/banco';

import { armazenamentoDaSessao } from './armazenamento';

// Só a chave pública (publishable) vai no app; quem protege os dados é a RLS.
// A chave secreta nunca entra aqui.
const urlDoEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!urlDoEnv || !chavePublica) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env (veja .env.example).',
  );
}

// Em desenvolvimento, segue o IP atual do computador (ver endereco-local.ts):
// no celular, pelo endereço de onde o Expo Go baixou o código; na web, pelo
// endereço da própria página, que é o mesmo computador do Supabase local.
const enderecoDoComputador =
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.host : Constants.expoConfig?.hostUri;
export const urlDoSupabase = __DEV__ ? ajustarEnderecoLocal(urlDoEnv, enderecoDoComputador) : urlDoEnv;

export const supabase = createClient<Database>(urlDoSupabase, chavePublica, {
  // Nenhuma chamada espera para sempre (ver fetch-com-limite.ts).
  global: { fetch: fetchComLimite(fetch) },
  auth: {
    // Nome fixo para a sessão: sem ele, a biblioteca usa parte do endereço do
    // servidor, e uma troca de endereço faria a pessoa perder o login.
    storageKey: 'meudizimo-sessao',
    storage: armazenamentoDaSessao,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// No celular, a renovação automática do login só roda com o app aberto.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
