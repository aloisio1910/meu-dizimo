import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { partesDaDataHora } from '@/lib/data';
import { emailValido, normalizarEmail, situacaoDoMembro } from '@/lib/membros';
import {
  buscarMembroDaIgreja,
  corrigirEmailDoConvidado,
  reenviarConvite,
  type ErroDoConvite,
  type MembroDaLista,
} from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

// Ficha do membro para a tesouraria. Por enquanto: dados de contato e o
// convite (reenviar e corrigir e-mail, D-069). O histórico entra na T-04.
export default function FichaDoMembro() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();

  const [membro, setMembro] = useState<MembroDaLista | null>();
  const [corrigindo, setCorrigindo] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const igrejaId = ficha?.igreja_id;
  const carregar = useCallback(async () => {
    if (!igrejaId) return;
    setMembro(await buscarMembroDaIgreja(igrejaId, id).catch(() => null));
  }, [igrejaId, id]);

  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    buscarMembroDaIgreja(igrejaId, id)
      .then((encontrado) => ativo && setMembro(encontrado))
      .catch(() => ativo && setMembro(null));
    return () => {
      ativo = false;
    };
  }, [igrejaId, id]);

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha || membro === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (membro === null) {
    return (
      <Tela>
        <Texto>{t('tesouraria.membro.naoEncontrado')}</Texto>
        <Botao titulo={t('tesouraria.membro.voltar')} onPress={() => router.back()} />
      </Tela>
    );
  }

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const dia = (momento: string) => partesDaDataHora(momento, idioma).dia;
  const situacao = situacaoDoMembro(membro.status, membro.convites, new Date());
  const ultimoConvite = membro.convites[0]; // vem do mais recente para o mais antigo

  const mensagemDoErro = (codigo: ErroDoConvite) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.convidar.erros.${codigo}`);

  async function aoReenviar() {
    setErro(undefined);
    setAviso(undefined);
    setEnviando(true);
    const resultado = await reenviarConvite(membro!.id);
    await carregar();
    setEnviando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setAviso(t('tesouraria.membro.reenviado', { data: dia(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()) }));
  }

  async function aoSalvarEmail() {
    setErro(undefined);
    setAviso(undefined);
    if (!emailValido(novoEmail)) {
      setErro(t('tesouraria.convidar.erros.emailInvalido'));
      return;
    }
    setEnviando(true);
    const resultado = await corrigirEmailDoConvidado(membro!.id, normalizarEmail(novoEmail));
    await carregar();
    setEnviando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setCorrigindo(false);
    setAviso(t('tesouraria.membro.emailCorrigido'));
  }

  const ehConvidado = membro.status === 'convidado';

  return (
    <Tela larga>
      <Texto variante="apoio">{t('tesouraria.membros.numero', { numero: membro.numero })}</Texto>
      <Texto variante="titulo">{membro.nome}</Texto>
      <Texto variante={situacao === 'convite_vencido' ? 'erro' : 'destaque'}>
        {t(`tesouraria.membros.situacao.${situacao}`)}
      </Texto>

      <View style={estilos.cartao}>
        <Texto variante="apoio">{t('tesouraria.membro.email')}</Texto>
        <Texto variante="destaque">{membro.email}</Texto>
        <Texto variante="apoio">{t('tesouraria.membro.celular')}</Texto>
        <Texto variante="destaque">{membro.celular}</Texto>
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

      {ehConvidado && !corrigindo && (
        <>
          <Botao titulo={t('tesouraria.membro.reenviar')} onPress={aoReenviar} carregando={enviando} />
          <Botao
            titulo={t('tesouraria.membro.corrigirEmail')}
            variante="secundario"
            onPress={() => {
              setNovoEmail(membro.email);
              setErro(undefined);
              setAviso(undefined);
              setCorrigindo(true);
            }}
            desabilitado={enviando}
          />
        </>
      )}

      {ehConvidado && corrigindo && (
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
          <Botao
            titulo={t('tesouraria.membro.voltar')}
            variante="secundario"
            onPress={() => setCorrigindo(false)}
            desabilitado={enviando}
          />
        </>
      )}

      {!corrigindo && <Botao titulo={t('tesouraria.membro.voltar')} variante="secundario" onPress={() => router.back()} />}
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
