import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PagamentoPix } from '@/components/pagamento-pix';
import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { validarConta, type CamposDaConta, type ErrosDaConta } from '@/lib/conta';
import { formatarMoeda } from '@/lib/dinheiro';
import type { TipoDeChavePix } from '@/lib/pix';
import {
  buscarConta,
  criarConta,
  definirContaPrincipal,
  listarTodasAsContas,
  mudarAtivacaoDaConta,
  salvarConta,
  type ContaCompleta,
  type ErroDaConta,
} from '@/services/supabase/contas-da-igreja';
import { cores, espacos, raio } from '@/theme';

const TIPOS: TipoDeChavePix[] = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];

type Confirmacao = 'principal' | 'desativar';

const camposVazios: CamposDaConta = {
  nome: '',
  banco: '',
  agencia: '',
  numeroConta: '',
  tipoChave: undefined,
  chave: '',
  recebedor: '',
  cidade: '',
};

function camposDe(c: ContaCompleta): CamposDaConta {
  return {
    nome: c.nome,
    banco: c.banco ?? '',
    agencia: c.agencia ?? '',
    numeroConta: c.numero_conta ?? '',
    tipoChave: c.tipo_chave_pix ?? undefined,
    chave: c.chave_pix ?? '',
    recebedor: c.nome_recebedor ?? '',
    cidade: c.cidade ?? '',
  };
}

