import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { SeletorDeFiltroPorCampo } from '@/components/seletor-de-filtro-por-campo';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Texto } from '@/components/ui/texto';
import { hojeIso, isoParaData, mascararData } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { atendeAoFiltro, type FiltroPorCampo } from '@/lib/filtro-por-campo';
import { calcularParticipacao, porcentagem, type Participacao } from '@/lib/participacao';
import { gerarPlanilhaEmBase64, type AbaDaPlanilha } from '@/lib/planilha-xlsx';
import { centavosParaPlanilha, periodoDoMes, validarPeriodo, type ErrosDoPeriodo, type Periodo } from '@/lib/relatorio';
import { entregarPlanilha } from '@/services/dispositivo/planilha';
import type { CampoDaIgreja } from '@/services/supabase/campos-da-igreja';
import { listarMembrosDaIgreja } from '@/services/supabase/membros-da-igreja';
import { buscarLancamentosDoRelatorio } from '@/services/supabase/relatorio';
import { cores, espacos, raio } from '@/theme';

const SEM_GRUPO = '__sem_grupo__';

type Props = {
  igrejaId: string;
  moeda: string;
  idioma: string;
  titulo: string | undefined;
  ehAdministrador: boolean;
  camposFiltraveis: CampoDaIgreja[];
};

type Resultado = { periodo: Periodo; participacao: Participacao; rotuloDoGrupo?: string };

