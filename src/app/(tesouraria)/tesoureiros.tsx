import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { filtrarMembros } from '@/lib/membros';
import {
  listarMembrosDaIgreja,
  mudarPerfilDoMembro,
  type ErroDoConvite,
  type MembroDaLista,
} from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

type Confirmacao = { membro: MembroDaLista; para: 'membro' | 'tesoureiro' };

const LIMITE_DA_BUSCA = 20;

// P-01 Tesoureiros: o Pastor de Governo autoriza e suspende (D-068). O
// suspenso volta a ser membro (D-090). O perfil de Pastor é do Admin Master.
export default function Tesoureiros() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [membros, setMembros] = useState<MembroDaLista[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [busca, setBusca] = useState('');
  const [confirmacao, setConfirmacao] = useState<Confirmacao>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [local, setLocal] = useState<'atuais' | 'autorizar'>('atuais');

  const carregar = useCallback(async () => {
    if (!ficha) return;
    try {
      setMembros(await listarMembrosDaIgreja(ficha.igreja_id));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [ficha]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;
  const titulo = ficha.igrejas?.titulo_administrador;
  if (!ehAdministrador) {
    return (
      <Tela>
        <Texto>{t('tesouraria.tesoureiros.soPastor', { titulo })}</Texto>
        <Botao titulo={t('tesouraria.lancar.voltar')} onPress={() => router.back()} />
      </Tela>
    );
  }

  const ativos = (membros ?? []).filter((m) => m.status !== 'inativo');
  const pastores = ativos.filter((m) => m.perfil === 'administrador');
  const tesoureiros = ativos.filter((m) => m.perfil === 'tesoureiro');
  const candidatos = busca.trim()
    ? filtrarMembros(
        ativos.filter((m) => m.perfil === 'membro'),
        busca,
      ).slice(0, LIMITE_DA_BUSCA)
    : [];

  const mensagemDoErro = (codigo: ErroDoConvite) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.membros.erros.${codigo}`, { titulo });

  function pedir(membro: MembroDaLista, para: Confirmacao['para']) {
    setErro(undefined);
    setAviso(undefined);
    setConfirmacao({ membro, para });
  }

  async function aoConfirmar() {
    if (!confirmacao) return;
    const { membro, para } = confirmacao;
    // O retorno aparece onde a pessoa tocou: na lista ou na busca.
    setLocal(para === 'membro' ? 'atuais' : 'autorizar');
    setEnviando(true);
    const resultado = await mudarPerfilDoMembro(membro.id, para === 'tesoureiro' ? 'membro' : 'tesoureiro', para);
    await carregar();
    setEnviando(false);
    setConfirmacao(undefined);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setBusca('');
    setAviso(
      para === 'tesoureiro'
        ? t('tesouraria.tesoureiros.autorizado', { nome: membro.nome })
        : t('tesouraria.tesoureiros.suspenso', { nome: membro.nome }),
    );
  }

  const blocoDeConfirmacao = (membro: MembroDaLista) =>
    confirmacao?.membro.id === membro.id && (
      <>
        <Texto variante="destaque">
          {confirmacao.para === 'tesoureiro'
            ? t('tesouraria.tesoureiros.perguntaAutorizar', { nome: membro.nome })
            : t('tesouraria.tesoureiros.perguntaSuspender', { nome: membro.nome })}
        </Texto>
        <Botao
          titulo={
            confirmacao.para === 'tesoureiro'
              ? t('tesouraria.tesoureiros.simAutorizar')
              : t('tesouraria.tesoureiros.simSuspender')
          }
          onPress={aoConfirmar}
          carregando={enviando}
        />
        <Botao
          titulo={t('tesouraria.tesoureiros.nao')}
          variante="secundario"
          onPress={() => setConfirmacao(undefined)}
          desabilitado={enviando}
        />
      </>
    );

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.tesoureiros.titulo')}</Texto>
      <Texto>{t('tesouraria.tesoureiros.explicacao')}</Texto>

      {falhou && <Texto variante="erro">{t('tesouraria.tesoureiros.falhaAoCarregar')}</Texto>}
      {!membros && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}

      {!!membros && (
        <>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.tesoureiros.pastores', { titulo })}
          </Texto>
          {pastores.map((pastor) => (
            <Texto key={pastor.id}>{pastor.nome}</Texto>
          ))}

          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.tesoureiros.atuais')}
          </Texto>
          {tesoureiros.length === 0 && <Texto>{t('tesouraria.tesoureiros.nenhum')}</Texto>}
          {tesoureiros.map((tesoureiro) => (
            <View key={tesoureiro.id} style={estilos.cartao}>
              <Texto variante="destaque">{tesoureiro.nome}</Texto>
              <Texto variante="apoio">{tesoureiro.email}</Texto>
              {tesoureiro.status === 'convidado' && (
                <Texto variante="apoio">{t('tesouraria.tesoureiros.convidado')}</Texto>
              )}
              {confirmacao?.membro.id === tesoureiro.id ? (
                blocoDeConfirmacao(tesoureiro)
              ) : (
                <Botao
                  titulo={t('tesouraria.tesoureiros.suspender', { nome: tesoureiro.nome })}
                  variante="secundario"
                  onPress={() => pedir(tesoureiro, 'membro')}
                  desabilitado={enviando}
                />
              )}
            </View>
          ))}
          {local === 'atuais' && <Retorno aviso={aviso} erro={erro} />}

          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.tesoureiros.autorizarTitulo')}
          </Texto>
          <Texto variante="apoio">{t('tesouraria.tesoureiros.autorizarExplicacao')}</Texto>
          <CampoTexto
            rotulo={t('tesouraria.tesoureiros.buscar')}
            dica={t('tesouraria.tesoureiros.dicaBuscar')}
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {local === 'autorizar' && <Retorno aviso={aviso} erro={erro} />}
          {!!busca.trim() && candidatos.length === 0 && <Texto>{t('tesouraria.tesoureiros.nenhumEncontrado')}</Texto>}
          {candidatos.map((membro) =>
            confirmacao?.membro.id === membro.id ? (
              <View key={membro.id} style={estilos.cartao}>
                {blocoDeConfirmacao(membro)}
              </View>
            ) : (
              <Pressable
                key={membro.id}
                accessibilityRole="button"
                accessibilityLabel={t('tesouraria.tesoureiros.autorizar', { nome: membro.nome })}
                onPress={() => pedir(membro, 'tesoureiro')}
                style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
              >
                <Texto variante="destaque">{membro.nome}</Texto>
                <Texto variante="apoio">
                  {t('tesouraria.membros.numero', { numero: membro.numero })} · {membro.email}
                </Texto>
              </Pressable>
            ),
          )}

          <Botao
            titulo={t('tesouraria.tesoureiros.convidarNovo')}
            variante="secundario"
            onPress={() => router.push({ pathname: '/convidar', params: { perfil: 'tesoureiro' } })}
          />
        </>
      )}

      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => router.back()} />
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
  pressionado: {
    backgroundColor: cores.fundoPressionado,
  },
});
