import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { cores, espacos, raio } from '@/theme';

// P-03 Configurações da igreja: ponto de entrada das partes que o Pastor de
// Governo ajusta. Contas e Pix primeiro; as outras entram em seguida.
export default function Configuracoes() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/fila');
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;
  if (!ehAdministrador) {
    return (
      <Tela>
        <Texto>{t('tesouraria.configuracoes.soPastor', { titulo: ficha.igrejas?.titulo_administrador })}</Texto>
        <Botao titulo={t('tesouraria.lancar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.configuracoes.titulo')}</Texto>
      <Texto>{t('tesouraria.configuracoes.explicacao')}</Texto>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/contas')}
        style={({ pressed }) => [estilos.opcao, pressed && estilos.pressionada]}
      >
        <Texto variante="destaque">{t('tesouraria.configuracoes.contas')}</Texto>
        <Texto variante="apoio">{t('tesouraria.configuracoes.contasDetalhe')}</Texto>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/dados-da-igreja')}
        style={({ pressed }) => [estilos.opcao, pressed && estilos.pressionada]}
      >
        <Texto variante="destaque">{t('tesouraria.configuracoes.dados')}</Texto>
        <Texto variante="apoio">{t('tesouraria.configuracoes.dadosDetalhe')}</Texto>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/aparencia')}
        style={({ pressed }) => [estilos.opcao, pressed && estilos.pressionada]}
      >
        <Texto variante="destaque">{t('tesouraria.configuracoes.aparencia')}</Texto>
        <Texto variante="apoio">{t('tesouraria.configuracoes.aparenciaDetalhe')}</Texto>
      </Pressable>

      <Texto variante="apoio">{t('tesouraria.configuracoes.emBreve')}</Texto>
      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  opcao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
});
