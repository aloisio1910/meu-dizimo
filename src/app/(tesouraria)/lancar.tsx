import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { CamposDoDizimo } from '@/components/campos-do-dizimo';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useVoltar } from '@/hooks/use-voltar';
import { hojeIso, isoParaData } from '@/lib/data';
import { formatarMoeda } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import { filtrarMembros } from '@/lib/membros';
import { validarDizimo, type DadosDoDizimo, type ErrosDoDizimo } from '@/lib/validar-dizimo';
import { existeLancamentoIgual, registrarDizimo } from '@/services/supabase/lancamentos';
import { listarMembrosDaIgreja, type MembroDaLista } from '@/services/supabase/membros-da-igreja';
import { listarCampanhasAtivas, type Campanha } from '@/services/supabase/ofertas';
import { cores, espacos, raio } from '@/theme';

type Etapa = 'escolher' | 'formulario' | 'duplicado' | 'confirmar' | 'lancado';
type Tipo = 'dizimo' | 'oferta';

// Quantos resultados a busca mostra de uma vez.
const LIMITE_DA_BUSCA = 20;

// T-05 Lançar para membro (devolução presencial, RN-033): o tesoureiro acha o
// membro pelos dados do envelope e lança. O banco grava já como Confirmado.
export default function LancarParaMembro() {
  const { t } = useTranslation();
  const voltar = useVoltar('/fila');
  const { membro: membroDaFicha } = useLocalSearchParams<{ membro?: string }>();
  const { ficha, carregando, ehTesouraria } = useFichaAtiva();

  const [membros, setMembros] = useState<MembroDaLista[] | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<MembroDaLista>();
  const [tipo, setTipo] = useState<Tipo>('dizimo');
  const [campanhaId, setCampanhaId] = useState<string>();
  const [erroDaCampanha, setErroDaCampanha] = useState<string>();
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => isoParaData(hojeIso()));
  const [forma, setForma] = useState<string>();
  const [erros, setErros] = useState<ErrosDoDizimo>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [lancamento, setLancamento] = useState<DadosDoDizimo>();

  const igrejaId = ficha?.igreja_id;
  const minhaFichaId = ficha?.id;
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    (async () => {
      try {
        const [lista, abertas] = await Promise.all([listarMembrosDaIgreja(igrejaId), listarCampanhasAtivas(igrejaId)]);
        if (!ativo) return;
        // Inativo não recebe lançamento; o próprio dízimo vai pelo Cartão, para
        // passar pela conferência de outra pessoa (RN-034).
        const lancaveis = lista.filter((m) => m.status !== 'inativo' && m.id !== minhaFichaId);
        setMembros(lancaveis);
        setCampanhas(abertas);
        const daFicha = lancaveis.find((m) => m.id === membroDaFicha);
        if (daFicha) {
          setEscolhido(daFicha);
          setEtapa('formulario');
        }
      } catch {
        if (ativo) setFalhou(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [igrejaId, minhaFichaId, membroDaFicha]);

  if (!carregando && (!ficha || !ehTesouraria)) return <Redirect href="/" />;
  if (!ficha) return null;

  const igreja = ficha.igrejas;
  const moeda = igreja?.moeda ?? 'BRL';
  const idioma = igreja?.idioma ?? 'pt-BR';
  const emMoeda = (centavos: number) => formatarMoeda(centavos, moeda, idioma);
  const nomeDaForma = (f: string) => (ehFormaConhecida(f) ? t(`formas.${f}`) : f);
  const formasAceitas = igreja?.formas_devolucao ?? [];
  const campanha = campanhas.find((c) => c.id === campanhaId);

  function escolher(membro: MembroDaLista) {
    setEscolhido(membro);
    setErroGeral(undefined);
    // Envelope costuma ser em dinheiro: já vem marcado, se a igreja aceita.
    if (!forma && formasAceitas.includes('dinheiro')) setForma('dinheiro');
    setEtapa('formulario');
  }

  function recomecar(mesmoMembro: boolean) {
    setValor('');
    setData(isoParaData(hojeIso()));
    setErros({});
    setErroGeral(undefined);
    setLancamento(undefined);
    if (!mesmoMembro) {
      setEscolhido(undefined);
      setBusca('');
    }
    setEtapa(mesmoMembro ? 'formulario' : 'escolher');
  }

  async function aoRevisar() {
    const resultado = validarDizimo({ valor, data, forma }, hojeIso());
    setErros(resultado.ok ? {} : resultado.erros);
    const faltaCampanha = tipo === 'oferta' && !campanha;
    setErroDaCampanha(faltaCampanha ? t('tesouraria.lancar.escolhaCampanha') : undefined);
    setErroGeral(undefined);
    if (!resultado.ok || faltaCampanha || !escolhido) return;
    setLancamento(resultado.dados);
    setEnviando(true);
    // RN-032: mesmo valor na mesma data gera alerta, não bloqueio.
    const repetido = await existeLancamentoIgual(escolhido.id, resultado.dados.centavos, resultado.dados.data, tipo).catch(
      () => false,
    );
    setEnviando(false);
    setEtapa(repetido ? 'duplicado' : 'confirmar');
  }

  async function aoLancar() {
    if (!escolhido || !lancamento) return;
    setEnviando(true);
    const resultado = await registrarDizimo({
      igrejaId: ficha!.igreja_id,
      membroId: escolhido.id,
      valorEmCentavos: lancamento.centavos,
      moeda,
      data: lancamento.data,
      forma: lancamento.forma,
      campanhaId: tipo === 'oferta' ? campanha?.id : undefined,
    });
    setEnviando(false);
    if (!resultado.ok) {
      setEtapa('formulario');
      setErroGeral(
        resultado.erro === 'sem_conexao' || resultado.erro === 'erro_inesperado'
          ? t(`comum.erros.${resultado.erro}`)
          : t(`registrar.erros.${resultado.erro}`),
      );
      return;
    }
    setEtapa('lancado');
  }

  if (falhou) {
    return (
      <Tela>
        <Texto variante="erro">{t('tesouraria.lancar.falhaAoCarregar')}</Texto>
        <Botao titulo={t('tesouraria.lancar.voltar')} onPress={() => voltar()} />
      </Tela>
    );
  }

  if (!membros) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (etapa === 'lancado' && escolhido && lancamento) {
    return (
      <Tela>
        <Texto variante="titulo">{t('tesouraria.lancar.lancado')}</Texto>
        <Texto>
          {t('tesouraria.lancar.lancadoDetalhe', {
            valor: emMoeda(lancamento.centavos),
            nome: escolhido.nome,
            data: isoParaData(lancamento.data),
          })}
        </Texto>
        <Botao titulo={t('tesouraria.lancar.outroParaMesmo', { nome: escolhido.nome })} onPress={() => recomecar(true)} />
        <Botao titulo={t('tesouraria.lancar.outroMembro')} variante="secundario" onPress={() => recomecar(false)} />
        <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => voltar()} />
      </Tela>
    );
  }

  if ((etapa === 'duplicado' || etapa === 'confirmar') && escolhido && lancamento) {
    const partes = {
      valor: emMoeda(lancamento.centavos),
      nome: escolhido.nome,
      data: isoParaData(lancamento.data),
      forma: nomeDaForma(lancamento.forma),
      campanha: campanha?.nome ?? '',
    };
    if (etapa === 'duplicado') {
      return (
        <Tela>
          <Texto variante="titulo">{t('tesouraria.lancar.duplicadoTitulo')}</Texto>
          <Texto>{t('tesouraria.lancar.duplicado', partes)}</Texto>
          <Botao titulo={t('tesouraria.lancar.lancarMesmoAssim')} onPress={() => setEtapa('confirmar')} />
          <Botao titulo={t('tesouraria.lancar.corrigir')} variante="secundario" onPress={() => setEtapa('formulario')} />
        </Tela>
      );
    }
    return (
      <Tela>
        <Texto variante="titulo">{t('tesouraria.lancar.confirmarTitulo')}</Texto>
        <Texto variante="destaque">
          {tipo === 'oferta' ? t('tesouraria.lancar.resumoOferta', partes) : t('tesouraria.lancar.resumoDizimo', partes)}
        </Texto>
        <Texto>{t('tesouraria.lancar.avisoConfirmado')}</Texto>
        <Botao titulo={t('tesouraria.lancar.lancarAgora')} onPress={aoLancar} carregando={enviando} />
        <Botao
          titulo={t('tesouraria.lancar.corrigir')}
          variante="secundario"
          onPress={() => setEtapa('formulario')}
          desabilitado={enviando}
        />
      </Tela>
    );
  }

  if (etapa === 'formulario' && escolhido) {
    return (
      <Tela>
        <Texto variante="titulo">{t('tesouraria.lancar.titulo')}</Texto>
        <Texto variante="destaque">
          {t('tesouraria.lancar.paraQuem', { nome: escolhido.nome, numero: escolhido.numero })}
        </Texto>
        <Opcoes
          rotulo={t('tesouraria.lancar.tipo')}
          opcoes={[
            { valor: 'dizimo', rotulo: t('tesouraria.lancar.dizimo') },
            { valor: 'oferta', rotulo: t('tesouraria.lancar.oferta') },
          ]}
          selecionada={tipo}
          onSelecionar={setTipo}
        />
        {tipo === 'oferta' &&
          (campanhas.length === 0 ? (
            <Texto variante="erro">{t('tesouraria.lancar.semCampanhas')}</Texto>
          ) : (
            <Opcoes
              rotulo={t('tesouraria.lancar.campanha')}
              opcoes={campanhas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              selecionada={campanhaId}
              onSelecionar={setCampanhaId}
              erro={erroDaCampanha}
            />
          ))}
        <CamposDoDizimo
          valor={valor}
          aoMudarValor={setValor}
          data={data}
          aoMudarData={setData}
          forma={forma}
          aoMudarForma={setForma}
          formasAceitas={formasAceitas}
          erros={erros}
          oferta={tipo === 'oferta'}
        />
        {!!erroGeral && <Texto variante="erro">{erroGeral}</Texto>}
        <Botao titulo={t('tesouraria.lancar.revisar')} onPress={aoRevisar} carregando={enviando} />
        <Botao titulo={t('tesouraria.lancar.trocarMembro')} variante="secundario" onPress={() => recomecar(false)} />
      </Tela>
    );
  }

  const encontrados = busca.trim() ? filtrarMembros(membros, busca).slice(0, LIMITE_DA_BUSCA) : [];

  return (
    <Tela larga>
      <Texto variante="apoio">{igreja?.nome}</Texto>
      <Texto variante="titulo">{t('tesouraria.lancar.titulo')}</Texto>
      <Texto>{t('tesouraria.lancar.explicacao')}</Texto>
      <CampoTexto
        rotulo={t('tesouraria.lancar.buscar')}
        dica={t('tesouraria.lancar.dicaBuscar')}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {!busca.trim() && <Texto variante="apoio">{t('tesouraria.lancar.digiteParaBuscar')}</Texto>}
      {!!busca.trim() && encontrados.length === 0 && <Texto>{t('tesouraria.lancar.nenhum')}</Texto>}
      {encontrados.map((membro) => (
        <Pressable
          key={membro.id}
          accessibilityRole="button"
          accessibilityLabel={t('tesouraria.lancar.escolher', { nome: membro.nome })}
          onPress={() => escolher(membro)}
          style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
        >
          <Texto variante="destaque">{membro.nome}</Texto>
          <Texto variante="apoio">
            {t('tesouraria.membros.numero', { numero: membro.numero })} · {membro.celular} · {membro.email}
          </Texto>
        </Pressable>
      ))}
      <Botao titulo={t('tesouraria.lancar.voltar')} variante="secundario" onPress={() => voltar()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linha: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionada: {
    backgroundColor: cores.fundoPressionado,
  },
});
