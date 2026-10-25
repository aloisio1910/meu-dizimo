import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { mudancaDaCampanha, validarCampanha, type CamposDaCampanha, type ErrosDaCampanha } from '@/lib/campanha';
import { hojeIso, isoParaData, mascararData } from '@/lib/data';
import { escolherFoto } from '@/services/dispositivo/arquivos';
import {
  buscarCampanhaDaIgreja,
  criarCampanha,
  enviarArte,
  listarContasDaIgreja,
  mudarStatusDaCampanha,
  retirarArte,
  salvarCampanha,
  type ArteDaCampanha,
  type CampanhaDaIgreja,
  type ContaDaIgreja,
  type ErroDaCampanha,
} from '@/services/supabase/campanhas-da-igreja';
import { cores, espacos, raio } from '@/theme';

// Valor da opção "conta principal" (campanha sem conta própria, D-073).
const PRINCIPAL = 'principal';

const camposVazios: CamposDaCampanha = { nome: '', descricao: '', objetivo: '', inicio: '', fim: '', linkVideo: '' };

function camposDe(c: CampanhaDaIgreja): CamposDaCampanha {
  return {
    nome: c.nome,
    descricao: c.descricao ?? '',
    objetivo: c.objetivo ?? '',
    inicio: c.inicio ? isoParaData(c.inicio) : '',
    fim: c.fim ? isoParaData(c.fim) : '',
    linkVideo: c.link_video ?? '',
  };
}

