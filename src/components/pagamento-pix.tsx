import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Botao } from '@/components/ui/botao';
import { Texto } from '@/components/ui/texto';
import { gerarCodigoPix } from '@/lib/pix';
import type { ContaParaPix } from '@/services/supabase/lancamentos';
import { cores, espacos } from '@/theme';

type Props = {
  conta: ContaParaPix;
  valorEmCentavos: number;
  valorFormatado: string;
  descricao: string; // aparece para quem paga, se o banco mostrar (ex.: "Dizimo")
};

// Pagamento pelo Pix da igreja (D-051): "Copiar código Pix" é a ação
// principal; o QR Code fica como opção secundária. Usado no dízimo e na oferta.
export function PagamentoPix({ conta, valorEmCentavos, valorFormatado, descricao }: Props) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);
  const [mostrarQr, setMostrarQr] = useState(false);

  const codigo = gerarCodigoPix({
    chave: conta.chave_pix,
    tipoDeChave: conta.tipo_chave_pix,
    nomeDoRecebedor: conta.nome_recebedor,
    cidade: conta.cidade,
    valorEmCentavos,
    descricao,
  });

  return (
    <View style={estilos.bloco}>
      <Texto variante="destaque">{t('registrar.pagarComPix')}</Texto>
      <Texto>{t('registrar.passoCopiar')}</Texto>
      <Texto>{t('registrar.passoBanco')}</Texto>
      <Texto>{t('registrar.passoConfirmar')}</Texto>
      <Texto variante="apoio">{t('registrar.contaDestino', { conta: conta.nome })}</Texto>
      <Botao
        titulo={t('registrar.copiar')}
        onPress={async () => {
          await Clipboard.setStringAsync(codigo);
          setCopiado(true);
        }}
      />
      {copiado && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {t('registrar.copiado')}
        </Texto>
      )}
      <Botao
        titulo={mostrarQr ? t('registrar.esconderQr') : t('registrar.mostrarQr')}
        variante="secundario"
        onPress={() => setMostrarQr(!mostrarQr)}
      />
      {mostrarQr && (
        <View
          style={estilos.qr}
          accessible
          accessibilityLabel={t('registrar.descricaoQr', { valor: valorFormatado, conta: conta.nome })}
        >
          <QRCode value={codigo} size={240} />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.medio,
  },
  qr: {
    alignSelf: 'center',
    padding: espacos.medio,
    backgroundColor: cores.fundo,
  },
});
