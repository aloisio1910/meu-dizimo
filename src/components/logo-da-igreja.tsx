import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useImagensDaIgreja } from '@/hooks/use-imagens-da-igreja';
import { raio } from '@/theme';

// Logo da igreja em uso, quando houver (seção 17). Sem logo, não ocupa espaço.
export function LogoDaIgreja({ tamanho = 56 }: { tamanho?: number }) {
  const { t } = useTranslation();
  const { logo } = useImagensDaIgreja();
  if (!logo) return null;
  return (
    <Image
      source={{ uri: logo }}
      style={[estilos.logo, { width: tamanho, height: tamanho }]}
      contentFit="contain"
      accessibilityLabel={t('tesouraria.aparencia.descricaoLogo')}
    />
  );
}

const estilos = StyleSheet.create({
  logo: {
    borderRadius: raio,
  },
});
