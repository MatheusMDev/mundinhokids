// Verifica as travas de segurança num Postgres embutido (PGlite), sem Supabase:
// o que um visitante sem login e um login sem perfil conseguem fazer.
//
//   npm run seguranca:verificar

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const pasta = (arquivo) => fileURLToPath(new URL(`../${arquivo}`, import.meta.url));

// Todas as migrações do repositório, em ordem de nome
const MIGRACOES = readdirSync(pasta('migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);

// O que o Supabase já traz pronto (Auth, Realtime e Storage, só o necessário)
const PREPARO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let passaram = 0;
let falharam = 0;
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log(`  ok   ${nome}`); }
  catch (erro) { falharam++; console.log(`  FALHA ${nome}\n        ${erro.message}`); }
}
const qtd = async (tx, sql) => Number((await tx.query(sql)).rows[0].n);

// Cada teste roda numa transação desfeita no fim
async function isolado(fn) {
  await db.transaction(async (tx) => { await fn(tx); await tx.rollback(); })
    .catch((erro) => { if (!String(erro.message).includes('rollback')) throw erro; });
}

const LOGIN = {
  gerente: '90000000-0000-0000-0000-000000000001',
  bruno: '90000000-0000-0000-0000-000000000003',
  julia: '90000000-0000-0000-0000-000000000004',
  paula: '90000000-0000-0000-0000-000000000005',
};
const SEM_PERFIL = '66666666-0000-0000-0000-000000000666';

const db = new PGlite({ extensions: { btree_gist } });
await db.exec(PREPARO);
for (const arquivo of MIGRACOES) await db.exec(readFileSync(pasta(arquivo), 'utf8'));
await db.exec(readFileSync(pasta('seed.sql'), 'utf8'));
await db.exec(`insert into auth.users (id, email) values
  ('${LOGIN.gerente}', 'gerente@teste.com'), ('${LOGIN.bruno}', 'bruno@teste.com'),
  ('${LOGIN.julia}', 'julia@teste.com'), ('${LOGIN.paula}', 'paula@teste.com'),
  ('${SEM_PERFIL}', 'cadastro-aberto@teste.com')`);
await db.exec(readFileSync(pasta('vincular_usuarios.sql'), 'utf8'));


// Roda como o papel e o login indicados; devolve o erro (ou null se passou)
async function como(tx, papel, uid, sql) {
  await tx.exec(`set local role ${papel}; set local app.uid = '${uid ?? ''}'`);
  try { await tx.exec(sql); return null; } catch (erro) { return erro.message; }
}
const contar = (tx, tabela) => qtd(tx, `select count(*) as n from ${tabela}`);

const TABELAS_COM_PERFIL = ['configuracoes', 'fantasias', 'locais', 'personagens', 'profissional_personagens', 'reservas_veiculo', 'veiculos'];

console.log('\nVisitante sem login (anon)\n');

for (const fn of ["notificar_gestao('evento_gestao', null, 'golpe')", 'gerar_notificacoes_gestao()', "atualizar_minha_conta('x', null, null)", "atualizar_foto_minha_conta('x')"]) {
  await teste(`não executa ${fn.split('(')[0]}`, () => isolado(async (tx) => {
    const erro = await como(tx, 'anon', null, `select ${fn}`);
    if (!erro?.includes('permission denied')) throw new Error(erro ?? 'executou');
  }));
}

await teste('função antiga cancelar_evento não existe mais', () => isolado(async (tx) => {
  const n = await qtd(tx, "select count(*) as n from pg_proc where proname = 'cancelar_evento'");
  if (n !== 0) throw new Error('ainda existe');
}));

console.log('\nLogin sem perfil (cadastro aberto no Auth)\n');

for (const tabela of TABELAS_COM_PERFIL) {
  await teste(`não lê ${tabela}`, () => isolado(async (tx) => {
    await tx.exec(`set local role authenticated; set local app.uid = '${SEM_PERFIL}'`);
    const n = await contar(tx, tabela);
    if (n !== 0) throw new Error(`leu ${n} linha(s)`);
  }));
}

await teste('não manda notificação para a Direção', () => isolado(async (tx) => {
  const erro = await como(tx, 'authenticated', SEM_PERFIL, "select notificar_gestao('evento_gestao', null, 'golpe')");
  if (!erro?.includes('permission denied')) throw new Error(erro ?? 'executou');
}));

console.log('\nLogins com perfil continuam funcionando\n');

for (const [quem, uid] of [['gerente', LOGIN.gerente], ['produtor', LOGIN.bruno], ['artista', LOGIN.julia], ['fantasias', LOGIN.paula]]) {
  await teste(`${quem} lê locais, fantasias, personagens e configurações`, () => isolado(async (tx) => {
    await tx.exec(`set local role authenticated; set local app.uid = '${uid}'`);
    for (const tabela of ['locais', 'fantasias', 'personagens', 'configuracoes']) {
      if (await contar(tx, tabela) === 0) throw new Error(`não leu ${tabela}`);
    }
  }));
}

await teste('cancelar evento pela app (com multa) continua funcionando', () => isolado(async (tx) => {
  const evento = (await tx.query("select id from eventos where situacao <> 'cancelado' and inicio > now() limit 1")).rows[0].id;
  const erro = await como(tx, 'authenticated', LOGIN.gerente, `select cancelar_evento_com_multa('${evento}', 'teste', null, null, null, null)`);
  if (erro) throw new Error(erro);
}));

await teste('evento cancelado ainda avisa a gestão (gatilho usa a função fechada)', () => isolado(async (tx) => {
  const evento = (await tx.query("select id from eventos where situacao <> 'cancelado' and inicio > now() limit 1")).rows[0].id;
  await tx.exec(`set local app.uid = '${LOGIN.gerente}'; update eventos set situacao = 'cancelado', motivo_cancelamento = 'teste' where id = '${evento}'`);
  const n = await qtd(tx, `select count(*) as n from notificacoes where evento_id = '${evento}' and tipo = 'evento_gestao'`);
  if (n === 0) throw new Error('gestão não foi avisada');
}));

console.log(`\n${passaram} testes passaram, ${falharam} falharam`);
if (falharam) process.exit(1);