// P-02: criar e editar a campanha, enviar e retirar artes, publicar,
// encerrar e reabrir (D-088). "nova" no endereço = campanha nova.
export default function GerenciarCampanha() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/campanhas');
  const { id, aviso: avisoInicial } = useLocalSearchParams<{ id: string; aviso?: string }>();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const ehNova = id === 'nova';

  const [campanha, setCampanha] = useState<CampanhaDaIgreja | null>();
  const [artes, setArtes] = useState<ArteDaCampanha[]>([]);
  const [contas, setContas] = useState<ContaDaIgreja[]>([]);
  const [campos, setCampos] = useState<CamposDaCampanha>(camposVazios);
  const [contaId, setContaId] = useState<string>(PRINCIPAL);
  const [erros, setErros] = useState<ErrosDaCampanha>({});
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string | undefined>(avisoInicial === 'criada' ? 'criada' : undefined);
  // Onde mostrar o retorno: junto do botão que a pessoa tocou.
  const [local, setLocal] = useState<'status' | 'formulario' | 'artes'>('status');

  const igrejaId = ficha?.igreja_id;

  const aplicar = useCallback((encontrada: Awaited<ReturnType<typeof buscarCampanhaDaIgreja>>) => {
    setCampanha(encontrada?.campanha ?? null);
    setArtes(encontrada?.artes ?? []);
    if (encontrada) {
      setCampos(camposDe(encontrada.campanha));
      setContaId(encontrada.campanha.conta_id ?? PRINCIPAL);
    }
  }, []);

  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    listarContasDaIgreja(igrejaId)
      .then((lista) => ativo && setContas(lista))
      .catch(() => ativo && setContas([]));
    if (!ehNova) {
      buscarCampanhaDaIgreja(igrejaId, id)
        .then((encontrada) => ativo && aplicar(encontrada))
        .catch(() => ativo && setCampanha(null));
    }
    return () => {
      ativo = false;
    };
  }, [igrejaId, id, ehNova, aplicar]);

  if (!carregando && (!ficha || !ehAdministrador)) return <Redirect href="/" />;
  if (!ficha || (!ehNova && campanha === undefined)) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (!ehNova && campanha === null) {
    return (
      <Tela>
        <Texto>{t('tesouraria.campanhas.editar.naoEncontrada')}</Texto>
        <Botao titulo={t('tesouraria.campanhas.editar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const titulo = ficha.igrejas?.titulo_administrador;
  const mudanca = campanha ? mudancaDaCampanha(campanha) : null;
  const mensagemDoErro = (codigo: ErroDaCampanha) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.campanhas.editar.erros.${codigo}`, { titulo });
  const mudar = (chave: keyof CamposDaCampanha) => (texto: string) => {
    setCampos((atuais) => ({ ...atuais, [chave]: chave === 'inicio' || chave === 'fim' ? mascararData(texto) : texto }));
  };

  async function recarregar() {
    if (!campanha) return;
    aplicar(await buscarCampanhaDaIgreja(ficha!.igreja_id, campanha.id).catch(() => null));
  }

  function limparMensagens() {
    setErro(undefined);
    setAviso(undefined);
  }

  async function aoSalvar() {
    limparMensagens();
    setLocal('formulario');
    const resultado = validarCampanha(campos, hojeIso(), campanha?.status === 'ativa');
    setErros(resultado.ok ? {} : resultado.erros);
    if (!resultado.ok) return;
    const dados = { ...resultado.dados, conta_id: contaId === PRINCIPAL ? null : contaId };
    setEnviando(true);
    if (!campanha) {
      const criada = await criarCampanha(ficha!.igreja_id, dados);
      setEnviando(false);
      if (!criada.ok) {
        setErro(mensagemDoErro(criada.erro));
        return;
      }
      // Abre a campanha criada, já pronta para receber as artes.
      router.replace({ pathname: '/gerenciar-campanha/[id]', params: { id: criada.dados, aviso: 'criada' } });
      return;
    }
    const salvo = await salvarCampanha(campanha.id, dados);
    await recarregar();
    setEnviando(false);
    if (!salvo.ok) setErro(mensagemDoErro(salvo.erro));
    else setAviso(t('tesouraria.campanhas.editar.salvo'));
  }

  async function aoConfirmarMudanca() {
    if (!campanha || !mudanca) return;
    limparMensagens();
    setLocal('status');
    setEnviando(true);
    const resultado = await mudarStatusDaCampanha(campanha.id, campanha.status, mudanca.para);
    await recarregar();
    setEnviando(false);
    setConfirmando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    const feito = { publicar: 'publicada', encerrar: 'encerrada', reabrir: 'reaberta' } as const;
    setAviso(t(`tesouraria.campanhas.mudar.${feito[mudanca.acao]}`));
  }

  async function aoAdicionarArte() {
    if (!campanha) return;
    limparMensagens();
    setLocal('artes');
    const escolha = await escolherFoto('galeria');
    if (!escolha.ok) {
      if (escolha.motivo === 'permissao_negada') setErro(t('tesouraria.campanhas.artes.erros.permissao_negada'));
      return;
    }
    setEnviando(true);
    const proximaOrdem = artes.reduce((maior, a) => Math.max(maior, a.ordem), -1) + 1;
    const falha = await enviarArte(ficha!.igreja_id, campanha.id, escolha.arquivo, proximaOrdem);
    await recarregar();
    setEnviando(false);
    if (falha) setErro(t(`tesouraria.campanhas.artes.erros.${falha}`));
    else setAviso(t('tesouraria.campanhas.artes.enviada'));
  }

  async function aoRetirarArte(arteId: string) {
    limparMensagens();
    setLocal('artes');
    setEnviando(true);
    const retirou = await retirarArte(arteId);
    await recarregar();
    setEnviando(false);
    if (!retirou) setErro(t('tesouraria.campanhas.artes.erros.retirar_falhou'));
    else setAviso(t('tesouraria.campanhas.artes.retirada'));
  }

  const textoDoAviso = aviso === 'criada' ? t('tesouraria.campanhas.editar.criada') : aviso;
  const erroDoCampo = (chave: keyof ErrosDaCampanha) =>
    erros[chave] && t(`tesouraria.campanhas.editar.erros.${erros[chave]}`);

  return (
    <Tela larga>
      <Texto variante="titulo">
        {campanha ? campanha.nome : t('tesouraria.campanhas.editar.tituloNova')}
      </Texto>

      {!!campanha && (
        <View style={estilos.cartao}>
          <Texto variante="destaque">{t(`tesouraria.campanhas.status.${campanha.status}`)}</Texto>
          {campanha.permanente && <Texto variante="apoio">{t('tesouraria.campanhas.permanente')}</Texto>}
          {!!mudanca && !confirmando && (
            <Botao
              titulo={t(`tesouraria.campanhas.mudar.${mudanca.acao}`)}
              variante={mudanca.acao === 'encerrar' ? 'secundario' : 'principal'}
              onPress={() => {
                limparMensagens();
                setConfirmando(true);
              }}
              desabilitado={enviando}
            />
          )}
          {!!mudanca && confirmando && (
            <>
              <Texto variante="destaque">
                {t(
                  `tesouraria.campanhas.mudar.pergunta${mudanca.acao === 'publicar' ? 'Publicar' : mudanca.acao === 'encerrar' ? 'Encerrar' : 'Reabrir'}`,
                  { nome: campanha.nome },
                )}
              </Texto>
              <Botao titulo={t('tesouraria.campanhas.mudar.sim')} onPress={aoConfirmarMudanca} carregando={enviando} />
              <Botao
                titulo={t('tesouraria.campanhas.mudar.nao')}
                variante="secundario"
                onPress={() => setConfirmando(false)}
                desabilitado={enviando}
              />
            </>
          )}
        </View>
      )}

      {local === 'status' && <Retorno aviso={textoDoAviso} erro={erro} />}

      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.nome')}
        value={campos.nome}
        onChangeText={mudar('nome')}
        erro={erroDoCampo('nome')}
      />
      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.descricao')}
        dica={t('tesouraria.campanhas.editar.dicaDescricao')}
        value={campos.descricao}
        onChangeText={mudar('descricao')}
        multiline
      />
      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.objetivo')}
        dica={t('tesouraria.campanhas.editar.dicaObjetivo')}
        value={campos.objetivo}
        onChangeText={mudar('objetivo')}
        multiline
      />
      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.inicio')}
        dica={t('tesouraria.campanhas.editar.dicaData')}
        value={campos.inicio}
        onChangeText={mudar('inicio')}
        keyboardType="number-pad"
        erro={erroDoCampo('inicio')}
      />
      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.fim')}
        dica={t('tesouraria.campanhas.editar.dicaFim')}
        value={campos.fim}
        onChangeText={mudar('fim')}
        keyboardType="number-pad"
        erro={erroDoCampo('fim')}
      />
      <CampoTexto
        rotulo={t('tesouraria.campanhas.editar.linkVideo')}
        dica={t('tesouraria.campanhas.editar.dicaLinkVideo')}
        value={campos.linkVideo}
        onChangeText={mudar('linkVideo')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        erro={erroDoCampo('linkVideo')}
      />
      {contas.length > 0 && (
        <Opcoes
          rotulo={t('tesouraria.campanhas.editar.conta')}
          opcoes={[
            { valor: PRINCIPAL, rotulo: t('tesouraria.campanhas.editar.contaPrincipal') },
            ...contas.filter((c) => !c.principal).map((c) => ({ valor: c.id, rotulo: c.nome })),
          ]}
          selecionada={contaId}
          onSelecionar={setContaId}
        />
      )}
      <Botao
        titulo={campanha ? t('tesouraria.campanhas.editar.salvar') : t('tesouraria.campanhas.editar.criar')}
        onPress={aoSalvar}
        carregando={enviando && !confirmando}
      />
      {local === 'formulario' && <Retorno aviso={textoDoAviso} erro={erro} />}

      <Texto variante="destaque" accessibilityRole="header">
        {t('tesouraria.campanhas.artes.titulo')}
      </Texto>
      {!campanha ? (
        <Texto variante="apoio">{t('tesouraria.campanhas.artes.salveAntes')}</Texto>
      ) : (
        <>
          <Texto variante="apoio">{t('tesouraria.campanhas.artes.explicacao')}</Texto>
          {artes.length === 0 && <Texto>{t('tesouraria.campanhas.artes.nenhuma')}</Texto>}
          {artes.map((arte, indice) => (
            <View key={arte.id} style={estilos.cartao}>
              {!!arte.link && (
                <Image
                  source={{ uri: arte.link }}
                  style={estilos.arte}
                  contentFit="cover"
                  accessibilityLabel={t('tesouraria.campanhas.artes.descricao', { numero: indice + 1 })}
                />
              )}
              <Botao
                titulo={t('tesouraria.campanhas.artes.retirar')}
                variante="secundario"
                onPress={() => aoRetirarArte(arte.id)}
                desabilitado={enviando}
              />
            </View>
          ))}
          <Botao
            titulo={t('tesouraria.campanhas.artes.adicionar')}
            variante="secundario"
            onPress={aoAdicionarArte}
            desabilitado={enviando}
          />
          {local === 'artes' && <Retorno aviso={textoDoAviso} erro={erro} />}
        </>
      )}

      <Botao
        titulo={t('tesouraria.campanhas.editar.voltar')}
        variante="secundario"
        onPress={() => router.dismissTo('/campanhas')}
        desabilitado={enviando}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.medio,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  arte: {
    width: '100%',
    maxWidth: 480,
    aspectRatio: 16 / 9,
    borderRadius: raio,
  },
});
