import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = new URL('./', import.meta.url);
const tabs = await (await fetch('http://127.0.0.1:9223/json')).json();
const tab = tabs.find(t => t.type === 'page' && t.url === 'about:blank') ?? tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });

// Todas as chamadas ao serviço de dados são simuladas no navegador.
// Nenhum cadastro, login, pagamento ou evento real é usado ou alterado.
const fixture = function () {
  if (location.origin !== 'http://127.0.0.1:5173') return;
  const profile = new URL(location.href).searchParams.get('perfilTeste') || 'gerente';
  const uid = '00000000-0000-4000-8000-000000000001';
  const user = { id: uid, nome: 'Gerente de teste', email: 'mobile@example.test', perfil: profile, ativo: true, telas: null };
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(15, 0, 0, 0);
  const end = new Date(start); end.setHours(18);
  const db = {
    usuarios: [user], configuracoes: [], historico: [],
    profissionais: [{ id: 'p1', usuario_id: uid, nome: 'Profissional de teste', telefone: '11999990000', email: 'mobile@example.test', funcoes: profile === 'gerente' || profile === 'diretora' || profile === 'assistente' ? ['artista'] : [profile], disponibilidade: 'Todos os dias', ativo: true }],
    personagens: [{ id: 'pe1', nome: 'Princesa de teste', descricao: 'Personagem para validação mobile', referencias: null, orientacoes: 'Orientação de teste', ativo: true }],
    profissional_personagens: [{ profissional_id: 'p1', personagem_id: 'pe1' }],
    fantasias: [{ id: 'f1', personagem_id: 'pe1', identificacao: 'Fantasia de teste', tamanho: 'M', quantidade: 1, situacao: 'disponivel', previsao_disponivel: null, observacoes: null }],
    contratantes: [{ id: 'c1', nome: 'Contratante de teste', telefone: '11999990000', email: 'contratante@example.test' }],
    locais: [{ id: 'l1', nome: 'Buffet de teste', tipo: 'buffet', endereco: 'Rua de teste, 100', contato: null, link_localizacao: null, orientacoes_acesso: null, ativo: true }],
    veiculos: [{ id: 'v1', nome: 'Veículo de teste', placa: 'ABC1D23', observacoes: null, ativo: true }],
    eventos: [{ id: 'e1', titulo: 'Festa de teste no celular', aniversariante: 'João Maria', idade: 5, contratante_id: 'c1', local_id: 'l1', inicio: start.toISOString(), fim: end.toISOString(), situacao: 'confirmado', tem_maquiagem: false, maquiagem_pessoas: 0, orientacoes: 'Evento simulado para a revisão mobile.', motivo_cancelamento: null, criado_em: new Date().toISOString() }],
    evento_escala: [{ id: 'esc1', evento_id: 'e1', profissional_id: 'p1', funcao: 'artista', personagem_id: 'pe1', fantasia_id: 'f1', maquiar: false, horario_maquiagem: null, ativo: true }],
    evento_financeiro: [{ evento_id: 'e1', valor_contratado: 900 }],
    recebimentos: [], pagamentos_profissionais: [{ id: 'pg1', evento_id: 'e1', profissional_id: 'p1', valor_combinado: 150, situacao: 'pendente', pago_em: null, observacoes: null }], despesas: [], reservas_veiculo: [], substituicoes: [], conferencias_fantasia: [], notificacoes: [], profissionais_notas: [], contratantes_notas: [],
  };
  const enc = obj => btoa(JSON.stringify(obj)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
  const token = enc({ alg: 'HS256', typ: 'JWT' }) + '.' + enc({ sub: uid, exp: Math.floor(Date.now() / 1000) + 86400, role: 'authenticated' }) + '.simulado';
  const session = { access_token: token, refresh_token: 'simulado', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, token_type: 'bearer', user: { ...user, user_metadata: {}, app_metadata: {} } };
  window.__mobileWrites = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin === location.origin) return originalFetch(input, options);
    if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/functions/v1/')) {
      let result = [];
      const method = options.method || (typeof input !== 'string' && input.method) || 'GET';
      if (url.pathname.includes('/auth/v1/')) result = { ...session, user: session.user };
      else if (method !== 'GET' && !url.pathname.includes('/rpc/')) {
        window.__mobileWrites.push({ path: url.pathname, method, body: options.body });
        const body = JSON.parse(options.body || '{}');
        const table = url.pathname.split('/').at(-1);
        const rows = Array.isArray(body) ? body : [body];
        if (method === 'POST' && db[table]) db[table].push(...rows.map((r, i) => ({ id: `novo-${i}`, ...r })));
        const headers = new Headers(options.headers || {});
        result = headers.get('accept')?.includes('object+json') ? { id: 'novo-0', ...rows[0] } : rows;
      } else if (!url.pathname.includes('/rpc/')) result = db[url.pathname.split('/').at(-1)] || [];
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('', { status: 200 });
  };
  // Descobre somente o identificador público do projeto no módulo de configuração.
  const project = PROJECT_HOST;
  localStorage.clear();
  if (profile !== 'login') localStorage.setItem('sb-' + project + '-auth-token', JSON.stringify(session));
};
const env = await fs.readFile(new URL('../.env.local', import.meta.url), 'utf8');
const projectUrl = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)?.[1];
assert(projectUrl, 'URL pública do Supabase configurada');
const project = new URL(projectUrl).hostname.split('.')[0];
await send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + fixture.toString().replace('PROJECT_HOST', JSON.stringify(project)) + ')()' });

