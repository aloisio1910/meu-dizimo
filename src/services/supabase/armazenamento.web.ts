// Na web, a sessão fica no localStorage do navegador. Durante a geração da
// página no servidor não há navegador, então não há onde guardar.
export const armazenamentoDaSessao = typeof window === 'undefined' ? undefined : window.localStorage;

// O autoteste da criptografia só existe no celular.
export async function autotesteDoArmazenamento(): Promise<void> {}
