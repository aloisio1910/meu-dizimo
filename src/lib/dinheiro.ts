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

// Máscara do campo de valor enquanto a pessoa digita: só números e uma vírgula com até 2 casas.
export function mascararValor(texto: string): string {
  const [inteiros, ...resto] = texto.replace(/[^\d,]/g, '').split(',');
  const semZerosAEsquerda = inteiros.replace(/^0+(?=\d)/, '');
  return resto.length > 0 ? `${semZerosAEsquerda || '0'},${resto.join('').slice(0, 2)}` : semZerosAEsquerda;
}
