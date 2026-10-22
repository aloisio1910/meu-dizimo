import '@/i18n';

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { Desbloqueio } from '@/components/desbloqueio';
import { ProvedorDeBloqueio, useBloqueio } from '@/hooks/use-bloqueio';
import { ProvedorDeFichas } from '@/hooks/use-minhas-fichas';
import { ProvedorDeSessao, useSessao } from '@/hooks/use-sessao';

// A tela de abertura fica até a fonte, a sessão e o bloqueio estarem
// prontos, para o usuário não ver a letra trocar nem uma tela piscar.
SplashScreen.preventAutoHideAsync();

function Navegacao() {
  const [fontesCarregadas, erroNasFontes] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });
  const { carregando } = useSessao();
  const { estado: bloqueio } = useBloqueio();
  const pronto = (fontesCarregadas || !!erroNasFontes) && !carregando && bloqueio !== 'verificando';

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  // Com a digital ativada, nada do app aparece antes de ela ser confirmada.
  if (bloqueio === 'bloqueado') return <Desbloqueio />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ProvedorDeSessao>
      <ProvedorDeBloqueio>
        <ProvedorDeFichas>
          <Navegacao />
        </ProvedorDeFichas>
      </ProvedorDeBloqueio>
    </ProvedorDeSessao>
  );
}