// Participação no período: quantos membros ativos devolveram e ofertaram,
// por campanha e por grupo. A lista de quem não devolveu é só do Pastor,
// sem valores, como cuidado pastoral (seção 16).
export function RelatorioDeParticipacao(props: Props) {
  const { t } = useTranslation();
  const [de, setDe] = useState(() => isoParaData(periodoDoMes(hojeIso()).de));
  const [ate, setAte] = useState(() => isoParaData(periodoDoMes(hojeIso()).ate));
  const [errosDoPeriodo, setErrosDoPeriodo] = useState<ErrosDoPeriodo>({});
  const [filtroPorCampo, setFiltroPorCampo] = useState<FiltroPorCampo>();
  const [grupo, setGrupo] = useState<string>(SEM_GRUPO);
  const [resultado, setResultado] = useState<Resultado>();
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  const r = 'tesouraria.relatorios.participacao';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, props.moeda, props.idioma);
  const camposDeGrupo = props.camposFiltraveis.filter((c) => c.tipo === 'lista');
  const mudar =
    <T,>(definir: (valor: T) => void) =>
    (valor: T) => {
      definir(valor);
      setResultado(undefined);
      setRetorno(undefined);
    };

  function usarMes(deslocamento: number) {
    const periodo = periodoDoMes(hojeIso(), deslocamento);
    setDe(isoParaData(periodo.de));
    setAte(isoParaData(periodo.ate));
    setErrosDoPeriodo({});
    setResultado(undefined);
  }

  async function aoGerar() {
    setRetorno(undefined);
    const validado = validarPeriodo({ de, ate });
    setErrosDoPeriodo(validado.ok ? {} : validado.erros);
    if (!validado.ok) return;
    setGerando(true);
    try {
      const [membros, lancamentos] = await Promise.all([
        listarMembrosDaIgreja(props.igrejaId),
        buscarLancamentosDoRelatorio(props.igrejaId, { periodo: validado.periodo }),
      ]);
      // Com filtro por campo, entram só os membros do grupo e os lançamentos deles.
      const doGrupo = membros.filter((m) => atendeAoFiltro(m, filtroPorCampo, props.camposFiltraveis));
      const ids = new Set(doGrupo.map((m) => m.id));
      const campoDoGrupo = camposDeGrupo.find((c) => c.chave === grupo);
      setResultado({
        periodo: validado.periodo,
        participacao: calcularParticipacao(
          doGrupo,
          lancamentos.filter((l) => ids.has(l.membro_id)),
          campoDoGrupo,
        ),
        rotuloDoGrupo: campoDoGrupo?.rotulo,
      });
    } catch {
      setRetorno({ erro: t('tesouraria.relatorio.falhaAoGerar') });
    }
    setGerando(false);
  }

  const nomeDoGrupo = (valor: string) => valor || t(`${r}.semGrupo`);

  async function aoBaixar() {
    if (!resultado) return;
    setRetorno(undefined);
    setBaixando(true);
    try {
      const { participacao: p } = resultado;
      const c = `${r}.colunas`;
      const abas: AbaDaPlanilha[] = [
        {
          nome: t(`${r}.abas.resumo`),
          colunasDeValor: [],
          linhas: [
            [t('tesouraria.relatorio.planilha.periodo'), descreverPeriodo(resultado.periodo)],
            [t('filtroPorCampo.rotulo'), descreverFiltro()],
            [],
            [t(`${c}.item`), t(`${c}.quantidade`), t(`${c}.total`), t(`${c}.porcentagem`)],
            [t(`${c}.ativos`), p.ativos, p.ativos, 100],
            [t(`${c}.devolveram`), p.comDizimo, p.ativos, porcentagem(p.comDizimo, p.ativos)],
            [t(`${c}.ofertaram`), p.comOferta, p.ativos, porcentagem(p.comOferta, p.ativos)],
          ],
        },
        {
          nome: t(`${r}.abas.campanhas`),
          colunasDeValor: [2],
          linhas: [
            [t(`${c}.campanha`), t(`${c}.pessoas`), t(`${c}.valor`, { moeda: props.moeda })],
            ...p.porCampanha.map((campanha) => [
              campanha.nome,
              campanha.pessoas,
              centavosParaPlanilha(campanha.centavos),
            ]),
          ],
        },
      ];
      if (p.porGrupo.length > 0) {
        abas.push({
          nome: t(`${r}.abas.grupos`),
          colunasDeValor: [],
          linhas: [
            [resultado.rotuloDoGrupo ?? t(`${c}.grupo`), t(`${c}.ativos`), t(`${c}.devolveram`), t(`${c}.ofertaram`)],
            ...p.porGrupo.map((g) => [nomeDoGrupo(g.grupo), g.ativos, g.comDizimo, g.comOferta]),
          ],
        });
      }
      // A lista de visitas vai para a planilha só quando quem gera é o Pastor.
      if (props.ehAdministrador && p.semDizimo.length > 0) {
        abas.push({
          nome: t(`${r}.abas.visita`),
          colunasDeValor: [],
          linhas: [
            [
              t('tesouraria.relatorios.membros.colunas.numero'),
              t('tesouraria.relatorios.membros.colunas.nome'),
              t('tesouraria.relatorios.membros.colunas.celular'),
            ],
            ...p.semDizimo.map((m) => [m.numero, m.nome, m.celular]),
          ],
        });
      }
      const arquivo = `${t(`${r}.arquivo`)}-${resultado.periodo.de}-a-${resultado.periodo.ate}.xlsx`;
      await entregarPlanilha(arquivo, gerarPlanilhaEmBase64(abas), t('tesouraria.relatorio.compartilhar'));
      setRetorno({ aviso: t('tesouraria.relatorio.baixado', { arquivo }) });
    } catch {
      setRetorno({ erro: t('tesouraria.relatorio.falhaAoBaixar') });
    }
    setBaixando(false);
  }

  function descreverPeriodo(periodo: Periodo) {
    return t('tesouraria.relatorio.planilha.periodoDeAte', {
      de: isoParaData(periodo.de),
      ate: isoParaData(periodo.ate),
    });
  }

  function descreverFiltro() {
    const campo = props.camposFiltraveis.find((c) => c.chave === filtroPorCampo?.chave);
    return campo && filtroPorCampo?.valor ? `${campo.rotulo}: ${filtroPorCampo.valor}` : t('filtroPorCampo.nenhum');
  }

  const p = resultado?.participacao;

  return (
    <View style={estilos.bloco}>
      <Texto>{t(`${r}.explicacao`)}</Texto>

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

      <SeletorDeFiltroPorCampo
        campos={props.camposFiltraveis}
        filtro={filtroPorCampo}
        aoMudar={mudar(setFiltroPorCampo)}
      />
      {camposDeGrupo.length > 0 && (
        <Opcoes
          rotulo={t(`${r}.separarPor`)}
          opcoes={[
            { valor: SEM_GRUPO, rotulo: t(`${r}.semSeparar`) },
            ...camposDeGrupo.map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
          ]}
          selecionada={grupo}
          onSelecionar={mudar(setGrupo)}
        />
      )}

      <Botao titulo={t(`${r}.gerar`)} onPress={aoGerar} carregando={gerando} />

      {!!resultado && !!p && (
        <View style={estilos.cartao}>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.relatorio.resultado')}: {descreverPeriodo(resultado.periodo)}
          </Texto>
          <Texto>{t(`${r}.ativos`, { count: p.ativos })}</Texto>
          <Texto variante="destaque">
            {t(`${r}.devolveram`, { parte: p.comDizimo, total: p.ativos, pct: porcentagem(p.comDizimo, p.ativos) })}
          </Texto>
          <Texto variante="destaque">
            {t(`${r}.ofertaram`, { parte: p.comOferta, total: p.ativos, pct: porcentagem(p.comOferta, p.ativos) })}
          </Texto>

          <Texto variante="destaque" accessibilityRole="header">
            {t(`${r}.porCampanha`)}
          </Texto>
          {p.porCampanha.length === 0 && <Texto>{t(`${r}.semOfertas`)}</Texto>}
          {p.porCampanha.map((campanha) => (
            <Texto key={campanha.nome}>
              {t(`${r}.linhaCampanha`, {
                nome: campanha.nome,
                count: campanha.pessoas,
                valor: emMoeda(campanha.centavos),
              })}
            </Texto>
          ))}

          {p.porGrupo.length > 0 && (
            <>
              <Texto variante="destaque" accessibilityRole="header">
                {t(`${r}.porGrupo`, { campo: resultado.rotuloDoGrupo })}
              </Texto>
              {p.porGrupo.map((g) => (
                <Texto key={g.grupo || SEM_GRUPO}>
                  {t(`${r}.linhaGrupo`, {
                    grupo: nomeDoGrupo(g.grupo),
                    dizimo: g.comDizimo,
                    ativos: g.ativos,
                    oferta: g.comOferta,
                  })}
                </Texto>
              ))}
            </>
          )}

          {props.ehAdministrador && (
            <View style={estilos.visita}>
              <Texto variante="destaque" accessibilityRole="header">
                {t(`${r}.visitaTitulo`)}
              </Texto>
              <Texto variante="apoio">{t(`${r}.visitaExplicacao`, { titulo: props.titulo })}</Texto>
              {p.semDizimo.length === 0 && <Texto>{t(`${r}.visitaNenhum`)}</Texto>}
              {p.semDizimo.map((m) => (
                <Texto key={m.id}>
                  {t(`${r}.visitaLinha`, { nome: m.nome, numero: m.numero, celular: m.celular })}
                </Texto>
              ))}
            </View>
          )}

          <Botao
            titulo={Platform.OS === 'web' ? t('tesouraria.relatorio.baixar') : t('tesouraria.relatorio.compartilhar')}
            onPress={aoBaixar}
            carregando={baixando}
          />
        </View>
      )}
      {!!retorno && <Retorno aviso={retorno.aviso} erro={retorno.erro} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.medio,
  },
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
  visita: {
    gap: espacos.pequeno,
    paddingTop: espacos.medio,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
});
