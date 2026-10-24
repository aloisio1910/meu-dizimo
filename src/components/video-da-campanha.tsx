import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Botao } from '@/components/ui/botao';
import { idDoYouTube, paginaDoPlayer } from '@/lib/video';
import { raio } from '@/theme';

// O player do YouTube precisa saber de qual site ele está sendo aberto.
const ORIGEM_DO_PLAYER = 'https://meudizimo.app';

// Vídeo da campanha (D-053): YouTube toca dentro do app; outros links
// (Instagram, Vimeo...) viram o botão "Assistir vídeo", que abre o app de origem.
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
      <WebView
        source={{ html: paginaDoPlayer(id), baseUrl: ORIGEM_DO_PLAYER }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        style={estilos.player}
      />
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
  player: {
    flex: 1,
  },
});
