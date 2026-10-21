import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { CaixaSelecao } from '@/components/ui/caixa-selecao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { dataParaIso, mascararData } from '@/lib/data';
import { versaoDosTermos } from '@/i18n/termos/pt-BR';
import {
  buscarCamposDoCadastro,
  concluirCadastro,
  type CampoDoCadastro,
  type MinhaFicha,
} from '@/services/supabase/membros';
import { espacos } from '@/theme';

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

type Erros = Record<string, string>;

// Valores guardados no banco viram texto para os campos da tela.
function valoresIniciais(ficha: MinhaFicha): Record<string, string> {
  const extras = (ficha.campos_extras ?? {}) as Record<string, unknown>;
  const valores: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(extras)) {
    const texto = String(valor ?? '');
    valores[chave] = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto.split('-').reverse().join('/') : texto;
  }
  return valores;
}

function familiaresIniciais(ficha: MinhaFicha): string[] {
  const lista = Array.isArray(ficha.familiares) ? ficha.familiares : [];
  return lista
    .map((item) => (item && typeof item === 'object' && 'nome' in item ? String(item.nome) : ''))
    .filter(Boolean);
}

function Formulario({ ficha, aoConcluir }: { ficha: MinhaFicha; aoConcluir: () => Promise<void> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const nomeDaIgreja = ficha.igrejas?.nome ?? t('termos.suaIgreja');

  const [campos, setCampos] = useState<CampoDoCadastro[] | null>(null);
  const [falhaNosCampos, setFalhaNosCampos] = useState(false);
  const [nome, setNome] = useState(ficha.nome);
  const [celular, setCelular] = useState(ficha.celular);
  const [tipoDizimo, setTipoDizimo] = useState(ficha.tipo_dizimo);
  const [familiares, setFamiliares] = useState(() => familiaresIniciais(ficha));
  const [novoFamiliar, setNovoFamiliar] = useState('');
  const [valores, setValores] = useState(() => valoresIniciais(ficha));
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteSensivel, setAceiteSensivel] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    buscarCamposDoCadastro(ficha.igreja_id)
      .then(setCampos)
      .catch(() => setFalhaNosCampos(true));
  }, [ficha.igreja_id]);

  function rotuloDoCampo(campo: CampoDoCadastro) {
    return t(campo.obrigatorio ? 'comum.obrigatorio' : 'comum.opcional', { rotulo: campo.rotulo });
  }

  function alterarValor(chave: string, valor: string) {
    setValores((atuais) => ({ ...atuais, [chave]: valor }));
  }

  function adicionarFamiliar() {
    const nomeDoFamiliar = novoFamiliar.trim();
    if (!nomeDoFamiliar) return;
    setFamiliares((atuais) => [...atuais, nomeDoFamiliar]);
    setNovoFamiliar('');
  }

  // Confere tudo na tela antes de enviar; o banco confere de novo.
  function validar(): { erros: Erros; camposExtras: Record<string, string | number> } {
    const novosErros: Erros = {};
    const camposExtras: Record<string, string | number> = {};

    if (!nome.trim()) novosErros.nome = t('primeiroAcesso.erros.nomeObrigatorio');
    if (!celular.trim()) novosErros.celular = t('primeiroAcesso.erros.celularObrigatorio');
    if (tipoDizimo === 'familiar' && familiares.length === 0) {
      novosErros.familiares = t('primeiroAcesso.erros.familiaresObrigatorios');
    }

    for (const campo of campos ?? []) {
      const texto = (valores[campo.chave] ?? '').trim();
      const chaveDoErro = `campo:${campo.chave}`;
      if (!texto) {
        if (campo.obrigatorio) novosErros[chaveDoErro] = t('primeiroAcesso.erros.campoObrigatorio');
        continue;
      }
      if (campo.tipo === 'data') {
        const iso = dataParaIso(texto);
        if (iso) camposExtras[campo.chave] = iso;
        else novosErros[chaveDoErro] = t('primeiroAcesso.erros.dataInvalida');
      } else if (campo.tipo === 'numero') {
        const numero = Number(texto.replace(',', '.'));
        if (Number.isFinite(numero)) camposExtras[campo.chave] = numero;
        else novosErros[chaveDoErro] = t('primeiroAcesso.erros.numeroInvalido');
      } else {
        camposExtras[campo.chave] = texto;
      }
    }

    if (!aceiteTermos) novosErros.termos = t('primeiroAcesso.erros.aceiteObrigatorio');
    if (!aceiteSensivel) novosErros.sensivel = t('primeiroAcesso.erros.aceiteObrigatorio');

    return { erros: novosErros, camposExtras };
  }

  async function concluir() {
    setErroGeral(undefined);
    const { erros: novosErros, camposExtras } = validar();
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      setErroGeral(t('primeiroAcesso.erros.revise'));
      return;
    }

    setEnviando(true);
    const erro = await concluirCadastro({
      membroId: ficha.id,
      nome: nome.trim(),
      celular: celular.trim(),
      tipoDizimo,
      familiares: tipoDizimo === 'familiar' ? familiares.map((n) => ({ nome: n })) : [],
      camposExtras,
      versaoDosTermos,
    });

    if (!erro) {
      await aoConcluir();
      return;
    }
    setEnviando(false);

    if (erro.codigo === 'campo_obrigatorio' || erro.codigo === 'campo_invalido') {
      setErros({
        [`campo:${erro.campo}`]: t(
          erro.codigo === 'campo_obrigatorio' ? 'primeiroAcesso.erros.campoObrigatorio' : 'primeiroAcesso.erros.campoInvalido',
        ),
      });
      setErroGeral(t('primeiroAcesso.erros.revise'));
    } else if (erro.codigo === 'familiares_obrigatorios') {
      setErros({ familiares: t('primeiroAcesso.erros.familiaresObrigatorios') });
      setErroGeral(t('primeiroAcesso.erros.revise'));
    } else if (erro.codigo === 'cadastro_indisponivel') {
      setErroGeral(t('primeiroAcesso.erros.cadastro_indisponivel'));
    } else {
      setErroGeral(t(`comum.erros.${erro.codigo}`));
    }
  }

  if (falhaNosCampos) {
    return (
      <Tela>
        <Texto>{t('comum.erros.erro_inesperado')}</Texto>
        <Botao
          titulo={t('comum.tentarDeNovo')}
          onPress={() => {
            setFalhaNosCampos(false);
            buscarCamposDoCadastro(ficha.igreja_id).then(setCampos).catch(() => setFalhaNosCampos(true));
          }}
        />
      </Tela>
    );
  }

  if (!campos) {
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
      <CampoTexto
        rotulo={t('primeiroAcesso.rotuloNome')}
        value={nome}
        onChangeText={setNome}
        erro={erros.nome}
        autoComplete="name"
        textContentType="name"
      />
      <CampoTexto
        rotulo={t('primeiroAcesso.rotuloCelular')}
        value={celular}
        onChangeText={setCelular}
        erro={erros.celular}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      {campos.map((campo) =>
        campo.tipo === 'lista' ? (
          <Opcoes
            key={campo.id}
            rotulo={rotuloDoCampo(campo)}
            opcoes={campo.opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao }))}
            selecionada={valores[campo.chave] || undefined}
            onSelecionar={(valor) => alterarValor(campo.chave, valor)}
            erro={erros[`campo:${campo.chave}`]}
          />
        ) : (
          <CampoTexto
            key={campo.id}
            rotulo={rotuloDoCampo(campo)}
            dica={campo.tipo === 'data' ? t('primeiroAcesso.dicaData') : undefined}
            value={valores[campo.chave] ?? ''}
            onChangeText={(texto) => alterarValor(campo.chave, campo.tipo === 'data' ? mascararData(texto) : texto)}
            erro={erros[`campo:${campo.chave}`]}
            keyboardType={campo.tipo === 'texto' ? 'default' : campo.tipo === 'numero' ? 'decimal-pad' : 'number-pad'}
          />
        ),
      )}

      <Opcoes
        rotulo={t('primeiroAcesso.rotuloTipoDizimo')}
        opcoes={[
          { valor: 'individual', rotulo: t('primeiroAcesso.individual') },
          { valor: 'familiar', rotulo: t('primeiroAcesso.familiar') },
        ]}
        selecionada={tipoDizimo}
        onSelecionar={setTipoDizimo}
      />

      {tipoDizimo === 'familiar' && (
        <View style={estilos.bloco}>
          {familiares.length > 0 && <Texto>{t('primeiroAcesso.familiaresAdicionados')}</Texto>}
          {familiares.map((familiar, indice) => (
            <View key={`${familiar}-${indice}`} style={estilos.bloco}>
              <Texto variante="destaque">{familiar}</Texto>
              <Botao
                titulo={t('primeiroAcesso.remover', { nome: familiar })}
                variante="secundario"
                onPress={() => setFamiliares((atuais) => atuais.filter((_, i) => i !== indice))}
              />
            </View>
          ))}
          <CampoTexto
            rotulo={t('primeiroAcesso.rotuloFamiliar')}
            value={novoFamiliar}
            onChangeText={setNovoFamiliar}
            erro={erros.familiares}
            returnKeyType="done"
            onSubmitEditing={adicionarFamiliar}
          />
          <Botao titulo={t('primeiroAcesso.adicionarFamiliar')} variante="secundario" onPress={adicionarFamiliar} />
        </View>
      )}

      <Texto variante="destaque">{t('primeiroAcesso.secaoTermos')}</Texto>
      <Texto>{t('primeiroAcesso.explicacaoTermos')}</Texto>
      <Botao titulo={t('primeiroAcesso.lerTermos')} variante="secundario" onPress={() => router.push('/termos')} />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteTermos')}
        marcado={aceiteTermos}
        onAlterar={setAceiteTermos}
        erro={erros.termos}
      />
      <CaixaSelecao
        rotulo={t('primeiroAcesso.aceiteSensivel', { igreja: nomeDaIgreja })}
        marcado={aceiteSensivel}
        onAlterar={setAceiteSensivel}
        erro={erros.sensivel}
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

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.medio,
  },
});
