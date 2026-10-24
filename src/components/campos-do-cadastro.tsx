import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { Texto } from '@/components/ui/texto';
import type { FormularioDoCadastro } from '@/hooks/use-formulario-do-cadastro';
import { mascararData } from '@/lib/data';
import type { CampoDoCadastro } from '@/services/supabase/membros';
import { espacos } from '@/theme';

// Campos do cadastro do membro: nome, celular, campos da igreja e dízimo
// individual ou familiar. Usado no Primeiro acesso e no Meu perfil.
export function CamposDoCadastro({ formulario }: { formulario: FormularioDoCadastro }) {
  const { t } = useTranslation();
  const { erros } = formulario;
  const erro = (chave: string) => (erros[chave] ? t(`primeiroAcesso.erros.${erros[chave]}`) : undefined);
  const rotuloDoCampo = (campo: CampoDoCadastro) =>
    t(campo.obrigatorio ? 'comum.obrigatorio' : 'comum.opcional', { rotulo: campo.rotulo });

  return (
    <>
      <CampoTexto
        rotulo={t('primeiroAcesso.rotuloNome')}
        value={formulario.nome}
        onChangeText={formulario.setNome}
        erro={erro('nome')}
        autoComplete="name"
        textContentType="name"
      />
      <CampoTexto
        rotulo={t('primeiroAcesso.rotuloCelular')}
        value={formulario.celular}
        onChangeText={formulario.setCelular}
        erro={erro('celular')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      {(formulario.campos ?? []).map((campo) =>
        campo.tipo === 'lista' ? (
          <Opcoes
            key={campo.id}
            rotulo={rotuloDoCampo(campo)}
            opcoes={campo.opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao }))}
            selecionada={formulario.valores[campo.chave] || undefined}
            onSelecionar={(valor) => formulario.alterarValor(campo.chave, valor)}
            erro={erro(`campo:${campo.chave}`)}
          />
        ) : (
          <CampoTexto
            key={campo.id}
            rotulo={rotuloDoCampo(campo)}
            dica={campo.tipo === 'data' ? t('primeiroAcesso.dicaData') : undefined}
            value={formulario.valores[campo.chave] ?? ''}
            onChangeText={(texto) =>
              formulario.alterarValor(campo.chave, campo.tipo === 'data' ? mascararData(texto) : texto)
            }
            erro={erro(`campo:${campo.chave}`)}
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
        selecionada={formulario.tipoDizimo}
        onSelecionar={formulario.setTipoDizimo}
      />

      {formulario.tipoDizimo === 'familiar' && (
        <View style={estilos.bloco}>
          {formulario.familiares.length > 0 && <Texto>{t('primeiroAcesso.familiaresAdicionados')}</Texto>}
          {formulario.familiares.map((familiar, indice) => (
            <View key={`${familiar}-${indice}`} style={estilos.bloco}>
              <Texto variante="destaque">{familiar}</Texto>
              <Botao
                titulo={t('primeiroAcesso.remover', { nome: familiar })}
                variante="secundario"
                onPress={() => formulario.removerFamiliar(indice)}
              />
            </View>
          ))}
          <CampoTexto
            rotulo={t('primeiroAcesso.rotuloFamiliar')}
            value={formulario.novoFamiliar}
            onChangeText={formulario.setNovoFamiliar}
            erro={erro('familiares')}
            returnKeyType="done"
            onSubmitEditing={formulario.adicionarFamiliar}
          />
          <Botao
            titulo={t('primeiroAcesso.adicionarFamiliar')}
            variante="secundario"
            onPress={formulario.adicionarFamiliar}
          />
        </View>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  bloco: {
    gap: espacos.medio,
  },
});
