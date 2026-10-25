import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { fetchComLimite, LIMITE_DE_ENVIO_MS, LIMITE_DE_ESPERA_MS, limiteDaChamada } from '../fetch-com-limite';

describe('limiteDaChamada', () => {
  it('consultas têm o limite curto', () => {
    expect(limiteDaChamada('http://banco/rest/v1/membros')).toBe(LIMITE_DE_ESPERA_MS);
    expect(limiteDaChamada('http://banco/storage/v1/object/sign/comprovantes/x', { method: 'GET' })).toBe(
      LIMITE_DE_ESPERA_MS,
    );
  });

  it('envio de arquivo ao Storage tem o limite longo', () => {
    expect(limiteDaChamada('http://banco/storage/v1/object/comprovantes/a/b.pdf', { method: 'POST' })).toBe(
      LIMITE_DE_ENVIO_MS,
    );
  });
});

// Um "fetch" que só responde quando mandarem, ou é cancelado pelo sinal.
function fetchQueEspera() {
  let responder: (r: Response) => void = () => {};
  const chamado = jest.fn((_entrada: RequestInfo | URL, opcoes?: RequestInit) => {
    return new Promise<Response>((resolver, rejeitar) => {
      responder = resolver;
      opcoes?.signal?.addEventListener('abort', () => rejeitar(new Error('cancelado')));
    });
  });
  return { chamado, responder: (r: Response) => responder(r) };
}

describe('fetchComLimite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancela a chamada que passa do limite', async () => {
    const { chamado } = fetchQueEspera();
    const promessa = fetchComLimite(chamado, 1000)('http://banco');
    jest.advanceTimersByTime(1000);
    await expect(promessa).rejects.toThrow('cancelado');
  });

  it('deixa passar a resposta que chega antes do limite', async () => {
    const { chamado, responder } = fetchQueEspera();
    const promessa = fetchComLimite(chamado, 1000)('http://banco');
    const resposta = { ok: true } as Response;
    responder(resposta);
    await expect(promessa).resolves.toBe(resposta);
  });

  it('respeita o cancelamento de quem chamou', async () => {
    const { chamado } = fetchQueEspera();
    const doChamador = new AbortController();
    const promessa = fetchComLimite(chamado, 60_000)('http://banco', { signal: doChamador.signal });
    doChamador.abort();
    await expect(promessa).rejects.toThrow('cancelado');
  });
});
