// Verifica as migrações, os dados de teste e o vínculo de logins num
// Postgres embutido (PGlite), sem Supabase nem Docker. Simula o login
// com a configuração app.uid.
//
//   npm run banco:verificar

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const MIGRACOES = [
  'migrations/20261020000001_schema_v1.sql',
  'migrations/20261020000002_ajustes_v1.sql',
  'migrations/20261021000001_trocas_para_mim.sql',
  'migrations/20261104000001_funcoes_do_login.sql',
  'migrations/20261104000002_telas_do_usuario.sql',
  'migrations/20261106000001_profissionais_disponiveis.sql',
  'migrations/20261106000002_excluir_profissional.sql',
  'migrations/20261110000001_minha_conta.sql',
  'migrations/20261110000002_notificacao_remocao_evento.sql',
  'migrations/20261111000001_abas_mobile.sql',
  'migrations/20261111000002_abas_mobile_todos_menus.sql',
  'migrations/20261111000003_limpar_vinculos_ao_remover_da_escala.sql',
  'migrations/20261112000001_documentos_artistas.sql',
  'migrations/20261112000002_assistente_valores.sql',
  'migrations/20261112000003_adicionais_produtores.sql',
  'migrations/20261112000004_renomear_supervisora_para_assistente.sql',
  'migrations/20261112000005_comprovantes_despesas_evento.sql',
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
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const ID = {
  diretora: '00000000-0000-0000-0000-000000000001',
  assistente: '00000000-0000-0000-0000-000000000003',
  ana: '00000000-0000-0000-0000-000000000011',
  bia: '00000000-0000-0000-0000-000000000012',
  bruno: '00000000-0000-0000-0000-000000000013',
};

// Antes dos ajustes: cadastros com observações, para testar a migração delas
const DADOS_ANTES = `
  insert into auth.users (id) values ('${ID.diretora}'), ('${ID.assistente}'), ('${ID.ana}'), ('${ID.bia}'), ('${ID.bruno}');
  insert into usuarios (id, nome, email, perfil) values
    ('${ID.diretora}',    'Diretora',    'd@x', 'diretora'),
     ('${ID.assistente}', 'Assistente', 's@x', 'supervisora'),
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

await db.exec(PREPARO);
await db.exec(readFileSync(pasta(MIGRACOES[0]), 'utf8'));
await db.exec(DADOS_ANTES);
for (const arquivo of MIGRACOES.slice(1)) await db.exec(readFileSync(pasta(arquivo), 'utf8'));
await db.exec(DADOS);
console.log('\nRegras do banco (migrações)\n');

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

await teste('documentos de artista ficam isolados por RLS', async () => {
  await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.diretora}';
      insert into documentos_artistas (profissional_id, tipo, nome, storage_path, mime_type, tamanho_bytes)
      values ('10000000-0000-0000-0000-000000000011', 'Contrato', 'contrato.pdf', '10000000-0000-0000-0000-000000000011/contrato.pdf', 'application/pdf', 1200);`);
    await tx.exec(`set local app.uid = '${ID.ana}'`);
    const proprio = await qtd(tx, `select count(*) as n from documentos_artistas where profissional_id = '10000000-0000-0000-0000-000000000011'`);
    await tx.exec(`set local app.uid = '${ID.bia}'`);
    const alheio = await qtd(tx, `select count(*) as n from documentos_artistas`);
    if (proprio !== 1 || alheio !== 0) throw new Error(`Ana viu ${proprio}; Bia viu ${alheio}`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
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

await teste('assistente lê as observações migradas', async () => {
  const n = await como(ID.assistente, (tx) =>
    qtd(tx, 'select (select count(*) from profissionais_notas) + (select count(*) from contratantes_notas) as n'));
  if (n !== 2) throw new Error(`esperado 2, veio ${n}`);
});

await teste('produtor não lança despesa já aprovada', async () => {
  const r = await como(ID.bruno, (tx) => tx.query(`
    insert into despesas (evento_id, descricao, valor, responsavel_id, comprovante, aprovacao, aprovado_por)
    values ('60000000-0000-0000-0000-000000000001', 'Balões', 45, '${PROF.bruno}', 'https://exemplo.test/comprovante', 'aprovada', '${ID.diretora}')
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
    const r = await tx.query(`insert into despesas (evento_id, descricao, valor, responsavel_id, comprovante)
      values ('60000000-0000-0000-0000-000000000001', 'Peruca nova', 180, '${PROF.bruno}', 'https://exemplo.test/comprovante') returning aprovacao`);
    if (r.rows[0].aprovacao !== 'pendente') throw new Error(`ficou ${r.rows[0].aprovacao}`);
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

await teste('quem não fez login não chama funções do banco', () =>
  esperaErro(como(null, (tx) => tx.query(`select config_texto('link_formulario_produtor')`), 'anon'), 'permission'));

await teste('artista indicado vê o pedido de troca sem ver o evento', async () => {
  await db.transaction(async (tx) => {
    const escala = (await tx.query(`select id from evento_escala where profissional_id = '10000000-0000-0000-0000-000000000011'`)).rows[0].id;
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.ana}'`);
    await tx.exec(`select solicitar_substituicao('${escala}', '10000000-0000-0000-0000-000000000012', 'Imprevisto')`);
    await tx.exec(`set local app.uid = '${ID.bia}'`);
    const pedidos = (await tx.query('select titulo, solicitante, personagem from trocas_para_mim()')).rows;
    if (pedidos.length !== 1 || pedidos[0].titulo !== 'Festa da Laura' || pedidos[0].solicitante !== 'Ana') {
      throw new Error(`pedidos: ${JSON.stringify(pedidos)}`);
    }
    const eventos = await qtd(tx, 'select count(*) as n from eventos');
    if (eventos !== 0) throw new Error(`Bia não devia ler o evento antes da troca, leu ${eventos}`);
    await tx.exec(`set local app.uid = '${ID.assistente}'`);
    const daAssistente = (await tx.query('select * from trocas_para_mim()')).rows.length;
    if (daAssistente !== 0) throw new Error('assistente não é substituta de nada');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

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
    await tx.exec(`set local role authenticated; set local app.uid = '${ID.assistente}'`);
    await tx.exec(`select remarcar_evento('60000000-0000-0000-0000-000000000001', '2030-01-10 16:00-03', '2030-01-10 19:00-03', 'Pedido da mãe')`);
    const n = await qtd(tx, `select count(*) as n from evento_remarcacoes`);
    if (n !== 1) throw new Error('remarcação não registrada');
    await tx.rollback();
  }).catch((e) => { if (!e.message.includes('rollback')) throw e; });
});

