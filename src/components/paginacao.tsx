import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Texto } from '@/components/ui/texto';
import { paginasVisiveis, totalDePaginas } from '@/lib/paginacao';
import { espacos } from '@/theme';

type Props = {
  pagina: number; // começa em 0
  totalDeRegistros: number;
  tamanhoDaPagina: number;
  aoMudar: (pagina: number) => void;
  desabilitado?: boolean;
};

// Páginas numeradas, como na pesquisa do Google: Anterior, os números (a
// atual em destaque) e Próxima. Com uma página só, mostra só o total.
export function Paginacao({ pagina, totalDeRegistros, tamanhoDaPagina, aoMudar, desabilitado }: Props) {
  const { t } = useTranslation();
  const total = totalDePaginas(totalDeRegistros, tamanhoDaPagina);
  const atual = pagina + 1;

  return (
    <View style={estilos.bloco} accessibilityRole="toolbar">
      <Texto variante="apoio">{t('paginacao.resumo', { atual, total, count: totalDeRegistros })}</Texto>
      {total > 1 && (
        <View style={estilos.linha}>
          <View style={estilos.navegar}>
            <Botao
              titulo={t('paginacao.anterior')}
              variante="secundario"
              onPress={() => aoMudar(pagina - 1)}
              desabilitado={desabilitado || atual === 1}
            />
          </View>
          {paginasVisiveis(atual, total).map((item, i) =>
            item === 'salto' ? (
              <Texto key={`salto-${i}`} style={estilos.salto} accessible={false}>
                …
              </Texto>
            ) : (
              <View key={item} style={estilos.numero}>
                <Botao
                  titulo={String(item)}
                  variante={item === atual ? 'principal' : 'secundario'}
                  onPress={() => item !== atual && aoMudar(item - 1)}
                  desabilitado={desabilitado}
                />
              </View>
            ),
          )}
          <View style={estilos.navegar}>
            <Botao
              titulo={t('paginacao.proxima')}
              variante="secundario"
              onPress={() => aoMudar(pagina + 1)}
              desabilitado={desabilitado || atual === total}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.pequeno,
  },
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacos.pequeno,
  },
  numero: {
    minWidth: 56,
  },
  navegar: {
    minWidth: 120,
  },
  salto: {
    paddingHorizontal: espacos.pequeno,
  },
});
