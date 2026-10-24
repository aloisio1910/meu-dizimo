import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores, espacos } from '@/theme';

// Moldura padrão das telas: respeita o entalhe do celular, rola quando o
// conteúdo não cabe e sobe quando o teclado abre. Na web, limita a largura;
// "larga" serve ao painel da tesouraria, usado no computador.
export function Tela({ children, larga = false }: { children: ReactNode; larga?: boolean }) {
  return (
    <SafeAreaView style={estilos.area}>
      <KeyboardAvoidingView style={estilos.area} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[estilos.conteudo, larga && estilos.larga]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  area: {
    flex: 1,
    backgroundColor: cores.fundo,
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: espacos.grande,
    padding: espacos.grande,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  larga: {
    maxWidth: 960,
    justifyContent: 'flex-start',
  },
});
