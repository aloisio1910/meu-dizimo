import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ComprovantesDaTesouraria } from '@/components/comprovantes-da-tesouraria';
import { SeloDeStatus } from '@/components/selo-de-status';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useSessao } from '@/hooks/use-sessao';
import { useVoltar } from '@/hooks/use-voltar';
import { isoParaData, partesDaDataHora } from '@/lib/data';
import { minutosRestantes, tempoRestanteParaDesfazer } from '@/lib/desfazer';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import {
  buscarItem,
  desfazerConfirmacao,
  reabrirLancamento,
  type ErroDaConferencia,
  type ItemDaFila,
} from '@/services/supabase/tesouraria';
import { cores, espacos, raio } from '@/theme';

type Acao = 'desfazer' | 'reabrir';

// Lançamento já conferido: consulta e correção de engano. Quem confirmou
// desfaz em até 15 minutos (D-084); o Pastor de Governo reabre a qualquer
// momento, com justificativa (RN-031).
export default function Conferido() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/fila');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao } = useSessao();
  const { ficha, ehTesouraria, ehAdministrador } = useFichaAtiva();

  const [item, setItem] = useState<ItemDaFila | null>();
  const [acao, setAcao] = useState<Acao>();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string>();
  const [feito, setFeito] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    let ativo = true;
    buscarItem(id)
      .then((encontrado) => ativo && setItem(encontrado))
      .catch(() => ativo && setItem(null));
    return () => {
      ativo = false;
    };
  }, [id]);

  // Atualiza o tempo restante para desfazer a cada 15 segundos.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 15000);
    return () => clearInterval(relogio);
  }, []);

  if (!sessao) return <Redirect href="/entrar" />;
  if (!ficha) return <Redirect href="/" />;
  if (!ehTesouraria) return <Redirect href="/fila" />;

  if (item === undefined) {
    return (
      <Tela larga>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (!item) {
    return (
      <Tela larga>
        <Texto>{t('lancamento.naoEncontrado')}</Texto>
        <Botao titulo={t('tesouraria.conferencia.voltarAFila')} onPress={() => router.replace('/fila')} />
      </Tela>
    );
  }

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, item.moeda, idioma);
  const forma = ehFormaConhecida(item.forma) ? t(`formas.${item.forma}`) : item.forma;
  const restante = tempoRestanteParaDesfazer(item, sessao.user.id, agora);
  const confirmado = item.status === 'confirmado' && !feito;

  async function executar() {
    setErro(undefined);
    setEnviando(true);
    const resultado =
      acao === 'desfazer' ? await desfazerConfirmacao(item!.id, motivo) : await reabrirLancamento(item!.id, motivo);
    setEnviando(false);
    if (!resultado.ok) {
      const codigo: ErroDaConferencia = resultado.erro;
      setErro(
        codigo === 'sem_conexao' || codigo === 'erro_inesperado'
          ? t(`comum.erros.${codigo}`)
          : t(`tesouraria.conferencia.erros.${codigo}`),
      );
      return;
    }
    setFeito(t(acao === 'desfazer' ? 'tesouraria.conferidos.desfeito' : 'tesouraria.conferidos.reaberto'));
    setAcao(undefined);
  }

  return (
    <Tela larga>
      <Texto variante="titulo">{t('tesouraria.conferidos.detalheTitulo')}</Texto>

      <View style={estilos.cartao}>
        <Texto variante="destaque">
          {t('tesouraria.item.membro', { nome: item.membro_nome, numero: item.membro_numero })}
        </Texto>
        <Texto>
          {t(item.tipo === 'dizimo' ? 'tesouraria.item.dizimo' : 'tesouraria.item.oferta')} ·{' '}
          {t('tesouraria.item.dataEForma', { data: isoParaData(item.data_contribuicao), forma })}
        </Texto>
        <Texto variante="apoio">{t('tesouraria.conferencia.valorInformado')}</Texto>
        <Texto variante="titulo">{emMoeda(item.valor_informado_centavos)}</Texto>
        {item.valor_conferido_centavos !== null && item.valor_conferido_centavos !== item.valor_informado_centavos && (
          <Texto>{t('tesouraria.conferidos.valorConferido', { valor: emMoeda(item.valor_conferido_centavos) })}</Texto>
        )}
        {!!item.conta_nome && <Texto>{t('tesouraria.conferencia.conta', { conta: item.conta_nome })}</Texto>}
        {!feito && <SeloDeStatus status={item.status} />}
        {confirmado && !!item.confirmado_por_nome && !!item.confirmado_em && (
          <Texto>
            {t('tesouraria.conferidos.confirmadoPorEm', {
              nome: item.confirmado_por_nome,
              quando: t('lancamento.dataHora', partesDaDataHora(item.confirmado_em, idioma)),
            })}
          </Texto>
        )}
      </View>

      <ComprovantesDaTesouraria lancamentoId={item.id} idioma={idioma} />

      {!!feito && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {feito}
        </Texto>
      )}
      {!!erro && <Texto variante="erro">{erro}</Texto>}

      {confirmado && !acao && (
        <>
          {restante > 0 && (
            <>
              <Texto>{t('tesouraria.conferidos.podeDesfazer', { minutos: minutosRestantes(restante) })}</Texto>
              <Botao titulo={t('tesouraria.conferidos.desfazer')} onPress={() => setAcao('desfazer')} />
            </>
          )}
          {ehAdministrador ? (
            <Botao titulo={t('tesouraria.conferidos.reabrir')} variante="secundario" onPress={() => setAcao('reabrir')} />
          ) : (
            restante === 0 && <Texto variante="apoio">{t('tesouraria.conferidos.paraCorrigir')}</Texto>
          )}
        </>
      )}

      {!!acao && (
        <>
          <CampoTexto
            rotulo={t(acao === 'desfazer' ? 'tesouraria.conferidos.motivoDesfazer' : 'tesouraria.conferidos.justificativa')}
            dica={t(
              acao === 'desfazer' ? 'tesouraria.conferidos.dicaMotivoDesfazer' : 'tesouraria.conferidos.dicaJustificativa',
            )}
            value={motivo}
            onChangeText={setMotivo}
            multiline
          />
          <Botao
            titulo={t(acao === 'desfazer' ? 'tesouraria.conferidos.confirmarDesfazer' : 'tesouraria.conferidos.confirmarReabrir')}
            onPress={executar}
            carregando={enviando}
          />
          <Botao
            titulo={t('tesouraria.conferidos.voltar')}
            variante="secundario"
            onPress={() => {
              setAcao(undefined);
              setErro(undefined);
            }}
            desabilitado={enviando}
          />
        </>
      )}

      <Botao
        titulo={t('tesouraria.conferencia.voltarAFila')}
        variante="secundario"
        onPress={() => voltar()}
        desabilitado={enviando}
      />
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
});
