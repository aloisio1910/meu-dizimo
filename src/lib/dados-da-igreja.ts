import { chavePixValida } from './conta';

// Regras do formulário Dados e contato da igreja (P-03). O banco confere de
// novo o que depende dele (nome, formas aceitas, país e moeda).

export const REDES = ['instagram', 'facebook', 'youtube'] as const;
export type Rede = (typeof REDES)[number];

// "Texto curto" da seção 17: cabe numa notificação e no cartão.
export const LIMITE_DA_MENSAGEM = 200;
export const LIMITE_DO_VERSICULO = 300;

export type CamposDaIgreja = {
  nome: string;
  endereco: string;
  horarios: string;
  site: string;
  redes: Record<Rede, string>;
  whatsapp: string;
  versiculoReferencia: string;
  versiculoTexto: string;
  mensagemConfirmacao: string;
  formas: string[];
};

export type DadosDaIgrejaParaSalvar = {
  nome: string;
  endereco: string | null;
  horarios_culto: string | null;
  site: string | null;
  redes_sociais: Partial<Record<Rede, string>>;
  whatsapp_contato: string | null;
  versiculo_referencia: string;
  versiculo_texto: string | null;
  mensagem_confirmacao: string | null;
  formas_devolucao: string[];
};

export type CodigoDeErroDaIgreja =
  | 'nomeObrigatorio'
  | 'linkInvalido'
  | 'whatsappInvalido'
  | 'referenciaObrigatoria'
  | 'textoLongo'
  | 'escolhaUmaForma';

export type ErrosDaIgreja = Partial<
  Record<
    'nome' | 'site' | Rede | 'whatsapp' | 'versiculoReferencia' | 'versiculoTexto' | 'mensagem' | 'formas',
    CodigoDeErroDaIgreja
  >
>;

const vazioParaNulo = (texto: string) => texto.trim() || null;
const ehLink = (texto: string) => /^https?:\/\/\S+\.\S+$/i.test(texto.trim());

export function validarDadosDaIgreja(
  campos: CamposDaIgreja,
): { ok: true; dados: DadosDaIgrejaParaSalvar } | { ok: false; erros: ErrosDaIgreja } {
  const erros: ErrosDaIgreja = {};
  if (!campos.nome.trim()) erros.nome = 'nomeObrigatorio';
  if (campos.site.trim() && !ehLink(campos.site)) erros.site = 'linkInvalido';
  for (const rede of REDES) {
    if (campos.redes[rede].trim() && !ehLink(campos.redes[rede])) erros[rede] = 'linkInvalido';
  }
  // Mesmo formato do celular do Pix: DDD e número, com ou sem o 55.
  if (campos.whatsapp.trim() && !chavePixValida(campos.whatsapp, 'telefone')) erros.whatsapp = 'whatsappInvalido';
  if (!campos.versiculoReferencia.trim()) erros.versiculoReferencia = 'referenciaObrigatoria';
  if (campos.versiculoTexto.trim().length > LIMITE_DO_VERSICULO) erros.versiculoTexto = 'textoLongo';
  if (campos.mensagemConfirmacao.trim().length > LIMITE_DA_MENSAGEM) erros.mensagem = 'textoLongo';
  if (campos.formas.length === 0) erros.formas = 'escolhaUmaForma';

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const redes: Partial<Record<Rede, string>> = {};
  for (const rede of REDES) {
    if (campos.redes[rede].trim()) redes[rede] = campos.redes[rede].trim();
  }
  return {
    ok: true,
    dados: {
      nome: campos.nome.trim(),
      endereco: vazioParaNulo(campos.endereco),
      horarios_culto: vazioParaNulo(campos.horarios),
      site: vazioParaNulo(campos.site),
      redes_sociais: redes,
      whatsapp_contato: campos.whatsapp.trim() ? campos.whatsapp.replace(/\D/g, '') : null,
      versiculo_referencia: campos.versiculoReferencia.trim(),
      versiculo_texto: vazioParaNulo(campos.versiculoTexto),
      mensagem_confirmacao: vazioParaNulo(campos.mensagemConfirmacao),
      formas_devolucao: campos.formas,
    },
  };
}

// Redes guardadas no banco (objeto livre) viram os campos da tela.
export function redesIniciais(redesSociais: unknown): Record<Rede, string> {
  const guardadas = redesSociais && typeof redesSociais === 'object' ? (redesSociais as Record<string, unknown>) : {};
  return Object.fromEntries(REDES.map((rede) => [rede, typeof guardadas[rede] === 'string' ? guardadas[rede] : ''])) as Record<
    Rede,
    string
  >;
}
