import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { avisosForamLidos } from '@/hooks/use-avisos-nao-lidos';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useSessao } from '@/hooks/use-sessao';
import { useTema } from '@/hooks/use-tema';
import { destinoDoAviso, valoresDoAviso, type Aviso } from '@/lib/avisos';
import { partesDaDataHora } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { listarAvisos, marcarAvisosComoLidos } from '@/services/supabase/avisos';
import { cores, espacos, raio } from '@/theme';

// Avisos (D-096): a lista do sino. Os não lidos ficam em destaque; tocar
// marca como lido e abre a tela do aviso.
export default function Avisos() {
  const { t } = useTranslation();
  const router = useRouter();
  const tema = useTema();
  const { sessao } = useSessao();
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const usuarioId = sessao?.user.id;
  const igrejaId = ficha?.igreja_id;
  const carregar = useCallback(async () => {
    if (!usuarioId || !igrejaId) return;
    try {
      setAvisos(await listarAvisos(usuarioId, igrejaId));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [usuarioId, igrejaId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const naoLidos = avisos?.filter((a) => !a.lida_em) ?? [];

  const textoDo = (aviso: Aviso) => {
    const valores = valoresDoAviso(aviso, (centavos, moeda) => formatarMoeda(centavos, moeda, idioma));
    return t(`avisos.textos.${aviso.tipo}`, {
      ...valores,
      tipo: t(`log.tipos.${valores.tipo === 'oferta' ? 'oferta' : 'dizimo'}`),
      quem: valores.quem || t('avisos.naTesouraria'),
      titulo: ficha.igrejas?.titulo_administrador,
    });
  };

  async function aoTocar(aviso: Aviso) {
    if (!aviso.lida_em) {
      await marcarAvisosComoLidos([aviso.id]).catch(() => {});
      avisosForamLidos();
    }
    const destino = destinoDoAviso(aviso, ehAdministrador);
    if (destino) router.push(destino);
    else carregar();
  }

  async function aoMarcarTodos() {
    setMarcando(true);
    await marcarAvisosComoLidos().catch(() => {});
    avisosForamLidos();
    await carregar();
    setMarcando(false);
  }

  return (
    <Tela>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('avisos.titulo')}</Texto>
      <Texto>{t('avisos.explicacao')}</Texto>

      {falhou && <Texto variante="erro">{t('avisos.falhaAoCarregar')}</Texto>}
      {!avisos && !falhou && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {avisos?.length === 0 && <Texto>{t('avisos.nenhum')}</Texto>}
      {naoLidos.length > 0 && (
        <Botao titulo={t('avisos.marcarTodos')} variante="secundario" onPress={aoMarcarTodos} carregando={marcando} />
      )}

      {avisos?.map((aviso) => {
        const novo = !aviso.lida_em;
        return (
          <Pressable
            key={aviso.id}
            accessibilityRole="button"
            onPress={() => aoTocar(aviso)}
            style={({ pressed }) => [
              estilos.aviso,
              novo && { borderColor: tema.corPrincipal, borderWidth: 2 },
              pressed && estilos.pressionado,
            ]}
          >
            <View style={estilos.topo}>
              {novo && (
                <Texto variante="destaque" style={{ color: tema.corPrincipal }}>
                  {t('avisos.novo')}
                </Texto>
              )}
              <Texto variante="apoio">{t('avisos.quando', partesDaDataHora(aviso.criado_em, idioma))}</Texto>
            </View>
            <Texto variante={novo ? 'destaque' : undefined}>{textoDo(aviso)}</Texto>
          </Pressable>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  aviso: {
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
    flexWrap: 'wrap',
    gap: espacos.pequeno,
  },
});
