import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Texto } from '@/components/ui/texto';
import { buscarIgrejasInativasOndeEstou, buscarIgrejasOndeEstouInativo } from '@/services/supabase/membros';

// Pessoa logada sem ficha que dê acesso: diz se a igreja foi inativada na
// plataforma, se a pessoa foi inativada ou se o convite não existe ou
// venceu, para ela saber o que pedir à igreja.
export function SemIgreja() {
  const { t } = useTranslation();
  const [motivos, setMotivos] = useState<{ igrejaInativa: string[]; inativoEm: string[] } | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      buscarIgrejasInativasOndeEstou().catch(() => []),
      buscarIgrejasOndeEstouInativo().catch(() => []),
    ]).then(([igrejaInativa, inativoEm]) => ativo && setMotivos({ igrejaInativa, inativoEm }));
    return () => {
      ativo = false;
    };
  }, []);

  if (!motivos) return <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />;
  if (motivos.igrejaInativa.length > 0) {
    return <Texto>{t('inicio.igrejaInativa', { igrejas: motivos.igrejaInativa.join(', ') })}</Texto>;
  }
  if (motivos.inativoEm.length > 0) {
    return <Texto>{t('inicio.inativo', { igrejas: motivos.inativoEm.join(', ') })}</Texto>;
  }
  return <Texto>{t('inicio.semIgreja')}</Texto>;
}
