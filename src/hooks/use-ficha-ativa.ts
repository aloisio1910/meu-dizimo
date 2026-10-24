import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useMinhasFichas } from './use-minhas-fichas';

// Ficha da igreja em uso. Enquanto o seletor de igreja (D-061) não existe,
// é a primeira igreja em que a pessoa está ativa. Cada tela que abre confere
// de novo o perfil e o status (ex.: tesoureiro suspenso perde a tesouraria).
export function useFichaAtiva() {
  const { fichas, carregando, atualizarEmSilencio } = useMinhasFichas();

  useFocusEffect(
    useCallback(() => {
      atualizarEmSilencio();
    }, [atualizarEmSilencio]),
  );

  const ficha = fichas.find((f) => f.status === 'ativo');
  // Tesouraria = tesoureiro ou Pastor de Governo (que tem tudo do tesoureiro).
  const ehTesouraria = ficha?.perfil === 'tesoureiro' || ficha?.perfil === 'administrador';
  const ehAdministrador = ficha?.perfil === 'administrador';
  return { ficha, carregando, ehTesouraria, ehAdministrador };
}
