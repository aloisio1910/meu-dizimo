import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CaixaSelecao } from '@/components/ui/caixa-selecao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import {
  LIMITE_DA_MENSAGEM,
  LIMITE_DO_VERSICULO,
  REDES,
  redesIniciais,
  validarDadosDaIgreja,
  type CamposDaIgreja,
  type ErrosDaIgreja,
  type Rede,
} from '@/lib/dados-da-igreja';
import { FORMAS_CONHECIDAS, ehFormaConhecida } from '@/lib/formas';
import { buscarDadosParaEditar, salvarDadosDaIgreja, type DadosParaEditar } from '@/services/supabase/configuracao-da-igreja';

function camposDe(d: DadosParaEditar): CamposDaIgreja {
  return {
    nome: d.nome,
    endereco: d.endereco ?? '',
    horarios: d.horarios_culto ?? '',
    site: d.site ?? '',
    redes: redesIniciais(d.redes_sociais),
    whatsapp: d.whatsapp_contato ?? '',
    versiculoReferencia: d.versiculo_referencia,
    versiculoTexto: d.versiculo_texto ?? '',
    mensagemConfirmacao: d.mensagem_confirmacao ?? '',
    formas: d.formas_devolucao,
  };
}

// P-03 Dados e contato: o que o membro vê na aba Igreja e no Cartão.
export default function DadosDaIgreja() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const { recarregar } = useMinhasFichas();
  const [campos, setCampos] = useState<CamposDaIgreja | null>();
  const [erros, setErros] = useState<ErrosDaIgreja>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const igrejaId = ficha?.igreja_id;
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    buscarDadosParaEditar(igrejaId)
      .then((dados) => ativo && setCampos(dados ? camposDe(dados) : null))
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
  if (campos === null) {
    return (
      <Tela>
        <Texto variante="erro">{t('tesouraria.dadosDaIgreja.falhaAoCarregar')}</Texto>
        <Botao titulo={t('tesouraria.dadosDaIgreja.voltar')} onPress={() => router.back()} />
      </Tela>
    );
  }

  const d = 'tesouraria.dadosDaIgreja';
  const titulo = ficha.igrejas?.titulo_administrador;
  // Formas que o app conhece, mais alguma que a igreja já tenha (aparece com o nome gravado).
  const formasDaTela = [...FORMAS_CONHECIDAS, ...campos.formas.filter((f) => !ehFormaConhecida(f))];
  const mudar = (chave: Exclude<keyof CamposDaIgreja, 'redes' | 'formas'>) => (texto: string) =>
    setCampos((atuais) => atuais && { ...atuais, [chave]: texto });
  const mudarRede = (rede: Rede) => (texto: string) =>
    setCampos((atuais) => atuais && { ...atuais, redes: { ...atuais.redes, [rede]: texto } });
  const alternarForma = (forma: string) => (marcado: boolean) =>
    setCampos(
      (atuais) =>
        atuais && {
          ...atuais,
          formas: marcado ? [...atuais.formas, forma] : atuais.formas.filter((f) => f !== forma),
        },
    );
  const erroDo = (chave: keyof ErrosDaIgreja) => {
    const codigo = erros[chave];
    return codigo && t(`tesouraria.dadosDaIgreja.erros.${codigo}`);
  };

  async function aoSalvar() {
    if (!campos) return;
    setErro(undefined);
    setAviso(undefined);
    const resultado = validarDadosDaIgreja(campos);
    setErros(resultado.ok ? {} : resultado.erros);
    if (!resultado.ok) return;
    setEnviando(true);
    const falha = await salvarDadosDaIgreja(ficha!.igreja_id, resultado.dados);
    setEnviando(false);
    if (falha) {
      setErro(falha === 'sem_permissao' ? t(`${d}.erros.sem_permissao`, { titulo }) : t(`comum.erros.${falha}`));
      return;
    }
    setAviso(t(`${d}.salvo`));
    // O Cartão e o registro usam versículo, mensagem e formas da ficha.
    await recarregar();
  }

  return (
    <Tela larga>
      <Texto variante="titulo">{t(`${d}.titulo`)}</Texto>
      <Texto>{t(`${d}.explicacao`)}</Texto>

      <Texto variante="destaque" accessibilityRole="header">
        {t(`${d}.secaoIgreja`)}
      </Texto>
      <CampoTexto rotulo={t(`${d}.nome`)} value={campos.nome} onChangeText={mudar('nome')} erro={erroDo('nome')} />
      <CampoTexto
        rotulo={t(`${d}.endereco`)}
        dica={t(`${d}.dicaEndereco`)}
        value={campos.endereco}
        onChangeText={mudar('endereco')}
        multiline
      />
      <CampoTexto
        rotulo={t(`${d}.horarios`)}
        dica={t(`${d}.dicaHorarios`)}
        value={campos.horarios}
        onChangeText={mudar('horarios')}
        multiline
      />

      <Texto variante="destaque" accessibilityRole="header">
        {t(`${d}.secaoContato`)}
      </Texto>
      <CampoTexto
        rotulo={t(`${d}.whatsapp`)}
        dica={t(`${d}.dicaWhatsapp`)}
        value={campos.whatsapp}
        onChangeText={mudar('whatsapp')}
        keyboardType="phone-pad"
        erro={erroDo('whatsapp')}
      />
      <CampoTexto
        rotulo={t(`${d}.site`)}
        dica={t(`${d}.dicaLink`)}
        value={campos.site}
        onChangeText={mudar('site')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        erro={erroDo('site')}
      />
      {REDES.map((rede) => (
        <CampoTexto
          key={rede}
          rotulo={t(`${d}.redes.${rede}`)}
          dica={t(`${d}.dicaLink`)}
          value={campos.redes[rede]}
          onChangeText={mudarRede(rede)}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          erro={erroDo(rede)}
        />
      ))}

      <Texto variante="destaque" accessibilityRole="header">
        {t(`${d}.secaoCartao`)}
      </Texto>
      <CampoTexto
        rotulo={t(`${d}.versiculoReferencia`)}
        dica={t(`${d}.dicaReferencia`)}
        value={campos.versiculoReferencia}
        onChangeText={mudar('versiculoReferencia')}
        erro={erroDo('versiculoReferencia')}
      />
      <CampoTexto
        rotulo={t(`${d}.versiculoTexto`)}
        dica={t(`${d}.dicaVersiculo`)}
        value={campos.versiculoTexto}
        onChangeText={mudar('versiculoTexto')}
        maxLength={LIMITE_DO_VERSICULO}
        multiline
        erro={erroDo('versiculoTexto')}
      />
      <CampoTexto
        rotulo={t(`${d}.mensagem`)}
        dica={t(`${d}.dicaMensagem`)}
        value={campos.mensagemConfirmacao}
        onChangeText={mudar('mensagemConfirmacao')}
        maxLength={LIMITE_DA_MENSAGEM}
        multiline
        erro={erroDo('mensagem')}
      />

      <Texto variante="destaque" accessibilityRole="header">
        {t(`${d}.secaoFormas`)}
      </Texto>
      <Texto variante="apoio">{t(`${d}.dicaFormas`)}</Texto>
      {formasDaTela.map((forma) => (
        <CaixaSelecao
          key={forma}
          rotulo={ehFormaConhecida(forma) ? t(`formas.${forma}`) : forma}
          marcado={campos.formas.includes(forma)}
          onAlterar={alternarForma(forma)}
        />
      ))}
      {!!erros.formas && <Texto variante="erro">{t(`${d}.erros.escolhaUmaForma`)}</Texto>}

      <Botao titulo={t(`${d}.salvar`)} onPress={aoSalvar} carregando={enviando} />
      <Retorno aviso={aviso} erro={erro} />
      <Botao titulo={t(`${d}.voltar`)} variante="secundario" onPress={() => router.back()} desabilitado={enviando} />
    </Tela>
  );
}
