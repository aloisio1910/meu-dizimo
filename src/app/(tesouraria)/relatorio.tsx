import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { hojeIso, isoParaData, mascararData, partesDaDataHora } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import { abasDoRelatorio, gerarPlanilhaEmBase64 } from '@/lib/planilha-xlsx';
import {
  centavosParaPlanilha,
  linhasDaPlanilha,
  nomeDoArquivo,
  periodoDoMes,
  totalizar,
  validarPeriodo,
  type Celula,
  type ErrosDoPeriodo,
  type LinhaDoRelatorio,
  type Periodo,
  type StatusDoLancamento,
  type Totais,
} from '@/lib/relatorio';
import { entregarPlanilha } from '@/services/dispositivo/planilha';
import {
  buscarLancamentosDoRelatorio,
  listarCampanhasDoRelatorio,
  type CampanhaDoFiltro,
  type FiltrosDoRelatorio,
} from '@/services/supabase/relatorio';
import { cores, espacos, raio } from '@/theme';

type FiltroDeTipo = 'todos' | 'dizimo' | 'oferta';
type FiltroDeStatus = 'todos' | StatusDoLancamento;

const STATUS: StatusDoLancamento[] = ['confirmado', 'aguardando', 'em_conferencia', 'divergencia', 'cancelado'];

type Resultado = { filtros: FiltrosDoRelatorio; linhas: LinhaDoRelatorio[]; totais: Totais };

