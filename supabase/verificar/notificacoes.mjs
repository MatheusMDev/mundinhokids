// Verifica os avisos automáticos num Postgres embutido (PGlite), sem Supabase.
// Hoje cobre o aviso de conferência das fantasias depois de uma festa.
//
//   npm run notificacoes:verificar

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
const PAULA_PROF = 'a0000000-0000-0000-0000-000000000010';
const JULIA_PROF = 'a0000000-0000-0000-0000-000000000001';
const FESTA = '10000000-0000-0000-0000-0000000000f1';
const FANTASIA = 'f0000000-0000-0000-0000-0000000000f1';
const ARTISTA = 'a0000000-0000-0000-0000-0000000000f1';

const db = new PGlite({ extensions: { btree_gist } });
await db.exec(PREPARO);
for (const arquivo of MIGRACOES) await db.exec(readFileSync(pasta(arquivo), 'utf8'));
await db.exec(readFileSync(pasta('seed.sql'), 'utf8'));
await db.exec(`insert into auth.users (id, email) values
  ('${LOGIN.gerente}', 'gerente@teste.com'), ('${LOGIN.bruno}', 'bruno@teste.com'),
  ('${LOGIN.julia}', 'julia@teste.com'), ('${LOGIN.paula}', 'paula@teste.com')`);
await db.exec(readFileSync(pasta('vincular_usuarios.sql'), 'utf8'));

// Uma festa só deste teste, com personagem, fantasia e artista próprios (não esbarra no seed)
const FESTA_BASE = `
  insert into personagens (id, nome) values ('b0000000-0000-0000-0000-0000000000f1', 'Personagem do teste');
  insert into fantasias (id, personagem_id, identificacao, tamanho, situacao)
    values ('${FANTASIA}', 'b0000000-0000-0000-0000-0000000000f1', 'Fantasia do teste', 'M', 'disponivel');
  insert into profissionais (id, nome, funcoes) values ('${ARTISTA}', 'Artista do teste', '{artista}');
  insert into profissional_personagens values ('${ARTISTA}', 'b0000000-0000-0000-0000-0000000000f1');
`;
const festa = (inicio, fim, situacao = 'confirmado') => `
  insert into eventos (id, titulo, contratante_id, local_id, inicio, fim, situacao)
    values ('${FESTA}', 'Festa do Teste', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
            ${inicio}, ${fim}, '${situacao}');
  insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id)
    values ('${FESTA}', '${ARTISTA}', 'artista', 'b0000000-0000-0000-0000-0000000000f1', '${FANTASIA}');
`;
const terminouHaUmaHora = festa(`now() - interval '4 hours'`, `now() - interval '1 hour'`);
const avisos = (tx, login) => qtd(tx, `select count(*) as n from notificacoes
  where tipo = 'conferencia_fantasias' and evento_id = '${FESTA}'${login ? ` and usuario_id = '${login}'` : ''}`);

console.log('\nAviso de conferência das fantasias\n');

await teste('festa encerrada com fantasia sem conferência avisa quem cuida das fantasias', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + 'select gerar_notificacoes_gestao();');
  if (await avisos(tx, LOGIN.paula) !== 1) throw new Error('Paula não recebeu o aviso');
  const msg = (await tx.query(`select mensagem from notificacoes where tipo = 'conferencia_fantasias' and evento_id = '${FESTA}'`)).rows[0].mensagem;
  if (msg !== 'Festa encerrada: confira as fantasias da Festa do Teste') throw new Error(`mensagem: ${msg}`);
}));

await teste('gestão, produção e artistas não recebem esse aviso', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + 'select gerar_notificacoes_gestao();');
  if (await avisos(tx) !== 1) throw new Error(`esperado 1 aviso no total, veio ${await avisos(tx)}`);
}));

await teste('a rotina roda a cada 5 minutos sem repetir o aviso', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + 'select gerar_notificacoes_gestao(); select gerar_notificacoes_gestao();');
  if (await avisos(tx, LOGIN.paula) !== 1) throw new Error('aviso repetido');
}));

await teste('festa com todas as fantasias conferidas não avisa', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + `
    insert into conferencias_fantasia (evento_id, fantasia_id, devolvida, condicao) values ('${FESTA}', '${FANTASIA}', true, 'ok');
    select gerar_notificacoes_gestao();`);
  if (await avisos(tx) !== 0) throw new Error('avisou festa já conferida');
}));

await teste('festa que ainda não terminou não avisa', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + festa(`now() - interval '1 hour'`, `now() + interval '2 hours'`) + 'select gerar_notificacoes_gestao();');
  if (await avisos(tx) !== 0) throw new Error('avisou antes do fim');
}));

await teste('festa cancelada não avisa', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + `
    set local app.uid = '${LOGIN.gerente}';
    update eventos set situacao = 'cancelado', motivo_cancelamento = 'teste' where id = '${FESTA}';
    select gerar_notificacoes_gestao();`);
  if (await avisos(tx) !== 0) throw new Error('avisou festa cancelada');
}));

await teste('festa que terminou há mais de 3 dias não avisa', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + festa(`now() - interval '5 days'`, `now() - interval '5 days' + interval '3 hours'`) + 'select gerar_notificacoes_gestao();');
  if (await avisos(tx) !== 0) throw new Error('avisou festa antiga');
}));

await teste('festa sem fantasia não avisa', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + `
    update evento_escala set fantasia_id = null where evento_id = '${FESTA}';
    select gerar_notificacoes_gestao();`);
  if (await avisos(tx) !== 0) throw new Error('avisou festa sem fantasia');
}));

await teste('quem tem a função Fantasias no cadastro também recebe (ex.: artista que cuida das fantasias)', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + `
    update profissionais set funcoes = '{artista,fantasias}' where id = '${JULIA_PROF}';
    select gerar_notificacoes_gestao();`);
  if (await avisos(tx, LOGIN.julia) !== 1) throw new Error('Júlia não recebeu');
}));

await teste('login desativado não recebe', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + `
    update usuarios set ativo = false where id = '${LOGIN.paula}';
    select gerar_notificacoes_gestao();`);
  if (await avisos(tx, LOGIN.paula) !== 0) throw new Error('login desativado recebeu');
}));

await teste('Paula lê o próprio aviso; o Bruno não vê o aviso dela', () => isolado(async (tx) => {
  await tx.exec(FESTA_BASE + terminouHaUmaHora + 'select gerar_notificacoes_gestao();');
  await tx.exec(`set local role authenticated; set local app.uid = '${LOGIN.paula}'`);
  if (await avisos(tx) !== 1) throw new Error('Paula não vê o aviso');
  await tx.exec(`set local app.uid = '${LOGIN.bruno}'`);
  if (await avisos(tx) !== 0) throw new Error('Bruno vê o aviso da Paula');
}));

await teste('ninguém logado consegue disparar os avisos direto', () => isolado(async (tx) => {
  await tx.exec(`set local role authenticated; set local app.uid = '${LOGIN.paula}'`);
  try { await tx.exec('select gerar_avisos_conferencia()'); }
  catch (erro) { if (erro.message.includes('permission denied')) return; throw erro; }
  throw new Error('deveria ser recusado');
}));

await teste('a pessoa pode desligar esse aviso nas preferências', () => isolado(async (tx) => {
  await tx.exec(`insert into notificacao_preferencias (usuario_id, tipo, ativa) values ('${LOGIN.paula}', 'conferencia_fantasias', false)`);
}));

console.log(`\n${passaram} testes passaram, ${falharam} falharam`);
if (falharam) process.exit(1);
