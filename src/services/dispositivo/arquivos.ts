// Escolher o comprovante no celular: foto pela câmera, imagem da galeria ou PDF.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { base64ParaBytes } from '@/lib/base64';

export type ArquivoEscolhido = {
  tipo: string | null;
  nome: string | null;
  tamanho: number | null;
  ler: () => Promise<Uint8Array>;
};

export type ResultadoDaEscolha =
  | { ok: true; arquivo: ArquivoEscolhido }
  | { ok: false; motivo: 'cancelado' | 'permissao_negada' };

// Fotos de celular passam fácil de 10 MB: a qualidade 0,6 reduz bastante
// sem perder a leitura do comprovante. "compatible" faz o iPhone entregar
// JPEG em vez de HEIC.
const OPCOES_DE_FOTO: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// Lê o arquivo tentando três caminhos, porque cada origem tem as suas regras:
// a API atual (File), a leitura clássica em base64 e, por fim, o fetch, que
// não passa pela checagem de pastas do Expo Go.
async function lerBytes(uri: string): Promise<Uint8Array> {
  const tentativas: [string, () => Promise<Uint8Array>][] = [
    ['File', () => new File(uri).bytes()],
    ['base64', async () => base64ParaBytes(await readAsStringAsync(uri, { encoding: 'base64' }))],
    ['fetch', async () => new Uint8Array(await (await fetch(uri)).arrayBuffer())],
  ];
  const falhas: string[] = [];
  for (const [nome, ler] of tentativas) {
    try {
      const bytes = await ler();
      if (__DEV__ && falhas.length > 0) console.warn(`[comprovante] lido por ${nome} depois de:`, falhas.join(' | '));
      return bytes;
    } catch (erro) {
      falhas.push(`${nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }
  throw new Error(`uri=${uri} | ${falhas.join(' | ')}`);
}

function deArquivoLocal(uri: string, tipo: string | null, nome: string | null, tamanho: number | null): ArquivoEscolhido {
  return { tipo, nome, tamanho, ler: () => lerBytes(uri) };
}

export async function escolherFoto(origem: 'camera' | 'galeria'): Promise<ResultadoDaEscolha> {
  const permissao =
    origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return { ok: false, motivo: 'permissao_negada' };

  const resultado =
    origem === 'camera'
      ? await ImagePicker.launchCameraAsync(OPCOES_DE_FOTO)
      : await ImagePicker.launchImageLibraryAsync(OPCOES_DE_FOTO);
  const foto = resultado.assets?.[0];
  if (resultado.canceled || !foto) return { ok: false, motivo: 'cancelado' };

  return {
    ok: true,
    arquivo: deArquivoLocal(foto.uri, foto.mimeType ?? 'image/jpeg', foto.fileName ?? null, foto.fileSize ?? null),
  };
}

export async function escolherPdf(): Promise<ResultadoDaEscolha> {
  // Sem copiar para o cache: no Expo Go, a cópia vai para uma pasta do próprio
  // Expo Go que o app não tem permissão de ler. O endereço original vem com a
  // permissão de leitura concedida pelo Android para este arquivo.
  const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: false });
  const documento = resultado.assets?.[0];
  if (resultado.canceled || !documento) return { ok: false, motivo: 'cancelado' };
  return {
    ok: true,
    arquivo: deArquivoLocal(documento.uri, documento.mimeType ?? null, documento.name, documento.size ?? null),
  };
}
