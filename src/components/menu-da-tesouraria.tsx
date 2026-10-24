import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { espacos } from '@/theme';

type Pagina = 'fila' | 'membros';

// Atalhos entre as telas do painel da tesouraria, no topo de cada tela
// principal. Lado a lado no computador; no celular, quebram em linhas.
// A página atual não aparece; o Cartão do próprio tesoureiro fica por último.
export function MenuDaTesouraria({ atual }: { atual: Pagina }) {
  const { t } = useTranslation();
  const router = useRouter();

  const itens = [
    atual !== 'fila' && { titulo: t('tesouraria.menu.fila'), ir: () => router.replace('/fila') },
    atual !== 'membros' && { titulo: t('tesouraria.menu.membros'), ir: () => router.replace('/membros') },
    { titulo: t('tesouraria.menu.lancar'), ir: () => router.push('/lancar') },
    { titulo: t('tesouraria.menu.relatorio'), ir: () => router.push('/relatorio') },
    { titulo: t('tesouraria.meuCartao'), ir: () => router.push('/cartao') },
  ].filter((item) => !!item);

  return (
    <View style={estilos.menu} accessibilityRole="menu">
      {itens.map((item) => (
        <View key={item.titulo} style={estilos.item}>
          <Botao titulo={item.titulo} variante="secundario" onPress={item.ir} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
  item: {
    flexGrow: 1,
    flexBasis: 160,
  },
});
