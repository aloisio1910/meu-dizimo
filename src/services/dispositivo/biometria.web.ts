// Na web (painel da tesouraria) não há digital: a entrada é sempre pelo código.
export type PreferenciaDeBiometria = 'ativada' | 'recusada';
export type ResultadoDaBiometria = 'ok' | 'cancelado' | 'falhou';

export async function biometriaDisponivel(): Promise<boolean> {
  return false;
}

export async function lerPreferencia(): Promise<PreferenciaDeBiometria | null> {
  return null;
}

export async function gravarPreferencia(_preferencia: PreferenciaDeBiometria | null): Promise<void> {}

export async function autenticar(_textos: { motivo: string; cancelar: string }): Promise<ResultadoDaBiometria> {
  return 'falhou';
}
