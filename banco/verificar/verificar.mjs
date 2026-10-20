// Verifica schema.sql + ajustes_v1.sql num Postgres embutido (PGlite),
// sem Supabase nem Docker. Simula o login com a configuração app.uid.
//
//   npm run banco:verificar

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const pasta = (arquivo) => fileURLToPath(new URL(`../${arquivo}`, import.meta.url));

// O que o Supabase já traz pronto e o schema usa
const PREPARO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const ID = {
  diretora: '00000000-0000-0000-0000-000000000001',
  supervisora: '00000000-0000-0000-0000-000000000003',
  ana: '00000000-0000-0000-0000-000000000011',
  bia: '00000000-0000-0000-0000-000000000012',
  bruno: '00000000-0000-0000-0000-000000000013',
};

// Antes dos ajustes: cadastros com observações, para testar a migração delas
const DADOS_ANTES = `
  insert into auth.users (id) values ('${ID.diretora}'), ('${ID.supervisora}'), ('${ID.ana}'), ('${ID.bia}'), ('${ID.bruno}');
  insert into usuarios (id, nome, email, perfil) values
    ('${ID.diretora}',    'Diretora',    'd@x', 'diretora'),
    ('${ID.supervisora}', 'Supervisora', 's@x', 'supervisora'),
    ('${ID.ana}',         'Ana',         'a@x', 'artista'),
    ('${ID.bia}',         'Bia',         'b@x', 'artista'),
    ('${ID.bruno}',       'Bruno',       'p@x', 'produtor');

  insert into profissionais (id, usuario_id, nome, funcoes, observacoes) values
    ('10000000-0000-0000-0000-000000000011', '${ID.ana}',   'Ana',   '{artista}',  'Nota interna sobre a Ana'),
    ('10000000-0000-0000-0000-000000000012', '${ID.bia}',   'Bia',   '{artista}',  null),
    ('10000000-0000-0000-0000-000000000013', '${ID.bruno}', 'Bruno', '{produtor}', null);

  insert into contratantes (id, nome, observacoes) values ('40000000-0000-0000-0000-000000000001', 'Mariana', 'Cliente pede desconto');
`;

const DADOS = `
  insert into personagens (id, nome) values ('20000000-0000-0000-0000-000000000001', 'Princesa do Gelo');
  insert into profissional_personagens values
    ('10000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001');

  insert into fantasias (id, personagem_id, identificacao, situacao, previsao_disponivel) values
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Gelo M', 'disponivel', null),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Gelo P', 'limpeza', '2030-01-09 12:00-03');

  insert into locais (id, nome) values ('50000000-0000-0000-0000-000000000001', 'Buffet Castelo');

  insert into eventos (id, titulo, contratante_id, local_id, inicio, fim, situacao) values
    ('60000000-0000-0000-0000-000000000001', 'Festa da Laura', '40000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001', '2030-01-10 15:00-03', '2030-01-10 18:00-03', 'confirmado'),
    ('60000000-0000-0000-0000-000000000002', 'Festa do Theo',  '40000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001', '2030-01-08 11:00-03', '2030-01-08 14:00-03', 'confirmado');

  insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id) values
    ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'artista',
     '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
    ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013', 'produtor', null, null);
`;

const db = new PGlite({ extensions: { btree_gist } });
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

await db.exec(PREPARO);
await db.exec(readFileSync(pasta('schema.sql'), 'utf8'));
await db.exec(DADOS_ANTES);
await db.exec(readFileSync(pasta('ajustes_v1.sql'), 'utf8'));
await db.exec(DADOS);
console.log('\nschema.sql + ajustes_v1.sql carregados\n');

await teste('evento sem título é recusado', () =>
  esperaErro(db.exec(`insert into eventos (contratante_id, local_id, inicio, fim)
    values ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
            '2030-02-01 10:00-03', '2030-02-01 12:00-03')`), 'titulo'));

await teste('maquiagem guarda a quantidade de pessoas', async () => {
  await db.exec(`update eventos set tem_maquiagem = true, maquiagem_pessoas = 2 where id = '60000000-0000-0000-0000-000000000001'`);
  const n = await qtd(db, `select maquiagem_pessoas as n from eventos where id = '60000000-0000-0000-0000-000000000001'`);
  if (n !== 2) throw new Error(`esperado 2, veio ${n}`);
});

