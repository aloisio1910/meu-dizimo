import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MenuDaTesouraria } from '@/components/menu-da-tesouraria';
import { SeletorDeFiltroPorCampo, useCamposFiltraveis } from '@/components/seletor-de-filtro-por-campo';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useSessao } from '@/hooks/use-sessao';
import { atendeAoFiltro, type FiltroPorCampo } from '@/lib/filtro-por-campo';
import { filtrarMembros, situacaoDoMembro, type StatusDoMembro } from '@/lib/membros';
import { listarMembrosDaIgreja, type MembroDaLista } from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

type FiltroDeSituacao = 'todos' | StatusDoMembro;

// T-03 Membros: lista com busca e situação, e o botão Convidar.
export default function Membros() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao } = useSessao();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();
  const [membros, setMembros] = useState<MembroDaLista[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeSituacao>('todos');
  const [filtroPorCampo, setFiltroPorCampo] = useState<FiltroPorCampo>();
  const camposFiltraveis = useCamposFiltraveis(ficha?.igreja_id);

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarMembrosDaIgreja(ficha.igreja_id)
        .then((lista) => {
          if (ativo) {
            setMembros(lista);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!sessao) return <Redirect href="/entrar" />;
  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;
  if (!ehTesouraria) {
    return (
      <Tela>
        <Texto>{t('tesouraria.semPermissao')}</Texto>
        <Botao titulo={t('tesouraria.meuCartao')} onPress={() => router.replace('/cartao')} />
      </Tela>
    );
  }

  const agora = new Date();
  const visiveis = filtrarMembros(membros ?? [], busca)
    .filter((m) => filtro === 'todos' || m.status === filtro)
    .filter((m) => atendeAoFiltro(m, filtroPorCampo, camposFiltraveis));

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.membros.titulo')}</Texto>
      <MenuDaTesouraria atual="membros" />
      <Botao titulo={t('tesouraria.membros.convidar')} onPress={() => router.push('/convidar')} />
      <Botao
        titulo={t('tesouraria.membros.importar')}
        variante="secundario"
        onPress={() => router.push('/importar-membros')}
      />

      <CampoTexto
        rotulo={t('tesouraria.membros.busca')}
        dica={t('tesouraria.membros.dicaBusca')}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Opcoes
        rotulo={t('tesouraria.membros.filtroSituacao')}
        opcoes={[
          { valor: 'todos', rotulo: t('tesouraria.membros.todos') },
          { valor: 'ativo', rotulo: t('tesouraria.membros.ativos') },
          { valor: 'convidado', rotulo: t('tesouraria.membros.convidados') },
          { valor: 'inativo', rotulo: t('tesouraria.membros.inativos') },
        ]}
        selecionada={filtro}
        onSelecionar={setFiltro}
      />
      <SeletorDeFiltroPorCampo campos={camposFiltraveis} filtro={filtroPorCampo} aoMudar={setFiltroPorCampo} />

      {falhou && <Texto variante="erro">{t('tesouraria.membros.falhaAoCarregar')}</Texto>}
      {!membros && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}

      {!!membros && (
        <>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.membros.quantidade', { count: visiveis.length })}
          </Texto>
          {visiveis.length === 0 && <Texto>{t('tesouraria.membros.nenhum')}</Texto>}
          {visiveis.map((membro) => {
            const situacao = situacaoDoMembro(membro.status, membro.convites, agora);
            return (
              <Pressable
                key={membro.id}
                accessibilityRole="button"
                accessibilityHint={t('tesouraria.membros.abrirFicha', { nome: membro.nome })}
                onPress={() => router.push({ pathname: '/membro/[id]', params: { id: membro.id } })}
                style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
              >
                <View style={estilos.topoDaLinha}>
                  <Texto variante="destaque">{membro.nome}</Texto>
                  <Texto variante="apoio">{t('tesouraria.membros.numero', { numero: membro.numero })}</Texto>
                </View>
                <Texto variante="apoio">{membro.email}</Texto>
                <Texto variante={situacao === 'convite_vencido' ? 'erro' : 'apoio'}>
                  {t(`tesouraria.membros.situacao.${situacao}`)}
                </Texto>
              </Pressable>
            );
          })}
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linha: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
  topoDaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
});
