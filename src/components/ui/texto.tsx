import { StyleSheet, Text, type TextProps } from 'react-native';

import { cores, fontes, tamanhos } from '@/theme';

type Variante = 'titulo' | 'destaque' | 'corpo' | 'apoio' | 'erro';

type Props = TextProps & { variante?: Variante };

// Texto do app com a fonte Atkinson Hyperlegible. O conteúdo sempre vem do i18n.
export function Texto({ variante = 'corpo', style, ...props }: Props) {
  return (
    <Text
      accessibilityRole={variante === 'titulo' ? 'header' : undefined}
      style={[estilos.base, estilos[variante], style]}
      {...props}
    />
  );
}

const estilos = StyleSheet.create({
  base: {
    fontFamily: fontes.normal,
    fontSize: tamanhos.corpo,
    lineHeight: tamanhos.corpo * 1.4,
    color: cores.texto,
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: tamanhos.titulo,
    lineHeight: tamanhos.titulo * 1.25,
  },
  destaque: {
    fontFamily: fontes.negrito,
    fontSize: tamanhos.destaque,
    lineHeight: tamanhos.destaque * 1.3,
  },
  corpo: {},
  apoio: {
    fontSize: tamanhos.apoio,
    lineHeight: tamanhos.apoio * 1.4,
    color: cores.textoApoio,
  },
  erro: {
    fontFamily: fontes.negrito,
    color: cores.erro,
  },
});
