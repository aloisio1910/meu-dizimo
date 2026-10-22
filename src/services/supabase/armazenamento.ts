// Onde a sessão de login fica guardada no celular.
//
// A sessão é criptografada (AES-256-GCM) e gravada no banco local do app
// (expo-sqlite). A chave fica no cofre do aparelho (Keychain no iPhone,
// Keystore no Android), só pode ser lida com o aparelho desbloqueado e não
// vai para backups nem para outro aparelho.
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import 'expo-sqlite/localStorage/install';

import { bytesParaTexto, textoParaBytes } from '@/lib/utf8';

const NOME_DA_CHAVE = 'meudizimo.chave-da-sessao';
const PREFIXO = 'cifrado:';
const opcoesDoCofre: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let chaveEmMemoria: Promise<AESEncryptionKey> | undefined;

async function obterChave(): Promise<AESEncryptionKey> {
  chaveEmMemoria ??= (async () => {
    const guardada = await SecureStore.getItemAsync(NOME_DA_CHAVE, opcoesDoCofre);
    if (guardada) return (await AESEncryptionKey.import(guardada, 'base64')) as AESEncryptionKey;

    const nova = (await AESEncryptionKey.generate()) as AESEncryptionKey;
    await SecureStore.setItemAsync(NOME_DA_CHAVE, await nova.encoded('base64'), opcoesDoCofre);
    return nova;
  })();
  // Se algo falhar, a próxima tentativa recomeça do zero.
  chaveEmMemoria.catch(() => {
    chaveEmMemoria = undefined;
  });
  return chaveEmMemoria;
}

export const armazenamentoDaSessao = {
  async getItem(nome: string): Promise<string | null> {
    const guardado = localStorage.getItem(nome);
    if (guardado === null) return null;
    // Sessões gravadas antes da criptografia: lidas uma vez e regravadas
    // cifradas na próxima renovação do login.
    if (!guardado.startsWith(PREFIXO)) return guardado;

    try {
      const selado = AESSealedData.fromCombined(guardado.slice(PREFIXO.length));
      const bytes = (await aesDecryptAsync(selado, await obterChave())) as Uint8Array;
      return bytesParaTexto(bytes);
    } catch {
      // Chave perdida (ex.: app reinstalado): a sessão não pode ser lida e a
      // pessoa entra de novo com o código por e-mail.
      localStorage.removeItem(nome);
      return null;
    }
  },

  async setItem(nome: string, valor: string): Promise<void> {
    const selado = await aesEncryptAsync(textoParaBytes(valor), await obterChave());
    localStorage.setItem(nome, PREFIXO + (await selado.combined('base64')));
  },

  async removeItem(nome: string): Promise<void> {
    localStorage.removeItem(nome);
  },
};