// Um login com duas funções: perfil Artista, mas o cadastro também tem Produção
const reservaDaAna = (tx) => tx.exec(`insert into reservas_veiculo (veiculo_id, evento_id, responsavel_id, retirada, devolucao_prevista)
  values ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000011', '2030-01-10 13:00-03', '2030-01-10 20:00-03')`);
await db.exec(`insert into veiculos (id, nome) values ('70000000-0000-0000-0000-000000000001', 'Doblò')`);

await teste('artista que só é artista não reserva veículo', () =>
  como(ID.ana, (tx) => esperaErro(reservaDaAna(tx), 'row-level security')));

await teste('artista que também é produção reserva veículo no próprio evento', async () => {
  await db.exec(`update profissionais set funcoes = '{artista,produtor}' where id = '10000000-0000-0000-0000-000000000011'`);
  try {
    await como(ID.ana, (tx) => reservaDaAna(tx));
  } finally {
    await db.exec(`update profissionais set funcoes = '{artista}' where id = '10000000-0000-0000-0000-000000000011'`);
  }
});

await teste('telas do login só aceitam telas que existem', async () => {
  await db.exec(`update usuarios set telas = '{painel,eventos}' where id = '${ID.ana}'`);
  await esperaErro(db.exec(`update usuarios set telas = '{painel,qualquer}' where id = '${ID.ana}'`), 'usuarios_telas_validas');
  await db.exec(`update usuarios set telas = null where id = '${ID.ana}'`);
});

// ---------------------------------------------------------------------
// Exclusões, desativações e seleções desatualizadas (task #63).
// Cada cenário desfaz as próprias mudanças, sem depender da ordem dos testes.
// ---------------------------------------------------------------------
async function isolado(fn) {
  await db.transaction(async (tx) => {
    await tx.exec(`set local app.uid = '${ID.diretora}'`);
    await fn(tx);
    await tx.rollback();
  }).catch((e) => { if (!String(e.message).includes('rollback')) throw e; });
}
const PROF = {
  ana: '10000000-0000-0000-0000-000000000011',
  bia: '10000000-0000-0000-0000-000000000012',
  bruno: '10000000-0000-0000-0000-000000000013',
};
const EVENTO = '60000000-0000-0000-0000-000000000001';

