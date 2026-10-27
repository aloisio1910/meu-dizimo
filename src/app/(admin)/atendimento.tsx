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
import { buscarPessoa, definirPastor, type ErroDoAdmin, type PessoaEncontrada } from '@/services/supabase/admin';
import { trocarEmailDoMembro, type ErroDaTroca } from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

type Acao = { membroId: string; tipo: 'email' | 'pastor' };

// Atendimento do suporte: acha a pessoa pelo e-mail em todas as igrejas
// (cada ficha encontrada fica no log da igreja, com o motivo) para trocar o
// e-mail dela (D-097) ou torná-la o Pastor de Governo (D-068).
export default function Atendimento() {
  const { t } = useTranslation();
  const voltar = useVoltar('/igrejas');
  const { ehAdminMaster, carregando } = useAdminMaster();
  const [email, setEmail] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pessoas, setPessoas] = useState<PessoaEncontrada[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroDaBusca, setErroDaBusca] = useState<string>();
  const [acao, setAcao] = useState<Acao>();
  const [novoEmail, setNovoEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ membroId: string; aviso?: string; erro?: string }>();

  if (!carregando && !ehAdminMaster) return <Redirect href="/" />;
  if (!ehAdminMaster) return null;

  const tituloPadrao = t('admin.atendimento.perfis.administrador');
  const erroDoAdmin = (codigo: ErroDoAdmin) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado' ? t(`comum.erros.${codigo}`) : t(`admin.erros.${codigo}`);
  const erroDaTroca = (codigo: ErroDaTroca) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.membro.errosDaTroca.${codigo}`, { titulo: tituloPadrao });

  async function aoBuscar() {
    setErroDaBusca(undefined);
    setRetorno(undefined);
    setAcao(undefined);
    setBuscando(true);
    const resultado = await buscarPessoa(normalizarEmail(email), motivo);
    setBuscando(false);
    if (!resultado.ok) {
      setErroDaBusca(erroDoAdmin(resultado.erro));
      return;
    }
    setPessoas(resultado.dados);
  }

  function abrir(membroId: string, tipo: Acao['tipo']) {
    setRetorno(undefined);
    setNovoEmail('');
    setAcao({ membroId, tipo });
  }

  async function aoTrocarEmail(pessoa: PessoaEncontrada) {
    if (!emailValido(novoEmail)) {
      setRetorno({ membroId: pessoa.membro_id, erro: t('admin.erros.email_invalido') });
      return;
    }
    setEnviando(true);
    const resultado = await trocarEmailDoMembro(pessoa.membro_id, normalizarEmail(novoEmail), motivo);
    setEnviando(false);
    if (!resultado.ok) {
      setRetorno({ membroId: pessoa.membro_id, erro: erroDaTroca(resultado.erro) });
      return;
    }
    setAcao(undefined);
    setPessoas(
      (lista) =>
        lista?.map((p) => (p.email === pessoa.email ? { ...p, email: normalizarEmail(novoEmail) } : p)) ?? null,
    );
    setRetorno({ membroId: pessoa.membro_id, aviso: t('admin.atendimento.emailTrocado') });
  }

  async function aoTornarPastor(pessoa: PessoaEncontrada) {
    setEnviando(true);
    const resultado = await definirPastor(pessoa.membro_id, motivo);
    setEnviando(false);
    if (!resultado.ok) {
      setRetorno({ membroId: pessoa.membro_id, erro: erroDoAdmin(resultado.erro) });
      return;
    }
    setAcao(undefined);
    setPessoas(
      (lista) => lista?.map((p) => (p.membro_id === pessoa.membro_id ? { ...p, perfil: 'administrador' } : p)) ?? null,
    );
    setRetorno({
      membroId: pessoa.membro_id,
      aviso: t('admin.atendimento.pastorDefinido', {
        nome: pessoa.nome,
        titulo: tituloPadrao,
        igreja: pessoa.igreja_nome,
      }),
    });
  }

  const emVariasIgrejas = (pessoas?.length ?? 0) > 1;

  return (
    <Tela>
      <Texto variante="titulo">{t('admin.atendimento.titulo')}</Texto>
      <Texto>{t('admin.atendimento.explicacao', { titulo: tituloPadrao })}</Texto>

      <CampoTexto
        rotulo={t('admin.atendimento.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <CampoTexto
        rotulo={t('admin.atendimento.motivo')}
        dica={t('admin.atendimento.motivoDica')}
        value={motivo}
        onChangeText={setMotivo}
      />
      <Botao titulo={t('admin.atendimento.buscar')} onPress={aoBuscar} carregando={buscando} />
      <Retorno erro={erroDaBusca} />

      {pessoas?.length === 0 && <Texto>{t('admin.atendimento.nenhuma')}</Texto>}
      {emVariasIgrejas && <Texto variante="destaque">{t('admin.atendimento.emVariasIgrejas')}</Texto>}

      {pessoas?.map((pessoa) => {
        const aberta = acao?.membroId === pessoa.membro_id ? acao.tipo : undefined;
        const podeSerPastor = pessoa.status === 'ativo' && pessoa.perfil !== 'administrador';
        const meuRetorno = retorno?.membroId === pessoa.membro_id ? retorno : undefined;
        return (
          <View key={pessoa.membro_id} style={estilos.cartao}>
            <Texto variante="destaque">{pessoa.nome}</Texto>
            <Texto>{pessoa.igreja_nome}</Texto>
            <Texto variante="apoio">
              {t(`admin.atendimento.perfis.${pessoa.perfil}`)}
              {' · '}
              {t(`admin.atendimento.situacoes.${pessoa.status}`)}
              {' · '}
              {pessoa.email}
            </Texto>

            {pessoa.status !== 'inativo' && !aberta && (
              <Botao
                titulo={t('admin.atendimento.trocarEmail')}
                variante="secundario"
                onPress={() => abrir(pessoa.membro_id, 'email')}
              />
            )}
            {podeSerPastor && !aberta && (
              <Botao
                titulo={t('admin.atendimento.tornarPastor', { titulo: tituloPadrao })}
                variante="secundario"
                onPress={() => abrir(pessoa.membro_id, 'pastor')}
              />
            )}

            {aberta === 'email' && (
              <>
                <CampoTexto
                  rotulo={t('admin.atendimento.novoEmail')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={novoEmail}
                  onChangeText={setNovoEmail}
                />
                <Botao
                  titulo={t('admin.atendimento.salvarEmail')}
                  onPress={() => aoTrocarEmail(pessoa)}
                  carregando={enviando}
                />
              </>
            )}
            {aberta === 'pastor' && (
              <>
                <Texto variante="destaque">
                  {t('admin.atendimento.confirmarPastor', {
                    nome: pessoa.nome,
                    titulo: tituloPadrao,
                    igreja: pessoa.igreja_nome,
                  })}
                </Texto>
                <Botao
                  titulo={t('admin.atendimento.simPastor', { titulo: tituloPadrao })}
                  onPress={() => aoTornarPastor(pessoa)}
                  carregando={enviando}
                />
              </>
            )}
            {!!aberta && (
              <Botao
                titulo={t('admin.igreja.naoVoltar')}
                variante="secundario"
                onPress={() => setAcao(undefined)}
                desabilitado={enviando}
              />
            )}
            <Retorno aviso={meuRetorno?.aviso} erro={meuRetorno?.erro} />
          </View>
        );
      })}

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
