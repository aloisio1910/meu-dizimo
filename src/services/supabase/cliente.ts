import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/banco';

import { armazenamentoDaSessao } from './armazenamento';

// Só a chave pública (publishable) vai no app; quem protege os dados é a RLS.
// A chave secreta nunca entra aqui.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chavePublica) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env (veja .env.example).',
  );
}

export const urlDoSupabase = url;

export const supabase = createClient<Database>(url, chavePublica, {
  auth: {
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