await teste('elegibilidade exclui login inativo, mas mantém profissional legítimo sem login', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set ativo = false where id = '${ID.bia}';
    insert into profissionais (id, nome, funcoes) values ('10000000-0000-0000-0000-000000000099', 'Sem login legítimo', '{produtor}')`);
  const ids = (await tx.query('select id from profissionais_disponiveis()')).rows.map((p) => p.id);
  if (ids.includes(PROF.bia) || !ids.includes(PROF.ana) || !ids.includes('10000000-0000-0000-0000-000000000099')) throw new Error('Lista de elegíveis incorreta');
}));

await teste('colega não precisa ler usuarios para receber a elegibilidade correta', () => isolado(async (tx) => {
  await tx.exec(`update profissionais set funcoes = '{produtor}' where id = '${PROF.bia}';
    insert into evento_escala (evento_id, profissional_id, funcao) values ('${EVENTO}', '${PROF.bia}', 'produtor');
    set local role authenticated; set local app.uid = '${ID.ana}'`);
  if (await qtd(tx, `select count(*) as n from usuarios where id = '${ID.bia}'`) !== 0) throw new Error('Login de colega exposto');
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis() where id = '${PROF.bia}'`) !== 1) throw new Error('Colega ativo ausente');
  await tx.exec(`reset role; update usuarios set ativo = false where id = '${ID.bia}'; set local role authenticated`);
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis() where id = '${PROF.bia}'`) !== 0) throw new Error('Colega com login inativo disponível');
}));

await teste('RPC de elegíveis não expõe profissionais fora da visibilidade do perfil', () => isolado(async (tx) => {
  await tx.exec(`set local role authenticated; set local app.uid = '${ID.ana}'`);
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis() where id = '${PROF.bia}'`) !== 0) throw new Error('Profissional fora do evento exposto');
}));

await teste('desvincular login desativa profissional em vez de criar órfão ativo', () => isolado(async (tx) => {
  await tx.exec(`update profissionais set usuario_id = null where id = '${PROF.bia}'`);
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bia}' and not ativo and usuario_id is null`) !== 1) throw new Error('Órfão permaneceu ativo');
}));

await teste('excluir Auth desativa e preserva profissional, escalas e pagamentos históricos', () => isolado(async (tx) => {
  await tx.exec(`insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado) values ('${EVENTO}', '${PROF.bruno}', 150);
    delete from auth.users where id = '${ID.bruno}'`);
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bruno}' and not ativo and usuario_id is null`) !== 1) throw new Error('Profissional não foi preservado inativo');
  if (await qtd(tx, `select count(*) as n from evento_escala where profissional_id = '${PROF.bruno}'`) < 1) throw new Error('Escala histórica perdida');
  if (await qtd(tx, `select count(*) as n from pagamentos_profissionais where profissional_id = '${PROF.bruno}'`) !== 1) throw new Error('Pagamento histórico perdido');
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis() where id = '${PROF.bruno}'`) !== 0) throw new Error('Excluído ainda selecionável');
}));

await teste('profissional inativo é recusado na escala por chamada direta', () => isolado(async (tx) => {
  await tx.exec(`update profissionais set ativo = false where id = '${PROF.bia}'`);
  await esperaErro(tx.exec(`insert into evento_escala (evento_id, profissional_id, funcao, personagem_id)
    values ('60000000-0000-0000-0000-000000000002', '${PROF.bia}', 'artista', '20000000-0000-0000-0000-000000000001')`), 'não está mais disponível');
}));

await teste('exclusão recusada preserva vínculo e atividade do profissional', () => isolado(async (tx) => {
  await tx.exec(`insert into despesas (descricao, valor, criado_por) values ('Histórico do usuário', 10, '${ID.bruno}'); savepoint tentativa_exclusao`);
  await esperaErro(tx.exec(`delete from auth.users where id = '${ID.bruno}'`), 'foreign key');
  await tx.exec('rollback to savepoint tentativa_exclusao');
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bruno}' and ativo and usuario_id = '${ID.bruno}'`) !== 1) throw new Error('Exclusão recusada deixou um órfão');
}));

