import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Texto } from '@/components/ui/texto';
import {
  aplicarZoom,
  escalaParaCobrir,
  limitarPosicao,
  posicaoCentralizada,
  retanguloDoRecorte,
  ZOOM_MAXIMO,
  type Posicao,
  type Tamanho,
} from '@/lib/recorte';
import type { ImagemParaRecortar } from '@/services/dispositivo/arquivos';
import type { RetanguloDoRecorte } from '@/services/dispositivo/recorte';
import { cores, espacos } from '@/theme';

type Props = {
  imagem: ImagemParaRecortar;
  proporcao: number; // largura ÷ altura da moldura (1 = quadrada)
  larguraMaxima: number;
  larguraRecomendada: number; // abaixo disso, avisa que pode ficar sem nitidez
  enviando: boolean;
  aoConfirmar: (retangulo: RetanguloDoRecorte) => void;
  aoCancelar: () => void;
};

const PASSO_DO_ZOOM = 1.25;
const PASSO_DO_MOVIMENTO = 0.1; // 10% da moldura por toque nos botões de mover

// Moldura de recorte, como a foto de perfil do WhatsApp: o que fica dentro
// dela é o que aparece no app.
export function RecorteDeImagem(props: Props) {
  const { t } = useTranslation();
  const tamanhoDaImagem: Tamanho = useMemo(
    () => ({ largura: props.imagem.largura, altura: props.imagem.altura }),
    [props.imagem],
  );
  const [larguraDisponivel, setLarguraDisponivel] = useState(0);
  const larguraDaMoldura = Math.min(larguraDisponivel, props.larguraMaxima);
  const moldura: Tamanho = { largura: larguraDaMoldura, altura: larguraDaMoldura / props.proporcao };
  const escalaBase = larguraDaMoldura ? escalaParaCobrir(tamanhoDaImagem, moldura) : 1;

  const [zoom, setZoom] = useState(1);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const escala = escalaBase * zoom;
  const atual = posicao ?? (larguraDaMoldura ? posicaoCentralizada(tamanhoDaImagem, escala, moldura) : { x: 0, y: 0 });

  // Arrasto com o dedo ou o mouse: guarda onde o toque começou e move a
  // imagem pela diferença, sem deixar espaço vazio na moldura.
  const [inicio, setInicio] = useState<{ toque: Posicao; posicao: Posicao } | null>(null);
  const toqueDe = (e: GestureResponderEvent): Posicao => ({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  const arrasto = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => setInicio({ toque: toqueDe(e), posicao: atual }),
    onResponderMove: (e: GestureResponderEvent) => {
      if (!inicio) return;
      const toque = toqueDe(e);
      setPosicao(
        limitarPosicao(
          { x: inicio.posicao.x + toque.x - inicio.toque.x, y: inicio.posicao.y + toque.y - inicio.toque.y },
          tamanhoDaImagem,
          escala,
          moldura,
        ),
      );
    },
    onResponderRelease: () => setInicio(null),
  };

  function mudarZoom(novo: number) {
    const limitado = Math.min(ZOOM_MAXIMO, Math.max(1, novo));
    setPosicao(aplicarZoom(atual, escala, escalaBase * limitado, tamanhoDaImagem, moldura));
    setZoom(limitado);
  }

  function mover(dx: number, dy: number) {
    setPosicao(
      limitarPosicao(
        {
          x: atual.x + dx * moldura.largura * PASSO_DO_MOVIMENTO,
          y: atual.y + dy * moldura.altura * PASSO_DO_MOVIMENTO,
        },
        tamanhoDaImagem,
        escala,
        moldura,
      ),
    );
  }

  const retangulo = larguraDaMoldura ? retanguloDoRecorte(atual, escala, tamanhoDaImagem, moldura) : null;
  const poucaNitidez = !!retangulo && retangulo.width < props.larguraRecomendada;

  return (
    <View style={estilos.bloco} onLayout={(e: LayoutChangeEvent) => setLarguraDisponivel(e.nativeEvent.layout.width)}>
      <Texto>{t('recorte.explicacao')}</Texto>
      {larguraDaMoldura > 0 && (
        <View
          style={[estilos.moldura, { width: moldura.largura, height: moldura.altura }]}
          accessible
          accessibilityLabel={t('recorte.moldura')}
          {...arrasto}
        >
          <Image
            source={{ uri: props.imagem.uri }}
            style={{
              position: 'absolute',
              left: atual.x,
              top: atual.y,
              width: tamanhoDaImagem.largura * escala,
              height: tamanhoDaImagem.altura * escala,
            }}
            contentFit="fill"
          />
        </View>
      )}
      {poucaNitidez && <Texto variante="apoio">{t('recorte.poucaNitidez')}</Texto>}

      <View style={estilos.linha}>
        <View style={estilos.item}>
          <Botao
            titulo={t('recorte.afastar')}
            variante="secundario"
            onPress={() => mudarZoom(zoom / PASSO_DO_ZOOM)}
            desabilitado={zoom <= 1}
          />
        </View>
        <View style={estilos.item}>
          <Botao
            titulo={t('recorte.aproximar')}
            variante="secundario"
            onPress={() => mudarZoom(zoom * PASSO_DO_ZOOM)}
            desabilitado={zoom >= ZOOM_MAXIMO}
          />
        </View>
      </View>
      <View style={estilos.linha}>
        {(
          [
            ['esquerda', 1, 0],
            ['cima', 0, 1],
            ['baixo', 0, -1],
            ['direita', -1, 0],
          ] as const
        ).map(([direcao, dx, dy]) => (
          <View key={direcao} style={estilos.item}>
            <Botao titulo={t(`recorte.mover.${direcao}`)} variante="secundario" onPress={() => mover(dx, dy)} />
          </View>
        ))}
      </View>

      <Botao
        titulo={t('recorte.usar')}
        onPress={() => retangulo && props.aoConfirmar(retangulo)}
        carregando={props.enviando}
        desabilitado={!retangulo}
      />
      <Botao
        titulo={t('recorte.cancelar')}
        variante="secundario"
        onPress={props.aoCancelar}
        desabilitado={props.enviando}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.medio,
  },
  moldura: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: cores.texto,
    backgroundColor: cores.fundoPressionado,
  },
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
  item: {
    flexGrow: 1,
    flexBasis: 120,
  },
});
