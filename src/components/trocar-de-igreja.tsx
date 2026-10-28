import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';

// "Trocar de igreja" (D-061): só aparece para quem está em mais de uma.
export function TrocarDeIgreja() {
  const { t } = useTranslation();
  const router = useRouter();
  const { fichas } = useMinhasFichas();
  if (fichas.filter((f) => f.status === 'ativo').length < 2) return null;
  return (
    <Botao titulo={t('escolherIgreja.trocar')} variante="secundario" onPress={() => router.push('/escolher-igreja')} />
  );
}