await teste('reativação de vaga não pode reutilizar profissional desligado', () => isolado(async (tx) => {
  await tx.exec(`update evento_escala set ativo = false where profissional_id = '${PROF.bruno}'; update profissionais set ativo = false where id = '${PROF.bruno}'`);
  await esperaErro(tx.exec(`update evento_escala set ativo = true where profissional_id = '${PROF.bruno}'`), 'não está mais disponível');
}));

await teste('login inativo é recusado na escala mesmo com profissional ativo', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set ativo = false where id = '${ID.bia}'`);
  await esperaErro(tx.exec(`insert into evento_escala (evento_id, profissional_id, funcao, personagem_id)
    values ('60000000-0000-0000-0000-000000000002', '${PROF.bia}', 'artista', '20000000-0000-0000-0000-000000000001')`), 'não está mais disponível');
}));

await teste('reserva de veículo recusa responsável com login inativo', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set ativo = false where id = '${ID.bruno}'`);
  await esperaErro(tx.exec(`insert into reservas_veiculo (veiculo_id, responsavel_id, retirada, devolucao_prevista)
    values ('70000000-0000-0000-0000-000000000001', '${PROF.bruno}', '2030-03-01 10:00-03', '2030-03-01 12:00-03')`), 'não está mais disponível');
}));

await teste('nova despesa recusa responsável com login excluído', () => isolado(async (tx) => {
  await tx.exec(`delete from auth.users where id = '${ID.bruno}'`);
  await esperaErro(tx.exec(`insert into despesas (descricao, valor, responsavel_id) values ('Teste', 10, '${PROF.bruno}')`), 'não está mais disponível');
}));

await teste('despesa existente de profissional desligado continua editável e quitável', () => isolado(async (tx) => {
  await tx.exec(`insert into despesas (id, descricao, valor, responsavel_id) values ('80000000-0000-0000-0000-000000000099', 'Teste', 10, '${PROF.bruno}');
    insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado) values ('${EVENTO}', '${PROF.bruno}', 150);
    update profissionais set ativo = false where id = '${PROF.bruno}';
    update despesas set descricao = 'Corrigida' where id = '80000000-0000-0000-0000-000000000099';
    update pagamentos_profissionais set situacao = 'pago', pago_em = current_date where evento_id = '${EVENTO}' and profissional_id = '${PROF.bruno}'`);
  if (await qtd(tx, `select count(*) as n from pagamentos_profissionais where profissional_id = '${PROF.bruno}' and situacao = 'pago'`) !== 1) throw new Error('Quitação histórica bloqueada');
}));

await teste('devolver ou cancelar reserva antiga permanece permitido após desligamento', () => isolado(async (tx) => {
  await tx.exec(`insert into reservas_veiculo (id, veiculo_id, responsavel_id, retirada, devolucao_prevista)
    values ('81000000-0000-0000-0000-000000000099', '70000000-0000-0000-0000-000000000001', '${PROF.bruno}', '2030-03-01 10:00-03', '2030-03-01 12:00-03');
    update profissionais set ativo = false where id = '${PROF.bruno}';
    update reservas_veiculo set devolvido_em = '2030-03-01 11:00-03' where id = '81000000-0000-0000-0000-000000000099';
    update reservas_veiculo set ativo = false where id = '81000000-0000-0000-0000-000000000099'`);
}));

await teste('substitutos disponíveis excluem login desativado', () => isolado(async (tx) => {
  const escala = (await tx.query(`select id from evento_escala where evento_id = '${EVENTO}' and profissional_id = '${PROF.ana}' and ativo`)).rows[0].id;
  await tx.exec(`update usuarios set ativo = false where id = '${ID.bia}'`);
  if (await qtd(tx, `select count(*) as n from substitutos_disponiveis('${escala}') where profissional_id = '${PROF.bia}'`) !== 0) throw new Error('Substituto inativo disponível');
}));

await teste('aprovação de troca antiga é recusada se substituto foi desativado', () => isolado(async (tx) => {
  const escala = (await tx.query(`select id from evento_escala where evento_id = '${EVENTO}' and profissional_id = '${PROF.ana}' and ativo`)).rows[0].id;
  await tx.exec(`insert into substituicoes (id, escala_id, solicitante_id, substituto_id, situacao)
    values ('82000000-0000-0000-0000-000000000099', '${escala}', '${PROF.ana}', '${PROF.bia}', 'aguardando_aprovacao');
    update usuarios set ativo = false where id = '${ID.bia}'`);
  await esperaErro(tx.exec(`select decidir_substituicao('82000000-0000-0000-0000-000000000099', true)`), 'não está mais disponível');
}));

