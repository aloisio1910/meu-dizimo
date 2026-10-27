import { describe, expect, it } from '@jest/globals';

import { avisosQueAPessoaPodeDesligar, destinoDoAviso, valoresDoAviso } from '../avisos';

const emMoeda = (centavos: number, moeda: string) => `${moeda} ${(centavos / 100).toFixed(2)}`;

describe('valoresDoAviso', () => {
  it('monta os valores do texto a partir dos dados', () => {
    expect(
      valoresDoAviso(
        {
          dados: {
            tipo: 'dizimo',
            valor_centavos: 18000,
            valor_informado_centavos: 20000,
            moeda: 'BRL',
            membro_nome: 'Maria',
            confirmado_por: 'Tiago',
          },
        },
        emMoeda,
      ),
    ).toEqual({
      tipo: 'dizimo',
      valor: 'BRL 180.00',
      valorInformado: 'BRL 200.00',
      membro: 'Maria',
      quem: 'Tiago',
      campanha: '',
      conta: '',
      email: '',
    });
  });

  it('oferta e dados que faltam', () => {
    expect(valoresDoAviso({ dados: { tipo: 'oferta', campanha_nome: 'Missões' } }, emMoeda)).toMatchObject({
      tipo: 'oferta',
      valor: '',
      campanha: 'Missões',
    });
  });
});

describe('destinoDoAviso', () => {
  it('avisos do membro abrem o lançamento ou a campanha', () => {
    expect(destinoDoAviso({ tipo: 'lancamento_confirmado', dados: { lancamento_id: 'l1' } }, false)).toEqual({
      pathname: '/lancamento/[id]',
      params: { id: 'l1' },
    });
    expect(destinoDoAviso({ tipo: 'nova_campanha', dados: { campanha_id: 'c1' } }, false)).toEqual({
      pathname: '/campanha/[id]',
      params: { id: 'c1' },
    });
  });

  it('avisos da tesouraria abrem a fila', () => {
    expect(destinoDoAviso({ tipo: 'novo_lancamento', dados: {} }, false)).toEqual({ pathname: '/fila' });
    expect(destinoDoAviso({ tipo: 'divergencia_contestada', dados: {} }, true)).toEqual({ pathname: '/fila' });
  });

  it('troca de Pix abre as contas só para o Pastor', () => {
    expect(destinoDoAviso({ tipo: 'pix_alterado', dados: {} }, true)).toEqual({ pathname: '/contas' });
    expect(destinoDoAviso({ tipo: 'pix_alterado', dados: {} }, false)).toBeNull();
  });

  it('sem o id, o aviso não abre nada', () => {
    expect(destinoDoAviso({ tipo: 'lancamento_confirmado', dados: {} }, false)).toBeNull();
  });
});

describe('avisosQueAPessoaPodeDesligar', () => {
  it('membro desliga só o de campanha; a tesouraria, também os dela', () => {
    expect(avisosQueAPessoaPodeDesligar(false)).toEqual(['nova_campanha']);
    expect(avisosQueAPessoaPodeDesligar(true)).toEqual(['nova_campanha', 'novo_lancamento', 'novo_comprovante']);
  });
});

describe('aviso de troca de e-mail (D-097)', () => {
  it('traz o novo e-mail e abre o Meu perfil', () => {
    const aviso = { tipo: 'email_alterado' as const, dados: { email: 'maria.nova@gmail.com' } };
    expect(valoresDoAviso(aviso, () => '').email).toBe('maria.nova@gmail.com');
    expect(destinoDoAviso(aviso, false)).toEqual({ pathname: '/perfil' });
  });
});
