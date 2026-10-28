import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MenuDaTesouraria } from '@/components/menu-da-tesouraria';
import { Retorno } from '@/components/retorno';
import { SeletorDeFiltroPorCampo, useCamposFiltraveis } from '@/components/seletor-de-filtro-por-campo';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { partesDaDataHora } from '@/lib/data';
import type { FiltroPorCampo } from '@/lib/filtro-por-campo';
import {
  enviarMensagemDaIgreja,
  listarMensagensDaIgreja,
  previaDaMensagem,
  type ErroDaMensagem,
  type MensagemEnviada,
  type Previa,
} from '@/services/supabase/mensagens';
import { cores, espacos, raio } from '@/theme';

const LIMITE_DE_LETRAS = 500;

// Mensagens aos membros (D-102): o Pastor e os tesoureiros escrevem, veem a
// prévia (como aparece e quantos recebem) e enviam. Até 1 por semana por
// igreja; para todos os ativos ou um grupo do cadastro.
export default function Mensagens() {
  const { t } = useTranslation();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();
  const igrejaId = ficha?.igreja_id;
  const campos = useCamposFiltraveis(igrejaId);
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<FiltroPorCampo>();
  const [previa, setPrevia] = useState<Previa>();
  const [proximaEm, setProximaEm] = useState<string | null>();
  const [enviadas, setEnviadas] = useState<MensagemEnviada[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  const carregar = useCallback(async () => {
    if (!igrejaId) return;
    try {
      const [lista, situacao] = await Promise.all([listarMensagensDaIgreja(igrejaId), previaDaMensagem(igrejaId)]);
      setEnviadas(lista);
      setProximaEm(situacao.proximaEm);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [igrejaId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha || !igrejaId) return null;

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const titulo = ficha.igrejas?.titulo_administrador;
  const mensagemDoErro = (codigo: ErroDaMensagem) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`mensagens.erros.${codigo}`, { titulo });
  const rotuloDoCampo = (chave: string | null) => campos.find((c) => c.chave === chave)?.rotulo ?? chave ?? '';

  function mudarTexto(novo: string) {
    setTexto(novo);
    setPrevia(undefined);
    setRetorno(undefined);
  }

  function mudarFiltro(novo: FiltroPorCampo | undefined) {
    setFiltro(novo);
    setPrevia(undefined);
    setRetorno(undefined);
  }

  async function aoVerPrevia() {
    setRetorno(undefined);
    if (texto.trim().length < 3) {
      setRetorno({ erro: t('mensagens.erros.texto_invalido') });
      return;
    }
    setOcupado(true);
    try {
      setPrevia(await previaDaMensagem(igrejaId!, filtro));
    } catch {
      setRetorno({ erro: t('comum.erros.erro_inesperado') });
    }
    setOcupado(false);
  }

  async function aoEnviar() {
    setOcupado(true);
    const resultado = await enviarMensagemDaIgreja(igrejaId!, texto.trim(), filtro);
    setOcupado(false);
    if (!resultado.ok) {
      setRetorno({ erro: mensagemDoErro(resultado.erro) });
      await carregar();
      return;
    }
    setTexto('');
    setFiltro(undefined);
    setPrevia(undefined);
    setRetorno({ aviso: t('mensagens.enviada', { count: resultado.destinatarios }) });
    await carregar();
  }

  const bloqueada = !!proximaEm && new Date(proximaEm) > new Date();

  return (
    <Tela larga>
      <MenuDaTesouraria atual="mensagens" />
      <Texto variante="titulo">{t('mensagens.titulo')}</Texto>
      <Texto>{t('mensagens.explicacao')}</Texto>

      {bloqueada && <Texto variante="destaque">{t('mensagens.limite', partesDaDataHora(proximaEm!, idioma))}</Texto>}

      {!bloqueada && (
        <View style={estilos.cartao}>
          <CampoTexto
            rotulo={t('mensagens.texto')}
            dica={t('mensagens.textoDica')}
            value={texto}
            onChangeText={mudarTexto}
            multiline
            maxLength={LIMITE_DE_LETRAS}
          />
          <Texto variante="apoio">{t('mensagens.contador', { quantos: texto.length })}</Texto>

          <Texto variante="destaque">{t('mensagens.paraQuem')}</Texto>
          <Texto variante="apoio">{t('mensagens.paraQuemExplicacao')}</Texto>
          <SeletorDeFiltroPorCampo campos={campos} filtro={filtro} aoMudar={mudarFiltro} />

          {!previa ? (
            <Botao titulo={t('mensagens.verPrevia')} onPress={aoVerPrevia} carregando={ocupado} />
          ) : (
            <>
              <Texto variante="destaque">{t('mensagens.previa')}</Texto>
              <View style={estilos.previa}>
                <Texto variante="destaque">{ficha.igrejas?.nome}</Texto>
                <Texto>{texto.trim()}</Texto>
              </View>
              <Texto variante={previa.destinatarios === 0 ? 'erro' : 'destaque'}>
                {t('mensagens.vaiPara', { count: previa.destinatarios })}
              </Texto>
              <Texto variante="apoio">{t('mensagens.naoRecebe')}</Texto>
              <Botao
                titulo={t('mensagens.enviar')}
                onPress={aoEnviar}
                carregando={ocupado}
                desabilitado={previa.destinatarios === 0}
              />
              <Botao
                titulo={t('mensagens.editar')}
                variante="secundario"
                onPress={() => setPrevia(undefined)}
                desabilitado={ocupado}
              />
            </>
          )}
          <Retorno aviso={retorno?.aviso} erro={retorno?.erro} />
        </View>
      )}
      {bloqueada && <Retorno aviso={retorno?.aviso} erro={retorno?.erro} />}

      <Texto variante="destaque" accessibilityRole="header">
        {t('mensagens.enviadas')}
      </Texto>
      {falhou && <Texto variante="erro">{t('mensagens.falhaAoCarregar')}</Texto>}
      {!enviadas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {enviadas?.length === 0 && <Texto>{t('mensagens.nenhuma')}</Texto>}
      {enviadas?.map((mensagem) => (
        <View key={mensagem.id} style={estilos.cartao}>
          <Texto variante="apoio">
            {t('mensagens.linha', {
              dia: partesDaDataHora(mensagem.criado_em, idioma).dia,
              autor: mensagem.autor_nome,
              count: mensagem.destinatarios,
            })}
          </Texto>
          {!!mensagem.grupo_campo && (
            <Texto variante="apoio">
              {t('mensagens.grupo', { campo: rotuloDoCampo(mensagem.grupo_campo), valor: mensagem.grupo_valor })}
            </Texto>
          )}
          <Texto>{mensagem.texto}</Texto>
        </View>
      ))}
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
  previa: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderRadius: raio,
    backgroundColor: cores.fundoPressionado,
  },
});
