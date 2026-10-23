// Regras do comprovante: PDF, JPG ou PNG, até 10 MB (D-077), guardado em
// <igreja_id>/<lancamento_id>/<arquivo> no bucket privado "comprovantes".

export type FormatoDoComprovante = 'pdf' | 'jpg' | 'png';

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

const POR_TIPO: Record<string, FormatoDoComprovante> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const POR_EXTENSAO: Record<string, FormatoDoComprovante> = { pdf: 'pdf', jpg: 'jpg', jpeg: 'jpg', png: 'png' };

export const TIPO_DO_FORMATO: Record<FormatoDoComprovante, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

// Descobre o formato pelo tipo informado pelo celular ou, se faltar, pela
// extensão do nome. Null = formato não aceito (ex.: HEIC do iPhone, Word).
export function formatoDoArquivo(tipo?: string | null, nome?: string | null): FormatoDoComprovante | null {
  if (tipo && POR_TIPO[tipo.toLowerCase()]) return POR_TIPO[tipo.toLowerCase()];
  const extensao = nome?.split('.').pop()?.toLowerCase();
  if (!tipo && extensao && POR_EXTENSAO[extensao]) return POR_EXTENSAO[extensao];
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
