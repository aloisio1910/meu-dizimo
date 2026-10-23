import { dataParaIso } from './data';
import { textoParaCentavos } from './dinheiro';

export type DadosDoDizimo = { centavos: number; data: string; forma: string };

export type ErrosDoDizimo = {
  valor?: 'valorInvalido';
  data?: 'dataInvalida' | 'dataFutura';
  forma?: 'escolhaForma';
};

// Confere o que foi digitado no registro ou na edição. "hoje" vem de fora
// (relógio do aparelho) para a regra ser testável. O banco confere de novo.
export function validarDizimo(
  campos: { valor: string; data: string; forma?: string },
  hoje: string,
): { ok: true; dados: DadosDoDizimo } | { ok: false; erros: ErrosDoDizimo } {
  const erros: ErrosDoDizimo = {};
  const centavos = textoParaCentavos(campos.valor);
  const iso = dataParaIso(campos.data);

  if (!centavos) erros.valor = 'valorInvalido';
  if (!iso) erros.data = 'dataInvalida';
  else if (iso > hoje) erros.data = 'dataFutura'; // RN-011 permite retroativa; futura, não (D-072)
  if (!campos.forma) erros.forma = 'escolhaForma';

  if (!centavos || !iso || !campos.forma || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { centavos, data: iso, forma: campos.forma } };
}
