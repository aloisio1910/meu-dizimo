import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useBloqueio } from '@/hooks/use-bloqueio';
import { sair } from '@/services/supabase/auth';

// Tela que cobre o app enquanto a digital não é confirmada. O código por
// e-mail fica sempre como alternativa (D-058).
export function Desbloqueio() {
  const { t } = useTranslation();
  const { disponivel, desbloquear } = useBloqueio();
  const [falhou, setFalhou] = useState(false);
  const [aguardando, setAguardando] = useState(false);
  const jaPediu = useRef(false);

  async function pedirDigital() {
    setAguardando(true);
    const resultado = await desbloquear();
    setAguardando(false);
    setFalhou(resultado === 'falhou');
  }

  // Abre o pedido da digital sozinho ao aparecer, uma vez.
  useEffect(() => {
    if (disponivel && !jaPediu.current) {
      jaPediu.current = true;
      pedirDigital();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponivel]);

  return (
    <Tela>
      <Texto variante="titulo">{t('app.nome')}</Texto>
      <Texto>{disponivel ? t('biometria.explicacaoBloqueio') : t('biometria.indisponivel')}</Texto>
      {falhou && <Texto variante="erro">{t('biometria.naoReconhecida')}</Texto>}
      {disponivel && <Botao titulo={t('biometria.entrarComDigital')} onPress={pedirDigital} carregando={aguardando} />}
      <Botao titulo={t('biometria.entrarComCodigo')} variante="secundario" onPress={() => sair()} />
    </Tela>
  );
}
