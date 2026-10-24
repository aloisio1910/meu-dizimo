import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { isoParaData, partesDaDataHora } from '@/lib/data';
import { completarValor, formatarMoeda, mascararValor, textoParaCentavos } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import {
  abrirProximo,
  buscarItem,
  confirmarLancamento,
  liberarConferencia,
  manterConferencia,
  registrarDivergencia,
  type ErroDaConferencia,
  type ItemDaFila,
} from '@/services/supabase/tesouraria';
import { cores, espacos, raio } from '@/theme';

// Sinal de vida a cada 2 minutos: o bloqueio só vence após 10 parado (RN-029).
const INTERVALO_DO_SINAL_MS = 2 * 60 * 1000;

type Modo = 'decidir' | 'divergencia' | 'feito';

// T-02 Conferência: dados, comprovantes e a decisão (confirmar ou divergência).
// A chave faz o React montar a tela do zero a cada lançamento (ex.: ao ir
// para o próximo), sem carregar o estado do anterior.
export default function Conferencia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConferenciaDoLancamento key={id} id={id} />;
}

function ConferenciaDoLancamento({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao } = useSessao();
  const { ficha, ehTesouraria } = useFichaAtiva();

  const [item, setItem] = useState<ItemDaFila | null>();
  const [modo, setModo] = useState<Modo>('decidir');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // Se a tela fechar sem decisão, o lançamento volta para a fila.
  const decidido = useRef(false);

  useEffect(() => {
    let ativo = true;
    buscarItem(id)
      .then((encontrado) => ativo && setItem(encontrado))
      .catch(() => ativo && setItem(null));
    return () => {
      ativo = false;
    };
  }, [id]);

  // Enquanto a tela está aberta, avisa o banco; ao sair sem decidir, libera.
  useFocusEffect(
    useCallback(() => {
      const sinal = setInterval(() => {
        manterConferencia(id);
      }, INTERVALO_DO_SINAL_MS);
      return () => {
        clearInterval(sinal);
        if (!decidido.current) liberarConferencia(id);
      };
    }, [id]),
  );

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

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const aberto = !!item && item.status === 'em_conferencia' && item.em_conferencia_por === sessao.user.id;

  if (!item || (!aberto && modo !== 'feito')) {
    return (
      <Tela larga>
        <Texto>{t('tesouraria.conferencia.naoAberta')}</Texto>
        <Botao titulo={t('tesouraria.conferencia.voltarAFila')} onPress={() => router.replace('/fila')} />
      </Tela>
    );
  }

  const emMoeda = (centavos: number) => formatarMoeda(centavos, item.moeda, idioma);
  const forma = ehFormaConhecida(item.forma) ? t(`formas.${item.forma}`) : item.forma;
  const contestada = item.resposta_membro === 'contestada';

  const mensagemDoErro = (codigo: ErroDaConferencia) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.conferencia.erros.${codigo}`);

  async function decidir(acao: () => Promise<{ ok: boolean; erro?: ErroDaConferencia }>, avisoDeSucesso: string) {
    setErro(undefined);
    setEnviando(true);
    const resultado = await acao();
    setEnviando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro ?? 'erro_inesperado'));
      return;
    }
    decidido.current = true;
    setAviso(avisoDeSucesso);
    setModo('feito');
  }

  function valorDigitado(): number | null {
    const centavos = textoParaCentavos(valor);
    if (!centavos) setErro(t('tesouraria.conferencia.erros.valorInvalido'));
    return centavos;
  }

  async function conferirProximo() {
    const resultado = await abrirProximo(ficha!.igreja_id, {});
    if (resultado.ok && resultado.id) router.replace({ pathname: '/conferencia/[id]', params: { id: resultado.id } });
    else router.replace('/fila');
  }

  return (
    <Tela larga>
      <Texto variante="titulo">{t('tesouraria.conferencia.titulo')}</Texto>

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
        {!!item.conta_nome && <Texto>{t('tesouraria.conferencia.conta', { conta: item.conta_nome })}</Texto>}
        <Texto variante="apoio">
          {t('tesouraria.conferencia.registradoEm', {
            quando: t('lancamento.dataHora', partesDaDataHora(item.registrado_em, idioma)),
          })}
        </Texto>
        {modo === 'feito' ? null : <SeloDeStatus status={item.status} />}
      </View>

      {contestada && (
        <View style={estilos.cartao}>
          {item.valor_conferido_centavos !== null && (
            <Texto>
              {t('tesouraria.conferencia.divergenciaAnterior', {
                valor: emMoeda(item.valor_conferido_centavos),
                texto: item.observacao_tesouraria ?? '',
              })}
            </Texto>
          )}
          <Texto variante="destaque">{t('tesouraria.conferencia.contestacao', { mensagem: item.mensagem_membro ?? '' })}</Texto>
        </View>
      )}

      <ComprovantesDaTesouraria lancamentoId={item.id} idioma={idioma} />

      {!!erro && <Texto variante="erro">{erro}</Texto>}

      {modo === 'decidir' && !contestada && (
        <>
          <Texto>{t('tesouraria.conferencia.orientacao')}</Texto>
          <Botao
            titulo={t('tesouraria.conferencia.confirmar', { valor: emMoeda(item.valor_informado_centavos) })}
            onPress={() => decidir(() => confirmarLancamento(item.id), t('tesouraria.conferencia.confirmado'))}
            carregando={enviando}
          />
          <Botao
            titulo={t('tesouraria.conferencia.registrarDivergencia')}
            variante="secundario"
            onPress={() => {
              setErro(undefined);
              setModo('divergencia');
            }}
            desabilitado={enviando}
          />
        </>
      )}

      {/* Contestação: a tesouraria informa o valor final; o informado nunca muda (D-075). */}
      {modo === 'decidir' && contestada && (
        <>
          <Texto>{t('tesouraria.conferencia.resolverContestacao')}</Texto>
          <CampoTexto
            rotulo={t('tesouraria.conferencia.valorConferido')}
            value={valor}
            onChangeText={(texto) => setValor(mascararValor(texto))}
            onBlur={() => setValor((atual) => completarValor(atual))}
            keyboardType="decimal-pad"
          />
          <Botao
            titulo={t('tesouraria.conferencia.confirmarComValor')}
            onPress={() => {
              const centavos = valorDigitado();
              if (centavos)
                decidir(() => confirmarLancamento(item.id, centavos), t('tesouraria.conferencia.confirmado'));
            }}
            carregando={enviando}
          />
          <Botao
            titulo={t('tesouraria.conferencia.registrarDivergencia')}
            variante="secundario"
            onPress={() => {
              setErro(undefined);
              setModo('divergencia');
            }}
            desabilitado={enviando}
          />
        </>
      )}

      {modo === 'divergencia' && (
        <>
          <CampoTexto
            rotulo={t('tesouraria.conferencia.valorConferido')}
            dica={t('tesouraria.conferencia.dicaValorConferido')}
            value={valor}
            onChangeText={(texto) => setValor(mascararValor(texto))}
            onBlur={() => setValor((atual) => completarValor(atual))}
            keyboardType="decimal-pad"
          />
          <CampoTexto
            rotulo={t('tesouraria.conferencia.observacao')}
            dica={t('tesouraria.conferencia.dicaObservacao')}
            value={observacao}
            onChangeText={setObservacao}
            multiline
          />
          <Botao
            titulo={t('tesouraria.conferencia.salvarDivergencia')}
            onPress={() => {
              const centavos = valorDigitado();
              if (centavos)
                decidir(
                  () => registrarDivergencia(item.id, centavos, observacao),
                  t('tesouraria.conferencia.divergenciaEnviada'),
                );
            }}
            carregando={enviando}
          />
          <Botao
            titulo={t('tesouraria.conferencia.voltar')}
            variante="secundario"
            onPress={() => {
              setErro(undefined);
              setModo('decidir');
            }}
            desabilitado={enviando}
          />
        </>
      )}

      {modo === 'feito' && (
        <>
          <Texto variante="destaque" accessibilityLiveRegion="polite">
            {aviso}
          </Texto>
          <Botao titulo={t('tesouraria.conferencia.proximo')} onPress={conferirProximo} />
          <Botao titulo={t('tesouraria.conferencia.voltarAFila')} variante="secundario" onPress={() => router.replace('/fila')} />
        </>
      )}

      {modo !== 'feito' && (
        <Botao
          titulo={t('tesouraria.conferencia.voltarAFila')}
          variante="secundario"
          onPress={() => router.replace('/fila')}
          desabilitado={enviando}
        />
      )}
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
