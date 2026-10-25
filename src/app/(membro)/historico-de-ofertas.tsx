import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SeloDeStatus } from '@/components/selo-de-status';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { isoParaData } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { listarMinhasOfertas, type OfertaDoHistorico } from '@/services/supabase/ofertas';
import { cores, espacos, raio } from '@/theme';

// M-08 Histórico de ofertas: só as ofertas registradas no app, separadas do
// Cartão de Dízimo (RN-037).
export default function HistoricoDeOfertas() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/ofertas');
  const { ficha, carregando } = useFichaAtiva();
  const [ofertas, setOfertas] = useState<OfertaDoHistorico[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarMinhasOfertas(ficha.id)
        .then((lista) => {
          if (ativo) {
            setOfertas(lista);
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

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';

  return (
    <Tela>
      <Texto variante="titulo">{t('ofertas.historicoTela.titulo')}</Texto>

      {falhou && <Texto variante="erro">{t('ofertas.falhaAoCarregar')}</Texto>}
      {!ofertas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {ofertas?.length === 0 && <Texto>{t('ofertas.historicoTela.nenhuma')}</Texto>}

      {ofertas?.map((oferta) => {
        const emMoeda = (centavos: number) => formatarMoeda(centavos, oferta.moeda, idioma);
        return (
          <Pressable
            key={oferta.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: oferta.id } })}
            style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
          >
            <View style={estilos.topoDaLinha}>
              <Texto variante="destaque">{isoParaData(oferta.data_contribuicao)}</Texto>
              <Texto variante="destaque">{emMoeda(oferta.valor_informado_centavos)}</Texto>
            </View>
            {!!oferta.campanhas && <Texto>{t('ofertas.historicoTela.campanha', { nome: oferta.campanhas.nome })}</Texto>}
            <SeloDeStatus status={oferta.status} />
            {oferta.status === 'confirmado' && !!oferta.confirmado_por_nome && (
              <Texto>{t('cartao.confirmadoPor', { nome: oferta.confirmado_por_nome })}</Texto>
            )}
            {oferta.valor_conferido_centavos !== null &&
              oferta.valor_conferido_centavos !== oferta.valor_informado_centavos && (
                <Texto>{t('cartao.valorConferido', { valor: emMoeda(oferta.valor_conferido_centavos) })}</Texto>
              )}
            <Texto variante="apoio">{t('cartao.tocarParaDetalhes')}</Texto>
          </Pressable>
        );
      })}

      <Botao titulo={t('ofertas.ofertar.voltarAsOfertas')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linha: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
  topoDaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
});
