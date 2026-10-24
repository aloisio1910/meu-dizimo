import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { listarCampanhasAtivas, type Campanha } from '@/services/supabase/ofertas';
import { cores, espacos, raio } from '@/theme';

// M-06 Ofertas: vitrine das campanhas abertas. O total arrecadado nunca
// aparece para o membro (RN-039).
export default function Ofertas() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, carregando } = useFichaAtiva();
  const [campanhas, setCampanhas] = useState<Campanha[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarCampanhasAtivas(ficha.igreja_id)
        .then((lista) => {
          if (ativo) {
            setCampanhas(lista);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;

  return (
    <Tela>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('ofertas.titulo')}</Texto>
      <Texto>{t('ofertas.explicacao')}</Texto>

      {falhou && <Texto variante="erro">{t('ofertas.falhaAoCarregar')}</Texto>}
      {!campanhas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {campanhas?.length === 0 && <Texto>{t('ofertas.nenhuma')}</Texto>}

      {campanhas?.map((campanha) => (
        <Pressable
          key={campanha.id}
          accessibilityRole="button"
          accessibilityHint={t('ofertas.verCampanha', { nome: campanha.nome })}
          onPress={() => router.push({ pathname: '/campanha/[id]', params: { id: campanha.id } })}
          style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
        >
          {!!campanha.arte && (
            <Image source={{ uri: campanha.arte }} style={estilos.arte} contentFit="cover" accessible={false} />
          )}
          <Texto variante="destaque">{campanha.nome}</Texto>
          {!!campanha.descricao && <Texto numberOfLines={3}>{campanha.descricao}</Texto>}
        </Pressable>
      ))}

      <Botao titulo={t('ofertas.historico')} variante="secundario" onPress={() => router.push('/historico-de-ofertas')} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionado: {
    backgroundColor: cores.fundoPressionado,
  },
  arte: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: raio,
  },
});