// T-06 Relatórios: filtros da seção 9 do Requisitos (período, tipo,
// campanha e status), totais na tela e a planilha do Excel. Os totais ficam
// só aqui, para a tesouraria (RN-039).
export default function Relatorio() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();

  const [de, setDe] = useState(() => isoParaData(periodoDoMes(hojeIso()).de));
  const [ate, setAte] = useState(() => isoParaData(periodoDoMes(hojeIso()).ate));
  const [tipo, setTipo] = useState<FiltroDeTipo>('todos');
  const [campanhaId, setCampanhaId] = useState<string>('todas');
  const [status, setStatus] = useState<FiltroDeStatus>('todos');
  const [campanhas, setCampanhas] = useState<CampanhaDoFiltro[]>([]);
  const [errosDoPeriodo, setErrosDoPeriodo] = useState<ErrosDoPeriodo>({});
  const [resultado, setResultado] = useState<Resultado>();
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const igrejaId = ficha?.igreja_id;
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    listarCampanhasDoRelatorio(igrejaId)
      .then((lista) => ativo && setCampanhas(lista))
      .catch(() => ativo && setCampanhas([]));
    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha) return null;

  const igreja = ficha.igrejas;
  const moeda = igreja?.moeda ?? 'BRL';
  const idioma = igreja?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, moeda, idioma);
  const nomeDaCampanha = (c: CampanhaDoFiltro) =>
    c.status === 'encerrada' ? t('tesouraria.relatorio.encerrada', { nome: c.nome }) : c.nome;

  // Qualquer filtro novo invalida o resultado da tela, para os totais nunca
  // mostrarem outra coisa que não os filtros escolhidos.
  function mudar<T>(definir: (valor: T) => void) {
    return (valor: T) => {
      definir(valor);
      setResultado(undefined);
      setAviso(undefined);
    };
  }

  function usarMes(deslocamento: number) {
    const periodo = periodoDoMes(hojeIso(), deslocamento);
    setDe(isoParaData(periodo.de));
    setAte(isoParaData(periodo.ate));
    setErrosDoPeriodo({});
    setResultado(undefined);
  }

  async function aoGerar() {
    setErro(undefined);
    setAviso(undefined);
    const validado = validarPeriodo({ de, ate });
    setErrosDoPeriodo(validado.ok ? {} : validado.erros);
    if (!validado.ok) return;
    const filtros: FiltrosDoRelatorio = {
      periodo: validado.periodo,
      tipo: tipo === 'todos' ? undefined : tipo,
      campanhaId: tipo === 'oferta' && campanhaId !== 'todas' ? campanhaId : undefined,
      status: status === 'todos' ? undefined : status,
    };
    setGerando(true);
    try {
      const linhas = await buscarLancamentosDoRelatorio(ficha!.igreja_id, filtros);
      setResultado({ filtros, linhas, totais: totalizar(linhas) });
    } catch {
      setErro(t('tesouraria.relatorio.falhaAoGerar'));
    }
    setGerando(false);
  }

  function descreverPeriodo(periodo: Periodo) {
    return t('tesouraria.relatorio.planilha.periodoDeAte', { de: isoParaData(periodo.de), ate: isoParaData(periodo.ate) });
  }

  function descreverFiltros(filtros: FiltrosDoRelatorio): string[] {
    const campanha = campanhas.find((c) => c.id === filtros.campanhaId);
    return [
      filtros.tipo ? t(`tesouraria.item.${filtros.tipo}`) : t('tesouraria.relatorio.todos'),
      campanha ? nomeDaCampanha(campanha) : t('tesouraria.relatorio.todasCampanhas'),
      filtros.status ? t(`status.${filtros.status}`) : t('tesouraria.relatorio.todos'),
    ];
  }

  async function aoBaixar() {
    if (!resultado) return;
    setErro(undefined);
    setAviso(undefined);
    setBaixando(true);
    try {
      const c = 'tesouraria.relatorio.planilha.colunas';
      const lancamentos = linhasDaPlanilha(resultado.linhas, {
        colunas: [
          t(`${c}.id`),
          t(`${c}.nome`),
          t(`${c}.tipo`),
          t(`${c}.campanha`),
          t(`${c}.data`),
          t(`${c}.registro`),
          t(`${c}.informado`, { moeda }),
          t(`${c}.conferido`, { moeda }),
          t(`${c}.forma`),
          t(`${c}.conta`),
          t(`${c}.status`),
          t(`${c}.tesoureiro`),
          t(`${c}.quemRegistrou`),
        ],
        tipo: (tipoDaLinha) => t(`tesouraria.item.${tipoDaLinha}`),
        status: (s) => t(`status.${s}`),
        forma: (f) => (ehFormaConhecida(f) ? t(`formas.${f}`) : f),
        data: isoParaData,
        dataHora: (momento) => t('lancamento.dataHora', partesDaDataHora(momento, idioma)),
        quemRegistrou: (l) =>
          l.registrado_pela_tesouraria
            ? t('tesouraria.relatorio.planilha.tesouraria', { nome: l.confirmado_por_nome ?? '' })
            : t('tesouraria.relatorio.planilha.membro'),
      });

      const p = 'tesouraria.relatorio';
      const { totais, filtros } = resultado;
      const soma = (rotulo: string, s: { quantidade: number; centavos: number }): Celula[] => [
        rotulo,
        s.quantidade,
        centavosParaPlanilha(s.centavos),
      ];
      const [rotuloTipo, rotuloCampanha, rotuloStatus] = descreverFiltros(filtros);
      const agora = partesDaDataHora(new Date().toISOString(), idioma);
      const linhasDosTotais: Celula[][] = [
        [t(`${p}.planilha.igreja`), igreja?.nome ?? ''],
        [t(`${p}.planilha.periodo`), descreverPeriodo(filtros.periodo)],
        [t(`${p}.tipo`), rotuloTipo],
        [t(`${p}.campanha`), rotuloCampanha],
        [t(`${p}.status`), rotuloStatus],
        [t(`${p}.planilha.geradoEm`), t('lancamento.dataHora', agora)],
        [],
        ['', t(`${p}.planilha.quantidade`), t(`${p}.planilha.valor`, { moeda })],
        soma(t(`${p}.totalConfirmado`), totais.confirmado),
        soma(t(`${p}.dizimosConfirmados`), totais.porTipo.dizimo),
        soma(t(`${p}.ofertasConfirmadas`), totais.porTipo.oferta),
        ...totais.porCampanha.map((campanha) => soma(t(`${p}.ofertaDaCampanha`, { nome: campanha.nome }), campanha)),
        soma(t(`${p}.pendente`), totais.pendente),
        [t(`${p}.cancelados`), totais.cancelados],
      ];

      const arquivo = nomeDoArquivo(filtros.periodo);
      const base64 = gerarPlanilhaEmBase64(
        abasDoRelatorio(lancamentos, linhasDosTotais, {
          lancamentos: t(`${p}.planilha.abaLancamentos`),
          totais: t(`${p}.planilha.abaTotais`),
        }),
      );
      await entregarPlanilha(arquivo, base64, t(`${p}.compartilhar`));
      setAviso(t(`${p}.baixado`, { arquivo }));
    } catch {
      setErro(t('tesouraria.relatorio.falhaAoBaixar'));
    }
    setBaixando(false);
  }

  const linhaDoTotal = (rotulo: string, s: { quantidade: number; centavos: number }, destaque = false) => (
    <View style={estilos.linhaDoTotal} key={rotulo}>
      <Texto variante={destaque ? 'destaque' : undefined} style={estilos.rotuloDoTotal}>
        {rotulo}
      </Texto>
      <Texto variante="destaque">
        {t('tesouraria.relatorio.linhaDoTotal', {
          valor: emMoeda(s.centavos),
          quantidade: t('tesouraria.relatorio.quantidade', { count: s.quantidade }),
        })}
      </Texto>
    </View>
  );

  return (
    <Tela larga>
      <Texto variante="apoio">{igreja?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.relatorio.titulo')}</Texto>
      <Texto>{t('tesouraria.relatorio.explicacao')}</Texto>

      <Texto variante="destaque" accessibilityRole="header">
        {t('tesouraria.relatorio.periodo')}
      </Texto>
      <View style={estilos.atalhos}>
        <Botao titulo={t('tesouraria.relatorio.esteMes')} variante="secundario" onPress={() => usarMes(0)} />
        <Botao titulo={t('tesouraria.relatorio.mesPassado')} variante="secundario" onPress={() => usarMes(-1)} />
      </View>
      <CampoTexto
        rotulo={t('tesouraria.relatorio.de')}
        dica={t('tesouraria.relatorio.dicaData')}
        value={de}
        onChangeText={(texto) => mudar(setDe)(mascararData(texto))}
        keyboardType="number-pad"
        erro={errosDoPeriodo.de && t(`tesouraria.relatorio.erros.${errosDoPeriodo.de}`)}
      />
      <CampoTexto
        rotulo={t('tesouraria.relatorio.ate')}
        value={ate}
        onChangeText={(texto) => mudar(setAte)(mascararData(texto))}
        keyboardType="number-pad"
        erro={errosDoPeriodo.ate && t(`tesouraria.relatorio.erros.${errosDoPeriodo.ate}`)}
      />

      <Opcoes
        rotulo={t('tesouraria.relatorio.tipo')}
        opcoes={[
          { valor: 'todos', rotulo: t('tesouraria.relatorio.todos') },
          { valor: 'dizimo', rotulo: t('tesouraria.relatorio.dizimos') },
          { valor: 'oferta', rotulo: t('tesouraria.relatorio.ofertas') },
        ]}
        selecionada={tipo}
        onSelecionar={mudar(setTipo)}
      />
      {tipo === 'oferta' && campanhas.length > 0 && (
        <Opcoes
          rotulo={t('tesouraria.relatorio.campanha')}
          opcoes={[
            { valor: 'todas', rotulo: t('tesouraria.relatorio.todasCampanhas') },
            ...campanhas.map((c) => ({ valor: c.id, rotulo: nomeDaCampanha(c) })),
          ]}
          selecionada={campanhaId}
          onSelecionar={mudar(setCampanhaId)}
        />
      )}
      <Opcoes
        rotulo={t('tesouraria.relatorio.status')}
        opcoes={[
          { valor: 'todos', rotulo: t('tesouraria.relatorio.todos') },
          ...STATUS.map((s) => ({ valor: s, rotulo: t(`status.${s}`) })),
        ]}
        selecionada={status}
        onSelecionar={mudar(setStatus)}
      />

      <Botao titulo={t('tesouraria.relatorio.gerar')} onPress={aoGerar} carregando={gerando} />
      {!!erro && <Texto variante="erro">{erro}</Texto>}

      {!!resultado && (
        <View style={estilos.cartao}>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.relatorio.resultado')}: {descreverPeriodo(resultado.filtros.periodo)}
          </Texto>
          <Texto>{t('tesouraria.relatorio.quantidade', { count: resultado.linhas.length })}</Texto>
          {resultado.linhas.length === 0 ? (
            <Texto>{t('tesouraria.relatorio.nenhum')}</Texto>
          ) : (
            <>
              {linhaDoTotal(t('tesouraria.relatorio.totalConfirmado'), resultado.totais.confirmado, true)}
              {linhaDoTotal(t('tesouraria.relatorio.dizimosConfirmados'), resultado.totais.porTipo.dizimo)}
              {linhaDoTotal(t('tesouraria.relatorio.ofertasConfirmadas'), resultado.totais.porTipo.oferta)}
              {resultado.totais.porCampanha.map((campanha) =>
                linhaDoTotal(t('tesouraria.relatorio.ofertaDaCampanha', { nome: campanha.nome }), campanha),
              )}
              {resultado.totais.pendente.quantidade > 0 &&
                linhaDoTotal(t('tesouraria.relatorio.pendente'), resultado.totais.pendente)}
              {resultado.totais.cancelados > 0 && (
                <Texto variante="apoio">
                  {t('tesouraria.relatorio.cancelados')}: {resultado.totais.cancelados}
                </Texto>
              )}
              <Texto variante="apoio">{t('tesouraria.relatorio.explicacaoTotais')}</Texto>
              <Botao
                titulo={Platform.OS === 'web' ? t('tesouraria.relatorio.baixar') : t('tesouraria.relatorio.compartilhar')}
                onPress={aoBaixar}
                carregando={baixando}
              />
            </>
          )}
        </View>
      )}
      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}

      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => router.back()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  atalhos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.medio,
  },
  cartao: {
    gap: espacos.medio,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  linhaDoTotal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: espacos.pequeno,
    paddingBottom: espacos.pequeno,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  rotuloDoTotal: {
    flexShrink: 1,
  },
});
