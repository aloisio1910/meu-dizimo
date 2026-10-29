// Excluir a conta pelo app (Apple 5.1.1(v), Google). Chamada pelo app com o
// login de quem pede. As regras ficam no banco (anonimizar_conta); aqui só o
// que exige a chave service_role: anonimizar o login no Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

// A tesouraria usa a versão web: o navegador pergunta antes (OPTIONS).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ERROS_CONHECIDOS = ['pastor_precisa_trocar', 'admin_master_pelo_suporte'];

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

  // A segunda confirmação: a pessoa digitou EXCLUIR.
  let corpo: { confirmacao?: string };
  try {
    corpo = await pedido.json();
  } catch {
    return responder({ erro: 'erro_inesperado' }, 400);
  }
  if ((corpo.confirmacao ?? '').trim().toUpperCase() !== 'EXCLUIR') {
    return responder({ erro: 'confirmacao_invalida' }, 400);
  }

  // Primeiro os dados da igreja (se isto falhar, nada muda); depois o login.
  const { error } = await banco.rpc('anonimizar_conta', { p_usuario: autor.user.id });
  if (error) {
    const codigo = ERROS_CONHECIDOS.find((c) => error.message === c) ?? 'erro_inesperado';
    return responder({ erro: codigo }, 400);
  }

  // Exclusão com anonimização: o login some (e-mail apagado, sem acesso), mas
  // o registro fica, porque lançamentos e o log apontam para ele.
  const { error: erroNoLogin } = await banco.auth.admin.deleteUser(autor.user.id, true);
  if (erroNoLogin) {
    console.error('excluir-conta: falha ao anonimizar o login', erroNoLogin.message);
    return responder({ erro: 'erro_inesperado' }, 500);
  }

  return responder({ ok: true });
});
