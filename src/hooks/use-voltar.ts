import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

// Botão Voltar que nunca fica sem destino. Na web, recarregar a página (F5)
// apaga o histórico de navegação, e router.back() falhava com "GO_BACK was
// not handled". Sem histórico, vai para a tela de onde a pessoa costuma vir.
export function useVoltar(destino: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(destino);
  }, [router, destino]);
}
