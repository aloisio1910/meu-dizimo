import { normalizarChavePix, type TipoDeChavePix } from './pix';

// Regras do cadastro de contas e Pix (P-03, D-091). O banco confere de novo
// as que dependem dele (Pix completo, limites do BR Code, uma principal).

// Limites do padrão BR Code (Pix Copia e Cola).
export const LIMITE_DO_RECEBEDOR = 25;
export const LIMITE_DA_CIDADE = 15;

// Até 5 contas ativas por igreja (D-066).
export const LIMITE_DE_CONTAS = 5;

function digitosVerificadoresOk(numeros: string, pesosDoPrimeiro: number[]): boolean {
  const calcular = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((total, peso, i) => total + Number(base[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const tamanho = pesosDoPrimeiro.length;
  const primeiro = calcular(numeros, pesosDoPrimeiro);
  const segundo = calcular(numeros, [pesosDoPrimeiro[0] + 1, ...pesosDoPrimeiro]);
  return primeiro === Number(numeros[tamanho]) && segundo === Number(numeros[tamanho + 1]);
}

export function cpfValido(texto: string): boolean {
  const numeros = texto.replace(/\D/g, '');
  if (numeros.length !== 11 || /^(\d)\1+$/.test(numeros)) return false;
  return digitosVerificadoresOk(numeros, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
}

export function cnpjValido(texto: string): boolean {
  const numeros = texto.replace(/\D/g, '');
  if (numeros.length !== 14 || /^(\d)\1+$/.test(numeros)) return false;
  const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calcular = (base: string, lista: number[]) => {
    const resto = lista.reduce((total, peso, i) => total + Number(base[i]) * peso, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcular(numeros, pesos) === Number(numeros[12]) && calcular(numeros, [6, ...pesos]) === Number(numeros[13]);
}

// A chave tem o formato do tipo escolhido? Celular com DDD (10 ou 11
// números), com ou sem o 55 do Brasil.
export function chavePixValida(chave: string, tipo: TipoDeChavePix): boolean {
  const limpa = chave.trim();
  switch (tipo) {
    case 'cpf':
      return cpfValido(limpa);
    case 'cnpj':
      return cnpjValido(limpa);
    case 'email':
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpa);
    case 'telefone': {
      const numeros = limpa.replace(/\D/g, '');
      const semPais = numeros.startsWith('55') && numeros.length > 11 ? numeros.slice(2) : numeros;
      return /^[1-9]{2}9?\d{8}$/.test(semPais);
    }
    case 'aleatoria':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpa);
  }
}

export type CamposDaConta = {
  nome: string;
  banco: string;
  agencia: string;
  numeroConta: string;
  tipoChave: TipoDeChavePix | undefined;
  chave: string;
  recebedor: string;
  cidade: string;
};

export type DadosDaConta = {
  nome: string;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  tipo_chave_pix: TipoDeChavePix | null;
  chave_pix: string | null;
  nome_recebedor: string | null;
  cidade: string | null;
};

export type ErrosDaConta = {
  nome?: 'nomeObrigatorio';
  tipoChave?: 'escolhaTipo';
  chave?: 'chaveInvalida';
  recebedor?: 'recebedorObrigatorio' | 'recebedorLongo';
  cidade?: 'cidadeObrigatoria' | 'cidadeLonga';
  pix?: 'principalSemPix';
};

const vazioParaNulo = (texto: string) => texto.trim() || null;

// Pix é opcional, mas, se houver chave, vêm junto tipo, recebedor e cidade
// (sem eles o código Pix não é gerado). A principal precisa de Pix: é ela
// que recebe o dízimo pelo app.
export function validarConta(
  campos: CamposDaConta,
  ehPrincipal: boolean,
): { ok: true; dados: DadosDaConta } | { ok: false; erros: ErrosDaConta } {
  const erros: ErrosDaConta = {};
  const temPix = !!campos.chave.trim();

  if (!campos.nome.trim()) erros.nome = 'nomeObrigatorio';
  if (temPix) {
    if (!campos.tipoChave) erros.tipoChave = 'escolhaTipo';
    else if (!chavePixValida(campos.chave, campos.tipoChave)) erros.chave = 'chaveInvalida';
    if (!campos.recebedor.trim()) erros.recebedor = 'recebedorObrigatorio';
    else if (campos.recebedor.trim().length > LIMITE_DO_RECEBEDOR) erros.recebedor = 'recebedorLongo';
    if (!campos.cidade.trim()) erros.cidade = 'cidadeObrigatoria';
    else if (campos.cidade.trim().length > LIMITE_DA_CIDADE) erros.cidade = 'cidadeLonga';
  } else if (ehPrincipal) {
    erros.pix = 'principalSemPix';
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      nome: campos.nome.trim(),
      banco: vazioParaNulo(campos.banco),
      agencia: vazioParaNulo(campos.agencia),
      numero_conta: vazioParaNulo(campos.numeroConta),
      tipo_chave_pix: temPix ? (campos.tipoChave ?? null) : null,
      // Guardada no formato que o Pix usa (ex.: CPF só com números).
      chave_pix: temPix && campos.tipoChave ? normalizarChavePix(campos.chave, campos.tipoChave) : null,
      nome_recebedor: temPix ? campos.recebedor.trim() : null,
      cidade: temPix ? campos.cidade.trim() : null,
    },
  };
}
