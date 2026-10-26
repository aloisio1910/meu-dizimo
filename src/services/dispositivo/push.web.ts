// Na web (painel da tesouraria) não há push: os avisos ficam no menu Avisos.
export type DadosDoPush = {
  notificacao_id?: string;
  igreja_id?: string;
  tipo?: string;
  dados?: Record<string, unknown>;
};

export function pushDisponivel(): boolean {
  return false;
}

export async function pedirTokenDePush(_nomeDoCanal: string): Promise<string | null> {
  return null;
}

export async function ouvirNotificacoes(_aoTocar: (dados: DadosDoPush) => void): Promise<() => void> {
  return () => {};
}
