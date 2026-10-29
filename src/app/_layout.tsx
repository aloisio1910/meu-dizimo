import '@/i18n';

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Desbloqueio } from '@/components/desbloqueio';
import { NovoAceiteDosTermos } from '@/components/novo-aceite-dos-termos';
import { ProvedorDeBloqueio, useBloqueio } from '@/hooks/use-bloqueio';
import { ProvedorDeFichas } from '@/hooks/use-minhas-fichas';
import { useNovoAceite } from '@/hooks/use-novo-aceite';
import { usePush } from '@/hooks/use-push';
import { ProvedorDeSessao, useSessao } from '@/hooks/use-sessao';
import { autotesteDoArmazenamento } from '@/services/supabase/armazenamento';
import { cores } from '@/theme';

// A tela de abertura fica até a fonte, a sessão e o bloqueio estarem
// prontos, para o usuário não ver a letra trocar nem uma tela piscar.
SplashScreen.preventAutoHideAsync();

// Só em desenvolvimento: confere a criptografia da sessão neste aparelho.
autotesteDoArmazenamento();

function Navegacao() {
  const [fontesCarregadas, erroNasFontes] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });
  const { carregando } = useSessao();
  const { estado: bloqueio } = useBloqueio();
  const pronto = (fontesCarregadas || !!erroNasFontes) && !carregando && bloqueio !== 'verificando';
  usePush(pronto && bloqueio !== 'bloqueado');
  const { pendente: termosNovos, aceitar } = useNovoAceite();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  // Com a digital ativada, nada do app aparece antes de ela ser confirmada.
  if (bloqueio === 'bloqueado') return <Desbloqueio />;

  // Termos novos (RN-041): aceitar antes de continuar. Excluir a conta
  // continua possível sem aceitar. O pedido cobre as telas, sem desmontar a
  // navegação: tirá-la no meio de uma troca de tela quebra o React.
  const cobrir = termosNovos && pathname !== '/excluir-conta';

  return (
    <View style={estilos.tudo}>
      <View
        style={estilos.tudo}
        importantForAccessibility={cobrir ? 'no-hide-descendants' : 'auto'}
        aria-hidden={cobrir}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {cobrir && (
        <View style={estilos.cobertura}>
          <NovoAceiteDosTermos aceitar={aceitar} aoExcluirConta={() => router.navigate('/excluir-conta')} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ProvedorDeSessao>
      <ProvedorDeBloqueio>
        <ProvedorDeFichas>
          <Navegacao />
        </ProvedorDeFichas>
      </ProvedorDeBloqueio>
    </ProvedorDeSessao>
  );
}

const estilos = StyleSheet.create({
  tudo: { flex: 1 },
  cobertura: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: cores.fundo },
});
