// Preferências pequenas deste aparelho (ex.: a igreja em uso, D-061). No
// celular ficam no SecureStore; se ele falhar, o app segue com o padrão.
import * as SecureStore from 'expo-secure-store';

export async function lerPreferencia(nome: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(nome);
  } catch {
    return null;
  }
}

export async function gravarPreferencia(nome: string, valor: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(nome, valor);
  } catch {
    // Só uma conveniência: sem ela, o app pergunta de novo.
  }
}
