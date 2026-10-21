import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { termos } from '@/i18n/termos/pt-BR';
import { espacos } from '@/theme';

// Texto completo dos Termos de Uso e da Política de Privacidade.
export default function Termos() {
  const { t } = useTranslation();
  const router = useRouter();
  const { fichas } = useMinhasFichas();
  const igreja = fichas.find((f) => f.status === 'convidado')?.igrejas?.nome ?? t('termos.suaIgreja');
  const comIgreja = (texto: string) => texto.replaceAll('{{igreja}}', igreja);

  return (
    <Tela>
      <Botao titulo={t('comum.voltar')} variante="secundario" onPress={() => router.back()} />
      <Texto variante="titulo">{termos.titulo}</Texto>
      <Texto variante="apoio">{termos.atualizadoEm}</Texto>
      {termos.secoes.map((secao) => (
        <View key={secao.titulo} style={estilos.secao}>
          <Texto variante="destaque" accessibilityRole="header">
            {comIgreja(secao.titulo)}
          </Texto>
          {secao.paragrafos.map((paragrafo) => (
            <Texto key={paragrafo}>{comIgreja(paragrafo)}</Texto>
          ))}
        </View>
      ))}
      <Botao titulo={t('comum.voltar')} onPress={() => router.back()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: {
    gap: espacos.pequeno,
  },
});
