import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { camposFiltraveis, type FiltroPorCampo } from '@/lib/filtro-por-campo';
import { listarTodosOsCampos, type CampoDaIgreja } from '@/services/supabase/campos-da-igreja';
import { espacos } from '@/theme';

const NENHUM = '__nenhum__';

// Campos ativos da igreja que servem de filtro (lista e texto).
export function useCamposFiltraveis(igrejaId: string | undefined): CampoDaIgreja[] {
  const [campos, setCampos] = useState<CampoDaIgreja[]>([]);
  useEffect(() => {
    if (!igrejaId) return;
    let ativo = true;
    listarTodosOsCampos(igrejaId)
      .then((lista) => ativo && setCampos(camposFiltraveis(lista.filter((c) => c.ativo))))
      .catch(() => ativo && setCampos([]));
    return () => {
      ativo = false;
    };
  }, [igrejaId]);
  return campos;
}

type Props = {
  campos: CampoDaIgreja[];
  filtro: FiltroPorCampo | undefined;
  aoMudar: (filtro: FiltroPorCampo | undefined) => void;
};

// Escolhe o campo e, conforme o tipo, a opção (lista) ou um trecho (texto).
// Sem campos que sirvam de filtro, não aparece.
export function SeletorDeFiltroPorCampo({ campos, filtro, aoMudar }: Props) {
  const { t } = useTranslation();
  if (campos.length === 0) return null;
  const campo = campos.find((c) => c.chave === filtro?.chave);

  return (
    <View style={{ gap: espacos.medio }}>
      <Opcoes
        rotulo={t('filtroPorCampo.rotulo')}
        opcoes={[
          { valor: NENHUM, rotulo: t('filtroPorCampo.nenhum') },
          ...campos.map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
        ]}
        selecionada={filtro?.chave ?? NENHUM}
        onSelecionar={(chave) => aoMudar(chave === NENHUM ? undefined : { chave, valor: '' })}
      />
      {campo?.tipo === 'lista' && (
        <Opcoes
          rotulo={campo.rotulo}
          opcoes={campo.opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao }))}
          selecionada={filtro?.valor || undefined}
          onSelecionar={(valor) => aoMudar({ chave: campo.chave, valor })}
        />
      )}
      {campo?.tipo === 'texto' && (
        <CampoTexto
          rotulo={campo.rotulo}
          dica={t('filtroPorCampo.dicaTexto')}
          value={filtro?.valor ?? ''}
          onChangeText={(valor) => aoMudar({ chave: campo.chave, valor })}
          autoCorrect={false}
        />
      )}
    </View>
  );
}