await teste('sessão antiga de login desativado não retém acesso aos eventos', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set ativo = false where id = '${ID.ana}'; set local role authenticated; set local app.uid = '${ID.ana}'`);
  if (await qtd(tx, `select count(*) as n from eventos`) !== 0) throw new Error('Sessão desativada ainda lê eventos');
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis()`) !== 0) throw new Error('Sessão desativada ainda recebe seleções');
}));

// ---------------------------------------------------------------------
// Exclusão de profissional pela gestão: cadastro sai da operação, mantendo histórico.
// ---------------------------------------------------------------------
await teste('Direção exclui profissional preservando login, escala e pagamento', () => isolado(async (tx) => {
  await tx.exec(`insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado) values ('${EVENTO}', '${PROF.bruno}', 150);
    set local role authenticated; select excluir_profissional('${PROF.bruno}')`);
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bruno}' and excluido_em is not null and not ativo and usuario_id is null`) !== 1) throw new Error('Exclusão incompleta');
  if (await qtd(tx, `select count(*) as n from usuarios where id = '${ID.bruno}' and ativo`) !== 1) throw new Error('Login foi removido ou desativado');
  if (await qtd(tx, `select count(*) as n from evento_escala where profissional_id = '${PROF.bruno}'`) < 1) throw new Error('Escala perdida');
  if (await qtd(tx, `select count(*) as n from pagamentos_profissionais where profissional_id = '${PROF.bruno}'`) !== 1) throw new Error('Pagamento perdido');
  if (await qtd(tx, `select count(*) as n from profissionais_disponiveis() where id = '${PROF.bruno}'`) !== 0) throw new Error('Excluído continua elegível');
}));

await teste('Gerência exclui profissional sem apagar cadastro de login', () => isolado(async (tx) => {
  const gerente = '00000000-0000-0000-0000-000000000090';
  await tx.exec(`insert into auth.users (id) values ('${gerente}'); insert into usuarios (id, nome, email, perfil) values ('${gerente}', 'Gerente', 'gerente@exemplo.test', 'gerente');
    set local role authenticated; set local app.uid = '${gerente}'; select excluir_profissional('${PROF.bia}')`);
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bia}' and excluido_em is not null`) !== 1) throw new Error('Gerência não conseguiu excluir');
}));

await teste('Assistente não exclui profissional por RPC', () =>
  como(ID.assistente, (tx) => esperaErro(tx.exec(`select excluir_profissional('${PROF.bia}')`), 'Só a direção')));

await teste('Assistente não contorna a exclusão com update direto', () =>
  como(ID.assistente, (tx) => esperaErro(tx.exec(`update profissionais set excluido_em = now() where id = '${PROF.bia}'`), 'Só a direção')));

await teste('Artista não exclui profissional por RPC', () =>
  como(ID.ana, (tx) => esperaErro(tx.exec(`select excluir_profissional('${PROF.bia}')`), 'Só a direção')));

await teste('Sem login não é possível chamar excluir_profissional', () =>
  como(null, (tx) => esperaErro(tx.exec(`select excluir_profissional('${PROF.bia}')`), 'permission denied'), 'anon'));

await teste('Gerência com acesso inativo não exclui profissional', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set perfil = 'gerente', ativo = false where id = '${ID.bia}'; set local role authenticated; set local app.uid = '${ID.bia}'`);
  await esperaErro(tx.exec(`select excluir_profissional('${PROF.ana}')`), 'Só a direção');
}));

await teste('Gerência não exclui profissional vinculado à Direção', () => isolado(async (tx) => {
  await tx.exec(`update usuarios set perfil = 'gerente' where id = '${ID.bruno}';
    insert into profissionais (id, nome, usuario_id, funcoes) values ('10000000-0000-0000-0000-000000000090', 'Direção', '${ID.diretora}', '{produtor}');
    set local role authenticated; set local app.uid = '${ID.bruno}'`);
  await esperaErro(tx.exec(`select excluir_profissional('10000000-0000-0000-0000-000000000090')`), 'Só a Direção');
}));

await teste('profissional excluído não pode ser reativado por alteração de ativo', () => isolado(async (tx) => {
  await tx.exec(`select excluir_profissional('${PROF.bia}'); update profissionais set ativo = true where id = '${PROF.bia}'`);
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${PROF.bia}' and ativo`) !== 0) throw new Error('Profissional excluído foi reativado');
}));