// P-03: cadastrar e editar a conta, trocar a principal, desativar e
// reativar, e testar o Pix (D-091). "nova" no endereço = conta nova.
export default function GerenciarConta() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/contas');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const ehNova = id === 'nova';

  const [conta, setConta] = useState<ContaCompleta | null>();
  const [temPrincipal, setTemPrincipal] = useState(true);
  const [campos, setCampos] = useState<CamposDaConta>(camposVazios);
  const [erros, setErros] = useState<ErrosDaConta>({});
  const [confirmacao, setConfirmacao] = useState<Confirmacao>();
  const [mostrarTeste, setMostrarTeste] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  // Onde mostrar o retorno: junto do botão que a pessoa tocou.
  const [local, setLocal] = useState<'formulario' | 'acoes'>('formulario');

  const igrejaId = ficha?.igreja_id;

  const aplicar = useCallback((encontrada: ContaCompleta | null) => {
    setConta(encontrada);
    if (encontrada) setCampos(camposDe(encontrada));
  }, []);

  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    // Sem nenhuma principal (igreja nova), a primeira conta já nasce principal.
    listarTodasAsContas(igrejaId)
      .then((lista) => ativo && setTemPrincipal(lista.some((c) => c.principal)))
      .catch(() => {});
    if (!ehNova) {
      buscarConta(igrejaId, id)
        .then((encontrada) => ativo && aplicar(encontrada))
        .catch(() => ativo && setConta(null));
    }
    return () => {
      ativo = false;
    };
  }, [igrejaId, id, ehNova, aplicar]);

  if (!carregando && (!ficha || !ehAdministrador)) return <Redirect href="/" />;
  if (!ficha || (!ehNova && conta === undefined)) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (!ehNova && conta === null) {
    return (
      <Tela>
        <Texto>{t('tesouraria.contas.editar.naoEncontrada')}</Texto>
        <Botao titulo={t('tesouraria.contas.editar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const titulo = ficha.igrejas?.titulo_administrador;
  const ehPrincipal = conta ? conta.principal : !temPrincipal;
  const e = 'tesouraria.contas.editar';
  const mensagemDoErro = (codigo: ErroDaConta) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`${e}.erros.${codigo}`, { titulo });
  const mudar = (chave: keyof CamposDaConta) => (texto: string) => setCampos((atuais) => ({ ...atuais, [chave]: texto }));

  function limparMensagens() {
    setErro(undefined);
    setAviso(undefined);
  }

  async function recarregar() {
    if (!conta) return;
    aplicar(await buscarConta(ficha!.igreja_id, conta.id).catch(() => null));
  }

  async function aoSalvar() {
    limparMensagens();
    setLocal('formulario');
    setMostrarTeste(false);
    const resultado = validarConta(campos, ehPrincipal);
    setErros(resultado.ok ? {} : resultado.erros);
    if (!resultado.ok) return;
    setEnviando(true);
    if (!conta) {
      const criada = await criarConta(ficha!.igreja_id, resultado.dados, !temPrincipal);
      setEnviando(false);
      if (!criada.ok) {
        setErro(mensagemDoErro(criada.erro));
        return;
      }
      router.replace({ pathname: '/gerenciar-conta/[id]', params: { id: criada.dados } });
      return;
    }
    const salvo = await salvarConta(conta.id, resultado.dados);
    await recarregar();
    setEnviando(false);
    if (!salvo.ok) setErro(mensagemDoErro(salvo.erro));
    else setAviso(t(`${e}.salva`));
  }

  async function aoConfirmar() {
    if (!conta || !confirmacao) return;
    limparMensagens();
    setLocal('acoes');
    setEnviando(true);
    const resultado =
      confirmacao === 'principal' ? await definirContaPrincipal(conta.id) : await mudarAtivacaoDaConta(conta.id, false);
    await recarregar();
    setEnviando(false);
    setConfirmacao(undefined);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setAviso(confirmacao === 'principal' ? t(`${e}.agoraPrincipal`, { nome: conta.nome }) : t(`${e}.desativada`));
  }

  async function aoReativar() {
    if (!conta) return;
    limparMensagens();
    setLocal('acoes');
    setEnviando(true);
    const resultado = await mudarAtivacaoDaConta(conta.id, true);
    await recarregar();
    setEnviando(false);
    if (!resultado.ok) setErro(mensagemDoErro(resultado.erro));
    else setAviso(t(`${e}.reativada`));
  }

  const erroDoCampo = (chave: keyof ErrosDaConta) => erros[chave] && t(`${e}.erros.${erros[chave]}`);
  const temPixSalvo = !!conta?.chave_pix && !!conta.tipo_chave_pix && !!conta.nome_recebedor && !!conta.cidade;

  return (
    <Tela larga>
      <Texto variante="titulo">{conta ? conta.nome : t(`${e}.tituloNova`)}</Texto>
      {ehPrincipal && <Texto variante="destaque">{t('tesouraria.contas.principal')}</Texto>}
      {conta && !conta.ativa && <Texto variante="apoio">{t('tesouraria.contas.desativada')}</Texto>}

      <CampoTexto
        rotulo={t(`${e}.nome`)}
        dica={t(`${e}.dicaNome`)}
        value={campos.nome}
        onChangeText={mudar('nome')}
        erro={erroDoCampo('nome')}
      />
      <CampoTexto rotulo={t(`${e}.banco`)} value={campos.banco} onChangeText={mudar('banco')} />
      <CampoTexto rotulo={t(`${e}.agencia`)} value={campos.agencia} onChangeText={mudar('agencia')} keyboardType="number-pad" />
      <CampoTexto rotulo={t(`${e}.numeroConta`)} value={campos.numeroConta} onChangeText={mudar('numeroConta')} />

      <Texto variante="destaque" accessibilityRole="header">
        {t(`${e}.secaoPix`)}
      </Texto>
      <Texto variante="apoio">{t(`${e}.dicaPix`)}</Texto>
      {!!erros.pix && <Texto variante="erro">{t(`${e}.erros.${erros.pix}`)}</Texto>}
      <Opcoes
        rotulo={t(`${e}.tipoChave`)}
        opcoes={TIPOS.map((tipo) => ({ valor: tipo, rotulo: t(`tesouraria.contas.tipos.${tipo}`) }))}
        selecionada={campos.tipoChave}
        onSelecionar={(tipo) => setCampos((atuais) => ({ ...atuais, tipoChave: tipo }))}
        erro={erroDoCampo('tipoChave')}
      />
      <CampoTexto
        rotulo={t(`${e}.chave`)}
        dica={campos.tipoChave ? t(`${e}.dicaChave.${campos.tipoChave}`) : undefined}
        value={campos.chave}
        onChangeText={mudar('chave')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={campos.tipoChave === 'email' ? 'email-address' : 'default'}
        erro={erroDoCampo('chave')}
      />
      <CampoTexto
        rotulo={t(`${e}.recebedor`)}
        dica={t(`${e}.dicaRecebedor`)}
        value={campos.recebedor}
        onChangeText={mudar('recebedor')}
        maxLength={25}
        erro={erroDoCampo('recebedor')}
      />
      <CampoTexto
        rotulo={t(`${e}.cidade`)}
        dica={t(`${e}.dicaCidade`)}
        value={campos.cidade}
        onChangeText={mudar('cidade')}
        maxLength={15}
        erro={erroDoCampo('cidade')}
      />

      <Botao titulo={conta ? t(`${e}.salvar`) : t(`${e}.criar`)} onPress={aoSalvar} carregando={enviando && !confirmacao} />
      {local === 'formulario' && <Retorno aviso={aviso} erro={erro} />}

      {!!conta && conta.ativa && temPixSalvo && (
        <View style={estilos.cartao}>
          {mostrarTeste ? (
            <>
              <Texto>{t(`${e}.explicacaoTeste`)}</Texto>
              <PagamentoPix
                conta={{
                  nome: conta.nome,
                  chave_pix: conta.chave_pix!,
                  tipo_chave_pix: conta.tipo_chave_pix!,
                  nome_recebedor: conta.nome_recebedor!,
                  cidade: conta.cidade!,
                }}
                valorEmCentavos={1}
                valorFormatado={formatarMoeda(1, ficha.igrejas?.moeda ?? 'BRL', ficha.igrejas?.idioma ?? 'pt-BR')}
                descricao="Teste"
              />
              <Botao titulo={t(`${e}.esconderTeste`)} variante="secundario" onPress={() => setMostrarTeste(false)} />
            </>
          ) : (
            <Botao titulo={t(`${e}.testarPix`)} variante="secundario" onPress={() => setMostrarTeste(true)} />
          )}
        </View>
      )}

      {!!conta && conta.ativa && !conta.principal && !confirmacao && (
        <>
          {temPixSalvo && (
            <Botao
              titulo={t(`${e}.tornarPrincipal`)}
              variante="secundario"
              onPress={() => {
                limparMensagens();
                setConfirmacao('principal');
              }}
              desabilitado={enviando}
            />
          )}
          <Botao
            titulo={t(`${e}.desativar`)}
            variante="secundario"
            onPress={() => {
              limparMensagens();
              setConfirmacao('desativar');
            }}
            desabilitado={enviando}
          />
        </>
      )}

      {!!conta && !!confirmacao && (
        <View style={estilos.cartao}>
          <Texto variante="destaque">
            {confirmacao === 'principal'
              ? t(`${e}.perguntaPrincipal`, { nome: conta.nome })
              : t(`${e}.perguntaDesativar`, { nome: conta.nome })}
          </Texto>
          <Botao titulo={t(`${e}.sim`)} onPress={aoConfirmar} carregando={enviando} />
          <Botao titulo={t(`${e}.nao`)} variante="secundario" onPress={() => setConfirmacao(undefined)} desabilitado={enviando} />
        </View>
      )}

      {!!conta && !conta.ativa && (
        <Botao titulo={t(`${e}.reativar`)} variante="secundario" onPress={aoReativar} carregando={enviando} />
      )}
      {local === 'acoes' && <Retorno aviso={aviso} erro={erro} />}

      <Botao
        titulo={t(`${e}.voltar`)}
        variante="secundario"
        onPress={() => router.dismissTo('/contas')}
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
});
