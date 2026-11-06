// Verifica as migrações, os dados de teste e o vínculo de logins num
// Postgres embutido (PGlite), sem Supabase nem Docker. Simula o login
// com a configuração app.uid.
//
//   npm run perfis:verificar

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const MIGRACOES = [
  'migrations/20261020000001_schema_v1.sql',
  'migrations/20261020000002_ajustes_v1.sql',
  'migrations/20261021000001_trocas_para_mim.sql',
  'migrations/20261104000001_funcoes_do_login.sql',
  'migrations/20261104000002_telas_do_usuario.sql',
];

const pasta = (arquivo) => fileURLToPath(new URL(`../${arquivo}`, import.meta.url));

// O que o Supabase já traz pronto e o schema usa
const PREPARO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let db = new PGlite({ extensions: { btree_gist } });
let passaram = 0;
let falharam = 0;

async function teste(nome, fn) {
  try {
    await fn();
    passaram++;
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falharam++;
    console.log(`  FALHA ${nome}\n        ${erro.message}`);
  }
}

// Roda como um usuário logado (ou anon), sempre desfazendo no fim
async function como(uid, fn, papel = 'authenticated') {
  let resultado;
  await db.transaction(async (tx) => {
    await tx.exec(`set local role ${papel}; set local app.uid = '${uid ?? ''}';`);
    resultado = await fn(tx);
    await tx.rollback();
  }).catch((erro) => {
    if (!String(erro.message).includes('rollback')) throw erro;
  });
  return resultado;
}

async function esperaErro(promessa, trecho) {
  try {
    await promessa;
  } catch (erro) {
    if (!trecho || erro.message.includes(trecho)) return;
    throw new Error(`Erro diferente do esperado: ${erro.message}`);
  }
  throw new Error('Deveria ter sido bloqueado');
}

const qtd = async (tx, sql) => Number((await tx.query(sql)).rows[0].n);

const LOGIN = {
  gerente: '90000000-0000-0000-0000-000000000001',
  supervisora: '90000000-0000-0000-0000-000000000002',
};

db = new PGlite({ extensions: { btree_gist } });
await db.exec(PREPARO);
for (const arquivo of MIGRACOES) await db.exec(readFileSync(pasta(arquivo), 'utf8'));
console.log('\nDados de teste (seed.sql + vincular_usuarios.sql)\n');

await teste('seed.sql carrega passando por todas as travas', () => db.exec(readFileSync(pasta('seed.sql'), 'utf8')));

await teste('vincular_usuarios.sql liga os logins criados no Auth', async () => {
  await db.exec(`insert into auth.users (id, email) values
    ('${LOGIN.gerente}', 'gerente@teste.com'), ('${LOGIN.supervisora}', 'supervisora@teste.com')`);
  await db.exec(readFileSync(pasta('vincular_usuarios.sql'), 'utf8'));
  const n = await qtd(db, 'select count(*) as n from usuarios');
  if (n !== 2) throw new Error(`esperado 2 usuários, veio ${n}`);
});

await teste('gerente vê os 14 eventos e os 5 valores contratados', async () => {
  const eventos = await como(LOGIN.gerente, (tx) => qtd(tx, 'select count(*) as n from eventos'));
  const valores = await como(LOGIN.gerente, (tx) => qtd(tx, 'select count(*) as n from evento_financeiro'));
  if (eventos !== 14 || valores !== 5) throw new Error(`veio ${eventos} eventos e ${valores} valores`);
});

await teste('supervisora vê os eventos, mas nenhum valor', async () => {
  const eventos = await como(LOGIN.supervisora, (tx) => qtd(tx, 'select count(*) as n from eventos'));
  const valores = await como(LOGIN.supervisora, (tx) =>
    qtd(tx, 'select (select count(*) from evento_financeiro) + (select count(*) from pagamentos_profissionais) as n'));
  if (eventos !== 14 || valores !== 0) throw new Error(`veio ${eventos} eventos e ${valores} valores`);
});

