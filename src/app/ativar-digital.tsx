import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useBloqueio } from '@/hooks/use-bloqueio';

// Oferta, depois do primeiro acesso, para entrar pela digital nas próximas vezes (D-058).
export default function AtivarDigital() {
  const { t } = useTranslation();
  const { disponivel, preferencia, ativar, recusar } = useBloqueio();
  const [aguardando, setAguardando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  // Já decidiu (ou o celular não tem digital): segue para o início.
  if (!disponivel || preferencia) return <Redirect href="/" />;

  async function aoAtivar() {
    setAguardando(true);
    setFalhou(false);
    const resultado = await ativar();
    setAguardando(false);
    if (resultado === 'falhou') setFalhou(true);
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('biometria.tituloOferta')}</Texto>
      <Texto>{t('biometria.explicacaoOferta')}</Texto>
      <Texto variante="apoio">{t('biometria.privacidade')}</Texto>
      {falhou && <Texto variante="erro">{t('biometria.naoFoiPossivelAtivar')}</Texto>}
      <Botao titulo={t('biometria.ativar')} onPress={aoAtivar} carregando={aguardando} />
      <Botao titulo={t('biometria.agoraNao')} variante="secundario" onPress={recusar} desabilitado={aguardando} />
    </Tela>
  );
}
