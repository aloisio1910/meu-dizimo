import { describe, expect, it } from '@jest/globals';

import { chavePixValida, cnpjValido, cpfValido, validarConta } from '../conta';

describe('cpfValido', () => {
  it('aceita CPF com dígitos verificadores certos, com ou sem pontuação', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('recusa dígito errado, tamanho errado e números repetidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ com dígitos verificadores certos', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });

  it('recusa dígito errado e números repetidos', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('00.000.000/0000-00')).toBe(false);
  });
});

describe('chavePixValida', () => {
  it('e-mail', () => {
    expect(chavePixValida('igreja@videira.org', 'email')).toBe(true);
    expect(chavePixValida('igreja@videira', 'email')).toBe(false);
  });

  it('celular com DDD, com ou sem 55 e pontuação', () => {
    expect(chavePixValida('(62) 99999-0000', 'telefone')).toBe(true);
    expect(chavePixValida('+55 62 99999-0000', 'telefone')).toBe(true);
    expect(chavePixValida('6233334444', 'telefone')).toBe(true);
    expect(chavePixValida('99999-0000', 'telefone')).toBe(false);
  });

  it('chave aleatória no formato do Banco Central', () => {
    expect(chavePixValida('123e4567-e89b-12d3-a456-426614174000', 'aleatoria')).toBe(true);
    expect(chavePixValida('123e4567e89b12d3a456426614174000', 'aleatoria')).toBe(false);
  });

  it('CPF digitado como CNPJ não passa', () => {
    expect(chavePixValida('529.982.247-25', 'cnpj')).toBe(false);
  });
});

describe('validarConta', () => {
  const campos = {
    nome: 'Dízimos e ofertas',
    banco: '',
    agencia: '',
    numeroConta: '',
    tipoChave: 'cpf' as const,
    chave: '529.982.247-25',
    recebedor: 'Igreja Videira',
    cidade: 'Goiânia',
  };

  it('guarda a chave no formato do Pix e vazios como nulo', () => {
    expect(validarConta(campos, true)).toEqual({
      ok: true,
      dados: {
        nome: 'Dízimos e ofertas',
        banco: null,
        agencia: null,
        numero_conta: null,
        tipo_chave_pix: 'cpf',
        chave_pix: '52998224725',
        nome_recebedor: 'Igreja Videira',
        cidade: 'Goiânia',
      },
    });
  });

  it('com chave, exige tipo certo, recebedor e cidade nos limites do BR Code', () => {
    expect(
      validarConta(
        { ...campos, chave: '123', recebedor: 'Igreja Evangélica Videira de Goiânia', cidade: '' },
        false,
      ),
    ).toEqual({ ok: false, erros: { chave: 'chaveInvalida', recebedor: 'recebedorLongo', cidade: 'cidadeObrigatoria' } });
    expect(validarConta({ ...campos, tipoChave: undefined }, false)).toEqual({
      ok: false,
      erros: { tipoChave: 'escolhaTipo' },
    });
  });

  it('conta sem Pix é aceita, menos a principal', () => {
    const semPix = { ...campos, chave: '', recebedor: '', cidade: '' };
    expect(validarConta(semPix, false)).toMatchObject({ ok: true, dados: { chave_pix: null, tipo_chave_pix: null } });
    expect(validarConta(semPix, true)).toEqual({ ok: false, erros: { pix: 'principalSemPix' } });
  });

  it('nome obrigatório', () => {
    expect(validarConta({ ...campos, nome: ' ' }, false)).toEqual({ ok: false, erros: { nome: 'nomeObrigatorio' } });
  });
});
