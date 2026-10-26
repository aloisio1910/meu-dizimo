import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAvisosNaoLidos } from '@/hooks/use-avisos-nao-lidos';
import { useSessao } from '@/hooks/use-sessao';
import { useTema } from '@/hooks/use-tema';
import { cores, fontes, tamanhos } from '@/theme';

type NomeDoIcone = ComponentProps<typeof Ionicons>['name'];

// Abas do membro (Fluxos, seção 3): grandes, com ícone e nome escrito.
export default function LayoutDasAbas() {
  const { t } = useTranslation();
  const tema = useTema();
  // Espaço da barra de gestos do celular (ex.: iPhone sem botão), somado à altura.
  const { bottom } = useSafeAreaInsets();
  const { sessao } = useSessao();
  const { naoLidos } = useAvisosNaoLidos();

  // Sem login (ex.: logo depois de "Sair"), nenhuma aba faz sentido: volta
  // para a porta de entrada, que leva ao Entrar. Vale para todas as abas.
  if (!sessao) return <Redirect href="/" />;

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
      <Tabs.Screen name="ofertas" options={{ title: t('abas.ofertas'), tabBarIcon: icone('gift-outline') }} />
      <Tabs.Screen name="igreja" options={{ title: t('abas.igreja'), tabBarIcon: icone('home-outline') }} />
      <Tabs.Screen
        name="avisos"
        options={{
          title: t('abas.avisos'),
          tabBarIcon: icone('notifications-outline'),
          // Número de não lidos na aba (D-096).
          tabBarBadge: naoLidos > 0 ? naoLidos : undefined,
          tabBarAccessibilityLabel: t('avisos.rotuloDaAba', { count: naoLidos }),
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: t('abas.perfil'), tabBarIcon: icone('person-outline') }} />
    </Tabs>
  );
}
