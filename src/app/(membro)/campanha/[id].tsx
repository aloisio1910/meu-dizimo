import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { VideoDaCampanha } from '@/components/video-da-campanha';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useVoltar } from '@/hooks/use-voltar';
import { buscarCampanha } from '@/services/supabase/ofertas';
import { raio } from '@/theme';

type CampanhaDaTela = Awaited<ReturnType<typeof buscarCampanha>>;

// M-07 Campanha: arte, descrição, objetivo e vídeo, com o botão Ofertar.
export default function TelaDaCampanha() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/ofertas');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [campanha, setCampanha] = useState<CampanhaDaTela>();

  useEffect(() => {
    let ativo = true;
    buscarCampanha(id)
      .then((encontrada) => ativo && setCampanha(encontrada))
      .catch(() => ativo && setCampanha(null));
    return () => {
      ativo = false;
    };
  }, [id]);

  if (campanha === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (campanha === null) {
    return (
      <Tela>
        <Texto>{t('ofertas.campanha.naoEncontrada')}</Texto>
        <Botao titulo={t('ofertas.campanha.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const ativa = campanha.status === 'ativa';

  return (
    <Tela>
      {!!campanha.arte && (
        <Image source={{ uri: campanha.arte }} style={estilos.arte} contentFit="cover" accessible={false} />
      )}
      <Texto variante="titulo">{campanha.nome}</Texto>
      {!!campanha.descricao && <Texto>{campanha.descricao}</Texto>}
      {!!campanha.objetivo && (
        <Texto variante="destaque">{t('ofertas.campanha.objetivo', { texto: campanha.objetivo })}</Texto>
      )}
      {!!campanha.link_video && <VideoDaCampanha link={campanha.link_video} />}

      {ativa ? (
        <Botao
          titulo={t('ofertas.campanha.ofertar')}
          onPress={() => router.push({ pathname: '/ofertar/[id]', params: { id: campanha.id } })}
        />
      ) : (
        <Texto variante="destaque">{t('ofertas.campanha.encerrada')}</Texto>
      )}
      <Botao titulo={t('ofertas.campanha.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  arte: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: raio,
  },
});
