import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/texto';
import { partesDaDataHora } from '@/lib/data';
import { listarComprovantes, type Comprovante } from '@/services/supabase/comprovantes';
import { cores, espacos, raio } from '@/theme';

// Comprovantes vistos pela tesouraria (T-02): inclui os retirados pelo
// membro, marcados como tal (D-083). Só leitura.
export function ComprovantesDaTesouraria({ lancamentoId, idioma }: { lancamentoId: string; idioma: string }) {
  const { t } = useTranslation();
  const [comprovantes, setComprovantes] = useState<Comprovante[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    listarComprovantes(lancamentoId, { incluirRetirados: true })
      .then((lista) => ativo && setComprovantes(lista))
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
    };
  }, [lancamentoId]);

  async function abrir(id: string) {
    // Link novo a cada abertura: os links valem 5 minutos.
    const lista = await listarComprovantes(lancamentoId, { incluirRetirados: true }).catch(() => []);
    const link = lista.find((c) => c.id === id)?.link;
    if (link) await WebBrowser.openBrowserAsync(link);
  }

  const quando = (momento: string) => t('lancamento.dataHora', partesDaDataHora(momento, idioma));

  return (
    <View style={estilos.secao}>
      <Texto variante="destaque" accessibilityRole="header">
        {t('tesouraria.conferencia.comprovantes')}
      </Texto>
      {falhou && <Texto variante="erro">{t('comprovantes.falhaAoCarregar')}</Texto>}
      {!comprovantes && !falhou && <ActivityIndicator accessibilityLabel={t('comum.carregando')} />}
      {comprovantes?.length === 0 && <Texto>{t('tesouraria.conferencia.semComprovantes')}</Texto>}
      {comprovantes?.map((comprovante, indice) => {
        const numero = indice + 1;
        return (
          <Pressable
            key={comprovante.id}
            accessibilityRole="button"
            accessibilityLabel={t('comprovantes.abrir', { numero })}
            onPress={() => abrir(comprovante.id)}
            style={[estilos.item, !!comprovante.retirado_em && estilos.retirado]}
          >
            {comprovante.formato !== 'pdf' && !!comprovante.link && (
              <Image source={{ uri: comprovante.link }} style={estilos.miniatura} contentFit="cover" />
            )}
            <View style={estilos.texto}>
              <Texto>
                {t('comprovantes.item', {
                  numero,
                  formato: comprovante.formato.toUpperCase(),
                  quando: quando(comprovante.enviado_em),
                })}
              </Texto>
              {!!comprovante.retirado_em && (
                <Texto variante="erro">
                  {t('tesouraria.conferencia.retiradoPeloMembro', { quando: quando(comprovante.retirado_em) })}
                </Texto>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: {
    gap: espacos.medio,
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
  retirado: {
    borderStyle: 'dashed',
  },
  miniatura: {
    width: 72,
    height: 72,
    borderRadius: 6,
  },
  texto: {
    flex: 1,
    gap: 4,
  },
});