await teste('gerente aprova a troca do seed e o Rafael entra na escala', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local app.uid = '${LOGIN.gerente}'`);
    const sub = (await tx.query(`select id from substituicoes where situacao = 'aguardando_aprovacao'`)).rows[0]?.id;
    if (!sub) throw new Error('troca do seed não encontrada');
    await tx.exec(`select decidir_substituicao('${sub}', true)`);
    const n = await qtd(tx, `select count(*) as n from evento_escala
      where ativo and profissional_id = 'a0000000-0000-0000-0000-000000000003'
        and evento_id = '10000000-0000-0000-0000-000000000009'`);
    if (n !== 1) throw new Error('Rafael não entrou na Festa da Laura');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

// #26: logins fictícios ligados às pessoas do seed; nenhuma conta real.
const perfis26 = [
  ['Bruno', 'produtor', 'a0000000-0000-0000-0000-000000000007'],
  ['Júlia', 'artista', 'a0000000-0000-0000-0000-000000000001'],
  ['Paula', 'fantasias', 'a0000000-0000-0000-0000-000000000010'],
];
for (const [i, [nome, perfil, profissional]] of perfis26.entries()) {
  const uid = `90000000-0000-0000-0000-00000000001${i}`;
  await db.exec(`insert into auth.users(id) values ('${uid}');
    insert into usuarios(id,nome,email,perfil) values ('${uid}','${nome}','perfil${i}@teste.com','${perfil}');
    update profissionais set usuario_id='${uid}' where id='${profissional}'`);
  const esperados = await qtd(db, perfil === 'fantasias' ? 'select count(*) as n from eventos' :
    `select count(*) as n from eventos where id in (select evento_id from evento_escala where ativo and profissional_id='${profissional}')`);
  await teste(`#26 ${nome}: eventos filtrados pelo banco`, () => como(uid, async tx => {
    const encontrados = await qtd(tx, 'select count(*) as n from eventos');
    if (!esperados || encontrados !== esperados) throw Error(`${encontrados} eventos; esperado ${esperados}`);
  }));
  const proprios = await qtd(db, `select count(*) as n from pagamentos_profissionais where profissional_id='${profissional}'`);
  await teste(`#26 ${nome}: nenhum financeiro, recebimento ou pagamento alheio`, () => como(uid, async tx => {
    const n = await qtd(tx, `select (select count(*) from evento_financeiro) + (select count(*) from recebimentos)
      + (select count(*) from pagamentos_profissionais where profissional_id <> '${profissional}') as n`);
    if (n) throw Error('Valor restrito chegou à consulta');
    if (await qtd(tx, 'select count(*) as n from pagamentos_profissionais') !== proprios) throw Error('Valor próprio ausente');
  }));
  await teste(`#26 ${nome}: criação de evento recusada pela RLS`, () => como(uid, tx => esperaErro(tx.exec(`
    insert into eventos(titulo,inicio,fim) values ('Evento indevido','2035-01-01 10:00Z','2035-01-01 12:00Z')`), 'row-level security')));
  if (perfil === 'produtor') {
    await teste('#26 Bruno: reserva Doblò e lança despesa própria', () => como(uid, async tx => {
      await tx.exec(`insert into reservas_veiculo(veiculo_id,responsavel_id,retirada,devolucao_prevista)
        values ('e0000000-0000-0000-0000-000000000001','${profissional}','2035-01-01 10:00Z','2035-01-01 12:00Z');
        insert into despesas(evento_id,descricao,valor,responsavel_id)
        select evento_id,'Teste produção',20,'${profissional}' from evento_escala where profissional_id='${profissional}' and ativo limit 1`);
      if (await qtd(tx, "select count(*) as n from despesas where descricao='Teste produção'") !== 1) throw Error('Despesa não gravada');
    }));
  }
  if (perfil === 'fantasias') {
    await teste('#26 Paula: edita fantasia e registra conferência', () => como(uid, async tx => {
      const f = (await tx.query('select id from fantasias limit 1')).rows[0].id;
      const e = (await tx.query('select id from eventos limit 1')).rows[0].id;
      await tx.exec(`update fantasias set observacoes='Teste Paula' where id='${f}';
        insert into conferencias_fantasia(evento_id,fantasia_id,devolvida,condicao) values ('${e}','${f}',true,'ok')
        on conflict(evento_id,fantasia_id) do update set devolvida=true`);
      if (await qtd(tx, `select count(*) as n from fantasias where id='${f}' and observacoes='Teste Paula'`) !== 1) throw Error('Edição recusada');
    }));
  }
}

console.log(`\n${passaram} testes passaram, ${falharam} falharam\n`);
process.exit(falharam ? 1 : 0);
