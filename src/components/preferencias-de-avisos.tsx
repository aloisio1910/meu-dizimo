import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Retorno } from '@/components/retorno';
import { CaixaSelecao } from '@/components/ui/caixa-selecao';
import { Texto } from '@/components/ui/texto';
import { avisosQueAPessoaPodeDesligar, type AvisoQueDesliga } from '@/lib/avisos';
import { salvarAvisosDesligados } from '@/services/supabase/avisos';
import type { MinhaFicha } from '@/services/supabase/membros';
import { cores, espacos, raio } from '@/theme';

// Meu perfil: ligar e desligar os avisos que podem ser desligados (seção 9).
// Os obrigatórios (confirmação, divergência, troca de Pix) sempre chegam.
export function PreferenciasDeAvisos({ ficha, ehTesouraria }: { ficha: MinhaFicha; ehTesouraria: boolean }) {
  const { t } = useTranslation();
  const [desligados, setDesligados] = useState<AvisoQueDesliga[]>(
    () => (ficha.avisos_desligados ?? []) as AvisoQueDesliga[],
  );
  const [retorno, setRetorno] = useState<{ aviso?: string; erro?: string }>();

  async function alternar(tipo: AvisoQueDesliga, receber: boolean) {
    const anteriores = desligados;
    const novos = receber ? desligados.filter((d) => d !== tipo) : [...desligados, tipo];
    setDesligados(novos);
    setRetorno(undefined);
    const salvou = await salvarAvisosDesligados(ficha.id, novos);
    if (salvou) {
      setRetorno({ aviso: t('perfil.avisos.salvo') });
    } else {
      setDesligados(anteriores);
      setRetorno({ erro: t('perfil.avisos.falhou') });
    }
  }

  return (
    <View style={estilos.cartao}>
      <Texto variante="destaque" accessibilityRole="header">
        {t('perfil.avisos.titulo')}
      </Texto>
      <Texto variante="apoio">{t('perfil.avisos.explicacao')}</Texto>
      {avisosQueAPessoaPodeDesligar(ehTesouraria).map((tipo) => (
        <CaixaSelecao
          key={tipo}
          rotulo={t(`perfil.avisos.tipos.${tipo}`)}
          marcado={!desligados.includes(tipo)}
          onAlterar={(receber) => alternar(tipo, receber)}
        />
      ))}
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
});
