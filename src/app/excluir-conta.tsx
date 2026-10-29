import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { useVoltar } from '@/hooks/use-voltar';
import { guardarDestinoDepoisDoLogin } from '@/lib/destino-depois-do-login';
import { confirmacaoValida } from '@/lib/excluir-conta';
import { excluirMinhaConta, souPastorEmAlgumaIgreja, type ErroDaExclusao } from '@/services/supabase/conta';
import { cores, espacos, raio } from '@/theme';

// Excluir minha conta (Apple 5.1.1(v), Google). Também é o endereço que a
// Google Play mostra para pedir a exclusão pela web: sem login, a pessoa entra
// e volta para cá. Na hora, com dupla confirmação (digitar EXCLUIR).
export default function ExcluirConta() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/perfil');
  const { sessao } = useSessao();
  const { fichaEmUso } = useMinhasFichas();
  const [ehPastor, setEhPastor] = useState<boolean>();
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [excluida, setExcluida] = useState(false);
  const [erro, setErro] = useState<string>();

  const usuarioId = sessao?.user.id;
  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    souPastorEmAlgumaIgreja()
      .then((resposta) => ativo && setEhPastor(resposta))
      .catch(() => ativo && setEhPastor(false));
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  if (excluida) {
    return (
      <Tela>
        <Texto variante="titulo">{t('excluirConta.excluida')}</Texto>
        <Texto>{t('excluirConta.excluidaDetalhe')}</Texto>
        <Botao titulo={t('excluirConta.inicio')} onPress={() => router.replace('/')} />
      </Tela>
    );
  }

  if (!sessao) {
    guardarDestinoDepoisDoLogin('/excluir-conta');
    return <Redirect href="/entrar" />;
  }

  if (ehPastor === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  const mensagemDoErro = (codigo: ErroDaExclusao) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`excluirConta.erros.${codigo}`);

  async function aoExcluir() {
    setErro(undefined);
    if (!confirmacaoValida(confirmacao)) {
      setErro(t('excluirConta.erros.confirmacao_invalida'));
      return;
    }
    setExcluindo(true);
    const resultado = await excluirMinhaConta(confirmacao);
    setExcluindo(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setExcluida(true);
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('excluirConta.titulo')}</Texto>

      {ehPastor ? (
        <Texto variante="destaque">
          {t('excluirConta.pastor', { titulo: fichaEmUso?.igrejas?.titulo_administrador ?? 'Pastor de Governo' })}
        </Texto>
      ) : (
        <>
          <View style={estilos.cartao}>
            <Texto variante="destaque">{t('excluirConta.oQueAcontece')}</Texto>
            <Texto>• {t('excluirConta.item1')}</Texto>
            <Texto>• {t('excluirConta.item2')}</Texto>
            <Texto>• {t('excluirConta.item3')}</Texto>
            <Texto variante="destaque">• {t('excluirConta.item4')}</Texto>
          </View>
          <CampoTexto
            rotulo={t('excluirConta.digite')}
            value={confirmacao}
            onChangeText={setConfirmacao}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Botao
            titulo={t('excluirConta.excluir')}
            onPress={aoExcluir}
            carregando={excluindo}
            desabilitado={!confirmacaoValida(confirmacao)}
          />
          <Retorno erro={erro} />
        </>
      )}

      <Botao
        titulo={t('excluirConta.voltar')}
        variante="secundario"
        onPress={() => voltar()}
        desabilitado={excluindo}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.medio,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.erro,
    borderRadius: raio,
  },
});
