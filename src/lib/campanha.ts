import { dataParaIso } from './data';

// Regras da tela Campanhas (P-02). O banco confere de novo (trigger
// proteger_campanha e as restrições da tabela).

export type FormatoDaArte = 'jpg' | 'png' | 'webp';

// Artes, logo e capa até 5 MB (D-077).
export const TAMANHO_MAXIMO_DA_ARTE = 5 * 1024 * 1024;

export const TIPO_DA_ARTE: Record<FormatoDaArte, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// Formato pela assinatura no início do arquivo, como no comprovante.
export function formatoDaArte(bytes: Uint8Array): FormatoDaArte | null {
  const em = (inicio: number, ...assinatura: number[]) => assinatura.every((byte, i) => bytes[inicio + i] === byte);
  if (em(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (em(0, 0xff, 0xd8, 0xff)) return 'jpg';
  if (em(0, 0x52, 0x49, 0x46, 0x46) && em(8, 0x57, 0x45, 0x42, 0x50)) return 'webp'; // RIFF....WEBP
  return null;
}

// <igreja_id>/<campanha_id>/<arquivo>, como a política do bucket exige.
export function caminhoDaArte(igrejaId: string, campanhaId: string, idDoArquivo: string, formato: FormatoDaArte) {
  return `${igrejaId}/${campanhaId}/${idDoArquivo}.${formato}`;
}

export type CamposDaCampanha = {
  nome: string;
  descricao: string;
  objetivo: string;
  inicio: string; // DD/MM/AAAA ou vazio
  fim: string; // DD/MM/AAAA ou vazio
  linkVideo: string;
};

export type DadosDaCampanha = {
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  inicio: string | null; // AAAA-MM-DD
  fim: string | null;
  link_video: string | null;
};

export type ErrosDaCampanha = {
  nome?: 'nomeObrigatorio';
  inicio?: 'dataInvalida';
  fim?: 'dataInvalida' | 'fimAntesDoInicio' | 'fimNoPassado';
  linkVideo?: 'linkInvalido';
};

const vazioParaNulo = (texto: string) => texto.trim() || null;

// "hoje" vem de fora para a regra ser testável. A data de fim no passado só
// é erro para campanha que vai ficar ativa (D-089): ela encerraria na hora.
export function validarCampanha(
  campos: CamposDaCampanha,
  hoje: string,
  vaiFicarAtiva: boolean,
): { ok: true; dados: DadosDaCampanha } | { ok: false; erros: ErrosDaCampanha } {
  const erros: ErrosDaCampanha = {};
  const inicio = campos.inicio.trim() ? dataParaIso(campos.inicio) : null;
  const fim = campos.fim.trim() ? dataParaIso(campos.fim) : null;
  const link = campos.linkVideo.trim();

  if (!campos.nome.trim()) erros.nome = 'nomeObrigatorio';
  if (campos.inicio.trim() && !inicio) erros.inicio = 'dataInvalida';
  if (campos.fim.trim() && !fim) erros.fim = 'dataInvalida';
  else if (fim && inicio && fim < inicio) erros.fim = 'fimAntesDoInicio';
  else if (fim && vaiFicarAtiva && fim < hoje) erros.fim = 'fimNoPassado';
  if (link && !/^https?:\/\/\S+$/i.test(link)) erros.linkVideo = 'linkInvalido';

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      nome: campos.nome.trim(),
      descricao: vazioParaNulo(campos.descricao),
      objetivo: vazioParaNulo(campos.objetivo),
      inicio,
      fim,
      link_video: link || null,
    },
  };
}

export type StatusDaCampanha = 'rascunho' | 'ativa' | 'encerrada';

export type MudancaDaCampanha = { acao: 'publicar' | 'encerrar' | 'reabrir'; para: StatusDaCampanha };

// Espelha a trigger proteger_campanha (D-088): rascunho publica, ativa
// encerra, encerrada reabre. A permanente "Oferta" nunca encerra.
export function mudancaDaCampanha(campanha: { status: StatusDaCampanha; permanente: boolean }): MudancaDaCampanha | null {
  if (campanha.status === 'rascunho') return { acao: 'publicar', para: 'ativa' };
  if (campanha.status === 'encerrada') return { acao: 'reabrir', para: 'ativa' };
  return campanha.permanente ? null : { acao: 'encerrar', para: 'encerrada' };
}
