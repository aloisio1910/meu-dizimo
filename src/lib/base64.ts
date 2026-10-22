// Conversão entre bytes e texto base64 (letras, números, "+" e "/"), usada
// para guardar dados cifrados como texto. Feita aqui para não depender de
// como cada plataforma trata base64 nos módulos nativos.

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALOR: Record<string, number> = Object.fromEntries([...ALFABETO].map((letra, i) => [letra, i]));

export function bytesParaBase64(bytes: Uint8Array): string {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const bloco = (a << 16) | (b << 8) | c;
    texto += ALFABETO[(bloco >> 18) & 63] + ALFABETO[(bloco >> 12) & 63];
    texto += i + 1 < bytes.length ? ALFABETO[(bloco >> 6) & 63] : '=';
    texto += i + 2 < bytes.length ? ALFABETO[bloco & 63] : '=';
  }
  return texto;
}

export function base64ParaBytes(texto: string): Uint8Array {
  const limpo = texto.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(limpo) || limpo.length % 4 === 1) {
    throw new Error('Texto base64 inválido');
  }
  const bytes: number[] = [];
  for (let i = 0; i < limpo.length; i += 4) {
    const partes = [...limpo.slice(i, i + 4)].map((letra) => VALOR[letra]);
    const bloco = (partes[0] << 18) | (partes[1] << 12) | ((partes[2] ?? 0) << 6) | (partes[3] ?? 0);
    bytes.push((bloco >> 16) & 255);
    if (partes.length > 2) bytes.push((bloco >> 8) & 255);
    if (partes.length > 3) bytes.push(bloco & 255);
  }
  return Uint8Array.from(bytes);
}
