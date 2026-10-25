import { describe, expect, it } from '@jest/globals';

import { contarPorSituacao, linhasDaPlanilhaDeMembros, type MembroDoRelatorio } from '../relatorio-de-membros';

const base: Omit<MembroDoRelatorio, 'nome' | 'numero' | 'situacao'> = {
  email: 'x@teste.local',
  celular: '62999990000',
  perfil: 'membro',
  tipo_dizimo: 'individual',
  campos_extras: { lider: 'Carlos' },
  campos_internos: { celula: 'Norte' },
};

const membros: MembroDoRelatorio[] = [
  { ...base, numero: 2, nome: 'Bruno', situacao: 'ativo' },
  { ...base, numero: 1, nome: 'Ana', situacao: 'convite_vencido' },
  { ...base, numero: 3, nome: 'Carla', situacao: 'ativo' },
];

describe('contarPorSituacao', () => {
  it('conta cada situação, inclusive as zeradas', () => {
    expect(contarPorSituacao(membros)).toEqual({ ativo: 2, convidado: 0, convite_vencido: 1, inativo: 0 });
  });
});

describe('linhasDaPlanilhaDeMembros', () => {
  it('ordena por nome e traz os campos do membro e da tesouraria', () => {
    const [cabecalho, primeira] = linhasDaPlanilhaDeMembros(
      membros,
      [
        { chave: 'lider', rotulo: 'Líder', preenchido_por: 'membro' },
        { chave: 'celula', rotulo: 'Célula', preenchido_por: 'tesouraria' },
      ],
      {
        colunas: ['Nº', 'Nome', 'E-mail', 'Celular', 'Situação', 'Perfil', 'Dízimo'],
        situacao: (s) => s.toUpperCase(),
        perfil: (p) => p,
        dizimo: (d) => d,
      },
    );
    expect(cabecalho).toEqual(['Nº', 'Nome', 'E-mail', 'Celular', 'Situação', 'Perfil', 'Dízimo', 'Líder', 'Célula']);
    expect(primeira).toEqual([1, 'Ana', 'x@teste.local', '62999990000', 'CONVITE_VENCIDO', 'membro', 'individual', 'Carlos', 'Norte']);
  });
});
