// E-mail de convite (passo 2 do fluxo principal). Chamada pelo banco
// (pg_net) quando nasce um convite e a cada minuto para as novas tentativas;
// nunca pelo app. Reserva os convites pendentes, manda e devolve o resultado.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { emailDeConvite } from '../_shared/emails.ts';
import { enviarEmail } from '../_shared/enviar-email.ts';

type Reservado = { id: string; email: string; nome: string; igreja_nome: string; expira_em: string };

// O plano gratuito do Resend aceita 2 e-mails por segundo.
const INTERVALO_MS = 600;
const espera = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

Deno.serve(async (pedido) => {
  // Só o banco conhece o segredo (Vault); qualquer outro chamador é recusado.
  const segredo = Deno.env.get('SEGREDO_DAS_FUNCOES');
  if (!segredo || pedido.headers.get('x-segredo-das-funcoes') !== segredo) {
    return new Response('nao_autorizado', { status: 401 });
  }

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await banco.rpc('reservar_convites_para_email', { p_limite: 50 });
  if (error) return new Response(error.message, { status: 500 });
  const convites = (data ?? []) as Reservado[];

  // Links das lojas: só quando o app estiver publicado.
  const links = {
    android: Deno.env.get('LINK_ANDROID') || undefined,
    iphone: Deno.env.get('LINK_IPHONE') || undefined,
  };

  const resultados: { id: string; ok: boolean; erro: string | null }[] = [];
  for (const [i, convite] of convites.entries()) {
    if (i > 0) await espera(INTERVALO_MS);
    const envio = await enviarEmail(
      emailDeConvite({
        para: convite.email,
        nome: convite.nome,
        igreja: convite.igreja_nome,
        expiraEm: convite.expira_em,
        links,
      }),
    );
    resultados.push({ id: convite.id, ok: envio.ok, erro: envio.erro ?? null });
  }

  const { error: erroAoConcluir } = await banco.rpc('concluir_envio_de_convites', { p_resultados: resultados });
  if (erroAoConcluir) return new Response(erroAoConcluir.message, { status: 500 });

  return Response.json({ convites: convites.length, enviados: resultados.filter((r) => r.ok).length });
});
