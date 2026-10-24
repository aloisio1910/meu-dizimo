import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '@/hooks/use-tema';
import { cores, fontes, tamanhos } from '@/theme';

type NomeDoIcone = ComponentProps<typeof Ionicons>['name'];

// Abas do membro (Fluxos, seção 3): grandes, com ícone e nome escrito.
// A aba Ofertas entra junto com as telas M-06 a M-08.
export default function LayoutDasAbas() {
  const { t } = useTranslation();
  const tema = useTema();
  // Espaço da barra de gestos do celular (ex.: iPhone sem botão), somado à altura.
  const { bottom } = useSafeAreaInsets();

  const icone = (nome: NomeDoIcone) =>
    function IconeDaAba({ color }: { color: ColorValue }) {
      return <Ionicons name={nome} size={28} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tema.corPrincipal,
        tabBarInactiveTintColor: cores.textoApoio,
        tabBarLabelStyle: { fontFamily: fontes.negrito, fontSize: tamanhos.apoio },
        tabBarStyle: { height: 68 + bottom, paddingTop: 6, paddingBottom: 8 + bottom },
      }}
    >
      <Tabs.Screen name="cartao" options={{ title: t('abas.cartao'), tabBarIcon: icone('card-outline') }} />
      <Tabs.Screen name="igreja" options={{ title: t('abas.igreja'), tabBarIcon: icone('home-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: t('abas.perfil'), tabBarIcon: icone('person-outline') }} />
    </Tabs>
  );
}
