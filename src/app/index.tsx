import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tela provisória: será substituída pelo redirecionamento para login ou cartão.
export default function Inicio() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.tela}>
      <Text style={styles.titulo}>{t('app.nome')}</Text>
      <Text style={styles.texto}>{t('inicio.emConstrucao')}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  titulo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
  },
  texto: {
    fontSize: 20,
    textAlign: 'center',
    color: '#111111',
  },
});
