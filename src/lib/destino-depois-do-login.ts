// Para onde ir depois de entrar: quem abre um QR Code do culto sem estar
// logado passa pelo login e volta à tela do QR. Fica só na memória do app:
// fechar o app esquece, o que é o esperado.

let destino: string | null = null;

export function guardarDestinoDepoisDoLogin(caminho: string) {
  // Só caminhos internos do app, nunca um endereço de fora.
  if (caminho.startsWith('/') && !caminho.startsWith('//')) destino = caminho;
}

// Devolve e esquece: o desvio acontece uma vez só.
export function retirarDestinoDepoisDoLogin(): string | null {
  const atual = destino;
  destino = null;
  return atual;
}
