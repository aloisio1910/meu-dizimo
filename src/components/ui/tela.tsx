import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores, espacos } from '@/theme';

// Moldura padrão das telas: respeita o entalhe do celular, rola quando o
// conteúdo não cabe e sobe quando o teclado abre. Na web, limita a largura.
export function Tela({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.area}>
      <KeyboardAvoidingView style={estilos.area} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
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
});
