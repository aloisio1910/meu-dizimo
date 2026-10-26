import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LogoDaIgreja } from '@/components/logo-da-igreja';
import { Botao } from '@/components/ui/botao';
import { Texto } from '@/components/ui/texto';
import { useAvisosNaoLidos } from '@/hooks/use-avisos-nao-lidos';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { sair } from '@/services/supabase/auth';
import { espacos } from '@/theme';

type Pagina = 'fila' | 'membros';

// Atalhos entre as telas do painel da tesouraria, no topo de cada tela
// principal. Lado a lado no computador; no celular, quebram em linhas.
// A página atual não aparece. Mostra com quem a pessoa entrou: no
// computador o login fica guardado, e sem isso é fácil achar que entrou
// como Pastor estando como tesoureiro.
export function MenuDaTesouraria({ atual }: { atual: Pagina }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, ehAdministrador } = useFichaAtiva();
  const { naoLidos } = useAvisosNaoLidos();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const itens = [
    atual !== 'fila' && { titulo: t('tesouraria.menu.fila'), ir: () => router.replace('/fila') },
    atual !== 'membros' && { titulo: t('tesouraria.menu.membros'), ir: () => router.replace('/membros') },
    { titulo: t('tesouraria.menu.lancar'), ir: () => router.push('/lancar') },
    { titulo: t('tesouraria.menu.relatorio'), ir: () => router.push('/relatorio') },
    // Campanhas, tesoureiros e configurações são do Pastor de Governo.
    ehAdministrador && { titulo: t('tesouraria.menu.campanhas'), ir: () => router.push('/campanhas') },
    ehAdministrador && { titulo: t('tesouraria.menu.tesoureiros'), ir: () => router.push('/tesoureiros') },
    ehAdministrador && { titulo: t('tesouraria.menu.configuracoes'), ir: () => router.push('/configuracoes') },
    ehAdministrador && { titulo: t('tesouraria.menu.log'), ir: () => router.push('/log') },
    {
      titulo: naoLidos > 0 ? t('tesouraria.menu.avisosComNaoLidos', { count: naoLidos }) : t('tesouraria.menu.avisos'),
      ir: () => router.push('/avisos'),
    },
    { titulo: t('tesouraria.meuCartao'), ir: () => router.push('/cartao') },
  ].filter((item) => !!item);

  const perfil = ehAdministrador ? ficha?.igrejas?.titulo_administrador : t('tesouraria.membro.perfilTesoureiro');

  return (
    <View style={estilos.bloco}>
      {!!ficha && (
        <View style={estilos.quem}>
          <LogoDaIgreja tamanho={40} />
          <Texto variante="apoio" style={estilos.textoDeQuem}>
            {t('tesouraria.menu.conectadoComo', { nome: ficha.nome, perfil })}
          </Texto>
        </View>
      )}
      <View style={estilos.menu} accessibilityRole="menu">
        {itens.map((item) => (
          <View key={item.titulo} style={estilos.item}>
            <Botao titulo={item.titulo} variante="secundario" onPress={item.ir} />
          </View>
        ))}
        {!confirmandoSaida && (
          <View style={estilos.item}>
            <Botao titulo={t('tesouraria.menu.sair')} variante="secundario" onPress={() => setConfirmandoSaida(true)} />
          </View>
        )}
      </View>
      {/* Sair também esquece a escolha da digital neste aparelho (D-078). */}
      {confirmandoSaida && (
        <View style={estilos.bloco}>
          <Texto variante="destaque">{t('tesouraria.menu.confirmarSaida')}</Texto>
          <View style={estilos.menu}>
            <View style={estilos.item}>
              <Botao titulo={t('perfil.simSair')} onPress={() => sair()} />
            </View>
            <View style={estilos.item}>
              <Botao titulo={t('perfil.naoSair')} variante="secundario" onPress={() => setConfirmandoSaida(false)} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  quem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.pequeno,
  },
  textoDeQuem: {
    flexShrink: 1,
  },
  bloco: {
    gap: espacos.pequeno,
  },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
  item: {
    flexGrow: 1,
    flexBasis: 160,
  },
});
