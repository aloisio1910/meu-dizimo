import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui/texto';
import { valoresIniciais } from '@/lib/cadastro';
import { buscarCamposDaTesouraria, type CampoDoCadastro, type MinhaFicha } from '@/services/supabase/membros';
import { cores, espacos, raio } from '@/theme';

// O que a tesouraria anotou na ficha do membro (D-093), só para leitura:
// transparência e direito de acesso da LGPD. Sem anotações, não aparece.
export function InformacoesDaTesouraria({ ficha }: { ficha: MinhaFicha }) {
  const { t } = useTranslation();
  const [campos, setCampos] = useState<CampoDoCadastro[]>([]);

  useEffect(() => {
    let ativo = true;
    buscarCamposDaTesouraria(ficha.igreja_id)
      .then((lista) => ativo && setCampos(lista))
      .catch(() => ativo && setCampos([]));
    return () => {
      ativo = false;
    };
  }, [ficha.igreja_id]);

  const valores = valoresIniciais(ficha.campos_internos);
  const preenchidos = campos.filter((campo) => !!valores[campo.chave]);
  if (preenchidos.length === 0) return null;

  return (
    <View style={estilos.cartao}>
      <Texto variante="destaque" accessibilityRole="header">
        {t('perfil.informacoesDaIgreja')}
      </Texto>
      <Texto variante="apoio">{t('perfil.informacoesDaIgrejaExplicacao')}</Texto>
      {preenchidos.map((campo) => (
        <Texto key={campo.chave}>
          {campo.rotulo}: {valores[campo.chave]}
        </Texto>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
});
