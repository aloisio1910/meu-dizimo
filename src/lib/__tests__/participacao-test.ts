import { describe, expect, it } from '@jest/globals';

import { calcularParticipacao, porcentagem, type MembroDaParticipacao } from '../participacao';
import type { LinhaDoRelatorio } from '../relatorio';

function membro(id: string, nome: string, celula?: string, status: MembroDaParticipacao['status'] = 'ativo') {
  return {
    id,
    nome,
    numero: Number(id.replace('m', '')),
    celular: '62999990000',
    status,
    campos_extras: {},
    campos_internos: celula ? { celula } : {},
  };
}

function lancamento(parcial: Partial<LinhaDoRelatorio>): LinhaDoRelatorio {
  return {
    id: Math.random().toString(),
    membro_id: 'm1',
    tipo: 'dizimo',
    data_contribuicao: '2026-10-10',
    registrado_em: '2026-10-10T10:00:00Z',
    valor_informado_centavos: 10000,
    valor_conferido_centavos: null,
    moeda: 'BRL',
    forma: 'pix',
    status: 'confirmado',
    confirmado_por_nome: null,
    registrado_pela_tesouraria: false,
    membros: null,
    campanhas: null,
    contas: null,
    ...parcial,
  };
}

const membros = [
  membro('m1', 'Ana', 'Norte'),
  membro('m2', 'Bruno', 'Norte'),
  membro('m3', 'Carla', 'Sul'),
  membro('m4', 'Davi'),
  membro('m5', 'Eva', 'Sul', 'inativo'),
];

const lancamentos = [
  lancamento({ membro_id: 'm1' }),
  lancamento({ membro_id: 'm1' }), // dois dízimos da mesma pessoa contam uma vez
  lancamento({ membro_id: 'm2', status: 'aguardando' }), // ainda não conferido, mas devolveu
  lancamento({ membro_id: 'm3', status: 'cancelado' }), // cancelado não conta
  lancamento({ membro_id: 'm1', tipo: 'oferta', campanhas: { nome: 'Missões' }, valor_informado_centavos: 5000 }),
  lancamento({ membro_id: 'm3', tipo: 'oferta', campanhas: { nome: 'Missões' }, valor_informado_centavos: 2000, status: 'aguardando' }),
  lancamento({ membro_id: 'm5', tipo: 'oferta', campanhas: { nome: 'Templo' }, valor_informado_centavos: 3000 }),
];

describe('calcularParticipacao', () => {
  const resultado = calcularParticipacao(membros, lancamentos, { chave: 'celula', preenchido_por: 'tesouraria' });

  it('conta pessoas ativas, não lançamentos', () => {
    expect(resultado).toMatchObject({ ativos: 4, comDizimo: 2, comOferta: 2 });
  });

  it('por campanha: pessoas distintas e só o valor confirmado', () => {
    expect(resultado.porCampanha).toEqual([
      { nome: 'Missões', pessoas: 2, centavos: 5000 },
      { nome: 'Templo', pessoas: 1, centavos: 3000 },
    ]);
  });

  it('por grupo, com quem não tem o campo por último', () => {
    expect(resultado.porGrupo).toEqual([
      { grupo: 'Norte', ativos: 2, comDizimo: 2, comOferta: 1 },
      { grupo: 'Sul', ativos: 1, comDizimo: 0, comOferta: 1 },
      { grupo: '', ativos: 1, comDizimo: 0, comOferta: 0 },
    ]);
  });

  it('ativos sem dízimo no período, em ordem alfabética (o cancelado não conta)', () => {
    expect(resultado.semDizimo.map((m) => m.nome)).toEqual(['Carla', 'Davi']);
  });

  it('sem campo de grupo, não monta grupos', () => {
    expect(calcularParticipacao(membros, lancamentos).porGrupo).toEqual([]);
  });
});

describe('porcentagem', () => {
  it('arredonda e não divide por zero', () => {
    expect(porcentagem(2, 3)).toBe(67);
    expect(porcentagem(0, 0)).toBe(0);
  });
});
