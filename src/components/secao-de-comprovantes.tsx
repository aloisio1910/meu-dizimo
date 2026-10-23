import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Texto } from '@/components/ui/texto';
import { partesDaDataHora } from '@/lib/data';
import { escolherFoto, escolherPdf, type ResultadoDaEscolha } from '@/services/dispositivo/arquivos';
import {
  enviarComprovante,
  listarComprovantes,
  retirarComprovante,
  type Comprovante,
} from '@/services/supabase/comprovantes';
import type { StatusDoLancamento } from '@/services/supabase/lancamentos';
import { cores, espacos, raio } from '@/theme';

type Props = {
  igrejaId: string;
  lancamentoId: string;
  idioma: string;
  status: StatusDoLancamento;
};

// Comprovantes de um lançamento: ver (por link temporário), anexar (foto ou
// PDF) e retirar um errado (D-083).
export function SecaoDeComprovantes({ igrejaId, lancamentoId, idioma, status }: Props) {
  const { t } = useTranslation();
  const [comprovantes, setComprovantes] = useState<Comprovante[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [aRetirar, setARetirar] = useState<string>();

  // Lançamento cancelado não recebe comprovante; retirar só antes da conferência
  // ou numa divergência, enquanto o comprovante ainda não virou prova conferida.
  const podeAnexar = status !== 'cancelado';
  const podeRetirar = status === 'aguardando' || status === 'divergencia';

  const carregar = useCallback(async () => {
    try {
      setComprovantes(await listarComprovantes(lancamentoId));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [lancamentoId]);

  useEffect(() => {
    let ativo = true;
    listarComprovantes(lancamentoId)
      .then((lista) => ativo && setComprovantes(lista))
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
    };
  }, [lancamentoId]);

  async function anexar(escolher: () => Promise<ResultadoDaEscolha>) {
    setErro(undefined);
    setAviso(undefined);
    const escolha = await escolher();
    if (!escolha.ok) {
      if (escolha.motivo === 'permissao_negada') setErro(t('comprovantes.erros.permissao_negada'));
      return;
    }
    setEnviando(true);
    const falha = await enviarComprovante(igrejaId, lancamentoId, escolha.arquivo);
    setEnviando(false);
    if (falha) {
      setErro(t(`comprovantes.erros.${falha}`));
      return;
    }
    setAviso(t('comprovantes.enviado'));
    await carregar();
  }

  async function retirar(comprovanteId: string) {
    setErro(undefined);
    setAviso(undefined);
    setEnviando(true);
    const falha = await retirarComprovante(comprovanteId);
    setEnviando(false);
    setARetirar(undefined);
    if (falha) {
      setErro(t(`comprovantes.erros.${falha}`));
      return;
    }
    setAviso(t('comprovantes.retirado'));
    await carregar();
  }

  async function abrir(comprovante: Comprovante) {
    // O link vale 5 minutos: se a tela ficou aberta muito tempo, busca de novo.
    const atual = (await listarComprovantes(lancamentoId).catch(() => [])).find((c) => c.id === comprovante.id);
    if (!atual?.link) {
      setErro(t('comprovantes.linkIndisponivel'));
      return;
    }
    await WebBrowser.openBrowserAsync(atual.link);
  }

  const ehCelular = Platform.OS !== 'web';

  return (
    <View style={estilos.secao}>
      <Texto variante="destaque" accessibilityRole="header">
        {t('comprovantes.titulo')}
      </Texto>

      {falhou && <Texto variante="erro">{t('comprovantes.falhaAoCarregar')}</Texto>}
      {!comprovantes && !falhou && <ActivityIndicator accessibilityLabel={t('comum.carregando')} />}
      {comprovantes?.length === 0 && <Texto variante="apoio">{t('comprovantes.nenhum')}</Texto>}

      {comprovantes?.map((comprovante, indice) => {
        const numero = indice + 1;
        const quando = t('lancamento.dataHora', partesDaDataHora(comprovante.enviado_em, idioma));
        return (
          <View key={comprovante.id} style={estilos.bloco}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('comprovantes.abrir', { numero })}
              onPress={() => abrir(comprovante)}
              style={estilos.item}
            >
              {comprovante.formato !== 'pdf' && !!comprovante.link && (
                <Image source={{ uri: comprovante.link }} style={estilos.miniatura} contentFit="cover" />
              )}
              <Texto style={estilos.textoDoItem}>
                {t('comprovantes.item', { numero, formato: comprovante.formato.toUpperCase(), quando })}
              </Texto>
            </Pressable>
            {podeRetirar && aRetirar !== comprovante.id && (
              <Botao
                titulo={t('comprovantes.retirar', { numero })}
                variante="secundario"
                onPress={() => setARetirar(comprovante.id)}
                desabilitado={enviando}
              />
            )}
            {/* Retirar pede confirmação: o comprovante some da lista do membro. */}
            {aRetirar === comprovante.id && (
              <>
                <Texto variante="destaque">{t('comprovantes.confirmarRetirada')}</Texto>
                <Botao titulo={t('comprovantes.simRetirar')} onPress={() => retirar(comprovante.id)} carregando={enviando} />
                <Botao
                  titulo={t('comprovantes.naoRetirar')}
                  variante="secundario"
                  onPress={() => setARetirar(undefined)}
                  desabilitado={enviando}
                />
              </>
            )}
          </View>
        );
      })}

      {podeAnexar ? (
        <>
          <Texto variante="apoio">{t('comprovantes.explicacao')}</Texto>
          {enviando ? (
            <>
              <ActivityIndicator size="large" accessibilityLabel={t('comprovantes.enviando')} />
              <Texto>{t('comprovantes.enviando')}</Texto>
            </>
          ) : (
            <>
              {ehCelular && (
                <Botao titulo={t('comprovantes.tirarFoto')} onPress={() => anexar(() => escolherFoto('camera'))} />
              )}
              <Botao
                titulo={t('comprovantes.escolherGaleria')}
                variante="secundario"
                onPress={() => anexar(() => escolherFoto('galeria'))}
              />
              <Botao titulo={t('comprovantes.escolherPdf')} variante="secundario" onPress={() => anexar(escolherPdf)} />
            </>
          )}
        </>
      ) : (
        <Texto variante="apoio">{t('comprovantes.fechadoParaCancelado')}</Texto>
      )}

      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}
      {!!erro && <Texto variante="erro">{erro}</Texto>}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: {
    gap: espacos.medio,
  },
  bloco: {
    gap: espacos.pequeno,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.medio,
    minHeight: 56,
    padding: espacos.pequeno,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  miniatura: {
    width: 56,
    height: 56,
    borderRadius: 6,
  },
  textoDoItem: {
    flex: 1,
  },
});
