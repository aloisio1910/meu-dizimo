import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTema } from '@/hooks/use-tema';
import { alturaBotao, cores, espacos, fontes, raio, tamanhos } from '@/theme';

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: 'principal' | 'secundario';
  carregando?: boolean;
  desabilitado?: boolean;
};

// Botão grande (56 px de altura, acima do mínimo de 44 px), largura total.
export function Botao({ titulo, onPress, variante = 'principal', carregando = false, desabilitado = false }: Props) {
  const tema = useTema();
  const inativo = desabilitado || carregando;
  const principal = variante === 'principal';
  const corDoTexto = principal ? tema.textoSobrePrincipal : tema.corPrincipal;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.base,
        principal
          ? { backgroundColor: inativo ? cores.desabilitado : tema.corPrincipal }
          : { borderColor: inativo ? cores.desabilitado : tema.corPrincipal, borderWidth: 2 },
        pressed && estilos.pressionado,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corDoTexto} />
      ) : (
        <Text style={[estilos.texto, { color: inativo && !principal ? cores.desabilitado : corDoTexto }]}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: alturaBotao,
    borderRadius: raio,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacos.grande,
    alignSelf: 'stretch',
  },
  pressionado: {
    opacity: 0.8,
  },
  texto: {
    fontFamily: fontes.negrito,
    fontSize: tamanhos.corpo,
    textAlign: 'center',
  },
});
