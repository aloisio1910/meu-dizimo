// Formas de devolução que o app sabe nomear; a igreja pode cadastrar outras,
// que aparecem com o nome que ela escreveu.
export const FORMAS_CONHECIDAS = ['pix', 'cartao', 'dinheiro', 'transferencia'] as const;

export type FormaConhecida = (typeof FORMAS_CONHECIDAS)[number];

export function ehFormaConhecida(forma: string): forma is FormaConhecida {
  return (FORMAS_CONHECIDAS as readonly string[]).includes(forma);
}
