import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTema } from '@/hooks/use-tema';
import { alturaBotao, cores, espacos, fontes, raio, tamanhos } from '@/theme';

import { Texto } from './texto';

type Props = Omit<TextInputProps, 'style'> & {
  rotulo: string;
  erro?: string;
};

// Campo com rótulo sempre visível (não some ao digitar) e erro logo abaixo.
export function CampoTexto({ rotulo, erro, onFocus, onBlur, ...props }: Props) {
  const tema = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View style={estilos.grupo}>
      <Texto variante="destaque" style={estilos.rotulo}>
        {rotulo}
      </Texto>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={erro}
        placeholderTextColor={cores.textoApoio}
        onFocus={(e) => {
          setFocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          onBlur?.(e);
        }}
        style={[
          estilos.campo,
          focado && { borderColor: tema.corPrincipal, borderWidth: 3 },
          !!erro && { borderColor: cores.erro, borderWidth: 3 },
        ]}
        {...props}
      />
      {!!erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    gap: espacos.pequeno,
    alignSelf: 'stretch',
  },
  rotulo: {
    fontSize: tamanhos.corpo,
  },
  campo: {
    minHeight: alturaBotao,
    borderWidth: 2,
    borderColor: cores.borda,
    borderRadius: raio,
    paddingHorizontal: espacos.medio,
    fontFamily: fontes.normal,
    fontSize: tamanhos.destaque,
    color: cores.texto,
    backgroundColor: cores.fundo,
  },
});
