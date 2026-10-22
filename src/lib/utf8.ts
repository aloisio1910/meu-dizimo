// Conversão entre texto e bytes no padrão UTF-8, sem depender de recursos
// que nem todo motor JavaScript de celular tem (TextDecoder).

export function textoParaBytes(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const caractere of texto) {
    const codigo = caractere.codePointAt(0)!;
    if (codigo < 0x80) {
      bytes.push(codigo);
    } else if (codigo < 0x800) {
      bytes.push(0xc0 | (codigo >> 6), 0x80 | (codigo & 0x3f));
    } else if (codigo < 0x10000) {
      bytes.push(0xe0 | (codigo >> 12), 0x80 | ((codigo >> 6) & 0x3f), 0x80 | (codigo & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codigo >> 18),
        0x80 | ((codigo >> 12) & 0x3f),
        0x80 | ((codigo >> 6) & 0x3f),
        0x80 | (codigo & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

export function bytesParaTexto(bytes: Uint8Array): string {
  let texto = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let codigo: number;
    if (b < 0x80) {
      codigo = b;
      i += 1;
    } else if (b >> 5 === 0x06) {
      codigo = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (b >> 4 === 0x0e) {
      codigo = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      codigo =
        ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      i += 4;
    }
    texto += String.fromCodePoint(codigo);
  }
  return texto;
}
