// Cria ou recria as contas de demonstração dos revisores das lojas (igreja
// fictícia, um membro e um Pastor). Rode antes de enviar uma versão às lojas;
// pode rodar quantas vezes quiser.
//
// Uso:
//   node scripts/preparar-demonstracao.mjs --local
//     (Supabase local: lê o endereço e a chave do "npx supabase status")
//   node scripts/preparar-demonstracao.mjs
//     (nuvem: antes, no PowerShell, $env:SUPABASE_URL="https://<ref>.supabase.co"
//      e $env:SUPABASE_SERVICE_ROLE_KEY="<chave secreta>"; a chave nunca vai
//      para arquivo nem para o Git)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

function conexao() {
  if (process.argv.includes('--local')) {
    const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const valor = (nome) => status.match(new RegExp(`^${nome}="?([^"\\n]*)"?$`, 'm'))?.[1];
    return { url: valor('API_URL'), chave: valor('SERVICE_ROLE_KEY') };
  }
  return { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

// A versão atual dos termos: o aceite gravado é dela, para o app não pedir
// novo aceite ao revisor.
const termos = readFileSync(new URL('../src/i18n/termos/pt-BR.ts', import.meta.url), 'utf8');
const versao = /versaoDosTermos = '([^']+)'/.exec(termos)?.[1];

const { url, chave } = conexao();
if (!url || !chave || !versao) {
  console.error('Faltam o endereço, a chave secreta ou a versão dos termos (veja o começo deste arquivo).');
  process.exit(1);
}

const banco = createClient(url, chave, { auth: { persistSession: false } });

async function preparar() {
  const { data, error } = await banco.rpc('preparar_demonstracao', { p_versao_termos: versao });
  if (error) throw new Error(`preparar_demonstracao: ${error.message}`);
  return data.faltam_logins;
}

const faltam = await preparar();
for (const email of faltam) {
  const { error } = await banco.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`criar o login de ${email}: ${error.message}`);
  console.log(`Login criado: ${email}`);
}
const aindaFaltam = faltam.length ? await preparar() : [];
if (aindaFaltam.length) throw new Error(`Ainda sem login: ${aindaFaltam.join(', ')}`);

console.log(`Pronto (${url}). Contas de demonstração, com a versão ${versao} dos termos:`);
console.log('  membro@demonstracao.invalid  (membro)');
console.log('  pastor@demonstracao.invalid  (Pastor de Governo)');
console.log('O código é o segredo CODIGO_DEMONSTRACAO da função entrar-demonstracao.');
