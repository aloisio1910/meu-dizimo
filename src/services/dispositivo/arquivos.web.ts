// Na web (painel da tesouraria), o arquivo vem do seletor do navegador.
import * as DocumentPicker from 'expo-document-picker';

export type ArquivoEscolhido = {
  tipo: string | null;
  nome: string | null;
  tamanho: number | null;
  ler: () => Promise<Uint8Array>;
};

export type ResultadoDaEscolha =
  | { ok: true; arquivo: ArquivoEscolhido }
  | { ok: false; motivo: 'cancelado' | 'permissao_negada' };

async function escolher(tipo: string | string[]): Promise<ResultadoDaEscolha> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: tipo, base64: false });
  const documento = resultado.assets?.[0];
  if (resultado.canceled || !documento?.file) return { ok: false, motivo: 'cancelado' };
  const arquivo = documento.file;
  return {
    ok: true,
    arquivo: {
      tipo: arquivo.type || null,
      nome: arquivo.name,
      tamanho: arquivo.size,
      ler: async () => new Uint8Array(await arquivo.arrayBuffer()),
    },
  };
}

// No computador não há câmera do celular: a "foto" é uma imagem escolhida.
export async function escolherFoto(_origem: 'camera' | 'galeria'): Promise<ResultadoDaEscolha> {
  return escolher(['image/jpeg', 'image/png']);
}

export async function escolherPdf(): Promise<ResultadoDaEscolha> {
  return escolher('application/pdf');
}
