// Código Pix estático ("Pix Copia e Cola" e QR Code), no padrão BR Code do
// Banco Central (Manual de Padrões para Iniciação do Pix), que segue o EMV
// QRCPS-MPM. Cada campo é escrito como ID (2) + tamanho (2) + valor; no fim
// vem o CRC16, que o banco confere antes de aceitar o código.

export type TipoDeChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export type DadosDoPix = {
  chave: string;
  tipoDeChave: TipoDeChavePix;
  nomeDoRecebedor: string; // até 25 caracteres
  cidade: string; // até 15 caracteres
  valorEmCentavos?: number | null; // sem valor, quem paga digita no banco
  descricao?: string; // aparece para quem paga, se o banco mostrar
};

const LIMITE_NOME = 25;
const LIMITE_CIDADE = 15;
const LIMITE_CONTA = 99; // campo 26 inteiro (identificador + chave + descrição)

function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`Campo ${id} do Pix passa de 99 caracteres`);
  return id + String(valor.length).padStart(2, '0') + valor;
}

// Tira acentos e caracteres fora do conjunto aceito pelos bancos.
export function textoParaPix(texto: string, limite: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,\-/&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, limite)
    .trim();
}

// Formato que o Pix espera para cada tipo de chave.
export function normalizarChavePix(chave: string, tipo: TipoDeChavePix): string {
  const limpa = chave.trim();
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
      return limpa.replace(/\D/g, '');
    case 'telefone': {
      const numeros = limpa.replace(/\D/g, '');
      return numeros.startsWith('55') && numeros.length > 11 ? `+${numeros}` : `+55${numeros}`;
    }
    case 'email':
    case 'aleatoria':
      return limpa.toLowerCase();
  }
}

// CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo BR Code.
// Os textos do código Pix são ASCII, então cada caractere é um byte.
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function centavosParaValorPix(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos <= 0) throw new Error('Valor do Pix deve ser inteiro e positivo');
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

export function gerarCodigoPix(dados: DadosDoPix): string {
  const nome = textoParaPix(dados.nomeDoRecebedor, LIMITE_NOME);
  const cidade = textoParaPix(dados.cidade, LIMITE_CIDADE);
  if (!nome || !cidade) throw new Error('Nome do recebedor e cidade são obrigatórios no Pix');

  const descricao = dados.descricao ? textoParaPix(dados.descricao, 72) : '';
  let conta = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChavePix(dados.chave, dados.tipoDeChave));
  if (descricao) conta += campo('02', descricao);
  if (conta.length > LIMITE_CONTA) throw new Error('Chave e descrição do Pix passam do limite do campo');

  const corpo =
    campo('00', '01') + // versão do padrão
    campo('26', conta) + // conta Pix de quem recebe
    campo('52', '0000') + // categoria do comércio: não informada
    campo('53', '986') + // moeda: real (ISO 4217)
    // Sem valor (null), quem paga digita no banco; zero ou negativo é recusado.
    (dados.valorEmCentavos != null ? campo('54', centavosParaValorPix(dados.valorEmCentavos)) : '') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', '***')); // identificador da transação: "***" no Pix estático

  const semCrc = `${corpo}6304`;
  return semCrc + crc16(semCrc);
}
