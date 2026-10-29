// Segunda confirmação da exclusão de conta: a pessoa digita EXCLUIR (sem
// diferença entre maiúsculas e minúsculas, e sem espaços nas pontas).
export const PALAVRA_DE_CONFIRMACAO = 'EXCLUIR';

export function confirmacaoValida(texto: string): boolean {
  return texto.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}
