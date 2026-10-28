import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useAdminMaster } from '@/hooks/use-admin-master';
import { useVoltar } from '@/hooks/use-voltar';
import { partesDaDataHora } from '@/lib/data';
import {
  enviarAvisoDaPlataforma,
  listarAvisosDaPlataforma,
  listarIgrejasDaPlataforma,
  previaDoAvisoDaPlataforma,
  type AvisoDaPlataforma,
  type IgrejaDaPlataforma,
} from '@/services/supabase/admin';
import { cores, espacos, raio } from '@/theme';

const TODAS = '__todas__';
const LIMITE_DE_LETRAS = 500;

// Avisos da plataforma (D-102): o Admin Master avisa os usuários (ex.:
// manutenção programada), em todas as igrejas ou numa só. Sem limite e sem
// opção de desligar; fica nos Logs globais.
export default function AvisosDaPlataforma() {
  const { t } = useTranslation();
  const voltar = useVoltar('/igrejas');
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [texto, setTexto] = useState('');
  const [onde, setOnde] = useState(TODAS);
  const [igrejas, setIgrejas] = useState<IgrejaDaPlataforma[]>([]);
  const [enviados, setEnviados] = useState<AvisoDaPlataforma[] | null>(null);
  const [quantos, setQuantos] = useState<number>();
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  const carregar = useCallback(async () => {
    const [lista, avisos] = await Promise.all([
      listarIgrejasDaPlataforma().catch(() => []),
      listarAvisosDaPlataforma().catch(() => []),
    ]);
    setIgrejas(lista.filter((i) => i.status === 'ativa'));
    setEnviados(avisos);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ehAdminMaster) carregar();
    }, [ehAdminMaster, carregar]),
  );

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster) return null;

  const igrejaId = onde === TODAS ? undefined : onde;

  function mudar(acao: () => void) {
    acao();
    setQuantos(undefined);
    setRetorno(undefined);
  }

  async function aoVerPrevia() {
    setRetorno(undefined);
    if (texto.trim().length < 3) {
      setRetorno({ erro: t('admin.erros.texto_invalido') });
      return;
    }
    setOcupado(true);
    try {
      setQuantos(await previaDoAvisoDaPlataforma(igrejaId));
    } catch {
      setRetorno({ erro: t('comum.erros.erro_inesperado') });
    }
    setOcupado(false);
  }

  async function aoEnviar() {
    setOcupado(true);
    const resultado = await enviarAvisoDaPlataforma(texto.trim(), igrejaId);
    setOcupado(false);
    if (!resultado.ok) {
      setRetorno({
        erro:
          resultado.erro === 'sem_conexao' || resultado.erro === 'erro_inesperado'
            ? t(`comum.erros.${resultado.erro}`)
            : t(`admin.erros.${resultado.erro}`),
      });
      return;
    }
    const enviadosAgora = (resultado.dados as { destinatarios: number }).destinatarios;
    setTexto('');
    setQuantos(undefined);
    setRetorno({ aviso: t('admin.avisos.enviado', { count: enviadosAgora }) });
    await carregar();
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('admin.avisos.titulo')}</Texto>
      <Texto>{t('admin.avisos.explicacao')}</Texto>

      <View style={estilos.cartao}>
        <CampoTexto
          rotulo={t('admin.avisos.texto')}
          dica={t('admin.avisos.textoDica')}
          value={texto}
          onChangeText={(novo) => mudar(() => setTexto(novo))}
          multiline
          maxLength={LIMITE_DE_LETRAS}
        />
        <Opcoes
          rotulo={t('admin.avisos.paraQuem')}
          opcoes={[
            { valor: TODAS, rotulo: t('admin.avisos.todas') },
            ...igrejas.map((i) => ({ valor: i.id, rotulo: i.nome })),
          ]}
          selecionada={onde}
          onSelecionar={(valor) => mudar(() => setOnde(valor))}
        />
        {quantos === undefined ? (
          <Botao titulo={t('admin.avisos.verPrevia')} onPress={aoVerPrevia} carregando={ocupado} />
        ) : (
          <>
            <View style={estilos.previa}>
              <Texto variante="destaque">{t('app.nome')}</Texto>
              <Texto>{texto.trim()}</Texto>
            </View>
            <Texto variante={quantos === 0 ? 'erro' : 'destaque'}>
              {t('admin.avisos.vaiPara', { count: quantos })}
            </Texto>
            <Botao
              titulo={t('admin.avisos.enviar')}
              onPress={aoEnviar}
              carregando={ocupado}
              desabilitado={quantos === 0}
            />
            <Botao
              titulo={t('admin.avisos.editar')}
              variante="secundario"
              onPress={() => setQuantos(undefined)}
              desabilitado={ocupado}
            />
          </>
        )}
        <Retorno aviso={retorno?.aviso} erro={retorno?.erro} />
      </View>

      <Texto variante="destaque" accessibilityRole="header">
        {t('admin.avisos.enviados')}
      </Texto>
      {!enviados && <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />}
      {enviados?.length === 0 && <Texto>{t('admin.avisos.nenhum')}</Texto>}
      {enviados?.map((aviso) => (
        <View key={aviso.id} style={estilos.cartao}>
          <Texto variante="apoio">
            {t('admin.avisos.linha', {
              dia: partesDaDataHora(aviso.criado_em, 'pt-BR').dia,
              onde: aviso.igreja_nome ?? t('admin.avisos.todas'),
              count: aviso.destinatarios,
            })}
          </Texto>
          <Texto>{aviso.texto}</Texto>
        </View>
      ))}

      <Botao titulo={t('admin.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.medio,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  previa: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderRadius: raio,
    backgroundColor: cores.fundoPressionado,
  },
});
