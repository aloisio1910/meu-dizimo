import { useMinhasFichas } from './use-minhas-fichas';

// Ficha da igreja em uso. Enquanto o seletor de igreja (D-061) não existe,
// é a primeira igreja em que a pessoa está ativa.
export function useFichaAtiva() {
  const { fichas, carregando } = useMinhasFichas();
  return { ficha: fichas.find((f) => f.status === 'ativo'), carregando };
}
