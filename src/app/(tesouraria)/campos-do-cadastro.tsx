import { Redirect } from 'expo-router';
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
import {
  camposDaSituacao,
  chaveDoRotulo,
  opcoesRetiradas,
  situacaoDoCampo,
  trocarOrdem,
  validarCampo,
  type ErrosDoCampo,
  type SituacaoDoCampo,
  type TipoDoCampo,
} from '@/lib/campos-do-cadastro';
import {
  criarCampo,
  listarTodosOsCampos,
  salvarCampo,
  salvarOrdem,
  type CampoDaIgreja,
  type ErroDoCampo,
} from '@/services/supabase/campos-da-igreja';
import { cores, espacos, raio } from '@/theme';

const TIPOS: TipoDoCampo[] = ['texto', 'data', 'numero', 'lista'];
const SITUACOES: SituacaoDoCampo[] = ['obrigatorio', 'opcional', 'tesouraria', 'nao_usado'];

type Edicao = {
  id: string | 'novo';
  rotulo: string;
  tipo: TipoDoCampo;
  situacao: SituacaoDoCampo;
  opcoes: string[];
  novaOpcao: string;
};

// P-03 Campos do cadastro (RN-004): o Pastor de Governo define os campos
// extras que o membro preenche, como Líder e Rede.
export default function CamposDoCadastro() {
  const { t } = useTranslation();
  const voltar = useVoltar('/configuracoes');
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [campos, setCampos] = useState<CampoDaIgreja[] | null>();
  const [edicao, setEdicao] = useState<Edicao>();
  const [erros, setErros] = useState<ErrosDoCampo>({});
  const [enviando, setEnviando] = useState(false);
  // Retorno junto do que a pessoa tocou: um campo, o novo ou a ordem.
  const [retorno, setRetorno] = useState<{ onde: string; aviso?: string; erro?: string }>();

  const igrejaId = ficha?.igreja_id;
  const carregar = useCallback(async () => {
    if (!igrejaId) return;
    setCampos(await listarTodosOsCampos(igrejaId).catch(() => null));
  }, [igrejaId]);

  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    listarTodosOsCampos(igrejaId)
      .then((lista) => ativo && setCampos(lista))
      .catch(() => ativo && setCampos(null));
    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  if (!carregando && (!ficha || !ehAdministrador)) return <Redirect href="/" />;
  if (!ficha || campos === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  const c = 'tesouraria.camposDoCadastro';
  const titulo = ficha.igrejas?.titulo_administrador;
  const mensagemDoErro = (codigo: ErroDoCampo) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`${c}.erros.${codigo}`, { titulo });

  function abrir(campo?: CampoDaIgreja) {
    setRetorno(undefined);
    setErros({});
    setEdicao(
      campo
        ? {
            id: campo.id,
            rotulo: campo.rotulo,
            tipo: campo.tipo,
            situacao: situacaoDoCampo(campo),
            opcoes: campo.opcoes,
            novaOpcao: '',
          }
        : { id: 'novo', rotulo: '', tipo: 'texto', situacao: 'opcional', opcoes: [], novaOpcao: '' },
    );
  }

  async function aoSalvar() {
    if (!edicao || !campos) return;
    const resultado = validarCampo(edicao);
    setErros(resultado.ok ? {} : resultado.erros);
    if (!resultado.ok) return;
    setEnviando(true);
    const original = campos.find((campo) => campo.id === edicao.id);
    const situacao = camposDaSituacao(edicao.situacao, original?.preenchido_por);
    const falha =
      edicao.id === 'novo'
        ? await criarCampo(ficha!.igreja_id, {
            chave: chaveDoRotulo(
              resultado.dados.rotulo,
              campos.map((campo) => campo.chave),
            ),
            rotulo: resultado.dados.rotulo,
            tipo: edicao.tipo,
            opcoes: resultado.dados.opcoes,
            ordem: Math.max(0, ...campos.map((campo) => campo.ordem)) + 1,
            ...situacao,
          })
        : await salvarCampo(edicao.id, { rotulo: resultado.dados.rotulo, opcoes: resultado.dados.opcoes, ...situacao });
    await carregar();
    setEnviando(false);
    const onde = edicao.id;
    if (falha) {
      setRetorno({ onde, erro: mensagemDoErro(falha) });
      return;
    }
    setEdicao(undefined);
    setRetorno({ onde, aviso: t(onde === 'novo' ? `${c}.criado` : `${c}.salvo`) });
  }

  async function aoMover(campo: CampoDaIgreja, direcao: -1 | 1) {
    if (!campos) return;
    const ordens = trocarOrdem(campos, campo.id, direcao);
    if (!ordens) return;
    setRetorno(undefined);
    setEnviando(true);
    const falha = await salvarOrdem(ordens);
    await carregar();
    setEnviando(false);
    setRetorno({ onde: campo.id, ...(falha ? { erro: mensagemDoErro(falha) } : { aviso: t(`${c}.ordemSalva`) }) });
  }

  const retornoDe = (onde: string) => retorno?.onde === onde && <Retorno aviso={retorno.aviso} erro={retorno.erro} />;

  const editor = (original?: CampoDaIgreja) => {
    if (!edicao) return null;
    const mudar = (parcial: Partial<Edicao>) => setEdicao((atual) => atual && { ...atual, ...parcial });
    const retiradas = original ? opcoesRetiradas(original.opcoes, edicao.opcoes) : [];
    const ficouObrigatorio =
      edicao.situacao === 'obrigatorio' && (!original || situacaoDoCampo(original) !== 'obrigatorio');
    return (
      <View style={estilos.editor}>
        <CampoTexto
          rotulo={t(`${c}.rotulo`)}
          dica={t(`${c}.dicaRotulo`)}
          value={edicao.rotulo}
          onChangeText={(rotulo) => mudar({ rotulo })}
          erro={erros.rotulo && t(`${c}.erros.${erros.rotulo}`)}
        />
        {original ? (
          <Texto variante="apoio">{t(`${c}.tipoFixo`, { tipo: t(`${c}.tipos.${original.tipo}`) })}</Texto>
        ) : (
          <Opcoes
            rotulo={t(`${c}.tipo`)}
            opcoes={TIPOS.map((tipo) => ({ valor: tipo, rotulo: t(`${c}.tipos.${tipo}`) }))}
            selecionada={edicao.tipo}
            onSelecionar={(tipo) => mudar({ tipo })}
          />
        )}
        {edicao.tipo === 'lista' && (
          <View style={estilos.editor}>
            <Texto variante="destaque">{t(`${c}.opcoes`)}</Texto>
            {edicao.opcoes.map((opcao, posicao) => (
              <View key={`${posicao}-${opcao}`} style={estilos.opcao}>
                <Texto style={estilos.textoDaOpcao}>{opcao}</Texto>
                <Botao
                  titulo={t(`${c}.retirarOpcao`, { opcao })}
                  variante="secundario"
                  onPress={() => mudar({ opcoes: edicao.opcoes.filter((_o, i) => i !== posicao) })}
                />
              </View>
            ))}
            <CampoTexto
              rotulo={t(`${c}.novaOpcao`)}
              value={edicao.novaOpcao}
              onChangeText={(novaOpcao) => mudar({ novaOpcao })}
              onSubmitEditing={() =>
                edicao.novaOpcao.trim() && mudar({ opcoes: [...edicao.opcoes, edicao.novaOpcao.trim()], novaOpcao: '' })
              }
            />
            <Botao
              titulo={t(`${c}.adicionarOpcao`)}
              variante="secundario"
              onPress={() => mudar({ opcoes: [...edicao.opcoes, edicao.novaOpcao.trim()], novaOpcao: '' })}
              desabilitado={!edicao.novaOpcao.trim()}
            />
            {!!erros.opcoes && <Texto variante="erro">{t(`${c}.erros.${erros.opcoes}`)}</Texto>}
            {retiradas.length > 0 && (
              <Texto variante="destaque">{t(`${c}.avisoOpcoesRetiradas`, { opcoes: retiradas.join(', ') })}</Texto>
            )}
          </View>
        )}
        <Opcoes
          rotulo={t(`${c}.situacao`)}
          opcoes={SITUACOES.map((situacao) => ({ valor: situacao, rotulo: t(`${c}.situacoes.${situacao}`) }))}
          selecionada={edicao.situacao}
          onSelecionar={(situacao) => mudar({ situacao })}
        />
        {ficouObrigatorio && <Texto variante="apoio">{t(`${c}.avisoObrigatorio`)}</Texto>}
        {edicao.situacao === 'tesouraria' && <Texto variante="apoio">{t(`${c}.avisoTesouraria`, { titulo })}</Texto>}
        <Botao titulo={original ? t(`${c}.salvar`) : t(`${c}.criar`)} onPress={aoSalvar} carregando={enviando} />
        <Botao
          titulo={t(`${c}.cancelar`)}
          variante="secundario"
          onPress={() => setEdicao(undefined)}
          desabilitado={enviando}
        />
        {retornoDe(edicao.id)}
      </View>
    );
  };

  return (
    <Tela larga>
      <Texto variante="titulo">{t(`${c}.titulo`)}</Texto>
      <Texto>{t(`${c}.explicacao`)}</Texto>

      {campos === null && <Texto variante="erro">{t(`${c}.falhaAoCarregar`)}</Texto>}
      {campos?.length === 0 && <Texto>{t(`${c}.nenhum`)}</Texto>}

      {campos?.map((campo, indice) => (
        <View key={campo.id} style={[estilos.cartao, !campo.ativo && estilos.naoUsado]}>
          {edicao?.id === campo.id ? (
            editor(campo)
          ) : (
            <>
              <Texto variante="destaque">{campo.rotulo}</Texto>
              <Texto variante="apoio">
                {t(`${c}.resumo`, {
                  tipo: t(`${c}.tipos.${campo.tipo}`),
                  situacao: t(`${c}.situacoes.${situacaoDoCampo(campo)}`),
                })}
              </Texto>
              {campo.tipo === 'lista' && (
                <Texto variante="apoio">{t(`${c}.opcoesAtuais`, { opcoes: campo.opcoes.join(', ') })}</Texto>
              )}
              <View style={estilos.botoes}>
                <View style={estilos.item}>
                  <Botao
                    titulo={t(`${c}.editar`)}
                    variante="secundario"
                    onPress={() => abrir(campo)}
                    desabilitado={enviando}
                  />
                </View>
                <View style={estilos.item}>
                  <Botao
                    titulo={t(`${c}.subir`, { rotulo: campo.rotulo })}
                    variante="secundario"
                    onPress={() => aoMover(campo, -1)}
                    desabilitado={enviando || indice === 0}
                  />
                </View>
                <View style={estilos.item}>
                  <Botao
                    titulo={t(`${c}.descer`, { rotulo: campo.rotulo })}
                    variante="secundario"
                    onPress={() => aoMover(campo, 1)}
                    desabilitado={enviando || indice === campos.length - 1}
                  />
                </View>
              </View>
              {retornoDe(campo.id)}
            </>
          )}
        </View>
      ))}

      {edicao?.id === 'novo' ? (
        <View style={estilos.cartao}>{editor()}</View>
      ) : (
        <>
          <Botao titulo={t(`${c}.novo`)} onPress={() => abrir()} desabilitado={enviando || !!edicao} />
          {retornoDe('novo')}
        </>
      )}

      <Botao titulo={t(`${c}.voltar`)} variante="secundario" onPress={() => voltar()} desabilitado={enviando} />
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
  naoUsado: {
    borderStyle: 'dashed',
  },
  editor: {
    gap: espacos.medio,
  },
  opcao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacos.pequeno,
  },
  textoDaOpcao: {
    flexGrow: 1,
  },
  botoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
  item: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
