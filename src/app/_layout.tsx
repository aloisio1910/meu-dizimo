import '@/i18n';

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ProvedorDeSessao, useSessao } from '@/hooks/use-sessao';

// A tela de abertura fica até a fonte e a sessão estarem prontas, para o
// usuário não ver a letra trocar nem a tela de login piscar.
SplashScreen.preventAutoHideAsync();

function Navegacao() {
  const [fontesCarregadas, erroNasFontes] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });
  const { carregando } = useSessao();
  const pronto = (fontesCarregadas || !!erroNasFontes) && !carregando;

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ProvedorDeSessao>
      <Navegacao />
    </ProvedorDeSessao>
  );
}
