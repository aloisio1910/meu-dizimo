import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useSessao } from '@/hooks/use-sessao';
import { emailValido, normalizarEmail } from '@/lib/email';
import { entrarComCodigo, pedirCodigo, type ErroDeAcesso } from '@/services/supabase/auth';

const TAMANHO_DO_CODIGO = 6;

// M-01 Entrar: e-mail -> código de 6 números por e-mail -> dentro do app.
// A entrada por digital (D-058) entra numa etapa própria.
export default function Entrar() {
  const { t } = useTranslation();
  const { sessao } = useSessao();

  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  if (sessao) return <Redirect href="/" />;

  function mensagemDoErro(codigoDoErro: ErroDeAcesso): string {
    if (codigoDoErro === 'sem_conexao' || codigoDoErro === 'erro_inesperado') {
      return t(`comum.erros.${codigoDoErro}`);
    }
    return t(`entrar.erros.${codigoDoErro}`);
  }

  async function enviarCodigo(reenvio = false) {
    setErro(undefined);
    setAviso(undefined);
    if (!emailValido(email)) {
      setErro(t('entrar.erros.emailInvalido'));
      return;
    }

    setCarregando(true);
    const resultado = await pedirCodigo(email);
    setCarregando(false);

    if (!resultado.ok) {
      setErro(mensagemDoErro(resultado.erro));
      return;
    }
    setEmail(normalizarEmail(email));
    setCodigo('');
    setEtapa('codigo');
    if (reenvio) setAviso(t('entrar.codigoReenviado'));
  }

  async function confirmarCodigo() {
    setErro(undefined);
    setAviso(undefined);
    if (codigo.length !== TAMANHO_DO_CODIGO) {
      setErro(t('entrar.erros.codigoIncompleto'));
      return;
    }

    setCarregando(true);
    const resultado = await entrarComCodigo(email, codigo);
    setCarregando(false);

    // Com sucesso, a sessão muda e esta tela redireciona sozinha.
    if (!resultado.ok) setErro(mensagemDoErro(resultado.erro));
  }

  function voltarParaEmail() {
    setEtapa('email');
    setCodigo('');
    setErro(undefined);
    setAviso(undefined);
  }

  if (etapa === 'email') {
    return (
      <Tela>
        <Texto variante="titulo">{t('entrar.titulo')}</Texto>
        <Texto>{t('entrar.explicacao')}</Texto>
        <CampoTexto
          rotulo={t('entrar.rotuloEmail')}
          value={email}
          onChangeText={setEmail}
          erro={erro}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => enviarCodigo()}
        />
        <Botao titulo={t('entrar.enviarCodigo')} onPress={() => enviarCodigo()} carregando={carregando} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('entrar.tituloCodigo')}</Texto>
      <Texto>{t('entrar.explicacaoCodigo', { email })}</Texto>
      <CampoTexto
        rotulo={t('entrar.rotuloCodigo')}
        value={codigo}
        onChangeText={(texto) => setCodigo(texto.replace(/\D/g, '').slice(0, TAMANHO_DO_CODIGO))}
        erro={erro}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={TAMANHO_DO_CODIGO}
        returnKeyType="done"
        onSubmitEditing={confirmarCodigo}
      />
      {!!aviso && <Texto accessibilityLiveRegion="polite">{aviso}</Texto>}
      <Botao titulo={t('entrar.confirmar')} onPress={confirmarCodigo} carregando={carregando} />
      <Botao
        titulo={t('entrar.reenviar')}
        variante="secundario"
        onPress={() => enviarCodigo(true)}
        desabilitado={carregando}
      />
      <Botao titulo={t('entrar.trocarEmail')} variante="secundario" onPress={voltarParaEmail} desabilitado={carregando} />
    </Tela>
  );
}
