import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { CamposDoDizimo } from '@/components/campos-do-dizimo';
import { PagamentoPix } from '@/components/pagamento-pix';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { hojeIso, isoParaData } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { validarDizimo, type DadosDoDizimo, type ErrosDoDizimo } from '@/lib/validar-dizimo';
import {
  buscarContaPrincipal,
  existeLancamentoIgual,
  registrarDizimo,
  type ContaParaPix,
} from '@/services/supabase/lancamentos';

type Registro = DadosDoDizimo;

// M-04 Registrar dízimo: valor, data e forma; depois de gravar, o código Pix.
// Gravar antes de pagar garante que o registro não se perde se a pessoa
// for para o app do banco e não voltar.
export default function RegistrarDizimo() {
  const { t } = useTranslation();
  const router = useRouter();
  const voltar = useVoltar('/cartao');
  const { ficha, carregando } = useFichaAtiva();

  const [etapa, setEtapa] = useState<'formulario' | 'duplicado' | 'registrado'>('formulario');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => isoParaData(hojeIso()));
  const [forma, setForma] = useState<string>();
  const [erros, setErros] = useState<ErrosDoDizimo>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [registro, setRegistro] = useState<Registro>();
  const [idRegistrado, setIdRegistrado] = useState<string>();
  const [conta, setConta] = useState<ContaParaPix | null>();

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;

  const igreja = ficha.igrejas;
  const moeda = igreja?.moeda ?? 'BRL';
  const idioma = igreja?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, moeda, idioma);

  function validar(): Registro | null {
    const resultado = validarDizimo({ valor, data, forma }, hojeIso());
    setErros(resultado.ok ? {} : resultado.erros);
    setErroGeral(undefined);
    return resultado.ok ? resultado.dados : null;
  }

  async function gravar(dados: Registro) {
    setEnviando(true);
    const resultado = await registrarDizimo({
      igrejaId: ficha!.igreja_id,
      membroId: ficha!.id,
      valorEmCentavos: dados.centavos,
      moeda,
      data: dados.data,
      forma: dados.forma,
    });
    if (!resultado.ok) {
      setEnviando(false);
      setEtapa('formulario');
      setErroGeral(
        resultado.erro === 'sem_conexao' || resultado.erro === 'erro_inesperado'
          ? t(`comum.erros.${resultado.erro}`)
          : t(`registrar.erros.${resultado.erro}`),
      );
      return;
    }
    setRegistro(dados);
    setIdRegistrado(resultado.id);
    if (dados.forma === 'pix') {
      setConta(await buscarContaPrincipal(ficha!.igreja_id).catch(() => null));
    }
    setEnviando(false);
    setEtapa('registrado');
  }

  async function aoRegistrar() {
    const dados = validar();
    if (!dados) return;
    setEnviando(true);
    // RN-032: mesmo valor na mesma data gera alerta, não bloqueio.
    const repetido = await existeLancamentoIgual(ficha!.id, dados.centavos, dados.data).catch(() => false);
    setEnviando(false);
    if (repetido) {
      setRegistro(dados);
      setEtapa('duplicado');
      return;
    }
    await gravar(dados);
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
          onPress={() => setEtapa('formulario')}
          desabilitado={enviando}
        />
      </Tela>
    );
  }

  if (etapa === 'registrado' && registro) {
    const pagaComPix = registro.forma === 'pix' && !!conta;

    return (
      <Tela>
        <Texto variante="titulo">{t('registrar.registradoTitulo')}</Texto>
        <Texto>{t('registrar.registrado', { valor: emMoeda(registro.centavos), data: isoParaData(registro.data) })}</Texto>

        {registro.forma === 'pix' && !conta && <Texto variante="erro">{t('registrar.semPix')}</Texto>}

        {pagaComPix && (
          <PagamentoPix
            conta={conta}
            valorEmCentavos={registro.centavos}
            valorFormatado={emMoeda(registro.centavos)}
            descricao="Dizimo"
          />
        )}

        {!!idRegistrado && (
          <Botao
            titulo={t('registrar.anexarComprovante')}
            variante="secundario"
            onPress={() => router.replace({ pathname: '/lancamento/[id]', params: { id: idRegistrado } })}
          />
        )}
        <Botao
          titulo={t('registrar.voltarAoCartao')}
          variante={pagaComPix ? 'secundario' : 'principal'}
          onPress={() => voltar()}
        />
      </Tela>
    );
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('registrar.titulo')}</Texto>
      <Texto>{t('registrar.explicacao')}</Texto>
      <CamposDoDizimo
        valor={valor}
        aoMudarValor={setValor}
        data={data}
        aoMudarData={setData}
        forma={forma}
        aoMudarForma={setForma}
        formasAceitas={igreja?.formas_devolucao ?? []}
        erros={erros}
      />
      {!!erroGeral && <Texto variante="erro">{erroGeral}</Texto>}
      {enviando ? (
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      ) : (
        <Botao titulo={t('registrar.registrar')} onPress={aoRegistrar} />
      )}
      <Botao titulo={t('registrar.cancelar')} variante="secundario" onPress={() => voltar()} desabilitado={enviando} />
    </Tela>
  );
}
