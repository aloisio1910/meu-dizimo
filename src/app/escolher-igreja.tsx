import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useSessao } from '@/hooks/use-sessao';
import { useTema } from '@/hooks/use-tema';
import { useVoltar } from '@/hooks/use-voltar';
import { cores, espacos, raio } from '@/theme';

// Seletor de igreja (D-061): quem está em mais de uma igreja escolhe qual
// usar. Cada igreja tem o seu Cartão, as suas ofertas e o seu perfil; a
// escolha fica guardada neste aparelho e pode ser trocada a qualquer hora.
export default function EscolherIgreja() {
  const { t } = useTranslation();
  const router = useRouter();
  const tema = useTema();
  const voltar = useVoltar('/');
  const { sessao } = useSessao();
  const { fichas, fichaEmUso, precisaEscolherIgreja, escolherIgreja, carregando } = useMinhasFichas();

  if (!sessao) return <Redirect href="/" />;
  const ativas = fichas.filter((f) => f.status === 'ativo');
  if (!carregando && ativas.length < 2) return <Redirect href="/" />;

  function aoEscolher(igrejaId: string) {
    escolherIgreja(igrejaId);
    // A porta de entrada leva à tela certa para o perfil nesta igreja.
    router.replace('/');
  }

  return (
    <Tela>
      <Texto variante="titulo">{t('escolherIgreja.titulo')}</Texto>
      <Texto>{t('escolherIgreja.explicacao')}</Texto>
      {ativas.map((ficha) => {
        const emUso = !precisaEscolherIgreja && ficha.id === fichaEmUso?.id;
        const perfil =
          ficha.perfil === 'administrador'
            ? ficha.igrejas?.titulo_administrador
            : t(`escolherIgreja.perfis.${ficha.perfil === 'tesoureiro' ? 'tesoureiro' : 'membro'}`);
        return (
          <Pressable
            key={ficha.id}
            accessibilityRole="button"
            accessibilityLabel={ficha.igrejas?.nome}
            accessibilityState={{ selected: emUso }}
            onPress={() => aoEscolher(ficha.igreja_id)}
            style={({ pressed }) => [
              estilos.igreja,
              emUso && { borderColor: tema.corPrincipal, borderWidth: 2 },
              pressed && estilos.pressionado,
            ]}
          >
            <Texto variante="destaque">{ficha.igrejas?.nome}</Texto>
            <Texto variante="apoio">{t('escolherIgreja.numero', { numero: ficha.numero, perfil })}</Texto>
            {emUso && <Texto style={{ color: tema.corPrincipal }}>{t('escolherIgreja.emUso')}</Texto>}
          </Pressable>
        );
      })}
      {!precisaEscolherIgreja && (
        <Botao titulo={t('escolherIgreja.voltar')} variante="secundario" onPress={() => voltar()} />
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  igreja: {
    gap: espacos.pequeno,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  pressionado: {
    backgroundColor: cores.fundoPressionado,
  },
});
