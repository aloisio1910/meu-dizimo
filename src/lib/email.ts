// Mesma regra do banco (membros.email): algo@dominio.extensao, sem espaços.
const formatoDeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return formatoDeEmail.test(normalizarEmail(email));
}
