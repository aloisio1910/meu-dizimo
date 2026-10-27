import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useAdminMaster } from '@/hooks/use-admin-master';
import { listarIgrejasDaPlataforma, type IgrejaDaPlataforma } from '@/services/supabase/admin';
import { sair } from '@/services/supabase/auth';
import { cores, espacos, raio } from '@/theme';

// A-01 Igrejas (Admin Master): as igrejas da plataforma, com o Pastor de
// cada uma e quantos membros ativos. Dos membros, nada além disso.
export default function Igrejas() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [igrejas, setIgrejas] = useState<IgrejaDaPlataforma[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setIgrejas(await listarIgrejasDaPlataforma());
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ehAdminMaster) carregar();
    }, [ehAdminMaster, carregar]),
  );

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster) return null;

  return (
    <Tela larga>
      <Texto variante="apoio">{t('app.nome')}</Texto>
      <Texto variante="titulo">{t('admin.igrejas.titulo')}</Texto>
      <Texto>{t('admin.igrejas.explicacao')}</Texto>

      <View style={estilos.acoes}>
        <Botao titulo={t('admin.igrejas.cadastrar')} onPress={() => router.push('/nova-igreja')} />
        <Botao
          titulo={t('admin.igrejas.atendimento')}
          variante="secundario"
          onPress={() => router.push('/atendimento')}
        />
        <Botao titulo={t('admin.igrejas.logs')} variante="secundario" onPress={() => router.push('/logs-globais')} />
      </View>

      {falhou && <Texto variante="erro">{t('admin.igrejas.falhaAoCarregar')}</Texto>}
      {!igrejas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {igrejas?.length === 0 && <Texto>{t('admin.igrejas.nenhuma')}</Texto>}

      {igrejas?.map((igreja) => {
        const titulo = igreja.titulo_administrador;
        const pastor = igreja.pastor_nome
          ? t(igreja.pastor_status === 'convidado' ? 'admin.igrejas.pastorConvidado' : 'admin.igrejas.pastor', {
              titulo,
              nome: igreja.pastor_nome,
              email: igreja.pastor_email,
            })
          : t('admin.igrejas.semPastor', { titulo });
        return (
          <Pressable
            key={igreja.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/gerenciar-igreja/[id]', params: { id: igreja.id } })}
            style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
          >
            <View style={estilos.topo}>
              <Texto variante="destaque">{igreja.nome}</Texto>
              <Texto variante={igreja.status === 'ativa' ? 'destaque' : 'erro'}>
                {t(`admin.igrejas.${igreja.status}`)}
              </Texto>
            </View>
            <Texto>{pastor}</Texto>
            <Texto variante="apoio">
              {t('admin.igrejas.membrosAtivos', { count: igreja.membros_ativos })}
              {' · '}
              {igreja.faixa_plano
                ? t('admin.igrejas.plano', { plano: igreja.faixa_plano })
                : t('admin.igrejas.semPlano')}
              {' · '}
              {`${igreja.pais} · ${igreja.idioma} · ${igreja.moeda}`}
            </Texto>
          </Pressable>
        );
      })}

      <Botao titulo={t('admin.sair')} variante="secundario" onPress={() => sair()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  acoes: {
    gap: espacos.pequeno,
  },
  cartao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionado: {
    backgroundColor: cores.fundoPressionado,
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
});
