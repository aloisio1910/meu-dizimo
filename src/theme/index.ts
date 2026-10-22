import { corDoTextoSobre } from '@/lib/contraste';

// Identidade visual: alto contraste, letras grandes e alvos de toque largos,
// pensados para quem tem pouca familiaridade com tecnologia.

export const fontes = {
  normal: 'AtkinsonHyperlegible_400Regular',
  negrito: 'AtkinsonHyperlegible_700Bold',
} as const;

// Cor principal padrão, usada até a igreja definir a sua (contraste 7,7:1 com branco).
export const corPrincipalPadrao = '#1E4FA3';

export const cores = {
  fundo: '#FFFFFF',
  texto: '#111111',
  textoApoio: '#4A4A4A', // 8,9:1 sobre branco
  borda: '#6B6B6B', // 5,3:1: borda de campo visível
  erro: '#B3261E', // 6,5:1
  desabilitado: '#767676', // 4,5:1: mesmo desabilitado, o texto continua legível
} as const;

// Selo de status do lançamento: cor clara de fundo e texto escuro, sempre
// com o nome do status escrito (a cor sozinha não basta para quem não
// distingue cores). Contraste conferido nos testes.
export const coresDeStatus = {
  aguardando: { fundo: '#FFF4D6', texto: '#6B4E00' },
  em_conferencia: { fundo: '#E3EEFF', texto: '#1E4FA3' },
  confirmado: { fundo: '#E3F4E4', texto: '#1B5E20' },
  divergencia: { fundo: '#FDE7E4', texto: '#9A1B12' },
  cancelado: { fundo: '#EEEEEE', texto: '#4A4A4A' },
} as const;

export const tamanhos = {
  apoio: 16,
  corpo: 18,
  destaque: 22,
  titulo: 28,
} as const;

export const espacos = {
  pequeno: 8,
  medio: 16,
  grande: 24,
  enorme: 32,
} as const;

// Alvo mínimo de toque exigido pelo projeto é 44 px; os botões usam mais.
export const alvoMinimo = 44;
export const alturaBotao = 56;
export const raio = 12;

export type Tema = {
  corPrincipal: string;
  textoSobrePrincipal: string;
};

export function criarTema(corPrincipal: string = corPrincipalPadrao): Tema {
  return { corPrincipal, textoSobrePrincipal: corDoTextoSobre(corPrincipal) };
}
