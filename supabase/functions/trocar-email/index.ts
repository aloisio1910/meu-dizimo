// Troca de e-mail pela tesouraria (D-097). Chamada pelo app com o login de
// quem pede. As regras ficam no banco (trocar_email_do_membro); aqui só o
// que exige a chave service_role: trocar o login no Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { emailDeTrocaDeEmail } from '../_shared/emails.ts';
import { enviarEmail } from '../_shared/enviar-email.ts';

// A tesouraria usa a versão web: o navegador pergunta antes (OPTIONS).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Recusas do banco que o app sabe explicar (cada uma tem texto no i18n).
const ERROS_CONHECIDOS = [
  'sem_permissao',
  'email_proprio',
  'pastor_pelo_suporte',
  'membro_inativo',
  'motivo_obrigatorio',
  'email_invalido',
  'email_igual',
  'email_ja_cadastrado',
  'email_ja_tem_login',
  'esta_em_outra_igreja',
];

const responder = (corpo: Record<string, unknown>, status = 200) => Response.json(corpo, { status, headers: CORS });

Deno.serve(async (pedido) => {
  if (pedido.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Quem pede: o login que veio no pedido, conferido pelo próprio Auth.
  const jwt = (pedido.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: autor } = await banco.auth.getUser(jwt);
  if (!autor?.user) return responder({ erro: 'nao_autenticado' }, 401);

  let corpo: { membro_id?: string; email?: string; motivo?: string };
  try {
    corpo = await pedido.json();
  } catch {
    return responder({ erro: 'erro_inesperado' }, 400);
  }
  const email = (corpo.email ?? '').trim().toLowerCase();
  const motivo = (corpo.motivo ?? '').trim();

  const { data: troca, error } = await banco.rpc('trocar_email_do_membro', {
    p_autor: autor.user.id,
    p_membro_id: corpo.membro_id,
    p_email: email,
    p_motivo: motivo,
  });
  if (error) {
    const codigo = ERROS_CONHECIDOS.find((c) => error.message === c) ?? 'erro_inesperado';
    return responder({ erro: codigo }, 400);
  }

  // Quem já entrou: o login muda junto. Se falhar, a ficha volta a ser como era.
  if (troca.usuario_id) {
    const { error: erroNoLogin } = await banco.auth.admin.updateUserById(troca.usuario_id, {
      email,
      email_confirm: true,
    });
    if (erroNoLogin) {
      await banco.rpc('desfazer_troca_de_email', {
        p_autor: autor.user.id,
        p_membro_id: corpo.membro_id,
        p_email_antigo: troca.email_antigo,
      });
      return responder({ erro: erroNoLogin.code === 'email_exists' ? 'email_ja_tem_login' : 'erro_inesperado' }, 400);
    }
    await banco.rpc('avisar_troca_de_email', { p_membro_id: corpo.membro_id });
  }

  // O aviso ao e-mail antigo não desfaz a troca se falhar: o app só informa.
  const aviso = await enviarEmail(
    emailDeTrocaDeEmail({
      para: troca.email_antigo,
      nome: troca.nome,
      igreja: troca.igreja_nome,
      emailNovo: email,
      motivo,
      tituloAdministrador: troca.titulo_administrador,
    }),
  );
  if (!aviso.ok) console.error('trocar-email: aviso ao e-mail antigo falhou', aviso.erro);

  return responder({ ok: true, avisoPorEmail: aviso.ok });
});
