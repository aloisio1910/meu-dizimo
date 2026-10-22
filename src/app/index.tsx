import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useBloqueio } from '@/hooks/use-bloqueio';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { sair } from '@/services/supabase/auth';

// Porta de entrada: decide para onde a pessoa vai conforme o login e as
// fichas. A parte de baixo é provisória e dará lugar ao Cartão de Dízimo (M-03).
export default function Inicio() {
  const { t } = useTranslation();
  const { sessao } = useSessao();
  const { fichas, carregando, falhou, recarregar } = useMinhasFichas();
  const { disponivel: temDigital, preferencia: escolhaDaDigital } = useBloqueio();

  if (!sessao) return <Redirect href="/entrar" />;

  if (carregando) {
    return (
      <Tela>
        <ActivityIndicator size="large" accessibilityLabel={t('comum.carregando')} />
      </Tela>
    );
  }

  if (falhou) {
    return (
      <Tela>
        <Texto>{t('inicio.falhaAoCarregar')}</Texto>
        <Botao titulo={t('comum.tentarDeNovo')} onPress={recarregar} />
      </Tela>
    );
  }

  if (fichas.some((f) => f.status === 'convidado')) return <Redirect href="/primeiro-acesso" />;
  // Depois do cadastro, oferece a digital uma vez neste aparelho (D-058).
  if (fichas.length > 0 && temDigital && !escolhaDaDigital) return <Redirect href="/ativar-digital" />;
  if (fichas.some((f) => f.status === 'ativo')) return <Redirect href="/cartao" />;

  return (
    <Tela>
      <Texto variante="titulo">{t('app.nome')}</Texto>
      <Texto>{t('inicio.bemVindo', { email: sessao.user.email })}</Texto>
      {fichas.length === 0 ? (
        <Texto>{t('inicio.semIgreja')}</Texto>
      ) : (
        <>
          {fichas.map((ficha) => (
            <Texto key={ficha.id} variante="destaque">
              {ficha.igrejas?.nome}
            </Texto>
          ))}
          <Texto variante="apoio">{t('inicio.emBreve')}</Texto>
        </>
      )}
      <Botao titulo={t('inicio.sair')} variante="secundario" onPress={() => sair()} />
    </Tela>
  );
}
