import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Texto } from '@/components/ui/texto';
import { buscarIgrejasOndeEstouInativo } from '@/services/supabase/membros';

// Pessoa logada sem ficha que dê acesso: diz se ela foi inativada ou se o
// convite não existe ou venceu, para ela saber o que pedir à igreja.
export function SemIgreja() {
  const { t } = useTranslation();
  const [inativoEm, setInativoEm] = useState<string[] | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarIgrejasOndeEstouInativo()
      .then((igrejas) => ativo && setInativoEm(igrejas))
      .catch(() => ativo && setInativoEm([]));
    return () => {
      ativo = false;
    };
  }, []);

  if (!inativoEm) return <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />;
  if (inativoEm.length > 0) return <Texto>{t('inicio.inativo', { igrejas: inativoEm.join(', ') })}</Texto>;
  return <Texto>{t('inicio.semIgreja')}</Texto>;
}
