// Entra no app web pela tela de login de verdade (e-mail + código do Mailpit)
// num Edge sem janela e segue uma lista de passos.
// Uso: node scripts/navegar-na-web.mjs <email> "<passo>|<passo>..." (APP=http://localhost:8090)
//   passo: "ir:/caminho" | "tocar:Texto do botão" | "digitar:Rótulo=valor" | "ler"
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [email, roteiro = 'ler'] = process.argv.slice(2);
const APP = process.env.APP || 'http://localhost:8090';
// localhost: pelo 127.0.0.1, o Node às vezes perde a conexão com o Mailpit.
const MAILPIT = 'http://localhost:54324';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const perfil = mkdtempSync(join(tmpdir(), 'edge-'));
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9334',
  `--user-data-dir=${perfil}`,
  'about:blank',
]);
let alvo;
for (let i = 0; i < 40 && !alvo; i++) {
  await espera(500);
  try {
    alvo = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0;
const pendentes = new Map();
const enviar = (method, params = {}) =>
  new Promise((resolver) => {
    const id = ++n;
    pendentes.set(id, resolver);
    ws.send(JSON.stringify({ id, method, params }));
  });
const erros = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendentes.has(m.id)) pendentes.get(m.id)(m.result);
  if (m.method === 'Runtime.exceptionThrown')
    erros.push('EXCEÇÃO: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 800));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    erros.push(
      'ERRO: ' +
        m.params.args
          .map((a) => a.value ?? a.description)
          .join(' ')
          .slice(0, 800),
    );
  }
  if (
    m.method === 'Network.responseReceived' &&
    m.params.response.status >= 400 &&
    m.params.response.url.includes(':54321')
  ) {
    erros.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url.slice(0, 200));
  }
});
await enviar('Runtime.enable');
await enviar('Page.enable');
await enviar('Network.enable');
const avaliar = async (expressao) =>
  (await enviar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true })).result?.value;

// Preenche um campo pelo rótulo (accessibilityLabel vira aria-label).
const digitar = (rotulo, valor) =>
  avaliar(`(() => {
    const campo = [...document.querySelectorAll('input,textarea')].find((c) => c.getAttribute('aria-label') === ${JSON.stringify(rotulo)});
    if (!campo) return 'sem campo ' + ${JSON.stringify(rotulo)};
    const prot = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prot, 'value').set.call(campo, ${JSON.stringify(valor)});
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
const tocar = (texto) =>
  avaliar(
    `[...document.querySelectorAll('[role=button],[role=radio]')].find((e) => (e.getAttribute('aria-label') || e.innerText).trim() === ${JSON.stringify(texto)})?.click() ?? 'sem botão ' + ${JSON.stringify(texto)}`,
  );
const ler = () =>
  avaliar(
    `location.pathname + ' | ' + document.body.innerText.slice(0, ${Number(process.env.TAMANHO_DO_TEXTO || 1500)}).replace(/\\s+/g, ' ')`,
  );

// Login pela tela.
const inicio = new Date();
await enviar('Page.navigate', { url: APP + '/entrar' });
await espera(10000);
console.log(await digitar('Seu e-mail', email));
console.log(await tocar('Enviar código'));
let codigo;
for (let i = 0; i < 30 && !codigo; i++) {
  await espera(500);
  let msg;
  try {
    const lista = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json();
    const id = lista.messages?.find((m) => new Date(m.Created) > inicio)?.ID;
    if (!id) continue;
    msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
  } catch {
    continue;
  }
  codigo = (msg.Text || '').match(/\b\d{6}\b/)?.[0];
}
console.log('código:', codigo ? 'recebido' : 'não chegou');
await espera(1500);
console.log(await digitar('Código de 6 números', codigo ?? ''));
console.log(await tocar('Entrar'));
await espera(8000);

for (const passo of roteiro.split('|').filter(Boolean)) {
  const [tipo, ...resto] = passo.split(':');
  const arg = resto.join(':');
  if (tipo === 'ir') {
    await avaliar(
      `window.history.pushState({}, '', ${JSON.stringify(arg)}); dispatchEvent(new PopStateEvent('popstate')); 'ok'`,
    );
    await espera(6000);
  } else if (tipo === 'tocar') {
    console.log('tocar', arg, '→', (await tocar(arg)) ?? 'ok');
    await espera(5000);
  } else if (tipo === 'digitar') {
    const [rotulo, valor] = arg.split('=');
    console.log('digitar', rotulo, '→', await digitar(rotulo, valor));
    await espera(500);
  } else if (tipo === 'ler') {
    console.log('PÁGINA:', await ler());
  }
}
console.log(erros.length ? erros.join('\n') : 'sem erros no console');
ws.close();
edge.kill();
process.exit(0);
