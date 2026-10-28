import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { CamposDoCadastro } from '@/components/campos-do-cadastro';
import { Botao } from '@/components/ui/botao';
import { CaixaSelecao } from '@/components/ui/caixa-selecao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFormularioDoCadastro } from '@/hooks/use-formulario-do-cadastro';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { versaoDosTermos } from '@/i18n/termos/pt-BR';
import { concluirCadastro, type MinhaFicha } from '@/services/supabase/membros';

// M-02 Primeiro acesso: confere os dados, completa os campos da igreja,
// escolhe dízimo individual ou familiar e aceita os termos (passo 4).
export default function PrimeiroAcesso() {
  const { sessao } = useSessao();
  const { fichas, recarregar } = useMinhasFichas();
  const ficha = fichas.find((f) => f.status === 'convidado');

  if (!sessao) return <Redirect href="/entrar" />;
  // Concluído o cadastro, a ficha fica ativa e a pessoa segue para o início.
  if (!ficha) return <Redirect href="/" />;

  return <Formulario key={ficha.id} ficha={ficha} aoConcluir={recarregar} />;
}

function Formulario({ ficha, aoConcluir }: { ficha: MinhaFicha; aoConcluir: () => Promise<void> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const formulario = useFormularioDoCadastro(ficha);
  const nomeDaIgreja = ficha.igrejas?.nome ?? t('termos.suaIgreja');

  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteSensivel, setAceiteSensivel] = useState(false);
  const [maiorDeIdade, setMaiorDeIdade] = useState(false);
  const [errosDosAceites, setErrosDosAceites] = useState<{ termos?: boolean; sensivel?: boolean; idade?: boolean }>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function concluir() {
    setErroGeral(undefined);
    const dados = formulario.validar();
    // Os aceites são obrigatórios e separados (LGPD, D-080), e o app é só
    // para maiores de 18 anos (D-104).
    const faltaAceite = { termos: !aceiteTermos, sensivel: !aceiteSensivel, idade: !maiorDeIdade };
    setErrosDosAceites(faltaAceite);
    if (!dados || faltaAceite.termos || faltaAceite.sensivel || faltaAceite.idade) {
      setErroGeral(t('primeiroAcesso.erros.revise'));
      return;
    }

    setEnviando(true);
    const erro = await concluirCadastro({ membroId: ficha.id, ...dados, versaoDosTermos, declarouMaioridade: true });
    if (!erro) {
      await aoConcluir();
      return;
    }
    setEnviando(false);

    if (formulario.mostrarErroDoBanco(erro)) setErroGeral(t('primeiroAcesso.erros.revise'));
    else if (erro.codigo === 'cadastro_indisponivel') setErroGeral(t('primeiroAcesso.erros.cadastro_indisponivel'));
    else if (erro.codigo === 'sem_conexao' || erro.codigo === 'erro_inesperado')
      setErroGeral(t(`comum.erros.${erro.codigo}`));
  }

  if (formulario.falhaNosCampos) {
    return (
      <Tela>
        <Texto>{t('comum.erros.erro_inesperado')}</Texto>
        <Botao titulo={t('comum.tentarDeNovo')} onPress={formulario.carregarCampos} />
      </Tela>
    );
  }

  if (!formulario.campos) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('primeiroAcesso.titulo')}</Texto>
      <Texto variante="destaque">{nomeDaIgreja}</Texto>
      <Texto>{t('primeiroAcesso.explicacao')}</Texto>

      <Texto variante="destaque">{t('primeiroAcesso.secaoDados')}</Texto>
      <CamposDoCadastro formulario={formulario} />

      <Texto variante="destaque">{t('primeiroAcesso.secaoTermos')}</Texto>
      <Texto>{t('primeiroAcesso.explicacaoTermos')}</Texto>
      <Botao titulo={t('primeiroAcesso.lerTermos')} variante="secundario" onPress={() => router.push('/termos')} />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteTermos')}
        marcado={aceiteTermos}
        onAlterar={setAceiteTermos}
        erro={errosDosAceites.termos ? t('primeiroAcesso.erros.aceiteObrigatorio') : undefined}
      />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteSensivel', { igreja: nomeDaIgreja })}
        marcado={aceiteSensivel}
        onAlterar={setAceiteSensivel}
        erro={errosDosAceites.sensivel ? t('primeiroAcesso.erros.aceiteObrigatorio') : undefined}
      />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteIdade')}
        marcado={maiorDeIdade}
        onAlterar={setMaiorDeIdade}
        erro={errosDosAceites.idade ? t('primeiroAcesso.erros.idadeObrigatoria') : undefined}
      />

      {!!erroGeral && (
        <Texto variante="erro" accessibilityLiveRegion="assertive">
          {erroGeral}
        </Texto>
      )}
      <Botao titulo={t('primeiroAcesso.concluir')} onPress={concluir} carregando={enviando} />
    </Tela>
  );
}
