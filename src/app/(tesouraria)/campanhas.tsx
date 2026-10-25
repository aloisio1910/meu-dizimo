import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { isoParaData } from '@/lib/data';
import { listarCampanhasDaIgreja, type CampanhaDaIgreja } from '@/services/supabase/campanhas-da-igreja';
import { cores, espacos, raio } from '@/theme';

// P-02 Campanhas: lista de todas as campanhas da igreja, com rascunhos
// primeiro. Só o Pastor de Governo gerencia.
export default function Campanhas() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/fila');
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [campanhas, setCampanhas] = useState<CampanhaDaIgreja[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarCampanhasDaIgreja(ficha.igreja_id)
        .then((lista) => {
          if (ativo) {
            setCampanhas(lista);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;
  const titulo = ficha.igrejas?.titulo_administrador;
  if (!ehAdministrador) {
    return (
      <Tela>
        <Texto>{t('tesouraria.campanhas.soPastor', { titulo })}</Texto>
        <Botao titulo={t('tesouraria.lancar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const periodo = (c: CampanhaDaIgreja) => {
    if (c.inicio && c.fim) return t('tesouraria.campanhas.periodo', { inicio: isoParaData(c.inicio), fim: isoParaData(c.fim) });
    if (c.inicio) return t('tesouraria.campanhas.desde', { inicio: isoParaData(c.inicio) });
    if (c.fim) return t('tesouraria.campanhas.ate', { fim: isoParaData(c.fim) });
    return null;
  };

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.campanhas.titulo')}</Texto>
      <Texto>{t('tesouraria.campanhas.explicacao')}</Texto>
      <Botao
        titulo={t('tesouraria.campanhas.nova')}
        onPress={() => router.push({ pathname: '/gerenciar-campanha/[id]', params: { id: 'nova' } })}
      />

      {falhou && <Texto variante="erro">{t('tesouraria.campanhas.falhaAoCarregar')}</Texto>}
      {!campanhas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {campanhas?.length === 0 && <Texto>{t('tesouraria.campanhas.nenhuma')}</Texto>}

      {campanhas?.map((campanha) => (
        <Pressable
          key={campanha.id}
          accessibilityRole="button"
          accessibilityHint={t('tesouraria.campanhas.abrir', { nome: campanha.nome })}
          onPress={() => router.push({ pathname: '/gerenciar-campanha/[id]', params: { id: campanha.id } })}
          style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
        >
          <Texto variante="destaque">{campanha.nome}</Texto>
          <Texto variante={campanha.status === 'rascunho' ? 'destaque' : 'apoio'}>
            {t(`tesouraria.campanhas.status.${campanha.status}`)}
          </Texto>
          {!!periodo(campanha) && <Texto variante="apoio">{periodo(campanha)}</Texto>}
          {campanha.permanente && <Texto variante="apoio">{t('tesouraria.campanhas.permanente')}</Texto>}
        </Pressable>
      ))}

      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
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
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
});
