// D-084: quem confirmou desfaz a própria confirmação em até 15 minutos.
// Espelha a regra do banco (desfazer_confirmacao) para a tela só mostrar o
// botão quando ele vai funcionar; quem decide de verdade é o banco.

export const PRAZO_PARA_DESFAZER_MS = 15 * 60 * 1000;

export type ConfirmacaoParaDesfazer = {
  status: string;
  confirmado_por: string | null;
  confirmado_em: string | null;
  resposta_membro: string | null;
};

// Milissegundos que ainda restam para desfazer; 0 quando não pode mais.
export function tempoRestanteParaDesfazer(item: ConfirmacaoParaDesfazer, meuUsuarioId: string, agora: Date): number {
  if (item.status !== 'confirmado' || item.confirmado_por !== meuUsuarioId || item.resposta_membro === 'aceita') return 0;
  if (!item.confirmado_em) return 0;
  const restante = new Date(item.confirmado_em).getTime() + PRAZO_PARA_DESFAZER_MS - agora.getTime();
  return Math.max(0, restante);
}

// Minutos inteiros restantes, arredondando para cima ("ainda 1 minuto" até o fim).
export function minutosRestantes(milissegundos: number): number {
  return Math.ceil(milissegundos / 60000);
}