await teste('fantasia em limpeza entra em evento depois da previsão de volta', () =>
  db.transaction(async (tx) => {
    await tx.exec(`insert into eventos (id, titulo, contratante_id, local_id, inicio, fim) values
      ('60000000-0000-0000-0000-000000000003', 'Festa da Valentina', '40000000-0000-0000-0000-000000000001',
       '50000000-0000-0000-0000-000000000001', '2030-01-11 16:00-03', '2030-01-11 18:00-03')`);
    await tx.exec(`insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id) values
      ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000012', 'artista',
       '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; }));

await teste('fantasia em limpeza é bloqueada em evento antes da previsão', () =>
  esperaErro(db.exec(`insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id) values
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000012', 'artista',
     '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')`), 'previsão'));

await teste('fantasia volta a disponível e a previsão é apagada', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`update fantasias set situacao = 'disponivel' where id = '30000000-0000-0000-0000-000000000002'`);
    const r = await tx.query(`select previsao_disponivel from fantasias where id = '30000000-0000-0000-0000-000000000002'`);
    if (r.rows[0].previsao_disponivel !== null) throw new Error('previsão continuou preenchida');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('produtor não pode ser escalado como artista', () =>
  esperaErro(db.exec(`insert into evento_escala (evento_id, profissional_id, funcao) values
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000013', 'artista')`), 'função'));

await teste('Ana vê o evento enquanto está escalada', async () => {
  const n = await como(ID.ana, (tx) => qtd(tx, 'select count(*) as n from eventos'));
  if (n !== 1) throw new Error(`esperado 1, veio ${n}`);
});

await teste('Ana deixa de ver o evento ao sair da escala', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`update evento_escala set ativo = false where profissional_id = '10000000-0000-0000-0000-000000000011'`);
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.ana}'`);
    const n = await qtd(tx, 'select count(*) as n from eventos');
    if (n !== 0) throw new Error(`esperado 0, veio ${n}`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('Ana continua vendo o evento cancelado', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`set local app.uid = '${ID.diretora}'`);
    await tx.exec(`select cancelar_evento('60000000-0000-0000-0000-000000000001', 'Cliente desistiu')`);
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.ana}'`);
    const n = await qtd(tx, `select count(*) as n from eventos where situacao = 'cancelado'`);
    if (n !== 1) throw new Error(`esperado 1, veio ${n}`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('equipe não lê observações internas', async () => {
  const nAna = await como(ID.bruno, (tx) => qtd(tx, 'select count(*) as n from profissionais_notas'));
  const nCli = await como(ID.bruno, (tx) => qtd(tx, 'select count(*) as n from contratantes_notas'));
  if (nAna !== 0 || nCli !== 0) throw new Error(`produtor leu ${nAna} + ${nCli} observações`);
});

await teste('supervisora lê as observações migradas', async () => {
  const n = await como(ID.supervisora, (tx) =>
    qtd(tx, 'select (select count(*) from profissionais_notas) + (select count(*) from contratantes_notas) as n'));
  if (n !== 2) throw new Error(`esperado 2, veio ${n}`);
});

await teste('produtor não lança despesa já aprovada', async () => {
  const r = await como(ID.bruno, (tx) => tx.query(`
    insert into despesas (evento_id, descricao, valor, aprovacao, aprovado_por)
    values ('60000000-0000-0000-0000-000000000001', 'Balões', 45, 'aprovada', '${ID.diretora}')
    returning aprovacao, aprovado_por`));
  const linha = r.rows[0];
  if (linha.aprovacao !== 'nao_requer' || linha.aprovado_por !== null) {
    throw new Error(`gravou ${linha.aprovacao} por ${linha.aprovado_por}`);
  }
});

await teste('despesa acima do limite fica pendente', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`update configuracoes set valor = '100' where chave = 'despesa_aprovacao_acima_de'`);
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.bruno}'`);
    const r = await tx.query(`insert into despesas (evento_id, descricao, valor)
      values ('60000000-0000-0000-0000-000000000001', 'Peruca nova', 180) returning aprovacao`);
    if (r.rows[0].aprovacao !== 'pendente') throw new Error(`ficou ${r.rows[0].aprovacao}`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('quem não fez login não chama funções do banco', () =>
  esperaErro(como(null, (tx) => tx.query(`select config_texto('link_formulario_produtor')`), 'anon'), 'permission'));

await teste('troca de artista continua funcionando (Ana → Bia, aprovada)', async () => {
  await db.transaction(async (tx) => {
    const escala = (await tx.query(`select id from evento_escala where profissional_id = '10000000-0000-0000-0000-000000000011'`)).rows[0].id;
    await tx.exec(`set local role authenticated`);
    await tx.exec(`set local app.uid = '${ID.ana}'`);
    const sub = (await tx.query(`select solicitar_substituicao('${escala}', '10000000-0000-0000-0000-000000000012', 'Imprevisto') as id`)).rows[0].id;
    await tx.exec(`set local app.uid = '${ID.bia}'`);
    await tx.exec(`select responder_substituicao('${sub}', true)`);
    await tx.exec(`set local app.uid = '${ID.diretora}'`);
    await tx.exec(`select decidir_substituicao('${sub}', true)`);
    const n = await qtd(tx, `select count(*) as n from evento_escala where ativo and profissional_id = '10000000-0000-0000-0000-000000000012'`);
    if (n !== 1) throw new Error('Bia não entrou na escala');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('remarcação continua funcionando', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.supervisora}'`);
    await tx.exec(`select remarcar_evento('60000000-0000-0000-0000-000000000001', '2030-01-10 16:00-03', '2030-01-10 19:00-03', 'Pedido da mãe')`);
    const n = await qtd(tx, `select count(*) as n from evento_remarcacoes`);
    if (n !== 1) throw new Error('remarcação não registrada');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

console.log(`\n${passaram} testes passaram, ${falharam} falharam\n`);
process.exit(falharam ? 1 : 0);
