import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTema } from '@/hooks/use-tema';
import { alvoMinimo, cores, espacos, fontes, tamanhos } from '@/theme';

import { Texto } from './texto';

type Props = {
  rotulo: string;
  marcado: boolean;
  onAlterar: (marcado: boolean) => void;
  erro?: string;
};

// Caixa de seleção grande: a linha inteira (caixa e texto) é tocável.
export function CaixaSelecao({ rotulo, marcado, onAlterar, erro }: Props) {
  const tema = useTema();

  return (
    <View style={estilos.grupo}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={rotulo}
        accessibilityState={{ checked: marcado }}
        accessibilityHint={erro}
        onPress={() => onAlterar(!marcado)}
        style={estilos.linha}
      >
        <View
          style={[
            estilos.caixa,
            { borderColor: erro ? cores.erro : tema.corPrincipal },
            marcado && { backgroundColor: tema.corPrincipal },
          ]}
        >
          {marcado && <Text style={[estilos.marca, { color: tema.textoSobrePrincipal }]}>✓</Text>}
        </View>
        <Texto style={estilos.rotulo}>{rotulo}</Texto>
      </Pressable>
      {!!erro && <Texto variante="erro">{erro}</Texto>}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    gap: espacos.pequeno,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.medio,
    minHeight: alvoMinimo,
  },
  caixa: {
    width: 32,
    height: 32,
    borderWidth: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: {
    fontFamily: fontes.negrito,
    fontSize: tamanhos.destaque,
    lineHeight: tamanhos.destaque,
  },
  rotulo: {
    flex: 1,
  },
});
