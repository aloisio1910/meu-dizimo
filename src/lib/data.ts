// Datas digitadas como DD/MM/AAAA na tela e guardadas como AAAA-MM-DD no banco.

// Aplica a máscara enquanto a pessoa digita: "17051990" -> "17/05/1990".
export function mascararData(texto: string): string {
  const numeros = texto.replace(/\D/g, '').slice(0, 8);
  const partes = [numeros.slice(0, 2), numeros.slice(2, 4), numeros.slice(4, 8)].filter(Boolean);
  return partes.join('/');
}

// "17/05/1990" -> "1990-05-17"; devolve null se a data não existir.
export function dataParaIso(texto: string): string | null {
  const encontrado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!encontrado) return null;
  const [, dia, mes, ano] = encontrado;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const existe =
    data.getUTCFullYear() === Number(ano) && data.getUTCMonth() === Number(mes) - 1 && data.getUTCDate() === Number(dia);
  return existe ? `${ano}-${mes}-${dia}` : null;
}
