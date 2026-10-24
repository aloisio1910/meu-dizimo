// Onde a sessão de login fica guardada no celular.
//
// A sessão é criptografada (AES-256-GCM) e gravada no banco local do app
// (expo-sqlite). A chave fica no cofre do aparelho (Keychain no iPhone,
// Keystore no Android), só pode ser lida com o aparelho desbloqueado e não
// vai para backups nem para outro aparelho.
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import 'expo-sqlite/localStorage/install';

import { base64ParaBytes, bytesParaBase64 } from '@/lib/base64';
import { bytesParaTexto, textoParaBytes } from '@/lib/utf8';

const NOME_DA_CHAVE = 'meudizimo.chave-da-sessao';
const PREFIXO = 'cifrado:';
const opcoesDoCofre: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Em desenvolvimento, os erros aparecem na janela do "npx expo start";
// no app publicado, ficam em silêncio (o membro só volta a entrar pelo código).
function avisarEmDesenvolvimento(etapa: string, erro: unknown) {
  if (__DEV__) console.warn(`[sessão] falha ao ${etapa}:`, erro);
}

let chaveEmMemoria: Promise<AESEncryptionKey> | undefined;

// O módulo nativo só recebe bytes: no Android, o fromCombined não aceita o
// texto base64 que a documentação promete. A conversão para texto é nossa.
async function cifrar(texto: string, chave: AESEncryptionKey): Promise<string> {
  const selado = await aesEncryptAsync(textoParaBytes(texto), chave);
  return bytesParaBase64(await selado.combined('bytes'));
}

async function decifrar(guardado: string, chave: AESEncryptionKey): Promise<string> {
  const selado = AESSealedData.fromCombined(base64ParaBytes(guardado));
  return bytesParaTexto((await aesDecryptAsync(selado, chave)) as Uint8Array);
}

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
      return await decifrar(guardado.slice(PREFIXO.length), await obterChave());
    } catch (erro) {
      // Chave perdida (ex.: app reinstalado): a sessão não pode ser lida e a
      // pessoa entra de novo com o código por e-mail.
      avisarEmDesenvolvimento('ler a sessão', erro);
      localStorage.removeItem(nome);
      return null;
    }
  },

  async setItem(nome: string, valor: string): Promise<void> {
    try {
      localStorage.setItem(nome, PREFIXO + (await cifrar(valor, await obterChave())));
    } catch (erro) {
      avisarEmDesenvolvimento('gravar a sessão', erro);
      throw erro;
    }
  },

  async removeItem(nome: string): Promise<void> {
    localStorage.removeItem(nome);
  },
};

// Diagnóstico de desenvolvimento: cifra e decifra um texto de teste e mostra
// cada etapa na janela do "npx expo start".
export async function autotesteDoArmazenamento(): Promise<void> {
  if (!__DEV__) return;
  const etapas: string[] = [];
  try {
    const chaveGuardada = await SecureStore.getItemAsync(NOME_DA_CHAVE, opcoesDoCofre);
    etapas.push(`chave no cofre: ${chaveGuardada ? 'sim' : 'não'}`);
    const chave = await obterChave();
    etapas.push(`chave pronta (${chave.size} bits)`);
    const original = 'Cartão de Dízimo ✓';
    const cifrado = await cifrar(original, chave);
    etapas.push(`cifrado (${cifrado.length} caracteres)`);
    const lido = await decifrar(cifrado, chave);
    etapas.push(lido === original ? 'decifrado: igual ao original' : `decifrado DIFERENTE: "${lido}"`);
    let sessao: string | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const nome = localStorage.key(i);
      if (nome === 'meudizimo-sessao') sessao = nome;
    }
    const valor = sessao ? localStorage.getItem(sessao) : null;
    etapas.push(`sessão guardada: ${valor ? (valor.startsWith(PREFIXO) ? 'cifrada' : 'sem cifra (antiga)') : 'nenhuma'}`);
    console.log('[sessão] autoteste OK →', etapas.join(' | '));
  } catch (erro) {
    console.warn('[sessão] autoteste FALHOU depois de:', etapas.join(' | '), erro);
  }
}
