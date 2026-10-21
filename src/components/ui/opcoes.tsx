import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '@/hooks/use-tema';
import { alturaBotao, cores, espacos, raio, tamanhos } from '@/theme';

import { Texto } from './texto';

type Opcao<T extends string> = { valor: T; rotulo: string };

type Props<T extends string> = {
  rotulo: string;
  opcoes: Opcao<T>[];
  selecionada: T | undefined;
  onSelecionar: (valor: T) => void;
  erro?: string;
};

// Escolha de uma entre poucas opções, como botões grandes empilhados.
export function Opcoes<T extends string>({ rotulo, opcoes, selecionada, onSelecionar, erro }: Props<T>) {
  const tema = useTema();

  return (
    <View style={estilos.grupo} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      <Texto variante="destaque" style={estilos.rotulo}>
        {rotulo}
      </Texto>
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === selecionada;
        return (
          <Pressable
            key={opcao.valor}
            accessibilityRole="radio"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ selected: ativa, checked: ativa }}
            onPress={() => onSelecionar(opcao.valor)}
            style={[
              estilos.opcao,
              { borderColor: ativa ? tema.corPrincipal : erro ? cores.erro : cores.borda },
              ativa && estilos.opcaoAtiva,
            ]}
          >
            <View style={[estilos.circulo, { borderColor: ativa ? tema.corPrincipal : cores.borda }]}>
              {ativa && <View style={[estilos.ponto, { backgroundColor: tema.corPrincipal }]} />}
            </View>
            <Texto style={estilos.textoOpcao}>{opcao.rotulo}</Texto>
          </Pressable>
        );
      })}
      {!!erro && <Texto variante="erro">{erro}</Texto>}
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
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.medio,
    minHeight: alturaBotao,
    borderWidth: 2,
    borderRadius: raio,
    paddingHorizontal: espacos.medio,
  },
  opcaoAtiva: {
    borderWidth: 3,
  },
  circulo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textoOpcao: {
    flex: 1,
  },
});
