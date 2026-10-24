import * as WebBrowser from 'expo-web-browser';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { idDoYouTube } from '@/lib/video';
import { raio } from '@/theme';

// Na web não há WebView: o player do YouTube entra direto como iframe.
export function VideoDaCampanha({ link }: { link: string }) {
  const { t } = useTranslation();
  const id = idDoYouTube(link);

  if (!id) {
    return (
      <Botao titulo={t('ofertas.campanha.assistirVideo')} variante="secundario" onPress={() => WebBrowser.openBrowserAsync(link)} />
    );
  }

  return (
    <View style={estilos.moldura}>
      {createElement('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%' },
        title: t('ofertas.campanha.assistirVideo'),
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  moldura: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: raio,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
