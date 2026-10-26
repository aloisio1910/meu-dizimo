// Números de página para mostrar, como na pesquisa do Google: sempre a
// primeira e a última, e duas de cada lado da atual. Os saltos viram "…".
// Páginas contadas a partir de 1, como aparecem na tela.

export type ItemDaPaginacao = number | 'salto';

const VIZINHAS = 2;

export function totalDePaginas(totalDeRegistros: number, tamanhoDaPagina: number): number {
  return Math.max(1, Math.ceil(totalDeRegistros / tamanhoDaPagina));
}

export function paginasVisiveis(atual: number, total: number): ItemDaPaginacao[] {
  const numeros = new Set<number>([1, total]);
  for (let p = atual - VIZINHAS; p <= atual + VIZINHAS; p++) {
    if (p >= 1 && p <= total) numeros.add(p);
  }
  const ordenados = [...numeros].sort((a, b) => a - b);
  const itens: ItemDaPaginacao[] = [];
  ordenados.forEach((p, i) => {
    const anterior = ordenados[i - 1];
    if (anterior !== undefined && p - anterior === 2) {
      // Um só número no buraco: mostra o número em vez de "…".
      itens.push(anterior + 1);
    } else if (anterior !== undefined && p - anterior > 2) {
      itens.push('salto');
    }
    itens.push(p);
  });
  return itens;
}
