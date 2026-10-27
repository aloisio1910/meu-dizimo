import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useAdminMaster } from '@/hooks/use-admin-master';
import { useVoltar } from '@/hooks/use-voltar';
import { emailValido, normalizarEmail } from '@/lib/membros';
import {
  atualizarIgreja,
  convidarPastor,
  listarIgrejasDaPlataforma,
  reenviarConviteDoPastor,
  type DadosDaIgreja,
  type ErroDoAdmin,
  type IgrejaDaPlataforma,
} from '@/services/supabase/admin';
import { cores, espacos, raio } from '@/theme';

const dadosDa = (igreja: IgrejaDaPlataforma): DadosDaIgreja => ({
  nome: igreja.nome,
  status: igreja.status,
  faixaPlano: igreja.faixa_plano ?? '',
  pais: igreja.pais,
  idioma: igreja.idioma,
  moeda: igreja.moeda,
  tituloAdministrador: igreja.titulo_administrador,
});

const PASTOR_VAZIO = { nome: '', email: '', celular: '', motivo: '' };

// A-01, uma igreja: dados (situação, plano, país, idioma, moeda, título) e
// troca do Pastor de Governo por convite (D-068). Tudo fica no log da igreja.
export default function GerenciarIgreja() {
  const { t } = useTranslation();
  const voltar = useVoltar('/igrejas');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [igreja, setIgreja] = useState<IgrejaDaPlataforma | null>();
  const [dados, setDados] = useState<DadosDaIgreja>();
  const [confirmandoInativar, setConfirmandoInativar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [retornoDosDados, setRetornoDosDados] = useState<{ aviso?: string; erro?: string }>();
  const [pastor, setPastor] = useState(PASTOR_VAZIO);
  const [convidando, setConvidando] = useState(false);
  const [retornoDoPastor, setRetornoDoPastor] = useState<{ aviso?: string; erro?: string }>();

  const carregar = useCallback(async () => {
    const encontrada = (await listarIgrejasDaPlataforma().catch(() => [])).find((i) => i.id === id) ?? null;
    setIgreja(encontrada);
    if (encontrada) setDados(dadosDa(encontrada));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (ehAdminMaster) carregar();
    }, [ehAdminMaster, carregar]),
  );

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster || igreja === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }
  if (igreja === null || !dados) {
    return (
      <Tela>
        <Texto>{t('admin.igreja.naoEncontrada')}</Texto>
        <Botao titulo={t('admin.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const titulo = igreja.titulo_administrador;
  const mensagemDoErro = (codigo: ErroDoAdmin) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado' ? t(`comum.erros.${codigo}`) : t(`admin.erros.${codigo}`);
  const campo = (chave: Exclude<keyof DadosDaIgreja, 'status'>) => ({
    value: dados[chave],
    onChangeText: (valor: string) => setDados((atual) => atual && { ...atual, [chave]: valor }),
  });

  async function salvarDados() {
    if (!dados || !igreja) return;
    setRetornoDosDados(undefined);
    setSalvando(true);
    const resultado = await atualizarIgreja(igreja.id, dados);
    setSalvando(false);
    setConfirmandoInativar(false);
    if (!resultado.ok) {
      setRetornoDosDados({ erro: mensagemDoErro(resultado.erro) });
      return;
    }
    await carregar();
    setRetornoDosDados({ aviso: t('admin.igreja.salvo') });
  }

  function aoSalvar() {
    // Inativar tira todo mundo da igreja do app: pede confirmação antes.
    if (igreja?.status === 'ativa' && dados?.status === 'inativa') setConfirmandoInativar(true);
    else salvarDados();
  }

  async function aoReenviarConvite() {
    if (!igreja?.pastor_id) return;
    setRetornoDoPastor(undefined);
    setConvidando(true);
    const resultado = await reenviarConviteDoPastor(igreja.pastor_id);
    setConvidando(false);
    setRetornoDoPastor(
      resultado.ok
        ? { aviso: t('admin.igreja.conviteReenviado', { email: igreja.pastor_email }) }
        : { erro: mensagemDoErro(resultado.erro) },
    );
  }

  async function aoConvidarPastor() {
    if (!igreja) return;
    setRetornoDoPastor(undefined);
    if (!emailValido(pastor.email)) {
      setRetornoDoPastor({ erro: t('admin.erros.email_invalido') });
      return;
    }
    setConvidando(true);
    const email = normalizarEmail(pastor.email);
    const resultado = await convidarPastor(igreja.id, { ...pastor, email }, pastor.motivo);
    setConvidando(false);
    if (!resultado.ok) {
      setRetornoDoPastor({ erro: mensagemDoErro(resultado.erro) });
      return;
    }
    setPastor(PASTOR_VAZIO);
    await carregar();
    setRetornoDoPastor({ aviso: t('admin.igreja.pastorConvidado', { email }) });
  }

  return (
    <Tela>
      <Texto variante="titulo">{igreja.nome}</Texto>

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t('admin.igreja.dados')}
        </Texto>
        <CampoTexto rotulo={t('admin.nova.nome')} {...campo('nome')} />
        <Opcoes
          rotulo={t('admin.igreja.status')}
          opcoes={[
            { valor: 'ativa', rotulo: t('admin.igreja.ativa') },
            { valor: 'inativa', rotulo: t('admin.igreja.inativa') },
          ]}
          selecionada={dados.status}
          onSelecionar={(status) => setDados((atual) => atual && { ...atual, status })}
        />
        <CampoTexto rotulo={t('admin.nova.plano')} dica={t('admin.nova.planoDica')} {...campo('faixaPlano')} />
        <CampoTexto rotulo={t('admin.nova.pais')} autoCapitalize="characters" maxLength={2} {...campo('pais')} />
        <CampoTexto rotulo={t('admin.nova.idioma')} autoCapitalize="none" {...campo('idioma')} />
        <CampoTexto rotulo={t('admin.nova.moeda')} autoCapitalize="characters" maxLength={3} {...campo('moeda')} />
        <CampoTexto
          rotulo={t('admin.nova.tituloAdministrador')}
          dica={t('admin.nova.tituloDica')}
          {...campo('tituloAdministrador')}
        />
        {confirmandoInativar ? (
          <>
            <Texto variante="destaque">{t('admin.igreja.confirmarInativar', { nome: igreja.nome })}</Texto>
            <Botao titulo={t('admin.igreja.simInativar')} onPress={salvarDados} carregando={salvando} />
            <Botao
              titulo={t('admin.igreja.naoVoltar')}
              variante="secundario"
              onPress={() => setConfirmandoInativar(false)}
              desabilitado={salvando}
            />
          </>
        ) : (
          <Botao titulo={t('admin.igreja.salvar')} onPress={aoSalvar} carregando={salvando} />
        )}
        <Retorno aviso={retornoDosDados?.aviso} erro={retornoDosDados?.erro} />
      </View>

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t('admin.igreja.pastor', { titulo })}
        </Texto>
        {igreja.pastor_nome ? (
          <>
            <Texto>{t('admin.igreja.pastorAtual', { nome: igreja.pastor_nome, email: igreja.pastor_email })}</Texto>
            {igreja.pastor_status === 'convidado' && (
              <>
                <Texto variante="apoio">{t('admin.igreja.pastorAindaNaoEntrou')}</Texto>
                <Botao
                  titulo={t('admin.igreja.reenviarConvite')}
                  variante="secundario"
                  onPress={aoReenviarConvite}
                  carregando={convidando}
                />
              </>
            )}
          </>
        ) : (
          <Texto>{t('admin.igreja.semPastor', { titulo })}</Texto>
        )}

        <Texto variante="destaque">{t('admin.igreja.trocarPastor', { titulo })}</Texto>
        <Texto variante="apoio">{t('admin.igreja.trocarPastorExplicacao')}</Texto>
        <CampoTexto
          rotulo={t('admin.nova.pastorNome')}
          value={pastor.nome}
          onChangeText={(nome) => setPastor((atual) => ({ ...atual, nome }))}
        />
        <CampoTexto
          rotulo={t('admin.nova.pastorEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={pastor.email}
          onChangeText={(email) => setPastor((atual) => ({ ...atual, email }))}
        />
        <CampoTexto
          rotulo={t('admin.nova.pastorCelular')}
          keyboardType="phone-pad"
          value={pastor.celular}
          onChangeText={(celular) => setPastor((atual) => ({ ...atual, celular }))}
        />
        <CampoTexto
          rotulo={t('admin.igreja.motivo')}
          dica={t('admin.igreja.motivoDica')}
          value={pastor.motivo}
          onChangeText={(motivo) => setPastor((atual) => ({ ...atual, motivo }))}
        />
        <Botao titulo={t('admin.igreja.convidar')} onPress={aoConvidarPastor} carregando={convidando} />
        <Retorno aviso={retornoDoPastor?.aviso} erro={retornoDoPastor?.erro} />
      </View>

      <Botao titulo={t('admin.voltar')} variante="secundario" onPress={() => voltar()} />
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
