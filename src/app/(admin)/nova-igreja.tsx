import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useAdminMaster } from '@/hooks/use-admin-master';
import { useVoltar } from '@/hooks/use-voltar';
import { emailValido, normalizarEmail } from '@/lib/membros';
import { cadastrarIgreja, type DadosDaIgrejaNova, type ErroDoAdmin } from '@/services/supabase/admin';
import { cores, espacos, raio } from '@/theme';

const INICIAL: DadosDaIgrejaNova = {
  nome: '',
  pais: 'BR',
  idioma: 'pt-BR',
  moeda: 'BRL',
  faixaPlano: '',
  tituloAdministrador: 'Pastor de Governo',
  pastorNome: '',
  pastorEmail: '',
  pastorCelular: '',
};

// A-01: igreja nova, com o mínimo. O Pastor recebe o convite por e-mail e
// completa o resto no app.
export default function NovaIgreja() {
  const { t } = useTranslation();
  const voltar = useVoltar('/igrejas');
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [dados, setDados] = useState(INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster) return null;

  const campo = (chave: keyof DadosDaIgrejaNova) => ({
    value: dados[chave],
    onChangeText: (valor: string) => setDados((atual) => ({ ...atual, [chave]: valor })),
  });
  const titulo = dados.tituloAdministrador.trim() || INICIAL.tituloAdministrador;
  const mensagemDoErro = (codigo: ErroDoAdmin) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado' ? t(`comum.erros.${codigo}`) : t(`admin.erros.${codigo}`);

  async function aoCadastrar() {
    setErro(undefined);
    setAviso(undefined);
    if (!emailValido(dados.pastorEmail)) {
      setErro(t('admin.erros.email_invalido'));
      return;
    }
    setEnviando(true);
    const email = normalizarEmail(dados.pastorEmail);
    const resultado = await cadastrarIgreja({ ...dados, pastorEmail: email });
    setEnviando(false);
    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setDados(INICIAL);
    setAviso(t('admin.nova.cadastrada', { email }));
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('admin.nova.titulo')}</Texto>
      <Texto>{t('admin.nova.explicacao', { titulo })}</Texto>

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t('admin.nova.igreja')}
        </Texto>
        <CampoTexto rotulo={t('admin.nova.nome')} {...campo('nome')} />
        <CampoTexto rotulo={t('admin.nova.pais')} autoCapitalize="characters" maxLength={2} {...campo('pais')} />
        <CampoTexto rotulo={t('admin.nova.idioma')} autoCapitalize="none" {...campo('idioma')} />
        <CampoTexto rotulo={t('admin.nova.moeda')} autoCapitalize="characters" maxLength={3} {...campo('moeda')} />
        <CampoTexto rotulo={t('admin.nova.plano')} dica={t('admin.nova.planoDica')} {...campo('faixaPlano')} />
        <CampoTexto
          rotulo={t('admin.nova.tituloAdministrador')}
          dica={t('admin.nova.tituloDica')}
          {...campo('tituloAdministrador')}
        />
      </View>

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t('admin.nova.pastor')}
        </Texto>
        <CampoTexto rotulo={t('admin.nova.pastorNome')} {...campo('pastorNome')} />
        <CampoTexto
          rotulo={t('admin.nova.pastorEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          {...campo('pastorEmail')}
        />
        <CampoTexto rotulo={t('admin.nova.pastorCelular')} keyboardType="phone-pad" {...campo('pastorCelular')} />
      </View>

      <Botao titulo={t('admin.nova.salvar')} onPress={aoCadastrar} carregando={enviando} />
      <Retorno aviso={aviso} erro={erro} />
      <Botao titulo={t('admin.voltar')} variante="secundario" onPress={() => voltar()} desabilitado={enviando} />
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
});
