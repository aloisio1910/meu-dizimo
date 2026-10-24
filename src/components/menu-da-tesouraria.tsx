import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { espacos } from '@/theme';

type Pagina = 'fila' | 'membros';

// Atalhos entre as telas principais do painel da tesouraria. A página
// atual não aparece; o Cartão do próprio tesoureiro fica sempre por último.
export function MenuDaTesouraria({ atual }: { atual: Pagina }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={estilos.menu}>
      {atual !== 'fila' && (
        <Botao titulo={t('tesouraria.menu.fila')} variante="secundario" onPress={() => router.replace('/fila')} />
      )}
      {atual !== 'membros' && (
        <Botao titulo={t('tesouraria.menu.membros')} variante="secundario" onPress={() => router.replace('/membros')} />
      )}
      <Botao titulo={t('tesouraria.menu.lancar')} variante="secundario" onPress={() => router.push('/lancar')} />
      <Botao titulo={t('tesouraria.menu.relatorio')} variante="secundario" onPress={() => router.push('/relatorio')} />
      <Botao titulo={t('tesouraria.meuCartao')} variante="secundario" onPress={() => router.push('/cartao')} />
    </View>
  );
}

const estilos = StyleSheet.create({
  menu: {
    gap: espacos.medio,
  },
});
