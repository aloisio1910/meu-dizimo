import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Paginacao } from '@/components/paginacao';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useAdminMaster } from '@/hooks/use-admin-master';
import { useVoltar } from '@/hooks/use-voltar';
import { partesDaDataHora } from '@/lib/data';
import { descreverRegistroGlobal } from '@/lib/logs-globais';
import { listarLogsGlobais, TAMANHO_DA_PAGINA_GLOBAL, type RegistroGlobal } from '@/services/supabase/admin';
import { cores, espacos, raio } from '@/theme';

// A-02 Logs globais: o que o suporte fez nas igrejas (cadastros, trocas de
// Pastor e de e-mail, buscas do atendimento), com páginas.
export default function LogsGlobais() {
  const { t } = useTranslation();
  const voltar = useVoltar('/igrejas');
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState<{ registros: RegistroGlobal[]; total: number } | null>(null);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async (qual: number) => {
    try {
      setDados(await listarLogsGlobais(qual));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ehAdminMaster) carregar(pagina);
    }, [ehAdminMaster, carregar, pagina]),
  );

  function mudarDePagina(nova: number) {
    setDados(null);
    setPagina(nova);
  }

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster) return null;

  return (
    <Tela larga>
      <Texto variante="titulo">{t('admin.logs.titulo')}</Texto>
      <Texto>{t('admin.logs.explicacao')}</Texto>

      {falhou && <Texto variante="erro">{t('admin.logs.falhaAoCarregar')}</Texto>}
      {!dados && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {dados?.registros.length === 0 && <Texto>{t('admin.logs.nenhum')}</Texto>}

      {dados?.registros.map((registro) => {
        const { codigo, valores } = descreverRegistroGlobal(registro);
        return (
          <View key={registro.id} style={estilos.cartao}>
            <Texto variante="apoio">
              {t('admin.logs.quando', partesDaDataHora(registro.criado_em, 'pt-BR'))}
              {registro.igreja_nome ? ` · ${registro.igreja_nome}` : ''}
            </Texto>
            <Texto>{t(`admin.logs.acoes.${codigo}`, { ...valores })}</Texto>
            {!!registro.motivo && <Texto variante="apoio">{t('admin.logs.motivo', { motivo: registro.motivo })}</Texto>}
          </View>
        );
      })}

      {!!dados && dados.total > 0 && (
        <Paginacao
          pagina={pagina}
          totalDeRegistros={dados.total}
          tamanhoDaPagina={TAMANHO_DA_PAGINA_GLOBAL}
          aoMudar={mudarDePagina}
        />
      )}

      <Botao titulo={t('admin.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
});
