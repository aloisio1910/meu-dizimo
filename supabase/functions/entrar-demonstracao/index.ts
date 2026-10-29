// Entrada dos revisores da Apple e da Google, que não recebem o código por
// e-mail. Só para as contas da igreja de demonstração: com o código fixo
// (segredo CODIGO_DEMONSTRACAO), devolve um token de uso único que o app
// troca pela sessão. Bloqueia após 5 erros por 1 hora.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (corpo: Record<string, unknown>, status = 200) => Response.json(corpo, { status, headers: CORS });

// Comparação em tempo constante: o tempo da resposta não revela quantos
// dígitos estão certos.
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

Deno.serve(async (pedido) => {
  if (pedido.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const codigoCerto = Deno.env.get('CODIGO_DEMONSTRACAO') ?? '';
  if (!/^\d{6}$/.test(codigoCerto)) return responder({ erro: 'codigo_invalido' }, 400);

  let corpo: { email?: string; codigo?: string };
  try {
    corpo = await pedido.json();
  } catch {
    return responder({ erro: 'erro_inesperado' }, 400);
  }
  const email = (corpo.email ?? '').trim().toLowerCase();
  const codigo = (corpo.codigo ?? '').trim();

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: situacao, error } = await banco.rpc('situacao_da_demonstracao', { p_email: email });
  if (error) return responder({ erro: 'erro_inesperado' }, 500);
  // Fora da demonstração, a mesma resposta de um código errado: não revela
  // quais e-mails existem.
  if (situacao === 'nao') return responder({ erro: 'codigo_invalido' }, 400);
  if (situacao === 'bloqueado') return responder({ erro: 'muitas_tentativas' }, 429);

  const acertou = iguais(codigo, codigoCerto);
  await banco.rpc('registrar_tentativa_de_demonstracao', { p_email: email, p_acertou: acertou });
  if (!acertou) return responder({ erro: 'codigo_invalido' }, 400);

  // O mesmo token do link mágico, sem enviar e-mail: o app troca por sessão.
  const { data: link, error: erroNoLink } = await banco.auth.admin.generateLink({ type: 'magiclink', email });
  if (erroNoLink || !link.properties?.hashed_token) {
    console.error('entrar-demonstracao: falha ao gerar o token', erroNoLink?.message);
    return responder({ erro: 'erro_inesperado' }, 500);
  }
  return responder({ token: link.properties.hashed_token });
});
