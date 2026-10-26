// Push no celular (D-096). O aviso em si é criado pelo banco; aqui o app só
// pede a permissão, descobre o endereço de push deste aparelho (token) e
// avisa quando a pessoa toca numa notificação.
//
// O Expo Go não recebe push no Android desde o SDK 53: lá tudo isto fica
// desligado e os avisos continuam na aba Avisos. A biblioteca é carregada só
// fora do Expo Go, para ela nem chegar a reclamar.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

type Notificacoes = typeof import('expo-notifications');

// Por enquanto só Android; iPhone quando houver a conta Apple Developer (D-096).
export function pushDisponivel(): boolean {
  return (
    Platform.OS === 'android' && Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

let carregada: Promise<Notificacoes> | null = null;
function biblioteca(): Promise<Notificacoes> {
  carregada ??= import('expo-notifications');
  return carregada;
}

const CANAL = 'avisos';

// Pede a permissão (no Android 13 ou mais novo aparece a pergunta do sistema)
// e devolve o token, ou null se a pessoa recusou ou não há push aqui.
export async function pedirTokenDePush(nomeDoCanal: string): Promise<string | null> {
  if (!pushDisponivel()) return null;
  const n = await biblioteca();
  // No Android o canal precisa existir antes da pergunta; é o nome que a
  // pessoa vê nas configurações de notificação do celular.
  await n.setNotificationChannelAsync(CANAL, { name: nomeDoCanal, importance: n.AndroidImportance.HIGH });
  let { status } = await n.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await n.requestPermissionsAsync());
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await n.getExpoPushTokenAsync({ projectId });
  return data;
}

// O que o envio (Edge Function) põe em cada notificação.
export type DadosDoPush = {
  notificacao_id?: string;
  igreja_id?: string;
  tipo?: string;
  dados?: Record<string, unknown>;
};

// Mostra a notificação mesmo com o app aberto e chama aoTocar quando a pessoa
// toca numa delas, inclusive a que abriu o app fechado. Devolve o desligar.
export async function ouvirNotificacoes(aoTocar: (dados: DadosDoPush) => void): Promise<() => void> {
  if (!pushDisponivel()) return () => {};
  const n = await biblioteca();
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const tratar = (resposta: import('expo-notifications').NotificationResponse) => {
    aoTocar((resposta.notification.request.content.data ?? {}) as DadosDoPush);
    // Senão, a mesma notificação seria tratada de novo na próxima abertura.
    n.clearLastNotificationResponseAsync().catch(() => {});
  };

  const assinatura = n.addNotificationResponseReceivedListener(tratar);
  const ultima = await n.getLastNotificationResponseAsync();
  if (ultima) tratar(ultima);
  return () => assinatura.remove();
}
