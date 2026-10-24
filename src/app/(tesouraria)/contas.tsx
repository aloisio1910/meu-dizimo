import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { LIMITE_DE_CONTAS } from '@/lib/conta';
import { listarTodasAsContas, type ContaCompleta } from '@/services/supabase/contas-da-igreja';
import { cores, espacos, raio } from '@/theme';

// P-03 Contas e Pix: as contas da igreja, a principal no topo.
export default function Contas() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [contas, setContas] = useState<ContaCompleta[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ficha) return;
      let ativo = true;
      listarTodasAsContas(ficha.igreja_id)
        .then((lista) => {
          if (ativo) {
            setContas(lista);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
      return () => {
        ativo = false;
      };
    }, [ficha]),
  );

  if (!carregando && (!ficha || !ehAdministrador)) return <Redirect href="/" />;
  if (!ficha) return null;

  const ativas = contas?.filter((c) => c.ativa).length ?? 0;
  const noLimite = ativas >= LIMITE_DE_CONTAS;

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.contas.titulo')}</Texto>
      <Texto>{t('tesouraria.contas.explicacao')}</Texto>

      {!!contas &&
        (noLimite ? (
          <Texto variante="apoio">{t('tesouraria.contas.limite')}</Texto>
        ) : (
          <Botao
            titulo={t('tesouraria.contas.nova')}
            onPress={() => router.push({ pathname: '/gerenciar-conta/[id]', params: { id: 'nova' } })}
          />
        ))}

      {falhou && <Texto variante="erro">{t('tesouraria.contas.falhaAoCarregar')}</Texto>}
      {!contas && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {contas?.length === 0 && <Texto>{t('tesouraria.contas.nenhuma')}</Texto>}

      {contas?.map((conta) => (
        <Pressable
          key={conta.id}
          accessibilityRole="button"
          accessibilityHint={t('tesouraria.contas.abrir', { nome: conta.nome })}
          onPress={() => router.push({ pathname: '/gerenciar-conta/[id]', params: { id: conta.id } })}
          style={({ pressed }) => [estilos.linha, !conta.ativa && estilos.desativada, pressed && estilos.pressionada]}
        >
          <Texto variante="destaque">{conta.nome}</Texto>
          {conta.principal && <Texto variante="destaque">{t('tesouraria.contas.principal')}</Texto>}
          {!conta.ativa && <Texto variante="apoio">{t('tesouraria.contas.desativada')}</Texto>}
          {conta.chave_pix && conta.tipo_chave_pix ? (
            <Texto>
              {t('tesouraria.contas.chave', {
                tipo: t(`tesouraria.contas.tipos.${conta.tipo_chave_pix}`),
                chave: conta.chave_pix,
              })}
            </Texto>
          ) : (
            <Texto variante="erro">{t('tesouraria.contas.semPix')}</Texto>
          )}
          {!!conta.banco && (
            <Texto variante="apoio">
              {t('tesouraria.contas.dadosBancarios', {
                banco: conta.banco,
                agencia: conta.agencia ?? '-',
                conta: conta.numero_conta ?? '-',
              })}
            </Texto>
          )}
        </Pressable>
      ))}

      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => router.back()} />
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
  desativada: {
    borderStyle: 'dashed',
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
});
