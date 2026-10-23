import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CamposDoDizimo } from '@/components/campos-do-dizimo';
import { SeloDeStatus } from '@/components/selo-de-status';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { hojeIso, isoParaData, partesDaDataHora } from '@/lib/data';
import { centavosParaCampo, formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import { validarDizimo, type ErrosDoDizimo } from '@/lib/validar-dizimo';
import {
  buscarLancamento,
  cancelarLancamento,
  editarDizimo,
  responderDivergencia,
  type DetalheDoLancamento,
  type ErroDaAcao,
} from '@/services/supabase/lancamentos';
import { cores, espacos, raio } from '@/theme';

type Modo = 'ver' | 'editar' | 'cancelar' | 'aceitar' | 'contestar';

// M-05 Detalhe do lançamento: status e, conforme o status, editar, cancelar,
// aceitar ou contestar a divergência.
export default function DetalheDoDizimo() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ficha } = useFichaAtiva();

  const [lancamento, setLancamento] = useState<DetalheDoLancamento | null>();
  const [modo, setModo] = useState<Modo>('ver');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  // Campos da edição, do cancelamento e da contestação
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [forma, setForma] = useState<string>();
  const [errosDaEdicao, setErrosDaEdicao] = useState<ErrosDoDizimo>({});
  const [texto, setTexto] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLancamento(await buscarLancamento(id));
    } catch {
      setLancamento(null);
    }
  }, [id]);

  useEffect(() => {
    let ativo = true;
    buscarLancamento(id)
      .then((encontrado) => ativo && setLancamento(encontrado))
      .catch(() => ativo && setLancamento(null));
    return () => {
      ativo = false;
    };
  }, [id]);

  if (!ficha) return <Redirect href="/" />;

  if (lancamento === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (lancamento === null) {
    return (
      <Tela>
        <Texto>{t('lancamento.naoEncontrado')}</Texto>
        <Botao titulo={t('lancamento.voltarAoCartao')} onPress={() => router.back()} />
      </Tela>
    );
  }

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, lancamento.moeda, idioma);
  const quando = (momento: string) => t('lancamento.dataHora', partesDaDataHora(momento, idioma));
  const nomeDaForma = (f: string) => (ehFormaConhecida(f) ? t(`formas.${f}`) : f);

  const mensagemDoErro = (codigo: ErroDaAcao) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado' ? t(`comum.erros.${codigo}`) : t(`lancamento.erros.${codigo}`);

  function irPara(novoModo: Modo) {
    setErro(undefined);
    setAviso(undefined);
    setTexto('');
    if (novoModo === 'editar' && lancamento) {
      setValor(centavosParaCampo(lancamento.valor_informado_centavos));
      setData(isoParaData(lancamento.data_contribuicao));
      setForma(lancamento.forma);
      setErrosDaEdicao({});
    }
    setModo(novoModo);
  }

  // Executa a ação, recarrega o lançamento e volta para a visão.
  async function executar(acao: () => Promise<ErroDaAcao | null>, avisoDeSucesso?: string) {
    setEnviando(true);
    setErro(undefined);
    const falha = await acao();
    setEnviando(false);
    if (falha) {
      setErro(mensagemDoErro(falha));
      if (falha === 'lancamento_bloqueado' || falha === 'divergencia_indisponivel') {
        await carregar();
        setModo('ver');
      }
      return;
    }
    await carregar();
    setModo('ver');
    setAviso(avisoDeSucesso);
  }

  async function salvarEdicao() {
    const resultado = validarDizimo({ valor, data, forma }, hojeIso());
    if (!resultado.ok) {
      setErrosDaEdicao(resultado.erros);
      return;
    }
    setErrosDaEdicao({});
    await executar(() => editarDizimo(lancamento!.id, resultado.dados), t('lancamento.editado'));
  }

  const divergenciaAberta = lancamento.status === 'divergencia' && !lancamento.resposta_membro;

  return (
    <Tela>
      <Texto variante="titulo">{t('lancamento.titulo')}</Texto>

      {modo === 'editar' ? (
        <>
          <CamposDoDizimo
            valor={valor}
            aoMudarValor={setValor}
            data={data}
            aoMudarData={setData}
            forma={forma}
            aoMudarForma={setForma}
            formasAceitas={ficha.igrejas?.formas_devolucao ?? []}
            erros={errosDaEdicao}
          />
          {!!erro && <Texto variante="erro">{erro}</Texto>}
          <Botao titulo={t('lancamento.salvar')} onPress={salvarEdicao} carregando={enviando} />
          <Botao titulo={t('lancamento.voltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
        </>
      ) : (
        <>
          <View style={estilos.cartao}>
            <SeloDeStatus status={lancamento.status} />
            <Texto variante="apoio">{t('lancamento.rotuloData')}</Texto>
            <Texto variante="destaque">{isoParaData(lancamento.data_contribuicao)}</Texto>
            <Texto variante="apoio">{t('lancamento.rotuloValor')}</Texto>
            <Texto variante="destaque">{emMoeda(lancamento.valor_informado_centavos)}</Texto>
            <Texto variante="apoio">{t('lancamento.rotuloForma')}</Texto>
            <Texto variante="destaque">{nomeDaForma(lancamento.forma)}</Texto>
            <Texto variante="apoio">{t('lancamento.registradoEm', { quando: quando(lancamento.registrado_em) })}</Texto>
            {lancamento.registrado_pela_tesouraria && <Texto variante="apoio">{t('cartao.registradoPelaTesouraria')}</Texto>}
          </View>

          {lancamento.status === 'confirmado' && !!lancamento.confirmado_por_nome && !!lancamento.confirmado_em && (
            <Texto>
              {t('lancamento.confirmadoPorEm', {
                nome: lancamento.confirmado_por_nome,
                quando: quando(lancamento.confirmado_em),
              })}
            </Texto>
          )}

          {lancamento.status === 'em_conferencia' && <Texto variante="destaque">{t('lancamento.emConferencia')}</Texto>}

          {lancamento.status === 'cancelado' && !!lancamento.cancelado_em && (
            <Texto>
              {t('lancamento.canceladoEm', {
                quando: quando(lancamento.cancelado_em),
                motivo: lancamento.motivo_cancelamento ?? '',
              })}
            </Texto>
          )}

          {/* Divergência: informado e conferido lado a lado (passo 2 do fluxo). */}
          {lancamento.status === 'divergencia' && lancamento.valor_conferido_centavos !== null && (
            <View style={estilos.cartao}>
              <Texto variante="destaque">{t('lancamento.divergenciaTitulo')}</Texto>
              <View style={estilos.ladoALado}>
                <View style={estilos.coluna}>
                  <Texto variante="apoio">{t('lancamento.rotuloValor')}</Texto>
                  <Texto variante="destaque">{emMoeda(lancamento.valor_informado_centavos)}</Texto>
                </View>
                <View style={estilos.coluna}>
                  <Texto variante="apoio">{t('lancamento.valorConferido')}</Texto>
                  <Texto variante="destaque">{emMoeda(lancamento.valor_conferido_centavos)}</Texto>
                </View>
              </View>
              {!!lancamento.observacao_tesouraria && (
                <Texto>{t('lancamento.observacao', { texto: lancamento.observacao_tesouraria })}</Texto>
              )}
              {lancamento.resposta_membro === 'contestada' && !!lancamento.respondido_em && (
                <Texto>
                  {t('lancamento.contestadoEm', {
                    quando: quando(lancamento.respondido_em),
                    mensagem: lancamento.mensagem_membro ?? '',
                  })}
                </Texto>
              )}
            </View>
          )}

          {!!aviso && (
            <Texto variante="destaque" accessibilityLiveRegion="polite">
              {aviso}
            </Texto>
          )}
          {!!erro && <Texto variante="erro">{erro}</Texto>}

          {modo === 'ver' && lancamento.status === 'aguardando' && (
            <>
              <Botao titulo={t('lancamento.editar')} onPress={() => irPara('editar')} />
              <Botao titulo={t('lancamento.cancelar')} variante="secundario" onPress={() => irPara('cancelar')} />
            </>
          )}

          {modo === 'cancelar' && (
            <>
              <CampoTexto
                rotulo={t('lancamento.motivo')}
                dica={t('lancamento.dicaMotivo')}
                value={texto}
                onChangeText={setTexto}
                multiline
              />
              <Botao
                titulo={t('lancamento.confirmarCancelamento')}
                onPress={() => executar(() => cancelarLancamento(lancamento.id, texto))}
                carregando={enviando}
              />
              <Botao titulo={t('lancamento.voltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
            </>
          )}

          {modo === 'ver' && divergenciaAberta && (
            <>
              <Botao titulo={t('lancamento.aceitar')} onPress={() => irPara('aceitar')} />
              <Botao titulo={t('lancamento.contestar')} variante="secundario" onPress={() => irPara('contestar')} />
            </>
          )}

          {/* Aceitar não tem volta: pede confirmação antes. */}
          {modo === 'aceitar' && lancamento.valor_conferido_centavos !== null && (
            <>
              <Texto variante="destaque">
                {t('lancamento.confirmarAceite', { valor: emMoeda(lancamento.valor_conferido_centavos) })}
              </Texto>
              <Botao
                titulo={t('lancamento.simAceitar')}
                onPress={() => executar(() => responderDivergencia(lancamento.id, true))}
                carregando={enviando}
              />
              <Botao titulo={t('lancamento.naoVoltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
            </>
          )}

          {modo === 'contestar' && (
            <>
              <CampoTexto
                rotulo={t('lancamento.mensagemContestacao')}
                dica={t('lancamento.dicaContestacao')}
                value={texto}
                onChangeText={setTexto}
                multiline
              />
              <Botao
                titulo={t('lancamento.enviarContestacao')}
                onPress={() => executar(() => responderDivergencia(lancamento.id, false, texto))}
                carregando={enviando}
              />
              <Botao titulo={t('lancamento.voltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
            </>
          )}
        </>
      )}

      {modo === 'ver' && (
        <Botao titulo={t('lancamento.voltarAoCartao')} variante="secundario" onPress={() => router.back()} />
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
  ladoALado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.grande,
  },
  coluna: {
    gap: 4,
  },
});
