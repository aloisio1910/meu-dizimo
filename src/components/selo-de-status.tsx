import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/texto';
import type { StatusDoLancamento } from '@/services/supabase/lancamentos';
import { coresDeStatus, espacos, fontes, raio, tamanhos } from '@/theme';

// Status sempre escrito por extenso, com cor de apoio (nunca só a cor).
export function SeloDeStatus({ status }: { status: StatusDoLancamento }) {
  const { t } = useTranslation();
  const cor = coresDeStatus[status];

  return (
    <View style={[estilos.selo, { backgroundColor: cor.fundo, borderColor: cor.texto }]}>
      <Texto style={[estilos.texto, { color: cor.texto }]}>{t(`status.${status}`)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: raio,
    paddingHorizontal: espacos.pequeno + 4,
    paddingVertical: 4,
  },
  texto: {
    fontFamily: fontes.negrito,
    fontSize: tamanhos.apoio,
    lineHeight: tamanhos.apoio * 1.3,
  },
});
