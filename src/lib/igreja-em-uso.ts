// Igreja em uso (D-061): quem está em mais de uma igreja tem uma ficha em
// cada e escolhe qual usar. A escolha fica guardada no aparelho.

type Ficha = { igreja_id: string; status: string };

// A ficha da igreja escolhida, se ela ainda estiver ativa; senão, a primeira
// ativa (a escolha pode ter ficado para trás, ex.: a pessoa foi inativada lá).
export function fichaEmUso<F extends Ficha>(fichas: F[], igrejaEscolhida: string | null): F | undefined {
  const ativas = fichas.filter((f) => f.status === 'ativo');
  return ativas.find((f) => f.igreja_id === igrejaEscolhida) ?? ativas[0];
}

// Pergunta qual igreja abrir só a quem tem mais de uma e ainda não escolheu
// (ou escolheu uma em que não está mais ativo).
export function precisaEscolherIgreja(fichas: Ficha[], igrejaEscolhida: string | null): boolean {
  const ativas = fichas.filter((f) => f.status === 'ativo');
  return ativas.length > 1 && !ativas.some((f) => f.igreja_id === igrejaEscolhida);
}

export const nomeDaPreferencia = (usuarioId: string) => `meudizimo.igreja.${usuarioId}`;
