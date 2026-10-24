import { useMinhasFichas } from './use-minhas-fichas';

// Ficha da igreja em uso. Enquanto o seletor de igreja (D-061) não existe,
// é a primeira igreja em que a pessoa está ativa.
export function useFichaAtiva() {
  const { fichas, carregando } = useMinhasFichas();
  const ficha = fichas.find((f) => f.status === 'ativo');
  // Tesouraria = tesoureiro ou Pastor de Governo (que tem tudo do tesoureiro).
  const ehTesouraria = ficha?.perfil === 'tesoureiro' || ficha?.perfil === 'administrador';
  return { ficha, carregando, ehTesouraria };
}
