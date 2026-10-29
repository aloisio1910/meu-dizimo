import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/texto';
import { termos } from '@/i18n/termos/pt-BR';
import { espacos } from '@/theme';

// Texto completo dos Termos de Uso e da Política de Privacidade, com o nome
// da igreja no lugar de {{igreja}}.
export function TextoDosTermos({ igreja }: { igreja: string }) {
  const comIgreja = (texto: string) => texto.replaceAll('{{igreja}}', igreja);

  return (
    <>
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
    </>
  );
}

const estilos = StyleSheet.create({
  secao: {
    gap: espacos.pequeno,
  },
});
