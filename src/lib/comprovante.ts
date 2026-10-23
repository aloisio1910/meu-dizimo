// Regras do comprovante: PDF, JPG ou PNG, até 10 MB (D-077), guardado em
// <igreja_id>/<lancamento_id>/<arquivo> no bucket privado "comprovantes".

export type FormatoDoComprovante = 'pdf' | 'jpg' | 'png';

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

export const TIPO_DO_FORMATO: Record<FormatoDoComprovante, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

// Formato pela "assinatura" no início do arquivo, que não depende do nome nem
// do tipo informado pelo celular (alguns Androids informam PDF como arquivo
// genérico). Um arquivo disfarçado com outra extensão, ou um HEIC do iPhone,
// não passa. Null = formato não aceito.
export function formatoPeloConteudo(bytes: Uint8Array): FormatoDoComprovante | null {
  const comeca = (...assinatura: number[]) => assinatura.every((byte, i) => bytes[i] === byte);
  if (comeca(0x25, 0x50, 0x44, 0x46)) return 'pdf'; // %PDF
  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (comeca(0xff, 0xd8, 0xff)) return 'jpg';
  return null;
}

export function caminhoDoComprovante(
  igrejaId: string,
  lancamentoId: string,
  idDoArquivo: string,
  formato: FormatoDoComprovante,
): string {
  return `${igrejaId}/${lancamentoId}/${idDoArquivo}.${formato}`;
}
