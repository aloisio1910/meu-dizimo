import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { LinhaDaFila } from '@/components/linha-da-fila';
import { Botao } from '@/components/ui/botao';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useSessao } from '@/hooks/use-sessao';
import {
  abrirConferencia,
  abrirProximo,
  listarConferidos,
  listarDivergenciasPendentes,
  listarFila,
  type ErroDaConferencia,
  type FiltrosDaFila,
  type ItemDaFila,
} from '@/services/supabase/tesouraria';

type Situacao = 'fila' | 'conferidos';
type FiltroDeTipo = 'todos' | 'dizimo' | 'oferta';
type FiltroDeComprovante = 'todos' | 'com' | 'sem';

// T-01 Fila de conferência: por ordem de chegada (RN-020), com filtros.
export default function Fila() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao } = useSessao();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();

  const [situacao, setSituacao] = useState<Situacao>('fila');
  const [conferidos, setConferidos] = useState<ItemDaFila[] | null>(null);
  const [filtroDeTipo, setFiltroDeTipo] = useState<FiltroDeTipo>('todos');
  const [filtroDeComprovante, setFiltroDeComprovante] = useState<FiltroDeComprovante>('todos');
  const [fila, setFila] = useState<ItemDaFila[] | null>(null);
  const [divergencias, setDivergencias] = useState<ItemDaFila[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const filtros: FiltrosDaFila = {
    tipo: filtroDeTipo === 'todos' ? undefined : filtroDeTipo,
    comComprovante: filtroDeComprovante === 'todos' ? undefined : filtroDeComprovante === 'com',
  };
  const chaveDosFiltros = `${situacao}|${filtroDeTipo}|${filtroDeComprovante}`;

  const carregar = useCallback(async () => {
    if (!ficha) return;
    const filtrosAtuais: FiltrosDaFila = {
      tipo: filtroDeTipo === 'todos' ? undefined : filtroDeTipo,
      comComprovante: filtroDeComprovante === 'todos' ? undefined : filtroDeComprovante === 'com',
    };
    try {
      if (situacao === 'conferidos') {
        setConferidos(await listarConferidos(ficha.igreja_id, filtrosAtuais));
      } else {
        const [itens, pendentes] = await Promise.all([
          listarFila(ficha.igreja_id, filtrosAtuais),
          listarDivergenciasPendentes(ficha.igreja_id),
        ]);
        setFila(itens);
        setDivergencias(pendentes);
      }
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
    // A chave resume os dois filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha, chaveDosFiltros]);

  // Recarrega ao voltar para a fila e quando os filtros mudam.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
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

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const meuUsuarioId = sessao.user.id;

  const mensagemDoErro = (codigo: ErroDaConferencia) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.conferencia.erros.${codigo}`);

  const irParaConferencia = (id: string) =>
    router.push({ pathname: '/conferencia/[id]', params: { id } });

  async function conferirProximo() {
    setErro(undefined);
    setAviso(undefined);
    setAbrindo(true);
    const resultado = await abrirProximo(ficha!.igreja_id, filtros);
    setAbrindo(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    if (!resultado.id) {
      setAviso(t('tesouraria.fila.filaVazia'));
      await carregar();
      return;
    }
    irParaConferencia(resultado.id);
  }

  async function abrirItem(item: ItemDaFila) {
    setErro(undefined);
    setAviso(undefined);
    // Já conferido: abre a consulta (desfazer ou reabrir), sem bloquear nada.
    if (item.status === 'confirmado') {
      router.push({ pathname: '/conferido/[id]', params: { id: item.id } });
      return;
    }
    // Se já está aberto para mim, só volta para a conferência.
    if (item.status === 'em_conferencia' && item.em_conferencia_por === meuUsuarioId) {
      irParaConferencia(item.id);
      return;
    }
    setAbrindo(true);
    const resultado = await abrirConferencia(item.id);
    setAbrindo(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      await carregar();
      return;
    }
    irParaConferencia(item.id);
  }

  const linha = (item: ItemDaFila) => (
    <LinhaDaFila
      key={item.id}
      item={item}
      idioma={idioma}
      meuUsuarioId={meuUsuarioId}
      ehMeuLancamento={item.membro_id === ficha.id}
      aoAbrir={() => abrirItem(item)}
    />
  );

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.fila.titulo')}</Texto>
      <Texto>{t('tesouraria.fila.explicacao')}</Texto>

      {situacao === 'fila' && (
        <Botao titulo={t('tesouraria.fila.conferirProximo')} onPress={conferirProximo} carregando={abrindo} />
      )}
      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}
      {!!erro && <Texto variante="erro">{erro}</Texto>}

      <Opcoes
        rotulo={t('tesouraria.conferidos.situacao')}
        opcoes={[
          { valor: 'fila', rotulo: t('tesouraria.conferidos.naFila') },
          { valor: 'conferidos', rotulo: t('tesouraria.conferidos.conferidos') },
        ]}
        selecionada={situacao}
        onSelecionar={setSituacao}
      />
      <Opcoes
        rotulo={t('tesouraria.fila.filtroTipo')}
        opcoes={[
          { valor: 'todos', rotulo: t('tesouraria.fila.todos') },
          { valor: 'dizimo', rotulo: t('tesouraria.fila.soDizimos') },
          { valor: 'oferta', rotulo: t('tesouraria.fila.soOfertas') },
        ]}
        selecionada={filtroDeTipo}
        onSelecionar={setFiltroDeTipo}
      />
      <Opcoes
        rotulo={t('tesouraria.fila.filtroComprovante')}
        opcoes={[
          { valor: 'todos', rotulo: t('tesouraria.fila.todos') },
          { valor: 'com', rotulo: t('tesouraria.fila.comComprovante') },
          { valor: 'sem', rotulo: t('tesouraria.fila.semComprovante') },
        ]}
        selecionada={filtroDeComprovante}
        onSelecionar={setFiltroDeComprovante}
      />

      {falhou && <Texto variante="erro">{t('tesouraria.fila.falhaAoCarregar')}</Texto>}

      {situacao === 'conferidos' && (
        <>
          {!conferidos && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
          {!!conferidos && (
            <>
              <Texto variante="destaque" accessibilityRole="header">
                {t('tesouraria.conferidos.titulo', { quantidade: conferidos.length })}
              </Texto>
              {conferidos.length === 0 && <Texto>{t('tesouraria.conferidos.nenhum')}</Texto>}
              {conferidos.map(linha)}
            </>
          )}
        </>
      )}

      {situacao === 'fila' && !fila && !falhou && (
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      )}

      {situacao === 'fila' && !!fila && (
        <>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.fila.aguardando', { quantidade: fila.length })}
          </Texto>
          {fila.length === 0 && (
            <Texto>
              {filtroDeTipo === 'todos' && filtroDeComprovante === 'todos'
                ? t('tesouraria.fila.filaVazia')
                : t('tesouraria.fila.nadaComFiltro')}
            </Texto>
          )}
          {fila.map(linha)}

          {divergencias.length > 0 && (
            <>
              <Texto variante="destaque" accessibilityRole="header">
                {t('tesouraria.fila.divergencias', { quantidade: divergencias.length })}
              </Texto>
              {divergencias.map(linha)}
            </>
          )}
        </>
      )}

      <Botao titulo={t('tesouraria.fila.atualizar')} variante="secundario" onPress={carregar} />
      <Botao titulo={t('tesouraria.meuCartao')} variante="secundario" onPress={() => router.push('/cartao')} />
    </Tela>
  );
}
