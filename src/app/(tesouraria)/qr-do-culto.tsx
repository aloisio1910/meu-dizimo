import * as Linking from 'expo-linking';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { LogoDaIgreja } from '@/components/logo-da-igreja';
import { MenuDaTesouraria } from '@/components/menu-da-tesouraria';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useTema } from '@/hooks/use-tema';
import { linkDoQr, type DestinoDoQr } from '@/lib/qr-do-culto';
import { listarCampanhasDaIgreja, type CampanhaDaIgreja } from '@/services/supabase/campanhas-da-igreja';
import { cores, espacos, raio } from '@/theme';

type Escolhido = { destino: DestinoDoQr; nome: string };

// Endereço que o QR abre. Na nuvem, o domínio do app (EXPO_PUBLIC_URL_DO_APP);
// no computador, o endereço desta própria página.
function enderecoDoApp(): string {
  const configurado = process.env.EXPO_PUBLIC_URL_DO_APP;
  if (configurado) return configurado;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return Linking.createURL('/');
}

// QR Code do culto (B1, D-107): a tesouraria escolhe o dízimo ou uma campanha
// ativa e mostra o QR no telão ou imprime. Quem lê abre a tela certa no app.
export default function QrDoCulto() {
  const { t } = useTranslation();
  const tema = useTema();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();
  const [campanhas, setCampanhas] = useState<CampanhaDaIgreja[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [escolhido, setEscolhido] = useState<Escolhido>();

  const igrejaId = ficha?.igreja_id;
  const carregar = useCallback(async () => {
    if (!igrejaId) return;
    try {
      const lista = await listarCampanhasDaIgreja(igrejaId);
      setCampanhas(lista.filter((c) => c.status === 'ativa'));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [igrejaId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha || !igrejaId) return null;

  // Tela cheia para o telão ou para imprimir: só a logo, o nome e o QR.
  if (escolhido) {
    const link = linkDoQr(enderecoDoApp(), igrejaId, escolhido.destino);
    return (
      <Tela>
        <View style={estilos.cartaz}>
          <LogoDaIgreja tamanho={72} />
          <Texto variante="titulo" style={estilos.centro}>
            {ficha.igrejas?.nome}
          </Texto>
          <Texto variante="destaque" style={estilos.centro}>
            {escolhido.nome}
          </Texto>
          <View
            style={estilos.qr}
            accessible
            accessibilityLabel={t('qrDoCulto.descricaoDoQr', { nome: escolhido.nome })}
          >
            <QRCode value={link} size={280} color={tema.corPrincipal} />
          </View>
          <Texto style={estilos.centro}>{t('qrDoCulto.instrucao')}</Texto>
        </View>
        {Platform.OS === 'web' && <Botao titulo={t('qrDoCulto.imprimir')} onPress={() => window.print()} />}
        <Botao titulo={t('qrDoCulto.voltar')} variante="secundario" onPress={() => setEscolhido(undefined)} />
      </Tela>
    );
  }

  const opcoes: Escolhido[] = [
    { destino: { tipo: 'dizimo' }, nome: t('qrDoCulto.dizimo') },
    ...(campanhas ?? []).map((c) => ({ destino: { tipo: 'campanha' as const, campanhaId: c.id }, nome: c.nome })),
  ];

  return (
    <Tela larga>
      <MenuDaTesouraria atual="qr" />
      <Texto variante="titulo">{t('qrDoCulto.titulo')}</Texto>
      <Texto>{t('qrDoCulto.explicacao')}</Texto>
      {falhou && <Texto variante="erro">{t('qrDoCulto.falhaAoCarregar')}</Texto>}
      {!campanhas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {opcoes.map((opcao) => (
        <Pressable
          key={opcao.destino.tipo === 'dizimo' ? 'dizimo' : opcao.destino.campanhaId}
          accessibilityRole="button"
          accessibilityLabel={opcao.nome}
          onPress={() => setEscolhido(opcao)}
          style={({ pressed }) => [estilos.opcao, pressed && estilos.pressionado]}
        >
          <Texto variante="destaque">{opcao.nome}</Texto>
          <Texto variante="apoio">
            {opcao.destino.tipo === 'dizimo' ? t('qrDoCulto.abreDizimo') : t('qrDoCulto.abreCampanha')}
          </Texto>
        </Pressable>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartaz: {
    alignItems: 'center',
    gap: espacos.medio,
    padding: espacos.grande,
  },
  centro: {
    textAlign: 'center',
  },
  qr: {
    padding: espacos.medio,
    backgroundColor: '#FFFFFF',
    borderRadius: raio,
  },
  opcao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionado: {
    backgroundColor: cores.fundoPressionado,
  },
});
