import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useSessao } from '@/hooks/use-sessao';
import { sair } from '@/services/supabase/auth';

// Tela provisória de quem já entrou; dará lugar ao Cartão de Dízimo (M-03)
// ou ao Primeiro acesso (M-02).
export default function Inicio() {
  const { t } = useTranslation();
  const { sessao } = useSessao();

  if (!sessao) return <Redirect href="/entrar" />;

  return (
    <Tela>
      <Texto variante="titulo">{t('app.nome')}</Texto>
      <Texto>{t('inicio.bemVindo', { email: sessao.user.email })}</Texto>
      <Texto variante="apoio">{t('inicio.emBreve')}</Texto>
      <Botao titulo={t('inicio.sair')} variante="secundario" onPress={() => sair()} />
    </Tela>
  );
}
