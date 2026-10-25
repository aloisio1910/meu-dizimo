import { valorDoCampo } from './filtro-por-campo';
import type { SituacaoDoMembro } from './membros';
import type { Celula } from './relatorio';

// Relatório de membros por situação, com os campos do cadastro e da
// tesouraria (D-093) como colunas.

export type MembroDoRelatorio = {
  numero: number;
  nome: string;
  email: string;
  celular: string;
  perfil: string;
  tipo_dizimo: string;
  campos_extras: unknown;
  campos_internos: unknown;
  situacao: SituacaoDoMembro;
};

export type ColunaDeCampo = { chave: string; rotulo: string; preenchido_por: 'membro' | 'tesouraria' };

export function contarPorSituacao(membros: { situacao: SituacaoDoMembro }[]): Record<SituacaoDoMembro, number> {
  const contagem: Record<SituacaoDoMembro, number> = { ativo: 0, convidado: 0, convite_vencido: 0, inativo: 0 };
  for (const m of membros) contagem[m.situacao] += 1;
  return contagem;
}

export function linhasDaPlanilhaDeMembros(
  membros: MembroDoRelatorio[],
  campos: ColunaDeCampo[],
  textos: {
    colunas: string[]; // Nº, Nome, E-mail, Celular, Situação, Perfil, Dízimo
    situacao: (s: SituacaoDoMembro) => string;
    perfil: (p: string) => string;
    dizimo: (d: string) => string;
  },
): Celula[][] {
  return [
    [...textos.colunas, ...campos.map((c) => c.rotulo)],
    ...[...membros]
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((m) => [
        m.numero,
        m.nome,
        m.email,
        m.celular,
        textos.situacao(m.situacao),
        textos.perfil(m.perfil),
        textos.dizimo(m.tipo_dizimo),
        ...campos.map((c) => valorDoCampo(m, c)),
      ]),
  ];
}