const results = process.env.FUNCTIONAL_ONLY ? JSON.parse(await fs.readFile(new URL('resultado-parcial.json', out), 'utf8')).results.slice(0, 65) : [];
const interactions = [];
async function tap(selector, text) {
  const r = await evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => ${text ? `e.textContent.trim() === ${JSON.stringify(text)}` : 'true'} && e.getBoundingClientRect().width && e.getBoundingClientRect().height);
    if (!e) throw Error('Elemento não encontrado: ' + ${JSON.stringify(selector + ' ' + (text || ''))});
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(200);
}
async function fill(selector, value) {
  await evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)});
    e.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await pause(100);
}
async function checkDialog(label) {
  await until('!!document.querySelector("dialog[open]")');
  const r = await evaluate(`(() => {
    const d = document.querySelector('dialog[open]');
    const b = d.getBoundingClientRect();
    const footer = d.querySelector('footer').getBoundingClientRect();
    const submit = d.querySelector('[type=submit]').getBoundingClientRect();
    const hit = document.elementFromPoint(submit.x + submit.width / 2, submit.y + submit.height / 2);
    return { title: d.querySelector('h2').textContent, contained: b.left >= -1 && b.right <= screen.width + 1,
      footerVisible: footer.bottom <= innerHeight + 1, submitClickable: !!hit?.closest('[type=submit]'),
      overflow: d.scrollWidth > d.clientWidth + 1 };
  })()`);
  interactions.push({ label, ...r });
  assert(r.contained && r.footerVisible && r.submitClickable && !r.overflow, JSON.stringify({ label, ...r }));
}
async function go(path, profile = 'gerente') {
  await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path + (path.includes('?') ? '&' : '?') + 'perfilTeste=' + profile });
  await until(profile === 'login' ? '!!document.querySelector(".tela-login")' : '!!document.querySelector(".app, .tela-erro")');
  await pause(150);
}
async function inspect(label, expectTabs = true) {
  const r = await evaluate(`(() => {
    const nav = document.querySelector('.abas');
    const rect = nav?.getBoundingClientRect();
    const actions = document.querySelector('.barra-acoes')?.getBoundingClientRect();
    return { width: screen.width, layoutWidth: innerWidth, overflow: document.documentElement.scrollWidth > screen.width + 1,
      tabsVisible: !!rect && rect.height > 0 && rect.bottom <= innerHeight + 1,
      tabs: nav ? [...nav.querySelectorAll('a')].map(a => ({ text: a.textContent, active: a.classList.contains('ativo'), href: a.getAttribute('href') })) : [],
      actionsOverlap: !!actions && !!rect && actions.height > 0 && actions.bottom > rect.top + 1,
      headings: [...document.querySelectorAll('h1')].map(e => e.textContent),
      overflowing: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(e).position !== 'absolute'; }).slice(0, 12).map(e => ({ tag: e.tagName, cls: e.className, text: e.textContent.slice(0, 80) })) };
  })()`);
  results.push({ label, ...r });
  console.log(JSON.stringify({ label, width: r.width, overflow: r.overflow, tabsVisible: r.tabsVisible, actionsOverlap: r.actionsOverlap }));
  return r;
}
async function screenshot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(new URL(name + '.png', out), Buffer.from(s.data, 'base64'));
}