await teste('excluir duas vezes não confirma uma nova exclusão', () => isolado(async (tx) => {
  await tx.exec(`select excluir_profissional('${PROF.bia}')`);
  await esperaErro(tx.exec(`select excluir_profissional('${PROF.bia}')`), 'já excluído');
}));

await teste('exclusão do profissional bloqueia tentativa de escala antiga', () => isolado(async (tx) => {
  await tx.exec(`select excluir_profissional('${PROF.bia}')`);
  await esperaErro(tx.exec(`insert into evento_escala (evento_id, profissional_id, funcao, personagem_id)
    values ('60000000-0000-0000-0000-000000000002', '${PROF.bia}', 'artista', '20000000-0000-0000-0000-000000000001')`), 'não está mais disponível');
}));

// ---------------------------------------------------------------------
// Regularização dos IDs escolhidos pelo usuário, sempre em banco fictício.
// ---------------------------------------------------------------------
const MATHEUS_PRINCIPAL = 'a18e2007-5d9f-4b0f-9409-d4561170204b';
const MATHEUS_DUPLICADO = '7206b688-d741-4cef-9dc5-023c737b4f73';
const criarMatheusDeTeste = (tx) => tx.exec(`insert into profissionais (id, nome, ativo, funcoes) values
  ('${MATHEUS_PRINCIPAL}', 'Matheus Miranda', false, '{produtor}'),
  ('${MATHEUS_DUPLICADO}', 'Matheus  Miranda', true, '{produtor}');
  insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado) values
    ('${EVENTO}', '${MATHEUS_PRINCIPAL}', 100), ('${EVENTO}', '${MATHEUS_DUPLICADO}', 100)`);

// regularizar_matheus.sql foi uma correção única de dados da produção e o arquivo
// não está no repositório: sem ele, os dois testes abaixo ficam como "pulados".
const temRegularizacao = existsSync(pasta('regularizar_matheus.sql'));
if (!temRegularizacao) console.log('  pulado regularização do cadastro duplicado (supabase/regularizar_matheus.sql não está no repositório)');
if (temRegularizacao) await teste('regularização mantém um espaço ativo e preserva pagamentos dos dois IDs', () => isolado(async (tx) => {
  await criarMatheusDeTeste(tx);
  await tx.exec(readFileSync(pasta('regularizar_matheus.sql'), 'utf8'));
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${MATHEUS_PRINCIPAL}' and ativo`) !== 1) throw new Error('Principal não ficou ativo');
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${MATHEUS_DUPLICADO}' and not ativo`) !== 1) throw new Error('Duplicado permaneceu ativo');
  if (await qtd(tx, `select count(*) as n from pagamentos_profissionais where profissional_id in ('${MATHEUS_PRINCIPAL}', '${MATHEUS_DUPLICADO}')`) !== 2) throw new Error('Pagamento perdido');
}));

if (temRegularizacao) await teste('regularização não altera nenhum cadastro se o principal já foi excluído', () => isolado(async (tx) => {
  await criarMatheusDeTeste(tx);
  await tx.exec(`select excluir_profissional('${MATHEUS_PRINCIPAL}')`);
  await tx.exec(readFileSync(pasta('regularizar_matheus.sql'), 'utf8'));
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${MATHEUS_PRINCIPAL}' and not ativo and excluido_em is not null`) !== 1) throw new Error('Excluído foi reativado');
  if (await qtd(tx, `select count(*) as n from profissionais where id = '${MATHEUS_DUPLICADO}' and ativo`) !== 1) throw new Error('Duplicado foi desativado sem principal válido');
}));

// ---------------------------------------------------------------------
// Dados de teste (seed.sql) e vínculo de logins, num banco novo
// ---------------------------------------------------------------------

const LOGIN = {
  gerente: '90000000-0000-0000-0000-000000000001',
  assistente: '90000000-0000-0000-0000-000000000002',
};

