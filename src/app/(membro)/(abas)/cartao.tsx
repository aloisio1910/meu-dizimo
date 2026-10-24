import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SeloDeStatus } from '@/components/selo-de-status';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useSessao } from '@/hooks/use-sessao';
import { isoParaData } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import { listarMeusDizimos, type LancamentoDoCartao } from '@/services/supabase/lancamentos';
import { cores, espacos, raio } from '@/theme';

// M-03 Cartão de Dízimo: tela inicial do membro, com os dízimos por data,
// o status de cada um e quem confirmou.
export default function Cartao() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao } = useSessao();
  const { ficha, carregando: carregandoFicha, ehTesouraria } = useFichaAtiva();
  const [dizimos, setDizimos] = useState<LancamentoDoCartao[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  // Recarrega sempre que a tela volta a aparecer (ex.: depois de registrar).
  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarMeusDizimos(ficha.id)
        .then((lista) => {
          if (ativo) {
            setDizimos(lista);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!sessao) return <Redirect href="/entrar" />;
  if (!carregandoFicha && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;

  const igreja = ficha.igrejas;
  const idioma = igreja?.idioma ?? 'pt-BR';
  const moedaDe = (lancamento: LancamentoDoCartao) => (centavos: number) =>
    formatarMoeda(centavos, lancamento.moeda, idioma);

  return (
    <Tela>
      <Texto variante="apoio">{igreja?.nome}</Texto>
      <Texto variante="titulo">{t('cartao.titulo')}</Texto>
      <Texto variante="destaque">{t('cartao.dizimista', { nome: ficha.nome, numero: ficha.numero })}</Texto>
      {!!igreja && (
        <View style={estilos.versiculo}>
          {!!igreja.versiculo_texto && <Texto>{igreja.versiculo_texto}</Texto>}
          <Texto variante="apoio">{igreja.versiculo_referencia}</Texto>
        </View>
      )}

      <Botao titulo={t('cartao.registrar')} onPress={() => router.push('/registrar-dizimo')} />
      {ehTesouraria && (
        <Botao titulo={t('tesouraria.abrirPainel')} variante="secundario" onPress={() => router.push('/fila')} />
      )}

      <Texto variante="destaque" accessibilityRole="header">
        {t('cartao.seusDizimos')}
      </Texto>

      {falhou && <Texto variante="erro">{t('cartao.falhaAoCarregar')}</Texto>}
      {!dizimos && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {dizimos?.length === 0 && <Texto>{t('cartao.nenhum')}</Texto>}

      {dizimos?.map((dizimo) => {
        const moeda = moedaDe(dizimo);
        return (
          <Pressable
            key={dizimo.id}
            accessibilityRole="button"
            accessibilityHint={t('cartao.abrirDetalhe')}
            onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: dizimo.id } })}
            style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
          >
            <View style={estilos.topoDaLinha}>
              <Texto variante="destaque">{isoParaData(dizimo.data_contribuicao)}</Texto>
              <Texto variante="destaque">{moeda(dizimo.valor_informado_centavos)}</Texto>
            </View>
            <Texto variante="apoio">
              {ehFormaConhecida(dizimo.forma) ? t(`formas.${dizimo.forma}`) : dizimo.forma}
            </Texto>
            <SeloDeStatus status={dizimo.status} />
            {dizimo.status === 'confirmado' && !!dizimo.confirmado_por_nome && (
              <Texto>{t('cartao.confirmadoPor', { nome: dizimo.confirmado_por_nome })}</Texto>
            )}
            {dizimo.valor_conferido_centavos !== null &&
              dizimo.valor_conferido_centavos !== dizimo.valor_informado_centavos && (
                <Texto>{t('cartao.valorConferido', { valor: moeda(dizimo.valor_conferido_centavos) })}</Texto>
              )}
            {dizimo.registrado_pela_tesouraria && <Texto variante="apoio">{t('cartao.registradoPelaTesouraria')}</Texto>}
            <Texto variante="apoio">{t('cartao.tocarParaDetalhes')}</Texto>
          </Pressable>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  versiculo: {
    gap: espacos.pequeno,
    paddingLeft: espacos.medio,
    borderLeftWidth: 4,
    borderLeftColor: cores.borda,
  },
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
