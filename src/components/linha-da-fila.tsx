import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { SeloDeStatus } from '@/components/selo-de-status';
import { Texto } from '@/components/ui/texto';
import { isoParaData, partesDaDataHora } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import type { ItemDaFila } from '@/services/supabase/tesouraria';
import { cores, espacos, raio } from '@/theme';

type Props = {
  item: ItemDaFila;
  idioma: string;
  meuUsuarioId: string;
  ehMeuLancamento: boolean;
  aoAbrir: () => void;
};

// Uma linha da fila (T-01): quem, quanto, quando, como e a situação.
export function LinhaDaFila({ item, idioma, meuUsuarioId, ehMeuLancamento, aoAbrir }: Props) {
  const { t } = useTranslation();
  const valor = formatarMoeda(item.valor_informado_centavos, item.moeda, idioma);
  const forma = ehFormaConhecida(item.forma) ? t(`formas.${item.forma}`) : item.forma;
  const conferidoPorMim = item.status === 'em_conferencia' && item.em_conferencia_por === meuUsuarioId;
  const conferidoPorOutro =
    item.status === 'em_conferencia' && item.em_conferencia_por !== meuUsuarioId && !item.conferencia_parada;
  const confirmado = item.status === 'confirmado';
  // Não abre o próprio lançamento (RN-034) nem o que outro está conferindo;
  // um já conferido sempre abre, para consulta.
  const podeAbrir = confirmado || (!ehMeuLancamento && !conferidoPorOutro);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !podeAbrir }}
      accessibilityLabel={t('tesouraria.item.abrir', { nome: item.membro_nome, valor })}
      disabled={!podeAbrir}
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.linha, !podeAbrir && estilos.inativa, pressed && estilos.pressionada]}
    >
      <View style={estilos.topo}>
        <Texto variante="destaque" style={estilos.nome}>
          {t('tesouraria.item.membro', { nome: item.membro_nome, numero: item.membro_numero })}
        </Texto>
        <Texto variante="destaque">{valor}</Texto>
      </View>
      <Texto>
        {t(item.tipo === 'dizimo' ? 'tesouraria.item.dizimo' : 'tesouraria.item.oferta')} ·{' '}
        {t('tesouraria.item.dataEForma', { data: isoParaData(item.data_contribuicao), forma })}
      </Texto>
      <Texto variante="apoio">{t(item.tem_comprovante ? 'tesouraria.item.temComprovante' : 'tesouraria.item.semComprovante')}</Texto>
      <SeloDeStatus status={item.status} />
      {confirmado && !!item.confirmado_por_nome && !!item.confirmado_em && (
        <Texto>
          {t('tesouraria.conferidos.confirmadoPorEm', {
            nome: item.confirmado_por_nome,
            quando: t('lancamento.dataHora', partesDaDataHora(item.confirmado_em, idioma)),
          })}
        </Texto>
      )}
      {confirmado &&
        item.valor_conferido_centavos !== null &&
        item.valor_conferido_centavos !== item.valor_informado_centavos && (
          <Texto>
            {t('tesouraria.conferidos.valorConferido', {
              valor: formatarMoeda(item.valor_conferido_centavos, item.moeda, idioma),
            })}
          </Texto>
        )}
      {conferidoPorMim &&<Texto variante="destaque">{t('tesouraria.item.emConferenciaPorVoce')}</Texto>}
      {conferidoPorOutro && (
        <Texto>{t('tesouraria.item.emConferenciaPor', { nome: item.em_conferencia_por_nome ?? '' })}</Texto>
      )}
      {item.conferencia_parada && <Texto>{t('tesouraria.item.parada')}</Texto>}
      {item.resposta_membro === 'contestada' && <Texto variante="erro">{t('tesouraria.item.contestada')}</Texto>}
      {item.divergencia_sinalizada && <Texto variante="erro">{t('tesouraria.item.sinalizada')}</Texto>}
      {ehMeuLancamento && !confirmado && <Texto variante="apoio">{t('tesouraria.item.seuLancamento')}</Texto>}
    </Pressable>
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
  inativa: {
    borderStyle: 'dashed',
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
  nome: {
    flexShrink: 1,
  },
});
