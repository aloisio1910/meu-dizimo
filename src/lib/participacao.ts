import { valorDoCampo, type CampoFiltravel } from './filtro-por-campo';
import { valorConsiderado, type LinhaDoRelatorio } from './relatorio';

// Relatório de participação no período. "Devolveu" = registrou dízimo no
// período em qualquer status menos cancelado: a pessoa devolveu, mesmo que a
// tesouraria ainda não tenha conferido. Os valores somam só o confirmado
// (D-087).

export type MembroDaParticipacao = {
  id: string;
  nome: string;
  numero: number;
  celular: string;
  status: 'convidado' | 'ativo' | 'inativo';
  campos_extras: unknown;
  campos_internos: unknown;
};

export type Contagem = { ativos: number; comDizimo: number; comOferta: number };

export type Participacao = Contagem & {
  porCampanha: { nome: string; pessoas: number; centavos: number }[];
  porGrupo: ({ grupo: string } & Contagem)[];
  // Ativos sem dízimo registrado no período: só para o Pastor, sem valores,
  // como cuidado pastoral (seção 16).
  semDizimo: MembroDaParticipacao[];
};

export function calcularParticipacao(
  membros: MembroDaParticipacao[],
  lancamentos: LinhaDoRelatorio[],
  campoDoGrupo?: Pick<CampoFiltravel, 'chave' | 'preenchido_por'>,
): Participacao {
  const validos = lancamentos.filter((l) => l.status !== 'cancelado');
  const comDizimo = new Set(validos.filter((l) => l.tipo === 'dizimo').map((l) => l.membro_id));
  const comOferta = new Set(validos.filter((l) => l.tipo === 'oferta').map((l) => l.membro_id));
  const ativos = membros.filter((m) => m.status === 'ativo');

  const contar = (grupo: MembroDaParticipacao[]): Contagem => ({
    ativos: grupo.length,
    comDizimo: grupo.filter((m) => comDizimo.has(m.id)).length,
    comOferta: grupo.filter((m) => comOferta.has(m.id)).length,
  });

  const campanhas = new Map<string, { nome: string; pessoas: Set<string>; centavos: number }>();
  for (const l of validos) {
    if (l.tipo !== 'oferta') continue;
    const nome = l.campanhas?.nome ?? '';
    const campanha = campanhas.get(nome) ?? { nome, pessoas: new Set<string>(), centavos: 0 };
    campanha.pessoas.add(l.membro_id);
    if (l.status === 'confirmado') campanha.centavos += valorConsiderado(l);
    campanhas.set(nome, campanha);
  }

  const grupos = new Map<string, MembroDaParticipacao[]>();
  if (campoDoGrupo) {
    for (const membro of ativos) {
      const grupo = valorDoCampo(membro, campoDoGrupo);
      grupos.set(grupo, [...(grupos.get(grupo) ?? []), membro]);
    }
  }

  return {
    ...contar(ativos),
    porCampanha: [...campanhas.values()]
      .map(({ nome, pessoas, centavos }) => ({ nome, pessoas: pessoas.size, centavos }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    // Grupos em ordem alfabética; quem não tem o campo preenchido vai por último.
    porGrupo: [...grupos.entries()]
      .map(([grupo, lista]) => ({ grupo, ...contar(lista) }))
      .sort((a, b) => (a.grupo === '' ? 1 : b.grupo === '' ? -1 : a.grupo.localeCompare(b.grupo))),
    semDizimo: ativos.filter((m) => !comDizimo.has(m.id)).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

// "8 de 12 (67%)": porcentagem inteira, sem dividir por zero.
export function porcentagem(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}
