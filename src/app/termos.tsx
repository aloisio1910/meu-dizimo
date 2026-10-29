import { useTranslation } from 'react-i18next';

import { TextoDosTermos } from '@/components/texto-dos-termos';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useVoltar } from '@/hooks/use-voltar';

// Texto completo dos Termos de Uso e da Política de Privacidade.
export default function Termos() {
  const { t } = useTranslation();
  const voltar = useVoltar('/');
  const { fichas } = useMinhasFichas();
  const igreja = fichas.find((f) => f.status === 'convidado')?.igrejas?.nome ?? t('termos.suaIgreja');

  return (
    <Tela>
      <Botao titulo={t('comum.voltar')} variante="secundario" onPress={() => voltar()} />
      <TextoDosTermos igreja={igreja} />
      <Botao titulo={t('comum.voltar')} onPress={() => voltar()} />
    </Tela>
  );
}
