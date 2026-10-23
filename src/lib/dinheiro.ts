// Dinheiro sempre em centavos (inteiros) com o código da moeda; nunca float.

// Maior valor aceito num lançamento: R$ 999.999.999,99.
export const MAXIMO_EM_CENTAVOS = 99_999_999_999;

// "300" | "300,5" | "1.234,56" | "R$ 1.234,56" -> centavos; null se não for um valor válido.
export function textoParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;

  const [inteiros, decimais = ''] = limpo.replace(/\./g, '').split(',');
  const centavos = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0'));
  return centavos > 0 && centavos <= MAXIMO_EM_CENTAVOS ? centavos : null;
}

// 30000, "BRL", "pt-BR" -> "R$ 300,00"
export function formatarMoeda(centavos: number, moeda: string, idioma: string): string {
  return new Intl.NumberFormat(idioma, { style: 'currency', currency: moeda }).format(centavos / 100);
}

// Até 9 dígitos antes da vírgula: R$ 999.999.999,99, o máximo aceito.
const MAXIMO_DE_DIGITOS_INTEIROS = 9;

function comPontosDeMilhar(inteiros: string): string {
  return inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Máscara do campo de valor enquanto a pessoa digita: "10000" -> "10.000".
// Os pontos de milhar são colocados pelo próprio campo, então um ponto
// digitado no fim só pode ser a vírgula decimal de teclados que usam ponto
// ("300." -> "300,"); qualquer outro ponto é descartado.
export function mascararValor(texto: string): string {
  const normalizado = texto.endsWith('.') && !texto.includes(',') ? `${texto.slice(0, -1)},` : texto;
  const [parteInteira, ...resto] = normalizado.split(',');
  const inteiros = parteInteira
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAXIMO_DE_DIGITOS_INTEIROS);
  const formatado = comPontosDeMilhar(inteiros);
  if (resto.length === 0) return formatado;
  return `${formatado || '0'},${resto.join('').replace(/\D/g, '').slice(0, 2)}`;
}

// Ao sair do campo, completa os centavos: "10.000" -> "10.000,00", "300,5" -> "300,50".
export function completarValor(texto: string): string {
  const mascarado = mascararValor(texto);
  if (!mascarado) return '';
  const [inteiros, centavos = ''] = mascarado.split(',');
  return `${inteiros || '0'},${centavos.padEnd(2, '0')}`;
}