db = new PGlite({ extensions: { btree_gist } });
await db.exec(PREPARO);
for (const arquivo of MIGRACOES) await db.exec(readFileSync(pasta(arquivo), 'utf8'));
console.log('\nDados de teste (seed.sql + vincular_usuarios.sql)\n');

await teste('seed.sql carrega passando por todas as travas', () => db.exec(readFileSync(pasta('seed.sql'), 'utf8')));

await teste('vincular_usuarios.sql liga os logins criados no Auth', async () => {
  await db.exec(`insert into auth.users (id, email) values
    ('${LOGIN.gerente}', 'gerente@teste.com'), ('${LOGIN.assistente}', 'assistente@teste.com')`);
  await db.exec(readFileSync(pasta('vincular_usuarios.sql'), 'utf8'));
  const n = await qtd(db, 'select count(*) as n from usuarios');
  if (n !== 2) throw new Error(`esperado 2 usuários, veio ${n}`);
});

await db.exec(`insert into auth.users (id, email) values ('90000000-0000-0000-0000-000000000003', 'bruno@teste.com');
  insert into usuarios (id, nome, email, perfil) values ('90000000-0000-0000-0000-000000000003', 'Bruno Alves', 'bruno@teste.com', 'produtor');
  update profissionais set usuario_id = '90000000-0000-0000-0000-000000000003' where nome = 'Bruno Alves';
  insert into adicionais_produtores (id, produtor_id, valor, data, descricao, foto_path, foto_nome, foto_mime, foto_tamanho, criado_por)
    values ('70000000-0000-0000-0000-000000000001',
      (select id from profissionais where nome = 'Bruno Alves'), 48.50, current_date, 'Compra de glitter',
      'a0000000-0000-0000-0000-000000000007/comprovante.jpg', 'comprovante.jpg', 'image/jpeg', 1024,
      '90000000-0000-0000-0000-000000000001');`);

await teste('gerente vê os 14 eventos e os 5 valores contratados', async () => {
  const eventos = await como(LOGIN.gerente, (tx) => qtd(tx, 'select count(*) as n from eventos'));
  const valores = await como(LOGIN.gerente, (tx) => qtd(tx, 'select count(*) as n from evento_financeiro'));
  if (eventos !== 14 || valores !== 5) throw new Error(`veio ${eventos} eventos e ${valores} valores`);
});

await teste('Assistente vê eventos e valores, mas não pode gravar financeiro', async () => {
  const eventos = await como(LOGIN.assistente, (tx) => qtd(tx, 'select count(*) as n from eventos'));
  const valores = await como(LOGIN.assistente, (tx) =>
    qtd(tx, 'select (select count(*) from evento_financeiro) + (select count(*) from pagamentos_profissionais) as n'));
  if (eventos !== 14 || valores !== 15) throw new Error(`veio ${eventos} eventos e ${valores} valores`);
  const alteradas = await como(LOGIN.assistente, async (tx) => (await tx.query(`update evento_financeiro
    set valor_contratado = valor_contratado
    where evento_id = (select id from eventos order by inicio limit 1)
    returning evento_id`)).rows.length);
  if (alteradas !== 0) throw new Error(`Assistente alterou ${alteradas} valor(es)`);
});

await teste('adicional geral fica separado e produtor consulta o próprio sem alterar', async () => {
  const gerente = await como(LOGIN.gerente, (tx) => qtd(tx, 'select count(*) as n from adicionais_produtores'));
  const produtor = await como('90000000-0000-0000-0000-000000000003', (tx) => qtd(tx, 'select count(*) as n from adicionais_produtores'));
  const historico = await como(LOGIN.gerente, (tx) => qtd(tx, `select count(*) as n from historico
    where tabela = 'adicionais_produtores' and registro_id = '70000000-0000-0000-0000-000000000001'`));
  const alteradas = await como('90000000-0000-0000-0000-000000000003', async (tx) => (await tx.query(`update adicionais_produtores
    set descricao = descricao where id = '70000000-0000-0000-0000-000000000001' returning id`)).rows.length);
  if (gerente !== 1 || produtor !== 1 || historico !== 1 || alteradas !== 0) throw new Error(`gestão ${gerente}, produtor ${produtor}, histórico ${historico}, alteradas ${alteradas}`);
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

console.log(`\n${passaram} testes passaram, ${falharam} falharam\n`);
process.exit(falharam ? 1 : 0);
