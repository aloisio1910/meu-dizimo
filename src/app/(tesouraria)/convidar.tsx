import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { partesDaDataHora } from '@/lib/data';
import { validarConvite, type DadosDoConvite, type ErrosDoConvite } from '@/lib/membros';
import { convidarMembro } from '@/services/supabase/membros-da-igreja';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// Convidar (passo 1 do fluxo principal): nome, e-mail e celular. O banco
// recusa e-mail já cadastrado na igreja (RN-028). Com ?perfil=tesoureiro,
// o Pastor de Governo convida já como tesoureiro (P-01).
export default function Convidar() {
  const { t } = useTranslation();
  const router = useRouter();
  const { perfil: perfilPedido } = useLocalSearchParams<{ perfil?: string }>();
  const { ficha, carregando, ehTesouraria, ehAdministrador } = useFichaAtiva();
  const comoTesoureiro = perfilPedido === 'tesoureiro' && ehAdministrador;

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [erros, setErros] = useState<ErrosDoConvite>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [convidado, setConvidado] = useState<DadosDoConvite & { validoAte: string }>();

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha) return null;

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';

  async function aoConvidar() {
    const resultado = validarConvite({ nome, email, celular });
    setErros(resultado.ok ? {} : resultado.erros);
    setErroGeral(undefined);
    if (!resultado.ok) return;
    setEnviando(true);
    const resposta = await convidarMembro(ficha!.igreja_id, resultado.dados, comoTesoureiro ? 'tesoureiro' : 'membro');
    setEnviando(false);
    if (!resposta.ok) {
      setErroGeral(
        resposta.erro === 'sem_conexao' || resposta.erro === 'erro_inesperado'
          ? t(`comum.erros.${resposta.erro}`)
          : t(`tesouraria.membros.erros.${resposta.erro}`, { titulo: ficha!.igrejas?.titulo_administrador }),
      );
      return;
    }
    // O banco dá 7 dias a partir de agora; a data aqui é só para avisar.
    setConvidado({ ...resultado.dados, validoAte: new Date(Date.now() + SETE_DIAS_MS).toISOString() });
  }

  function convidarOutra() {
    setNome('');
    setEmail('');
    setCelular('');
    setConvidado(undefined);
  }

  if (convidado) {
    return (
      <Tela>
        <Texto variante="titulo">{t('tesouraria.convidar.criado')}</Texto>
        <Texto>
          {t('tesouraria.convidar.criadoDetalhe', {
            nome: convidado.nome,
            email: convidado.email,
            data: partesDaDataHora(convidado.validoAte, idioma).dia,
          })}
        </Texto>
        <Botao titulo={t('tesouraria.convidar.outro')} onPress={convidarOutra} />
        <Botao titulo={t('tesouraria.convidar.verLista')} variante="secundario" onPress={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="titulo">
        {comoTesoureiro ? t('tesouraria.convidar.tituloTesoureiro') : t('tesouraria.convidar.titulo')}
      </Texto>
      <Texto>{t('tesouraria.convidar.explicacao')}</Texto>
      {comoTesoureiro && <Texto variante="destaque">{t('tesouraria.convidar.avisoTesoureiro')}</Texto>}
      <CampoTexto
        rotulo={t('tesouraria.convidar.nome')}
        value={nome}
        onChangeText={setNome}
        autoCapitalize="words"
        erro={erros.nome && t(`tesouraria.convidar.erros.${erros.nome}`)}
      />
      <CampoTexto
        rotulo={t('tesouraria.convidar.email')}
        dica={t('tesouraria.convidar.dicaEmail')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        erro={erros.email && t(`tesouraria.convidar.erros.${erros.email}`)}
      />
      <CampoTexto
        rotulo={t('tesouraria.convidar.celular')}
        value={celular}
        onChangeText={setCelular}
        keyboardType="phone-pad"
        erro={erros.celular && t(`tesouraria.convidar.erros.${erros.celular}`)}
      />
      {!!erroGeral && <Texto variante="erro">{erroGeral}</Texto>}
      <Botao titulo={t('tesouraria.convidar.enviar')} onPress={aoConvidar} carregando={enviando} />
      <Botao titulo={t('tesouraria.convidar.cancelar')} variante="secundario" onPress={() => router.back()} desabilitado={enviando} />
    </Tela>
  );
}
