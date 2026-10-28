import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { guardarDestinoDepoisDoLogin } from '@/lib/destino-depois-do-login';
import { caminhoDoQr, lerQr } from '@/lib/qr-do-culto';

// QR Code do culto (B1): quem lê o QR cai aqui. Sem login, entra e volta;
// na igreja do QR, abre o registro do dízimo ou a campanha, já nessa igreja.
export default function LerQr() {
  const { t } = useTranslation();
  const router = useRouter();
  const parametros = useLocalSearchParams<{ igreja?: string; ir?: string; campanha?: string }>();
  const { sessao } = useSessao();
  const { fichas, carregando, escolherIgreja } = useMinhasFichas();
  const qr = lerQr(parametros);
  const ficha = qr ? fichas.find((f) => f.igreja_id === qr.igrejaId && f.status === 'ativo') : undefined;

  useEffect(() => {
    if (!qr || !ficha) return;
    escolherIgreja(qr.igrejaId);
    if (qr.destino.tipo === 'dizimo') router.replace('/registrar-dizimo');
    else router.replace({ pathname: '/campanha/[id]', params: { id: qr.destino.campanhaId } });
    // Só uma vez, quando a ficha da igreja do QR aparece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha?.id]);

  if (!qr) {
    return (
      <Tela>
        <Texto variante="titulo">{t('qr.titulo')}</Texto>
        <Texto>{t('qr.invalido')}</Texto>
        <Botao titulo={t('qr.inicio')} onPress={() => router.replace('/')} />
      </Tela>
    );
  }

  if (!sessao) {
    guardarDestinoDepoisDoLogin(caminhoDoQr(qr.igrejaId, qr.destino));
    return <Redirect href="/entrar" />;
  }

  if (carregando || ficha) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  // Convidado nesta igreja: termina o primeiro acesso e volta ao QR.
  if (fichas.some((f) => f.igreja_id === qr.igrejaId && f.status === 'convidado')) {
    guardarDestinoDepoisDoLogin(caminhoDoQr(qr.igrejaId, qr.destino));
    return <Redirect href="/" />;
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('qr.titulo')}</Texto>
      <Texto>{t('qr.outraIgreja')}</Texto>
      <Botao titulo={t('qr.inicio')} onPress={() => router.replace('/')} />
    </Tela>
  );
}
