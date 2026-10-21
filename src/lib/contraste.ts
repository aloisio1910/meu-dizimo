// Contraste entre cores pela fórmula da WCAG 2 (norma de acessibilidade).
// Usado para escolher texto branco ou preto sobre a cor principal da igreja.

function canalLinear(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const valor = hex.replace('#', '');
  const r = parseInt(valor.slice(0, 2), 16);
  const g = parseInt(valor.slice(2, 4), 16);
  const b = parseInt(valor.slice(4, 6), 16);
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

// Razão de contraste entre duas cores no formato #RRGGBB (1 a 21).
export function razaoDeContraste(cor1: string, cor2: string): number {
  const l1 = luminancia(cor1);
  const l2 = luminancia(cor2);
  const [clara, escura] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (clara + 0.05) / (escura + 0.05);
}

// Texto que mais contrasta com a cor de fundo: branco ou quase preto.
export function corDoTextoSobre(fundo: string): '#FFFFFF' | '#111111' {
  return razaoDeContraste(fundo, '#FFFFFF') >= razaoDeContraste(fundo, '#111111') ? '#FFFFFF' : '#111111';
}
