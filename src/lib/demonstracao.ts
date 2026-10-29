// Contas de demonstração dos revisores das lojas (igreja fictícia). O domínio
// .invalid é reservado e nunca recebe e-mail: para estes endereços o app não
// pede código por e-mail, e a entrada passa pela função entrar-demonstracao,
// que confere o código fixo no servidor.
const DOMINIO_DE_DEMONSTRACAO = '@demonstracao.invalid';

export function ehEmailDeDemonstracao(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DOMINIO_DE_DEMONSTRACAO);
}
