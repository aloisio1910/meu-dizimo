import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { TextoDosTermos } from '@/components/texto-dos-termos';
import { Botao } from '@/components/ui/botao';
import { CaixaSelecao } from '@/components/ui/caixa-selecao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { termos } from '@/i18n/termos/pt-BR';
import { listaDeNomes } from '@/lib/novo-aceite';
import type { ErroDoAceite } from '@/services/supabase/termos';
import { sair } from '@/services/supabase/auth';
import { cores, espacos, raio } from '@/theme';

// Tela que cobre o app quando os termos mudaram (RN-041; seção 13 dos
// termos): mostra o que mudou e pede os mesmos aceites do Primeiro acesso
// (D-080, D-104). Quem não quiser aceitar pode sair ou excluir a conta.
export function NovoAceiteDosTermos({
  aceitar,
  aoExcluirConta,
}: {
  aceitar: () => Promise<ErroDoAceite | null>;
  aoExcluirConta: () => void;
}) {
  const { t } = useTranslation();
  const { fichas } = useMinhasFichas();
  const igrejas = listaDeNomes(
    fichas.filter((f) => f.status === 'ativo').map((f) => f.igrejas?.nome ?? ''),
    t('novoAceite.e'),
  );

  const [lendo, setLendo] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteSensivel, setAceiteSensivel] = useState(false);
  const [maiorDeIdade, setMaiorDeIdade] = useState(false);
  const [faltando, setFaltando] = useState<{ termos?: boolean; sensivel?: boolean; idade?: boolean }>({});
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function aoAceitar() {
    setErro(undefined);
    const falta = { termos: !aceiteTermos, sensivel: !aceiteSensivel, idade: !maiorDeIdade };
    setFaltando(falta);
    if (falta.termos || falta.sensivel || falta.idade) {
      setErro(t('primeiroAcesso.erros.revise'));
      return;
    }
    setEnviando(true);
    const resultado = await aceitar();
    setEnviando(false);
    if (resultado) setErro(t(`comum.erros.${resultado}`));
  }

  if (lendo) {
    return (
      <Tela>
        <Botao titulo={t('comum.voltar')} variante="secundario" onPress={() => setLendo(false)} />
        <TextoDosTermos igreja={igrejas || t('termos.suaIgreja')} />
        <Botao titulo={t('comum.voltar')} onPress={() => setLendo(false)} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('novoAceite.titulo')}</Texto>
      <Texto>{t('novoAceite.explicacao')}</Texto>

      <View style={estilos.cartao}>
        <Texto variante="destaque">{t('novoAceite.oQueMudou')}</Texto>
        {termos.novidades.map((novidade) => (
          <Texto key={novidade}>• {novidade}</Texto>
        ))}
        <Texto variante="apoio">{termos.atualizadoEm}</Texto>
      </View>
      <Botao titulo={t('primeiroAcesso.lerTermos')} variante="secundario" onPress={() => setLendo(true)} />

      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteTermos')}
        marcado={aceiteTermos}
        onAlterar={setAceiteTermos}
        erro={faltando.termos ? t('primeiroAcesso.erros.aceiteObrigatorio') : undefined}
      />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteSensivel', { igreja: igrejas })}
        marcado={aceiteSensivel}
        onAlterar={setAceiteSensivel}
        erro={faltando.sensivel ? t('primeiroAcesso.erros.aceiteObrigatorio') : undefined}
      />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteIdade')}
        marcado={maiorDeIdade}
        onAlterar={setMaiorDeIdade}
        erro={faltando.idade ? t('primeiroAcesso.erros.idadeObrigatoria') : undefined}
      />

      <Botao titulo={t('novoAceite.aceitar')} onPress={aoAceitar} carregando={enviando} />
      <Retorno erro={erro} />

      <Texto variante="apoio">{t('novoAceite.naoQuero')}</Texto>
      <Botao titulo={t('inicio.sair')} variante="secundario" onPress={() => sair()} desabilitado={enviando} />
      <Botao titulo={t('excluirConta.titulo')} variante="secundario" onPress={aoExcluirConta} desabilitado={enviando} />
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
