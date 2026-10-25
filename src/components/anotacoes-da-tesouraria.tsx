import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Texto } from '@/components/ui/texto';
import { converterValores, mesclarValores, valoresIniciais, type ErrosDoCadastro } from '@/lib/cadastro';
import { mascararData } from '@/lib/data';
import { salvarCamposInternos, type ErroDoConvite, type MembroDaLista } from '@/services/supabase/membros-da-igreja';
import { buscarCamposDaTesouraria, type CampoDoCadastro } from '@/services/supabase/membros';
import { cores, espacos, raio } from '@/theme';

// Valor da opção "não informado" nas listas (a lista exige uma escolha).
const SEM_VALOR = '__sem_valor__';

type Props = {
  igrejaId: string;
  membro: MembroDaLista;
  titulo: string | undefined;
  aoSalvar: () => Promise<void>;
};

// Campos preenchidos pela tesouraria na ficha do membro (D-093). O membro vê
// no perfil, sem editar. Sem campos assim na igreja, a seção não aparece.
export function AnotacoesDaTesouraria({ igrejaId, membro, titulo, aoSalvar }: Props) {
  const { t } = useTranslation();
  const [campos, setCampos] = useState<CampoDoCadastro[]>([]);
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<ErrosDoCadastro>({});
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  useEffect(() => {
    let ativo = true;
    buscarCamposDaTesouraria(igrejaId)
      .then((lista) => ativo && setCampos(lista))
      .catch(() => ativo && setCampos([]));
    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  if (campos.length === 0) return null;

  const a = 'tesouraria.membro.anotacoes';
  const guardados = valoresIniciais(membro.campos_internos);
  const mensagemDoErro = (codigo: ErroDoConvite) =>
    codigo === 'sem_conexao' || codigo === 'erro_inesperado'
      ? t(`comum.erros.${codigo}`)
      : t(`tesouraria.membros.erros.${codigo}`, { titulo });

  function abrir() {
    setValores(guardados);
    setErros({});
    setRetorno(undefined);
    setEditando(true);
  }

  async function aoSalvarAnotacoes() {
    const convertidos = converterValores(valores, campos, false);
    setErros(convertidos.erros);
    if (Object.keys(convertidos.erros).length > 0) return;
    setEnviando(true);
    const resultado = await salvarCamposInternos(
      membro.id,
      mesclarValores(
        membro.campos_internos,
        convertidos.valores,
        campos.map((campo) => campo.chave),
      ),
    );
    if (resultado.ok) await aoSalvar();
    setEnviando(false);
    if (!resultado.ok) {
      setRetorno({ erro: mensagemDoErro(resultado.erro) });
      return;
    }
    setEditando(false);
    setRetorno({ aviso: t(`${a}.salvas`) });
  }

  const erroDo = (chave: string) => {
    const codigo = erros[`campo:${chave}`];
    return codigo && t(`primeiroAcesso.erros.${codigo}`);
  };

  return (
    <View style={estilos.cartao}>
      <Texto variante="destaque" accessibilityRole="header">
        {t(`${a}.titulo`)}
      </Texto>
      <Texto variante="apoio">{t(`${a}.explicacao`)}</Texto>

      {!editando &&
        campos.map((campo) => (
          <View key={campo.chave} style={estilos.campo}>
            <Texto variante="apoio">{campo.rotulo}</Texto>
            <Texto>{guardados[campo.chave] || t('tesouraria.membro.naoInformado')}</Texto>
          </View>
        ))}

      {editando &&
        campos.map((campo) =>
          campo.tipo === 'lista' ? (
            <Opcoes
              key={campo.chave}
              rotulo={campo.rotulo}
              opcoes={[
                { valor: SEM_VALOR, rotulo: t('tesouraria.membro.naoInformado') },
                ...campo.opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao })),
              ]}
              selecionada={valores[campo.chave] || SEM_VALOR}
              onSelecionar={(opcao) =>
                setValores((atuais) => ({ ...atuais, [campo.chave]: opcao === SEM_VALOR ? '' : opcao }))
              }
              erro={erroDo(campo.chave)}
            />
          ) : (
            <CampoTexto
              key={campo.chave}
              rotulo={campo.rotulo}
              dica={campo.tipo === 'data' ? t('primeiroAcesso.dicaData') : undefined}
              value={valores[campo.chave] ?? ''}
              onChangeText={(texto) =>
                setValores((atuais) => ({
                  ...atuais,
                  [campo.chave]: campo.tipo === 'data' ? mascararData(texto) : texto,
                }))
              }
              keyboardType={campo.tipo === 'numero' ? 'decimal-pad' : campo.tipo === 'data' ? 'number-pad' : 'default'}
              erro={erroDo(campo.chave)}
            />
          ),
        )}

      {editando ? (
        <>
          <Botao titulo={t(`${a}.salvar`)} onPress={aoSalvarAnotacoes} carregando={enviando} />
          <Botao
            titulo={t(`${a}.cancelar`)}
            variante="secundario"
            onPress={() => setEditando(false)}
            desabilitado={enviando}
          />
        </>
      ) : (
        <Botao titulo={t(`${a}.editar`)} variante="secundario" onPress={abrir} />
      )}
      {!!retorno && <Retorno aviso={retorno.aviso} erro={retorno.erro} />}
    </View>
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
  campo: {
    gap: 2,
  },
});
