import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { CamposDoCadastro } from '@/components/campos-do-cadastro';
import { InformacoesDaTesouraria } from '@/components/informacoes-da-tesouraria';
import { PreferenciasDeAvisos } from '@/components/preferencias-de-avisos';
import { TrocarDeIgreja } from '@/components/trocar-de-igreja';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useBloqueio } from '@/hooks/use-bloqueio';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useFormularioDoCadastro } from '@/hooks/use-formulario-do-cadastro';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { familiaresIniciais } from '@/lib/cadastro';
import { sair } from '@/services/supabase/auth';
import { salvarMeuCadastro, type MinhaFicha } from '@/services/supabase/membros';
import { cores, espacos, raio } from '@/theme';

// M-10 Meu perfil: dados (RN-009), entrada pela digital, termos e sair.
export default function Perfil() {
  const { ficha } = useFichaAtiva();
  if (!ficha) return null;
  // A chave remonta o formulário quando os dados salvos voltam do banco.
  return <ConteudoDoPerfil key={`${ficha.id}-${ficha.nome}-${ficha.celular}`} ficha={ficha} />;
}

function ConteudoDoPerfil({ ficha }: { ficha: MinhaFicha }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { recarregar } = useMinhasFichas();
  const { disponivel, preferencia, ativar, recusar } = useBloqueio();
  const formulario = useFormularioDoCadastro(ficha);

  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [mudandoDigital, setMudandoDigital] = useState(false);

  const familiares = familiaresIniciais(ficha.familiares);
  const ehCelular = Platform.OS !== 'web';

  async function salvar() {
    setErro(undefined);
    setAviso(undefined);
    const dados = formulario.validar();
    if (!dados) {
      setErro(t('primeiroAcesso.erros.revise'));
      return;
    }
    setEnviando(true);
    const falha = await salvarMeuCadastro(ficha.id, dados);
    setEnviando(false);
    if (falha) {
      if (formulario.mostrarErroDoBanco(falha)) setErro(t('primeiroAcesso.erros.revise'));
      else if (falha.codigo === 'sem_conexao' || falha.codigo === 'erro_inesperado')
        setErro(t(`comum.erros.${falha.codigo}`));
      return;
    }
    setEditando(false);
    setAviso(t('perfil.salvo'));
    await recarregar();
  }

  async function alternarDigital() {
    setMudandoDigital(true);
    if (preferencia === 'ativada') await recusar();
    else await ativar();
    setMudandoDigital(false);
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('perfil.titulo')}</Texto>
      <Texto variante="destaque">{ficha.nome}</Texto>
      <Texto>{t('perfil.dizimista', { numero: ficha.numero, igreja: ficha.igrejas?.nome ?? '' })}</Texto>
      <TrocarDeIgreja />

      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}

      <Texto variante="destaque" accessibilityRole="header">
        {t('perfil.seusDados')}
      </Texto>
      {editando ? (
        !formulario.campos ? (
          <ActivityIndicator accessibilityLabel={t('comum.carregando')} />
        ) : (
          <>
            <CamposDoCadastro formulario={formulario} />
            {!!erro && <Texto variante="erro">{erro}</Texto>}
            <Botao titulo={t('perfil.salvar')} onPress={salvar} carregando={enviando} />
            <Botao
              titulo={t('perfil.cancelarEdicao')}
              variante="secundario"
              onPress={() => setEditando(false)}
              desabilitado={enviando}
            />
          </>
        )
      ) : (
        <View style={estilos.cartao}>
          <Texto>{t('perfil.email', { email: ficha.email })}</Texto>
          <Texto variante="apoio">{t('perfil.emailEmBreve')}</Texto>
          <Texto>
            {t('primeiroAcesso.rotuloCelular')}: {ficha.celular}
          </Texto>
          <Texto>
            {t('perfil.dizimo', {
              tipo: t(ficha.tipo_dizimo === 'familiar' ? 'primeiroAcesso.familiar' : 'primeiroAcesso.individual'),
            })}
          </Texto>
          {familiares.length > 0 && <Texto>{t('perfil.familiares', { nomes: familiares.join(', ') })}</Texto>}
          <Botao
            titulo={t('perfil.editar')}
            variante="secundario"
            onPress={() => {
              setAviso(undefined);
              setEditando(true);
            }}
          />
        </View>
      )}

      {!editando && <InformacoesDaTesouraria ficha={ficha} />}
      {!editando && (
        <PreferenciasDeAvisos
          ficha={ficha}
          ehTesouraria={ficha.perfil === 'tesoureiro' || ficha.perfil === 'administrador'}
        />
      )}

      {ehCelular && (
        <View style={estilos.cartao}>
          <Texto variante="destaque">{t('perfil.digital')}</Texto>
          {!disponivel ? (
            <Texto>{t('perfil.digitalIndisponivel')}</Texto>
          ) : (
            <>
              <Texto>{t(preferencia === 'ativada' ? 'perfil.digitalAtivada' : 'perfil.digitalDesativada')}</Texto>
              <Botao
                titulo={t(preferencia === 'ativada' ? 'perfil.desativarDigital' : 'perfil.ativarDigital')}
                variante="secundario"
                onPress={alternarDigital}
                carregando={mudandoDigital}
              />
            </>
          )}
        </View>
      )}

      <View style={estilos.cartao}>
        <Texto variante="destaque">{t('perfil.termos')}</Texto>
        <Botao titulo={t('perfil.lerTermos')} variante="secundario" onPress={() => router.push('/termos')} />
      </View>

      {/* Sair esquece a digital neste aparelho (D-078): pede confirmação. */}
      {confirmandoSaida ? (
        <View style={estilos.cartao}>
          <Texto variante="destaque">{t('perfil.confirmarSaida')}</Texto>
          <Botao titulo={t('perfil.simSair')} onPress={() => sair()} />
          <Botao titulo={t('perfil.naoSair')} variante="secundario" onPress={() => setConfirmandoSaida(false)} />
        </View>
      ) : (
        <Botao titulo={t('perfil.sair')} variante="secundario" onPress={() => setConfirmandoSaida(true)} />
      )}
      {/* Exigido pela Apple e pela Google: excluir a conta pelo próprio app. */}
      <Botao titulo={t('perfil.excluirConta')} variante="secundario" onPress={() => router.push('/excluir-conta')} />
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
