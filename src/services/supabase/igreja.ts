import type { Database, Json } from '@/types/banco';

import { supabase } from './cliente';

type Enums = Database['public']['Enums'];

export type DadosDaIgreja = {
  nome: string;
  endereco: string | null;
  horarios_culto: string | null;
  site: string | null;
  redes_sociais: Json;
  whatsapp_contato: string | null;
};

export type ContaDaIgreja = {
  id: string;
  nome: string;
  finalidade: string | null;
  principal: boolean;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  chave_pix: string | null;
  tipo_chave_pix: Enums['tipo_chave_pix'] | null;
  nome_recebedor: string | null;
};

// M-09: informações de contato da igreja.
export async function buscarDadosDaIgreja(igrejaId: string): Promise<DadosDaIgreja | null> {
  const { data, error } = await supabase
    .from('igrejas')
    .select('nome, endereco, horarios_culto, site, redes_sociais, whatsapp_contato')
    .eq('id', igrejaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Contas ativas da igreja, a principal primeiro (Requisitos v0.3, seção 7).
export async function listarContasDaIgreja(igrejaId: string): Promise<ContaDaIgreja[]> {
  const { data, error } = await supabase
    .from('contas')
    .select('id, nome, finalidade, principal, banco, agencia, numero_conta, chave_pix, tipo_chave_pix, nome_recebedor')
    .eq('igreja_id', igrejaId)
    .eq('ativa', true)
    .order('principal', { ascending: false })
    .order('nome');
  if (error) throw error;
  return data;
}
