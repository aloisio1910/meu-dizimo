import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { REDES, redesIniciais } from '@/lib/dados-da-igreja';
import { linkDoMapa } from '@/lib/mapa';
import { linkDoWhatsApp } from '@/lib/whatsapp';
import {
  buscarDadosDaIgreja,
  listarContasDaIgreja,
  type ContaDaIgreja,
  type DadosDaIgreja,
} from '@/services/supabase/igreja';
import { cores, espacos, raio } from '@/theme';

// M-09 Igreja: contato, horários, WhatsApp e as contas com a chave Pix.
export default function Igreja() {
  const { t } = useTranslation();
  const { ficha } = useFichaAtiva();
  const [dados, setDados] = useState<DadosDaIgreja | null>();
  const [contas, setContas] = useState<ContaDaIgreja[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [copiada, setCopiada] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      Promise.all([buscarDadosDaIgreja(ficha.igreja_id), listarContasDaIgreja(ficha.igreja_id)])
        .then(([encontrados, lista]) => {
          if (!ativo) return;
          setDados(encontrados);
          setContas(lista);
          setFalhou(false);
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!ficha) return null;

  if (falhou) {
    return (
      <Tela>
        <Texto variante="erro">{t('igreja.falhaAoCarregar')}</Texto>
      </Tela>
    );
  }

  if (dados === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  const whatsapp = linkDoWhatsApp(dados?.whatsapp_contato);
  const redes = redesIniciais(dados?.redes_sociais);

  async function copiarChave(conta: ContaDaIgreja) {
    if (!conta.chave_pix) return;
    await Clipboard.setStringAsync(conta.chave_pix);
    setCopiada(conta.id);
  }

  return (
    <Tela>
      <Texto variante="apoio">{t('igreja.titulo')}</Texto>
      <Texto variante="titulo">{dados?.nome ?? ficha.igrejas?.nome}</Texto>

      {!!whatsapp && <Botao titulo={t('igreja.whatsapp')} onPress={() => Linking.openURL(whatsapp)} />}

      {!!dados?.endereco && (
        <View style={estilos.bloco}>
          <Texto variante="destaque">{t('igreja.endereco')}</Texto>
          <Texto>{dados.endereco}</Texto>
          <Botao
            titulo={t('igreja.abrirMapa')}
            variante="secundario"
            onPress={() => Linking.openURL(linkDoMapa(dados.endereco!))}
          />
        </View>
      )}
      {!!dados?.horarios_culto && (
        <View style={estilos.bloco}>
          <Texto variante="destaque">{t('igreja.horarios')}</Texto>
          <Texto>{dados.horarios_culto}</Texto>
        </View>
      )}
      {!!dados?.site && (
        <Botao
          titulo={t('igreja.abrirSite')}
          variante="secundario"
          onPress={() => WebBrowser.openBrowserAsync(dados.site!)}
        />
      )}
      {REDES.filter((rede) => !!redes[rede]).map((rede) => (
        <Botao
          key={rede}
          titulo={t(`igreja.abrirRede.${rede}`)}
          variante="secundario"
          onPress={() => Linking.openURL(redes[rede])}
        />
      ))}

      <Texto variante="destaque" accessibilityRole="header">
        {t('igreja.contas')}
      </Texto>
      {contas.length === 0 && <Texto>{t('igreja.semContas')}</Texto>}
      {contas.map((conta) => (
        <View key={conta.id} style={estilos.conta}>
          <Texto variante="destaque">{conta.nome}</Texto>
          {conta.principal && <Texto variante="apoio">{t('igreja.principal')}</Texto>}
          {!!conta.finalidade && <Texto>{conta.finalidade}</Texto>}
          {!!conta.banco && (
            <Texto>
              {t('igreja.dadosBancarios', {
                banco: conta.banco,
                agencia: conta.agencia ?? '-',
                conta: conta.numero_conta ?? '-',
              })}
            </Texto>
          )}
          {!!conta.chave_pix && (
            <>
              <Texto>{t('igreja.chavePix', { chave: conta.chave_pix })}</Texto>
              {!!conta.nome_recebedor && <Texto variante="apoio">{t('igreja.recebedor', { nome: conta.nome_recebedor })}</Texto>}
              <Botao titulo={t('igreja.copiarChave', { conta: conta.nome })} onPress={() => copiarChave(conta)} />
              {copiada === conta.id && (
                <Texto variante="destaque" accessibilityLiveRegion="polite">
                  {t('igreja.chaveCopiada')}
                </Texto>
              )}
            </>
          )}
        </View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.pequeno,
  },
  conta: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
});
