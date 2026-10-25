// Chamada de rede com tempo máximo de espera. Sem isto, um endereço que
// não responde (ex.: o IP do computador mudou) deixava a tela em
// "carregando" para sempre; com o limite, a chamada falha e a tela mostra a
// mensagem de erro com "Tentar de novo".
export const LIMITE_DE_ESPERA_MS = 20_000;

// Envio de arquivo (comprovante de até 10 MB, artes) numa internet fraca de
// celular demora mais: o limite não pode cortar um envio que está andando.
export const LIMITE_DE_ENVIO_MS = 180_000;

type Fetch = (entrada: RequestInfo | URL, opcoes?: RequestInit) => Promise<Response>;

function enderecoDe(entrada: RequestInfo | URL): string {
  if (typeof entrada === 'string') return entrada;
  if (entrada instanceof URL) return entrada.href;
  return entrada.url;
}

export function limiteDaChamada(entrada: RequestInfo | URL, opcoes: RequestInit = {}): number {
  const metodo = (opcoes.method ?? 'GET').toUpperCase();
  const ehEnvioDeArquivo = enderecoDe(entrada).includes('/storage/v1/object') && (metodo === 'POST' || metodo === 'PUT');
  return ehEnvioDeArquivo ? LIMITE_DE_ENVIO_MS : LIMITE_DE_ESPERA_MS;
}

export function fetchComLimite(fetchOriginal: Fetch, limiteMs?: number): Fetch {
  return (entrada, opcoes = {}) => {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), limiteMs ?? limiteDaChamada(entrada, opcoes));
    // Se quem chamou já pode cancelar, o cancelamento dele continua valendo.
    opcoes.signal?.addEventListener('abort', () => controle.abort(), { once: true });
    return fetchOriginal(entrada, { ...opcoes, signal: controle.signal }).finally(() => clearTimeout(relogio));
  };
}
