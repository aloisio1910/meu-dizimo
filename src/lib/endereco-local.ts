// Em desenvolvimento, o Supabase local roda no mesmo computador que o
// servidor do Expo. Quando o IP desse computador muda (o roteador pode dar
// outro a cada reinício), o app troca o endereço do .env pelo endereço de
// onde baixou o código. Endereços da nuvem nunca são alterados.

const IP_OU_LOCAL = /^(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

// hostDoExpo vem como "192.168.100.31:8081" (Constants.expoConfig.hostUri).
export function ajustarEnderecoLocal(url: string, hostDoExpo: string | null | undefined): string {
  const computador = hostDoExpo?.split(':')[0];
  // Modo túnel (ex.: *.exp.direct) ou sem informação: não há como saber o IP.
  if (!computador || !IP_OU_LOCAL.test(computador)) return url;

  const encontrado = /^(https?:\/\/)([^:/]+)(.*)$/.exec(url);
  if (!encontrado) return url;
  const [, protocolo, hostDoEnv, resto] = encontrado;
  if (!IP_OU_LOCAL.test(hostDoEnv)) return url; // Supabase na nuvem: não mexe

  return `${protocolo}${computador}${resto}`;
}

// O app das lojas só fala com a nuvem: endereço https e público. Um build de
// produção feito com o endereço do computador quebraria no celular dos
// membros; com esta conferência, ele falha logo ao abrir, no teste.
export function enderecoDeProducaoValido(url: string): boolean {
  const encontrado = /^https:\/\/([^:/]+)/.exec(url);
  return !!encontrado && !IP_OU_LOCAL.test(encontrado[1]);
}
