// Na web, as preferências do aparelho ficam no localStorage do navegador
// (pode estar bloqueado, como numa janela anônima: aí o app usa o padrão).
export async function lerPreferencia(nome: string): Promise<string | null> {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(nome);
  } catch {
    return null;
  }
}

export async function gravarPreferencia(nome: string, valor: string): Promise<void> {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(nome, valor);
  } catch {
    // Só uma conveniência: sem ela, o app pergunta de novo.
  }
}
