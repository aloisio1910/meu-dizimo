import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { SeletorDeFiltroPorCampo } from '@/components/seletor-de-filtro-por-campo';
import { Botao } from '@/components/ui/botao';
import { Opcoes } from '@/components/ui/opcoes';
import { Texto } from '@/components/ui/texto';
import { hojeIso } from '@/lib/data';
import { atendeAoFiltro, type FiltroPorCampo } from '@/lib/filtro-por-campo';
import { situacaoDoMembro, type StatusDoMembro } from '@/lib/membros';
import { gerarPlanilhaEmBase64 } from '@/lib/planilha-xlsx';
import {
  contarPorSituacao,
  linhasDaPlanilhaDeMembros,
  type ColunaDeCampo,
  type MembroDoRelatorio,
} from '@/lib/relatorio-de-membros';
import { entregarPlanilha } from '@/services/dispositivo/planilha';
import type { CampoDaIgreja } from '@/services/supabase/campos-da-igreja';
import { listarMembrosDaIgreja } from '@/services/supabase/membros-da-igreja';
import { espacos } from '@/theme';

type FiltroDeSituacao = 'todos' | StatusDoMembro;

type Props = {
  igrejaId: string;
  titulo: string | undefined;
  camposFiltraveis: CampoDaIgreja[];
  colunasDeCampo: ColunaDeCampo[];
};

// Relatório de membros por situação, com os campos do cadastro e da
// tesouraria (D-093) e a planilha do Excel.
export function RelatorioDeMembros({ igrejaId, titulo, camposFiltraveis, colunasDeCampo }: Props) {
  const { t } = useTranslation();
  const [situacao, setSituacao] = useState<FiltroDeSituacao>('todos');
  const [filtroPorCampo, setFiltroPorCampo] = useState<FiltroPorCampo>();
  const [membros, setMembros] = useState<MembroDoRelatorio[]>();
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  const r = 'tesouraria.relatorios.membros';
  const mudar =
    <T,>(definir: (valor: T) => void) =>
    (valor: T) => {
      definir(valor);
      setMembros(undefined);
      setRetorno(undefined);
    };

  async function aoGerar() {
    setRetorno(undefined);
    setGerando(true);
    try {
      const agora = new Date();
      const lista = (await listarMembrosDaIgreja(igrejaId))
        .filter((m) => situacao === 'todos' || m.status === situacao)
        .filter((m) => atendeAoFiltro(m, filtroPorCampo, camposFiltraveis))
        .map((m) => ({ ...m, situacao: situacaoDoMembro(m.status, m.convites, agora) }));
      setMembros(lista);
    } catch {
      setRetorno({ erro: t('tesouraria.relatorio.falhaAoGerar') });
    }
    setGerando(false);
  }

  async function aoBaixar() {
    if (!membros) return;
    setRetorno(undefined);
    setBaixando(true);
    try {
      const c = `${r}.colunas`;
      const linhas = linhasDaPlanilhaDeMembros(membros, colunasDeCampo, {
        colunas: [
          t(`${c}.numero`),
          t(`${c}.nome`),
          t(`${c}.email`),
          t(`${c}.celular`),
          t(`${c}.situacao`),
          t(`${c}.perfil`),
          t(`${c}.dizimo`),
        ],
        situacao: (s) => t(`tesouraria.membros.situacao.${s}`),
        perfil: (p) =>
          p === 'administrador' ? (titulo ?? p) : t(`${r}.perfis.${p === 'tesoureiro' ? 'tesoureiro' : 'membro'}`),
        dizimo: (d) => t(`${r}.dizimo.${d === 'familiar' ? 'familiar' : 'individual'}`),
      });
      const arquivo = `${t(`${r}.arquivo`)}-${hojeIso()}.xlsx`;
      const base64 = gerarPlanilhaEmBase64([{ nome: t(`${r}.aba`), linhas, colunasDeValor: [] }]);
      await entregarPlanilha(arquivo, base64, t('tesouraria.relatorio.compartilhar'));
      setRetorno({ aviso: t('tesouraria.relatorio.baixado', { arquivo }) });
    } catch {
      setRetorno({ erro: t('tesouraria.relatorio.falhaAoBaixar') });
    }
    setBaixando(false);
  }

  const contagem = membros ? contarPorSituacao(membros) : null;

  return (
    <View style={{ gap: espacos.medio }}>
      <Texto>{t(`${r}.explicacao`)}</Texto>
      <Opcoes
        rotulo={t(`${r}.situacao`)}
        opcoes={[
          { valor: 'todos', rotulo: t(`${r}.todos`) },
          { valor: 'ativo', rotulo: t('tesouraria.membros.ativos') },
          { valor: 'convidado', rotulo: t('tesouraria.membros.convidados') },
          { valor: 'inativo', rotulo: t('tesouraria.membros.inativos') },
        ]}
        selecionada={situacao}
        onSelecionar={mudar(setSituacao)}
      />
      <SeletorDeFiltroPorCampo campos={camposFiltraveis} filtro={filtroPorCampo} aoMudar={mudar(setFiltroPorCampo)} />
      <Botao titulo={t(`${r}.gerar`)} onPress={aoGerar} carregando={gerando} />

      {!!membros && !!contagem && (
        <>
          <Texto variante="destaque" accessibilityRole="header">
            {t('tesouraria.membros.quantidade', { count: membros.length })}
          </Texto>
          <Texto>
            {t(`${r}.contagem`, {
              ativo: contagem.ativo,
              convidado: contagem.convidado,
              vencido: contagem.convite_vencido,
              inativo: contagem.inativo,
            })}
          </Texto>
          {membros.length === 0 ? (
            <Texto>{t(`${r}.nenhum`)}</Texto>
          ) : (
            <Botao
              titulo={Platform.OS === 'web' ? t('tesouraria.relatorio.baixar') : t('tesouraria.relatorio.compartilhar')}
              onPress={aoBaixar}
              carregando={baixando}
            />
          )}
        </>
      )}
      {!!retorno && <Retorno aviso={retorno.aviso} erro={retorno.erro} />}
    </View>
  );
}
