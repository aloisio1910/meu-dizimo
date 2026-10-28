// QR Code do culto (B1, D-107): no telão ou impresso, abre direto o
// registro do dízimo ou uma campanha de oferta da igreja. O endereço leva a
// igreja junto: quem está em mais de uma (D-061) cai na igreja certa.

export type DestinoDoQr = { tipo: 'dizimo' } | { tipo: 'campanha'; campanhaId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// base: o endereço do app (na nuvem, o domínio; no computador, o da página).
export function linkDoQr(base: string, igrejaId: string, destino: DestinoDoQr): string {
  const raiz = base.replace(/\/+$/, '');
  const ir = destino.tipo === 'dizimo' ? 'dizimo' : `campanha&campanha=${encodeURIComponent(destino.campanhaId)}`;
  return `${raiz}/qr?igreja=${encodeURIComponent(igrejaId)}&ir=${ir}`;
}

// Lê os parâmetros da tela /qr. Qualquer coisa estranha vira null: um QR
// adulterado não leva a lugar nenhum.
export function lerQr(parametros: {
  igreja?: string | string[];
  ir?: string | string[];
  campanha?: string | string[];
}): { igrejaId: string; destino: DestinoDoQr } | null {
  const um = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? '';
  const igrejaId = um(parametros.igreja);
  if (!UUID.test(igrejaId)) return null;
  if (um(parametros.ir) === 'dizimo') return { igrejaId, destino: { tipo: 'dizimo' } };
  const campanhaId = um(parametros.campanha);
  if (um(parametros.ir) === 'campanha' && UUID.test(campanhaId)) {
    return { igrejaId, destino: { tipo: 'campanha', campanhaId } };
  }
  return null;
}

// Endereço da própria tela /qr, para voltar a ela depois do login.
export function caminhoDoQr(igrejaId: string, destino: DestinoDoQr): string {
  return linkDoQr('', igrejaId, destino);
}
