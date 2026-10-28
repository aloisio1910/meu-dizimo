import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import {
  CABECALHO_DO_MODELO,
  EXEMPLO_DO_MODELO,
  LIMITE_POR_IMPORTACAO,
  lerPlanilhaDeMembros,
  type LeituraDaPlanilha,
} from '@/lib/importar-membros';
import { gerarPlanilhaEmBase64 } from '@/lib/planilha-xlsx';
import { escolherPlanilha } from '@/services/dispositivo/arquivos';
import { entregarPlanilha } from '@/services/dispositivo/planilha';
import { importarMembros, type ResultadoDaImportacao } from '@/services/supabase/membros-da-igreja';
import { cores, espacos, raio } from '@/theme';

// Mostra no máximo este tanto de linhas com problema; o resto vira "e mais N".
const PROBLEMAS_VISIVEIS = 20;

// Importar membros por planilha (B2, D-107): baixar o modelo, escolher a
// planilha, conferir a prévia e convidar todos de uma vez.
export default function ImportarMembros() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/membros');
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();
  const [leitura, setLeitura] = useState<Extract<LeituraDaPlanilha, { ok: true }>>();
  const [resultados, setResultados] = useState<ResultadoDaImportacao[]>();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string>();

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha) return null;

  async function aoBaixarModelo() {
    const base64 = gerarPlanilhaEmBase64([
      { nome: t('importarMembros.abaDoModelo'), linhas: [CABECALHO_DO_MODELO, EXEMPLO_DO_MODELO], colunasDeValor: [] },
    ]);
    await entregarPlanilha(t('importarMembros.nomeDoModelo'), base64, t('importarMembros.baixarModelo'));
  }

  async function aoEscolher() {
    setErro(undefined);
    setLeitura(undefined);
    const escolha = await escolherPlanilha();
    if (!escolha.ok) return;
    setOcupado(true);
    try {
      const lida = lerPlanilhaDeMembros(await escolha.arquivo.ler());
      if (lida.ok) setLeitura(lida);
      else setErro(t(`importarMembros.erros.${lida.erro}`));
    } catch {
      setErro(t('importarMembros.erros.arquivoIlegivel'));
    }
    setOcupado(false);
  }

  async function aoConvidar() {
    if (!leitura || !ficha) return;
    setErro(undefined);
    setOcupado(true);
    const resposta = await importarMembros(ficha.igreja_id, leitura.pessoas);
    setOcupado(false);
    if (!resposta.ok) {
      setErro(t(`comum.erros.${resposta.erro}`));
      return;
    }
    setResultados(resposta.resultados);
  }

  // Resultado da importação.
  if (resultados) {
    const quantos = (tipo: ResultadoDaImportacao['resultado']) => resultados.filter((r) => r.resultado === tipo).length;
    return (
      <Tela>
        <Texto variante="titulo">{t('importarMembros.resultado')}</Texto>
        <Texto variante="destaque">{t('importarMembros.convidados', { count: quantos('convidado') })}</Texto>
        {quantos('email_ja_cadastrado') > 0 && (
          <Texto>{t('importarMembros.jaCadastrados', { count: quantos('email_ja_cadastrado') })}</Texto>
        )}
        {quantos('dados_invalidos') > 0 && (
          <Texto>{t('importarMembros.invalidos', { count: quantos('dados_invalidos') })}</Texto>
        )}
        <Botao titulo={t('importarMembros.verMembros')} onPress={() => router.replace('/membros')} />
      </Tela>
    );
  }

  const problemas = leitura?.problemas ?? [];

  return (
    <Tela>
      <Texto variante="titulo">{t('importarMembros.titulo')}</Texto>
      <Texto>{t('importarMembros.explicacao')}</Texto>

      <View style={estilos.cartao}>
        <Texto variante="destaque">{t('importarMembros.passo1')}</Texto>
        <Botao titulo={t('importarMembros.baixarModelo')} variante="secundario" onPress={aoBaixarModelo} />
      </View>

      <View style={estilos.cartao}>
        <Texto variante="destaque">{t('importarMembros.passo2')}</Texto>
        <Botao
          titulo={leitura ? t('importarMembros.outraPlanilha') : t('importarMembros.escolher')}
          variante={leitura ? 'secundario' : 'principal'}
          onPress={aoEscolher}
          carregando={ocupado && !leitura}
        />
        {!leitura && <Retorno erro={erro} />}
      </View>

      {!!leitura && (
        <View style={estilos.cartao}>
          <Texto variante="destaque">{t('importarMembros.previa')}</Texto>
          <Texto>{t('importarMembros.prontos', { count: leitura.pessoas.length })}</Texto>
          {leitura.acimaDoLimite && (
            <Texto variante="erro">{t('importarMembros.acimaDoLimite', { limite: LIMITE_POR_IMPORTACAO })}</Texto>
          )}
          {problemas.length > 0 && (
            <>
              <Texto variante="erro">{t('importarMembros.comProblema', { count: problemas.length })}</Texto>
              {problemas.slice(0, PROBLEMAS_VISIVEIS).map((p) => (
                <Texto key={p.linha} variante="apoio">
                  {t('importarMembros.linha', {
                    linha: p.linha,
                    motivos: p.motivos.map((m) => t(`importarMembros.motivos.${m}`)).join(', '),
                  })}
                </Texto>
              ))}
              {problemas.length > PROBLEMAS_VISIVEIS && (
                <Texto variante="apoio">
                  {t('importarMembros.maisProblemas', { count: problemas.length - PROBLEMAS_VISIVEIS })}
                </Texto>
              )}
            </>
          )}
          {leitura.pessoas.length > 0 && (
            <Botao
              titulo={t('importarMembros.convidar', { count: leitura.pessoas.length })}
              onPress={aoConvidar}
              carregando={ocupado}
            />
          )}
          <Retorno erro={erro} />
        </View>
      )}

      <Botao
        titulo={t('importarMembros.voltar')}
        variante="secundario"
        onPress={() => voltar()}
        desabilitado={ocupado}
      />
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
