// Entrada pela digital ou pelo rosto (D-058). A biometria só confirma que é
// o dono do aparelho; o login em si continua sendo a sessão do Supabase.
// A digital e o rosto nunca saem do aparelho: o app só recebe "sim" ou "não".
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export type PreferenciaDeBiometria = 'ativada' | 'recusada';
export type ResultadoDaBiometria = 'ok' | 'cancelado' | 'falhou';

const NOME_DA_PREFERENCIA = 'meudizimo.biometria';

export async function biometriaDisponivel(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function lerPreferencia(): Promise<PreferenciaDeBiometria | null> {
  const valor = await SecureStore.getItemAsync(NOME_DA_PREFERENCIA);
  return valor === 'ativada' || valor === 'recusada' ? valor : null;
}

export async function gravarPreferencia(preferencia: PreferenciaDeBiometria | null): Promise<void> {
  if (preferencia) await SecureStore.setItemAsync(NOME_DA_PREFERENCIA, preferencia);
  else await SecureStore.deleteItemAsync(NOME_DA_PREFERENCIA);
}

export async function autenticar(textos: { motivo: string; cancelar: string }): Promise<ResultadoDaBiometria> {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: textos.motivo,
      cancelLabel: textos.cancelar,
    });
    if (resultado.success) return 'ok';
    return resultado.error === 'user_cancel' || resultado.error === 'system_cancel' || resultado.error === 'app_cancel'
      ? 'cancelado'
      : 'falhou';
  } catch {
    return 'falhou';
  }
}
