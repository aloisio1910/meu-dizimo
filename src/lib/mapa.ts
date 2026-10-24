// Endereço da igreja no mapa (seção 17). O link universal do Google Maps
// abre o app de mapas no celular e o site no computador.
export function linkDoMapa(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco.trim())}`;
}
