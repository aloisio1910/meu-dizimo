import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SeloDeStatus } from '@/components/selo-de-status';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { familiaresIniciais, valoresIniciais } from '@/lib/cadastro';
import { isoParaData, partesDaDataHora } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import { acaoDeStatus, emailValido, normalizarEmail, situacaoDoMembro } from '@/lib/membros';
import { buscarCamposDoCadastro, type CampoDoCadastro } from '@/services/supabase/membros';
import {
  buscarMembroDaIgreja,
  corrigirEmailDoConvidado,
  listarLancamentosDoMembro,
  mudarStatusDoMembro,
  reenviarConvite,
  type ErroDoConvite,
  type LancamentoDoMembro,
  type MembroDaLista,
} from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

type Modo = 'ver' | 'corrigirEmail' | 'confirmarStatus';

type Ficha = { membro: MembroDaLista; campos: CampoDoCadastro[] };

// T-04 Cartão do membro (tesouraria): dados cadastrais, convite, histórico
// de dízimos e ofertas e mudança de status (D-085).
export default function CartaoDoMembro() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/membros');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ficha, carregando, ehTesouraria, ehAdministrador } = useFichaAtiva();

  const [dados, setDados] = useState<Ficha | null>();
  const [lancamentos, setLancamentos] = useState<LancamentoDoMembro[] | null>(null);
  const [falhouHistorico, setFalhouHistorico] = useState(false);
  const [modo, setModo] = useState<Modo>('ver');
  const [novoEmail, setNovoEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const igrejaId = ficha?.igreja_id;

  const buscarTudo = useCallback(async () => {
    if (!igrejaId) return null;
    const [membro, campos] = await Promise.all([buscarMembroDaIgreja(igrejaId, id), buscarCamposDoCadastro(igrejaId)]);
    return membro ? { membro, campos } : null;
  }, [igrejaId, id]);

  const recarregar = useCallback(async () => {
    setDados(await buscarTudo().catch(() => null));
  }, [buscarTudo]);

  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    buscarTudo()
      .then((encontrado) => ativo && setDados(encontrado))
      .catch(() => ativo && setDados(null));
    listarLancamentosDoMembro(igrejaId, id)
      .then((lista) => ativo && setLancamentos(lista))
      .catch(() => ativo && setFalhouHistorico(true));
    return () => {
      ativo = false;
    };
  }, [buscarTudo, igrejaId, id]);

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha || dados === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (dados === null) {
    return (
      <Tela>
        <Texto>{t('tesouraria.membro.naoEncontrado')}</Texto>
        <Botao titulo={t('tesouraria.membro.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const { membro, campos } = dados;
  const igreja = ficha.igrejas;
  const idioma = igreja?.idioma ?? 'pt-BR';
  const titulo = igreja?.titulo_administrador;
  const dia = (momento: string) => partesDaDataHora(momento, idioma).dia;
  const situacao = situacaoDoMembro(membro.status, membro.convites, new Date());
  const ultimoConvite = membro.convites[0]; // vem do mais recente para o mais antigo
  const ehConvidado = membro.status === 'convidado';
  const valores = valoresIniciais(membro.campos_extras);
  const familiares = familiaresIniciais(membro.familiares);
  const mudanca = acaoDeStatus(membro, { ehAdministrador, ehEuMesmo: membro.id === ficha.id });

  const mensagemDoErro = (codigo: ErroDoConvite) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.membros.erros.${codigo}`, { titulo });

  function irPara(novoModo: Modo) {
    setErro(undefined);
    setAviso(undefined);
    if (novoModo === 'corrigirEmail') setNovoEmail(membro.email);
    setModo(novoModo);
  }

  // Executa a ação, recarrega a ficha e volta para a visão.
  async function executar(acao: () => Promise<{ ok: true } | { ok: false; erro: ErroDoConvite }>, sucesso: string) {
    setErro(undefined);
    setAviso(undefined);
    setEnviando(true);
    const resultado = await acao();
    await recarregar();
    setEnviando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setModo('ver');
    setAviso(sucesso);
  }

  function aoSalvarEmail() {
    if (!emailValido(novoEmail)) {
      setErro(t('tesouraria.convidar.erros.emailInvalido'));
      return;
    }
    executar(() => corrigirEmailDoConvidado(membro.id, normalizarEmail(novoEmail)), t('tesouraria.membro.emailCorrigido'));
  }

  function aoReenviar() {
    const validoAte = dia(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    executar(() => reenviarConvite(membro.id), t('tesouraria.membro.reenviado', { data: validoAte }));
  }

  const textosDaMudanca = mudanca && {
    cancelar_convite: {
      botao: t('tesouraria.membro.cancelarConvite'),
      pergunta: t('tesouraria.membro.confirmarCancelarConvite', { nome: membro.nome, titulo }),
      sim: t('tesouraria.membro.simCancelar'),
      feito: t('tesouraria.membro.conviteCancelado'),
    },
    inativar: {
      botao: t('tesouraria.membro.inativar'),
      pergunta: t('tesouraria.membro.confirmarInativar', { nome: membro.nome }),
      sim: t('tesouraria.membro.simInativar'),
      feito: t('tesouraria.membro.inativado'),
    },
    reativar: {
      botao: t('tesouraria.membro.reativar'),
      pergunta:
        mudanca.para === 'ativo'
          ? t('tesouraria.membro.confirmarReativarAtivo', { nome: membro.nome })
          : t('tesouraria.membro.confirmarReativarConvidado', { nome: membro.nome }),
      sim: t('tesouraria.membro.simReativar'),
      feito: t('tesouraria.membro.reativado'),
    },
  }[mudanca.acao];

  return (
    <Tela larga>
      <Texto variante="apoio">{t('tesouraria.membros.numero', { numero: membro.numero })}</Texto>
      <Texto variante="titulo">{membro.nome}</Texto>
      <Texto variante={situacao === 'convite_vencido' ? 'erro' : 'destaque'}>
        {t(`tesouraria.membros.situacao.${situacao}`)}
      </Texto>
      {membro.perfil === 'tesoureiro' && <Texto variante="destaque">{t('tesouraria.membro.perfilTesoureiro')}</Texto>}
      {membro.perfil === 'administrador' && <Texto variante="destaque">{titulo}</Texto>}

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t('tesouraria.membro.dadosCadastrais')}
        </Texto>
        <Texto variante="apoio">{t('tesouraria.membro.email')}</Texto>
        <Texto>{membro.email}</Texto>
        <Texto variante="apoio">{t('tesouraria.membro.celular')}</Texto>
        <Texto>{membro.celular}</Texto>
        {!ehConvidado && (
          <>
            <Texto variante="apoio">{t('tesouraria.membro.dizimo')}</Texto>
            <Texto>
              {t(membro.tipo_dizimo === 'familiar' ? 'tesouraria.membro.familiar' : 'tesouraria.membro.individual')}
            </Texto>
            {familiares.length > 0 && <Texto>{t('tesouraria.membro.familiares', { nomes: familiares.join(', ') })}</Texto>}
            {campos.map((campo) => (
              <View key={campo.chave} style={estilos.campo}>
                <Texto variante="apoio">{campo.rotulo}</Texto>
                <Texto>{valores[campo.chave] || t('tesouraria.membro.naoInformado')}</Texto>
              </View>
            ))}
          </>
        )}
      </View>

      {ehConvidado && (
        <View style={estilos.cartao}>
          {!!ultimoConvite && (
            <Texto>
              {situacao === 'convite_vencido'
                ? t('tesouraria.membro.conviteVenceu', { data: dia(ultimoConvite.expira_em) })
                : t('tesouraria.membro.conviteAte', { data: dia(ultimoConvite.expira_em) })}
            </Texto>
          )}
          <Texto variante="apoio">{t('tesouraria.membro.convitesEnviados', { count: membro.convites.length })}</Texto>
        </View>
      )}

      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}
      {!!erro && <Texto variante="erro">{erro}</Texto>}

      {modo === 'ver' && (
        <>
          {ehConvidado && (
            <>
              <Botao titulo={t('tesouraria.membro.reenviar')} onPress={aoReenviar} carregando={enviando} />
              <Botao
                titulo={t('tesouraria.membro.corrigirEmail')}
                variante="secundario"
                onPress={() => irPara('corrigirEmail')}
                desabilitado={enviando}
              />
            </>
          )}
          {membro.status !== 'inativo' && membro.id !== ficha.id && (
            <Botao
              titulo={t('tesouraria.membro.lancar')}
              variante="secundario"
              onPress={() => router.push({ pathname: '/lancar', params: { membro: membro.id } })}
              desabilitado={enviando}
            />
          )}
          {!!textosDaMudanca && (
            <Botao
              titulo={textosDaMudanca.botao}
              variante="secundario"
              onPress={() => irPara('confirmarStatus')}
              desabilitado={enviando}
            />
          )}
          {!mudanca && !ehConvidado && !ehAdministrador && (
            <Texto variante="apoio">{t('tesouraria.membro.statusSoPastor', { titulo })}</Texto>
          )}
        </>
      )}

      {modo === 'corrigirEmail' && (
        <>
          <CampoTexto
            rotulo={t('tesouraria.membro.novoEmail')}
            value={novoEmail}
            onChangeText={setNovoEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Botao titulo={t('tesouraria.membro.salvarEmail')} onPress={aoSalvarEmail} carregando={enviando} />
          <Botao titulo={t('tesouraria.membro.voltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
        </>
      )}

      {/* Mudança de status pede confirmação antes. */}
      {modo === 'confirmarStatus' && !!mudanca && !!textosDaMudanca && (
        <>
          <Texto variante="destaque">{textosDaMudanca.pergunta}</Texto>
          <Botao
            titulo={textosDaMudanca.sim}
            onPress={() => executar(() => mudarStatusDoMembro(membro.id, membro.status, mudanca.para), textosDaMudanca.feito)}
            carregando={enviando}
          />
          <Botao titulo={t('tesouraria.membro.naoVoltar')} variante="secundario" onPress={() => irPara('ver')} desabilitado={enviando} />
        </>
      )}

      <Texto variante="destaque" accessibilityRole="header">
        {t('tesouraria.membro.historico')}
      </Texto>
      {falhouHistorico && <Texto variante="erro">{t('tesouraria.membro.falhaHistorico')}</Texto>}
      {!lancamentos && !falhouHistorico && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {lancamentos?.length === 0 && <Texto>{t('tesouraria.membro.nenhumLancamento')}</Texto>}
      {lancamentos?.map((lancamento) => {
        const emMoeda = (centavos: number) => formatarMoeda(centavos, lancamento.moeda, idioma);
        return (
          <View key={lancamento.id} style={estilos.cartao}>
            <View style={estilos.topoDaLinha}>
              <Texto variante="destaque">{isoParaData(lancamento.data_contribuicao)}</Texto>
              <Texto variante="destaque">{emMoeda(lancamento.valor_informado_centavos)}</Texto>
            </View>
            <Texto>
              {lancamento.tipo === 'oferta'
                ? t('tesouraria.membro.ofertaDaCampanha', { campanha: lancamento.campanhas?.nome ?? '' })
                : t('tesouraria.item.dizimo')}
              {' · '}
              {ehFormaConhecida(lancamento.forma) ? t(`formas.${lancamento.forma}`) : lancamento.forma}
            </Texto>
            <SeloDeStatus status={lancamento.status} />
            {lancamento.valor_conferido_centavos !== null &&
              lancamento.valor_conferido_centavos !== lancamento.valor_informado_centavos && (
                <Texto>{t('tesouraria.membro.valorConferido', { valor: emMoeda(lancamento.valor_conferido_centavos) })}</Texto>
              )}
            {lancamento.status === 'confirmado' && !!lancamento.confirmado_por_nome && (
              <Texto variante="apoio">{t('cartao.confirmadoPor', { nome: lancamento.confirmado_por_nome })}</Texto>
            )}
          </View>
        );
      })}

      <Botao titulo={t('tesouraria.membro.voltar')} variante="secundario" onPress={() => voltar()} />
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
  campo: {
    gap: 2,
  },
  topoDaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
});
