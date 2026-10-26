import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Paginacao } from '@/components/paginacao';
import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { hojeIso, isoParaData, mascararData, partesDaDataHora } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import {
  descreverRegistro,
  limitesDoPeriodo,
  mudancasDoRegistro,
  TABELAS_DO_ASSUNTO,
  temNome,
  valorLegivel,
  type Assunto,
  type RegistroDoLog,
} from '@/lib/log';
import { listarTodosOsCampos } from '@/services/supabase/campos-da-igreja';
import { periodoDoMes, validarPeriodo, type ErrosDoPeriodo } from '@/lib/relatorio';
import {
  listarPessoasDaIgreja,
  listarRegistrosDoLog,
  TAMANHO_DA_PAGINA_DO_LOG,
  type FiltrosDoLog,
  type PessoaDaIgreja,
} from '@/services/supabase/log';
import { cores, espacos, raio } from '@/theme';

const ASSUNTOS: Assunto[] = ['lancamentos', 'membros', 'contas', 'campanhas', 'igreja', 'comprovantes'];
const TODOS = 'todos';

// P-04 Log da igreja: o histórico de ações gravado pelo banco (auditoria),
// com filtros de período, assunto e pessoa. Só o Pastor de Governo vê.
export default function LogDaIgreja() {
  const { t } = useTranslation();
  const voltar = useVoltar('/fila');
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const [de, setDe] = useState(() => isoParaData(periodoDoMes(hojeIso()).de));
  const [ate, setAte] = useState(() => isoParaData(periodoDoMes(hojeIso()).ate));
  const [errosDoPeriodo, setErrosDoPeriodo] = useState<ErrosDoPeriodo>({});
  const [assunto, setAssunto] = useState<string>(TODOS);
  const [quem, setQuem] = useState<string>(TODOS);
  const [pessoas, setPessoas] = useState<PessoaDaIgreja[]>([]);
  const [registros, setRegistros] = useState<RegistroDoLog[]>();
  const [filtrosUsados, setFiltrosUsados] = useState<FiltrosDoLog>();
  const [pagina, setPagina] = useState(0);
  const [totalDeRegistros, setTotalDeRegistros] = useState(0);
  const [rotulosDosCampos, setRotulosDosCampos] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<number[]>([]);
  const [carregandoLog, setCarregandoLog] = useState(false);
  const [erro, setErro] = useState<string>();

  const igrejaId = ficha?.igreja_id;
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    listarPessoasDaIgreja(igrejaId)
      .then((lista) => ativo && setPessoas(lista))
      .catch(() => ativo && setPessoas([]));
    // Nomes que a igreja deu aos campos do cadastro, para "Ver o que mudou".
    listarTodosOsCampos(igrejaId)
      .then((campos) => ativo && setRotulosDosCampos(Object.fromEntries(campos.map((c) => [c.chave, c.rotulo]))))
      .catch(() => ativo && setRotulosDosCampos({}));
    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  if (!carregando && !ficha) return <Redirect href="/" />;
  if (!ficha) return null;
  const titulo = ficha.igrejas?.titulo_administrador;
  if (!ehAdministrador) {
    return (
      <Tela>
        <Texto>{t('log.soPastor', { titulo })}</Texto>
        <Botao titulo={t('tesouraria.lancar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  const idioma = ficha.igrejas?.idioma ?? 'pt-BR';
  const moeda = ficha.igrejas?.moeda ?? 'BRL';
  const nomePeloLogin = new Map(pessoas.filter((p) => p.usuario_id).map((p) => [p.usuario_id!, p.nome]));
  const nomePelaFicha = new Map(pessoas.map((p) => [p.id, p.nome]));
  // Quem pode aparecer como autor: a tesouraria e quem já entrou no app.
  const autores = pessoas.filter((p) => p.usuario_id && p.perfil !== 'membro');

  const quemFez = (r: RegistroDoLog) => {
    if (!r.usuario_id) return t('log.sistema');
    if (r.perfil === 'admin_master') return t('log.equipe');
    return nomePeloLogin.get(r.usuario_id) ?? t('log.pessoaDesconhecida');
  };

  const mudar =
    <T,>(definir: (valor: T) => void) =>
    (valor: T) => {
      definir(valor);
      setRegistros(undefined);
    };

  function usarMes(deslocamento: number) {
    const periodo = periodoDoMes(hojeIso(), deslocamento);
    setDe(isoParaData(periodo.de));
    setAte(isoParaData(periodo.ate));
    setErrosDoPeriodo({});
    setRegistros(undefined);
  }

  async function buscar(filtros: FiltrosDoLog, numero: number) {
    setErro(undefined);
    setCarregandoLog(true);
    try {
      // O banco já tira os avisos internos (ex.: "ainda conferindo") e conta o total.
      const { registros: daPagina, total } = await listarRegistrosDoLog(ficha!.igreja_id, filtros, numero);
      setRegistros(daPagina);
      setTotalDeRegistros(total);
      setPagina(numero);
      setAbertos([]);
    } catch {
      setErro(t('log.falhaAoCarregar'));
    }
    setCarregandoLog(false);
  }

  function aoVer() {
    const validado = validarPeriodo({ de, ate });
    setErrosDoPeriodo(validado.ok ? {} : validado.erros);
    if (!validado.ok) return;
    const filtros: FiltrosDoLog = {
      ...limitesDoPeriodo(validado.periodo),
      tabelas: assunto === TODOS ? undefined : TABELAS_DO_ASSUNTO[assunto as Assunto],
      quem: quem === TODOS ? undefined : quem,
    };
    setFiltrosUsados(filtros);
    setAbertos([]);
    buscar(filtros, 0);
  }

  const frase = (r: RegistroDoLog) => {
    const { codigo, valores } = descreverRegistro(r, {
      nomeDoMembro: (id) => nomePelaFicha.get(id) ?? '?',
      valorEmMoeda: (centavos) => formatarMoeda(centavos, moeda, idioma),
    });
    return t(`log.acoes.${codigo}`, {
      ...valores,
      tipo: valores.tipo ? t(`log.tipos.${valores.tipo === 'oferta' ? 'oferta' : 'dizimo'}`) : '',
    });
  };

  const legivel = (campo: string, valor: unknown) =>
    valorLegivel(campo, valor, {
      sim: t('log.sim'),
      nao: t('log.nao'),
      alterado: t('log.alterado'),
      emMoeda: (centavos) => formatarMoeda(centavos, moeda, idioma),
    });

  const alternar = (id: number) =>
    setAbertos((atuais) => (atuais.includes(id) ? atuais.filter((a) => a !== id) : [...atuais, id]));

  return (
    <Tela larga>
      <Texto variante="apoio">{ficha.igrejas?.nome}</Texto>
      <Texto variante="titulo">{t('log.titulo')}</Texto>
      <Texto>{t('log.explicacao')}</Texto>

      <Texto variante="destaque" accessibilityRole="header">
        {t('log.periodo')}
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
        rotulo={t('log.assunto')}
        opcoes={[
          { valor: TODOS, rotulo: t('log.todos') },
          ...ASSUNTOS.map((a) => ({ valor: a, rotulo: t(`log.assuntos.${a}`) })),
        ]}
        selecionada={assunto}
        onSelecionar={mudar(setAssunto)}
      />
      <Opcoes
        rotulo={t('log.quem')}
        opcoes={[
          { valor: TODOS, rotulo: t('log.todos') },
          ...autores.map((p) => ({ valor: p.usuario_id!, rotulo: p.nome })),
          { valor: 'sistema', rotulo: t('log.sistema') },
        ]}
        selecionada={quem}
        onSelecionar={mudar(setQuem)}
      />
      <Botao titulo={t('log.ver')} onPress={aoVer} carregando={carregandoLog} />
      <Retorno erro={erro} />

      {registros?.length === 0 && <Texto>{t('log.nenhum')}</Texto>}
      {!!registros && registros.length > 0 && !!filtrosUsados && (
        <Paginacao
          pagina={pagina}
          totalDeRegistros={totalDeRegistros}
          tamanhoDaPagina={TAMANHO_DA_PAGINA_DO_LOG}
          aoMudar={(nova) => buscar(filtrosUsados, nova)}
          desabilitado={carregandoLog}
        />
      )}
      {registros?.map((r) => {
        const momento = partesDaDataHora(r.criado_em, idioma);
        const aberto = abertos.includes(r.id);
        const mudancas = r.acao === 'update' ? mudancasDoRegistro(r, rotulosDosCampos) : [];
        return (
          <View key={r.id} style={estilos.registro}>
            <Texto variante="apoio">{t('log.quando', { quem: quemFez(r), ...momento })}</Texto>
            <Texto>{frase(r)}</Texto>
            {!!r.motivo && <Texto variante="apoio">{t('log.motivo', { motivo: r.motivo })}</Texto>}
            {mudancas.length > 0 && (
              <>
                <Botao
                  titulo={aberto ? t('log.esconderDetalhes') : t('log.verDetalhes')}
                  variante="secundario"
                  onPress={() => alternar(r.id)}
                />
                {aberto &&
                  mudancas.map((m) => (
                    <Texto key={m.campo} variante="apoio">
                      {t('log.mudanca', {
                        campo: m.rotuloDaIgreja ?? (temNome(m.campo) ? t(`log.campos.${m.campo}`) : m.campo),
                        de: legivel(m.campo, m.de) || t('log.vazio'),
                        para: legivel(m.campo, m.para) || t('log.vazio'),
                      })}
                    </Texto>
                  ))}
              </>
            )}
          </View>
        );
      })}
      {!!registros && registros.length > 0 && !!filtrosUsados && (
        <Paginacao
          pagina={pagina}
          totalDeRegistros={totalDeRegistros}
          tamanhoDaPagina={TAMANHO_DA_PAGINA_DO_LOG}
          aoMudar={(nova) => buscar(filtrosUsados, nova)}
          desabilitado={carregandoLog}
        />
      )}

      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  atalhos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.medio,
  },
  registro: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
});
