// Datas digitadas como DD/MM/AAAA na tela e guardadas como AAAA-MM-DD no banco.

// Aplica a máscara enquanto a pessoa digita: "17051990" -> "17/05/1990".
export function mascararData(texto: string): string {
  const numeros = texto.replace(/\D/g, '').slice(0, 8);
  const partes = [numeros.slice(0, 2), numeros.slice(2, 4), numeros.slice(4, 8)].filter(Boolean);
  return partes.join('/');
}

// Data de hoje no relógio do aparelho, em AAAA-MM-DD (não em UTC: às 22h no
// Brasil, o UTC já está no dia seguinte).
export function hojeIso(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// Momento gravado pelo banco (UTC) no horário de quem lê, em partes para a
// frase vir do i18n: "2026-10-22T23:53:00Z" -> { dia: "22/10/2026", hora: "20:53" } em Brasília.
export function partesDaDataHora(momento: string, idioma: string, fusoHorario?: string) {
  const data = new Date(momento);
  const opcoes = { timeZone: fusoHorario } as const;
  return {
    dia: data.toLocaleDateString(idioma, { ...opcoes, day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: data.toLocaleTimeString(idioma, { ...opcoes, hour: '2-digit', minute: '2-digit' }),
  };
}

// "1990-05-17" -> "17/05/1990" (para mostrar e para preencher o campo).
export function isoParaData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
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
