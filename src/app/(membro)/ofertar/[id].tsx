import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { CamposDoDizimo } from '@/components/campos-do-dizimo';
import { PagamentoPix } from '@/components/pagamento-pix';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { hojeIso, isoParaData } from '@/lib/data';
import { completarValor, formatarMoeda, mascararValor, textoParaCentavos } from '@/lib/dinheiro';
import { validarDizimo, type DadosDoDizimo, type ErrosDoDizimo } from '@/lib/validar-dizimo';
import {
  buscarContaParaPix,
  existeLancamentoIgual,
  registrarDizimo,
  type ContaParaPix,
} from '@/services/supabase/lancamentos';
import { buscarCampanha, type Campanha } from '@/services/supabase/ofertas';

type Etapa = 'valor' | 'pagar' | 'registrar' | 'duplicado' | 'registrada';

// Ofertar (fluxo da oferta): valor → código Pix da conta da campanha →
// registro opcional. Diferente do dízimo, aqui o Pix vem antes, porque
// registrar a oferta no app não é obrigatório (RN-036).
export default function Ofertar() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ficha, carregando } = useFichaAtiva();

  const [campanha, setCampanha] = useState<Campanha | null>();
  const [conta, setConta] = useState<ContaParaPix | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('valor');
  const [valor, setValor] = useState('');
  const [erroDoValor, setErroDoValor] = useState<string>();
  const [data, setData] = useState(() => isoParaData(hojeIso()));
  const [forma, setForma] = useState<string>();
  const [erros, setErros] = useState<ErrosDoDizimo>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [registro, setRegistro] = useState<DadosDoDizimo>();
  const [idRegistrado, setIdRegistrado] = useState<string>();

  const igrejaId = ficha?.igreja_id;
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    (async () => {
      const encontrada = await buscarCampanha(id).catch(() => null);
      // Só campanhas ativas recebem oferta (D-074).
      const aberta = encontrada?.status === 'ativa' ? encontrada : null;
      const contaDaCampanha = aberta ? await buscarContaParaPix(igrejaId, aberta.conta_id).catch(() => null) : null;
      if (!ativo) return;
      setConta(contaDaCampanha);
      setCampanha(aberta);
    })();
    return () => {
      ativo = false;
    };
  }, [id, igrejaId]);

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha || campanha === undefined) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (campanha === null) {
    return (
      <Tela>
        <Texto>{t('registrar.erros.campanha_indisponivel')}</Texto>
        <Botao titulo={t('ofertas.ofertar.voltarAsOfertas')} onPress={() => router.back()} />
      </Tela>
    );
  }

  const igreja = ficha.igrejas;
  const moeda = igreja?.moeda ?? 'BRL';
  const idioma = igreja?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, moeda, idioma);
  const formasAceitas = igreja?.formas_devolucao ?? [];
  const centavos = textoParaCentavos(valor);

  function aoGerarPix() {
    if (!centavos) {
      setErroDoValor(t('registrar.erros.valorInvalido'));
      return;
    }
    setErroDoValor(undefined);
    setEtapa('pagar');
  }

  function irParaRegistro() {
    // Já vem preenchido com o que a pessoa acabou de pagar.
    if (conta && formasAceitas.includes('pix')) setForma('pix');
    setErros({});
    setErroGeral(undefined);
    setEtapa('registrar');
  }

  async function gravar(dados: DadosDoDizimo) {
    setEnviando(true);
    const resultado = await registrarDizimo({
      igrejaId: ficha!.igreja_id,
      membroId: ficha!.id,
      valorEmCentavos: dados.centavos,
      moeda,
      data: dados.data,
      forma: dados.forma,
      campanhaId: campanha!.id,
    });
    setEnviando(false);
    if (!resultado.ok) {
      setEtapa('registrar');
      setErroGeral(
        resultado.erro === 'sem_conexao' || resultado.erro === 'erro_inesperado'
          ? t(`comum.erros.${resultado.erro}`)
          : t(`registrar.erros.${resultado.erro}`),
      );
      return;
    }
    setRegistro(dados);
    setIdRegistrado(resultado.id);
    setEtapa('registrada');
  }

  async function aoRegistrar() {
    const resultado = validarDizimo({ valor, data, forma }, hojeIso());
    setErros(resultado.ok ? {} : resultado.erros);
    setErroGeral(undefined);
    if (!resultado.ok) return;
    setEnviando(true);
    // RN-032: mesmo valor na mesma data gera alerta, não bloqueio.
    const repetido = await existeLancamentoIgual(
      ficha!.id,
      resultado.dados.centavos,
      resultado.dados.data,
      'oferta',
    ).catch(() => false);
    setEnviando(false);
    if (repetido) {
      setRegistro(resultado.dados);
      setEtapa('duplicado');
      return;
    }
    await gravar(resultado.dados);
  }

  if (etapa === 'duplicado' && registro) {
    return (
      <Tela>
        <Texto variante="titulo">{t('registrar.duplicadoTitulo')}</Texto>
        <Texto>{t('registrar.duplicado', { valor: emMoeda(registro.centavos), data: isoParaData(registro.data) })}</Texto>
        <Botao titulo={t('registrar.registrarMesmoAssim')} onPress={() => gravar(registro)} carregando={enviando} />
        <Botao
          titulo={t('registrar.voltarECorrigir')}
          variante="secundario"
          onPress={() => setEtapa('registrar')}
          desabilitado={enviando}
        />
      </Tela>
    );
  }

  if (etapa === 'registrada' && registro) {
    return (
      <Tela>
        <Texto variante="titulo">{t('ofertas.ofertar.registrada')}</Texto>
        <Texto>{t('ofertas.ofertar.registradaDetalhe', { valor: emMoeda(registro.centavos), campanha: campanha.nome })}</Texto>
        {!!idRegistrado && (
          <Botao
            titulo={t('ofertas.ofertar.verDetalhe')}
            onPress={() => router.replace({ pathname: '/lancamento/[id]', params: { id: idRegistrado } })}
          />
        )}
        <Botao titulo={t('ofertas.ofertar.voltarAsOfertas')} variante="secundario" onPress={() => router.dismissTo('/ofertas')} />
      </Tela>
    );
  }

  if (etapa === 'registrar') {
    return (
      <Tela>
        <Texto variante="apoio">{campanha.nome}</Texto>
        <Texto variante="titulo">{t('ofertas.ofertar.registrar')}</Texto>
        <CamposDoDizimo
          valor={valor}
          aoMudarValor={setValor}
          data={data}
          aoMudarData={setData}
          forma={forma}
          aoMudarForma={setForma}
          formasAceitas={formasAceitas}
          erros={erros}
          oferta
        />
        {!!erroGeral && <Texto variante="erro">{erroGeral}</Texto>}
        <Botao titulo={t('ofertas.ofertar.registrarAgora')} onPress={aoRegistrar} carregando={enviando} />
        <Botao titulo={t('registrar.cancelar')} variante="secundario" onPress={() => setEtapa('pagar')} desabilitado={enviando} />
      </Tela>
    );
  }

  if (etapa === 'pagar' && centavos) {
    return (
      <Tela>
        <Texto variante="apoio">{campanha.nome}</Texto>
        <Texto variante="titulo">{emMoeda(centavos)}</Texto>
        {conta ? (
          <PagamentoPix conta={conta} valorEmCentavos={centavos} valorFormatado={emMoeda(centavos)} descricao="Oferta" />
        ) : (
          <Texto variante="erro">{t('registrar.semPix')}</Texto>
        )}
        <Texto variante="destaque" accessibilityRole="header">
          {t('ofertas.ofertar.registrarTitulo')}
        </Texto>
        <Texto>{t('ofertas.ofertar.registrarExplicacao')}</Texto>
        <Botao titulo={t('ofertas.ofertar.registrar')} variante="secundario" onPress={irParaRegistro} />
        <Botao titulo={t('ofertas.ofertar.concluirSemRegistrar')} variante="secundario" onPress={() => router.dismissTo('/ofertas')} />
        <Botao titulo={t('registrar.cancelar')} variante="secundario" onPress={() => setEtapa('valor')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="apoio">{campanha.nome}</Texto>
      <Texto variante="titulo">{t('ofertas.ofertar.titulo')}</Texto>
      <Texto>{t('ofertas.ofertar.explicacao')}</Texto>
      <CampoTexto
        rotulo={t('registrar.rotuloValor')}
        dica={t('registrar.dicaValor')}
        value={valor}
        onChangeText={(texto) => setValor(mascararValor(texto))}
        onBlur={() => setValor(completarValor(valor))}
        erro={erroDoValor}
        keyboardType="decimal-pad"
      />
      <Botao titulo={t('ofertas.ofertar.gerarPix')} onPress={aoGerarPix} />
      <Botao titulo={t('registrar.cancelar')} variante="secundario" onPress={() => router.back()} />
    </Tela>
  );
}
