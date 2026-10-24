import { razaoDeContraste } from './contraste';

// Paleta da cor principal da igreja (seção 17): só cores escuras, com
// contraste de pelo menos 7:1 com o branco (nível AAA da WCAG). A cor vira
// fundo de botão com texto branco e texto do botão secundário sobre branco,
// então uma cor clara deixaria o app ilegível para quem enxerga pouco.
// Vermelho fica de fora para não ser confundido com mensagem de erro.
export const PALETA = [
  { nome: 'azul', cor: '#1E4FA3' },
  { nome: 'marinho', cor: '#1B2F5E' },
  { nome: 'verde', cor: '#1B5E20' },
  { nome: 'petroleo', cor: '#0E5A63' },
  { nome: 'vinho', cor: '#7A1F3D' },
  { nome: 'roxo', cor: '#5B2C83' },
  { nome: 'marrom', cor: '#6D3F1F' },
  { nome: 'laranja', cor: '#8A3700' },
  { nome: 'grafite', cor: '#37474F' },
] as const;

export type NomeDaCor = (typeof PALETA)[number]['nome'];

export const CONTRASTE_MINIMO = 7;

// Cor que o app usa de fato: a da igreja, se estiver na paleta ou tiver o
// contraste mínimo; senão, a padrão. Protege o app mesmo se uma cor clara
// chegar ao banco por outro caminho.
export function corSegura(cor: string | null | undefined, padrao: string): string {
  if (!cor || !/^#[0-9A-Fa-f]{6}$/.test(cor)) return padrao;
  return razaoDeContraste(cor, '#FFFFFF') >= CONTRASTE_MINIMO ? cor : padrao;
}
