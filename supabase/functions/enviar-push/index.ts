// Envio do push (D-096). Chamada pelo banco (pg_net) quando nasce um aviso e
// a cada minuto para as novas tentativas; nunca pelo app. Reserva os avisos
// pendentes, manda pelo serviço de push do Expo e devolve o resultado.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { textoDoPush } from '../_shared/texto-do-push.ts';

const ENDERECO_DO_EXPO = 'https://exp.host/--/api/v2/push/send';
// O Expo aceita até 100 mensagens por pedido.
const POR_PEDIDO = 100;

type Reservado = {
  id: string;
  igreja_id: string;
  tipo: string;
  dados: Record<string, unknown>;
  igreja_nome: string;
  titulo_administrador: string | null;
  idioma: string | null;
  tokens: string[];
};

type Mensagem = {
  to: string;
  title: string;
  body: string;
  channelId: string;
  sound: 'default';
  data: Record<string, unknown>;
};

type Recibo = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

Deno.serve(async (pedido) => {
  // Só o banco conhece o segredo (Vault); qualquer outro chamador é recusado.
  const segredo = Deno.env.get('SEGREDO_DO_ENVIO_DE_PUSH');
  if (!segredo || pedido.headers.get('x-segredo-do-envio') !== segredo) {
    return new Response('nao_autorizado', { status: 401 });
  }

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await banco.rpc('reservar_avisos_para_push', { p_limite: 100 });
  if (error) return new Response(error.message, { status: 500 });
  const avisos = (data ?? []) as Reservado[];

  const mensagens: { avisoId: string; mensagem: Mensagem }[] = [];
  const resultados = new Map<string, { id: string; ok: boolean; erro: string | null }>();
  for (const aviso of avisos) {
    if (!aviso.tokens.length) {
      resultados.set(aviso.id, { id: aviso.id, ok: false, erro: 'sem_aparelho' });
      continue;
    }
    const corpo = textoDoPush(aviso, aviso);
    for (const token of aviso.tokens) {
      mensagens.push({
        avisoId: aviso.id,
        mensagem: {
          to: token,
          title: aviso.igreja_nome,
          body: corpo,
          channelId: 'avisos',
          sound: 'default',
          // O app usa para abrir a tela certa ao tocar (use-push).
          data: { notificacao_id: aviso.id, igreja_id: aviso.igreja_id, tipo: aviso.tipo, dados: aviso.dados },
        },
      });
    }
  }

  const tokensInvalidos: string[] = [];
  for (let inicio = 0; inicio < mensagens.length; inicio += POR_PEDIDO) {
    const lote = mensagens.slice(inicio, inicio + POR_PEDIDO);
    let recibos: Recibo[] = [];
    let falhaDoLote: string | null = null;
    try {
      const resposta = await fetch(ENDERECO_DO_EXPO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lote.map((m) => m.mensagem)),
      });
      const corpo = await resposta.json();
      if (!resposta.ok || !Array.isArray(corpo.data)) falhaDoLote = `expo_${resposta.status}`;
      else recibos = corpo.data;
    } catch (erro) {
      falhaDoLote = `rede: ${String(erro)}`;
    }

    lote.forEach(({ avisoId, mensagem }, i) => {
      const recibo = recibos[i];
      const anterior = resultados.get(avisoId);
      // Basta um aparelho da pessoa receber para o aviso contar como enviado.
      if (anterior?.ok) return;
      if (recibo?.status === 'ok') {
        resultados.set(avisoId, { id: avisoId, ok: true, erro: null });
        return;
      }
      const motivo = falhaDoLote ?? (recibo?.status === 'error' ? (recibo.details?.error ?? recibo.message) : null);
      if (recibo?.status === 'error' && recibo.details?.error === 'DeviceNotRegistered') {
        tokensInvalidos.push(mensagem.to);
      }
      resultados.set(avisoId, { id: avisoId, ok: false, erro: motivo ?? 'sem_resposta' });
    });
  }

  const { error: erroAoConcluir } = await banco.rpc('concluir_envio_de_push', {
    p_resultados: [...resultados.values()],
    p_tokens_invalidos: tokensInvalidos,
  });
  if (erroAoConcluir) return new Response(erroAoConcluir.message, { status: 500 });

  const enviados = [...resultados.values()].filter((r) => r.ok).length;
  return Response.json({ avisos: avisos.length, enviados });
});
