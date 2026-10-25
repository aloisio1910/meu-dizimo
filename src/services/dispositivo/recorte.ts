// Corta e reduz a imagem com a biblioteca do Expo (funciona no celular e na
// web) e devolve os bytes, prontos para o envio ao Storage.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ParaBytes } from '@/lib/base64';

export type RetanguloDoRecorte = { originX: number; originY: number; width: number; height: number };

export async function recortarImagem(
  uri: string,
  retangulo: RetanguloDoRecorte,
  larguraFinal: number,
  formato: 'png' | 'jpg',
): Promise<Uint8Array> {
  const contexto = ImageManipulator.manipulate(uri).crop(retangulo);
  // Só reduz: imagem menor que o tamanho final não é esticada.
  if (retangulo.width > larguraFinal) contexto.resize({ width: larguraFinal });
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({
    format: formato === 'png' ? SaveFormat.PNG : SaveFormat.JPEG,
    compress: 0.85,
    base64: true,
  });
  if (!salva.base64) throw new Error('recorte sem conteúdo');
  return base64ParaBytes(salva.base64);
}
