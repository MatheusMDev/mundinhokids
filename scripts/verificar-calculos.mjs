// Testes dos cálculos que as telas fazem (src/lib/consultas.ts e src/lib/formato.ts):
// datas no fuso de São Paulo, números e pendências da semana, conflitos de escala,
// transporte, situação das fantasias e financeiro do evento.
//
// Usa o código real (empacotado com esbuild) e uma base fictícia. Não conecta ao
// Supabase. Roda tudo em vários fusos de aparelho, porque as telas precisam mostrar
// sempre o horário de São Paulo, esteja o celular onde estiver.
//
//   npm run calculos:verificar

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const FUSOS = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'America/Los_Angeles'];

// Processo principal: roda este mesmo arquivo uma vez em cada fuso.
if (!process.env.FUSO_DO_TESTE) {
  let falhou = false;
  for (const fuso of FUSOS) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, FUSO_DO_TESTE: fuso }, encoding: 'utf8',
    });
    const saida = (r.stdout + r.stderr).trim();
    if (r.status !== 0) { falhou = true; console.log(`\n== Aparelho em ${fuso}: FALHOU\n${saida}`); }
    else console.log(fuso === FUSOS[0] ? saida : `== Aparelho em ${fuso}: ${saida.split('\n').at(-1)}`);
  }
  if (falhou) process.exit(1);
  process.exit(0);
}

const raiz = fileURLToPath(new URL('../', import.meta.url));
const entrada = `export * from './src/lib/consultas'; export * from './src/lib/formato';`;
const pacote = await build({
  stdin: { contents: entrada, resolveDir: raiz, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
});
const modulo = new Module(raiz + 'scripts/calculos-test.cjs');
modulo.filename = modulo.id;
modulo._compile(pacote.outputFiles[0].text, modulo.filename);
const c = modulo.exports;

let passou = 0;
let falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log('  ok   ' + nome); }
  catch (e) { falhou++; console.log('  FALHA ' + nome + '\n        ' + e.message.split('\n').join('\n        ')); }
}

// ---------------------------------------------------------------------
// Base fictícia. "Hoje" é quarta-feira, 11/11/2026, 12h em São Paulo.
// A semana do painel vai de domingo 08/11 a sábado 14/11.
// Horários em UTC: São Paulo = UTC-3 (sem horário de verão).
// ---------------------------------------------------------------------
const HOJE = '2026-11-11T15:00:00Z';

const evento = (id, titulo, inicio, fim, extra = {}) => ({
  id, titulo, aniversariante: null, idade: null, contratante_id: 'c1', local_id: 'l1', inicio, fim,
  situacao: 'confirmado', tem_maquiagem: false, maquiagem_pessoas: 0, orientacoes: null,
  motivo_cancelamento: null, criado_em: '2026-11-01T12:00:00Z', ...extra,
});
const escala = (id, evento_id, profissional_id, funcao, extra = {}) => ({
  id, evento_id, profissional_id, funcao, personagem_id: null, fantasia_id: null,
  maquiar: false, horario_maquiagem: null, ativo: true, ...extra,
});
const fantasia = (id, situacao = 'disponivel', extra = {}) => ({
  id, personagem_id: 'pe1', identificacao: 'Fantasia ' + id, tamanho: 'M', quantidade: 1,
  situacao, previsao_disponivel: null, observacoes: null, ...extra,
});
const reserva = (id, evento_id, retirada, devolucao_prevista, extra = {}) => ({
  id, veiculo_id: 'v1', evento_id, responsavel_id: 'bruno', retirada, devolucao_prevista,
  devolvido_em: null, observacoes: null, ativo: true, ...extra,
});
const troca = (id, escala_id, situacao, substituto_id = 'carla') => ({
  id, escala_id, solicitante_id: 'ana', substituto_id, motivo: null, situacao,
  solicitado_em: '2026-11-10T12:00:00Z', respondido_em: null, decidido_em: null,
});

function base() {
  return {
    profissionais_disponiveis: [], configuracoes: {}, usuarios: [],
    profissionais: ['ana', 'bruno', 'carla', 'davi', 'eva'].map((id) => ({
      id, usuario_id: null, nome: id[0].toUpperCase() + id.slice(1) + ' Souza', telefone: null, email: null,
      funcoes: ['artista'], disponibilidade: null, ativo: true,
    })),
    personagens: [{ id: 'pe1', nome: 'Princesa', descricao: null, referencias: null, orientacoes: null, ativo: true }],
    profissional_personagens: [], contratantes: [], locais: [],
    veiculos: [{ id: 'v1', nome: 'Doblò', placa: null, observacoes: null, ativo: true }],
    fantasias: [fantasia('f1'), fantasia('f2', 'limpeza', { previsao_disponivel: '2026-11-13' }), fantasia('f3', 'manutencao'), fantasia('f4')],
    eventos: [
      // Domingo 08/11, 15h — mesma semana, já passou
      evento('dom', 'Festa do Domingo', '2026-11-08T18:00:00Z', '2026-11-08T21:00:00Z', { situacao: 'realizado' }),
      // Quinta 12/11, 14h às 17h — produtor sem veículo, maquiagem sem maquiador, troca para aprovar
      evento('qui', 'Festa da Laura', '2026-11-12T17:00:00Z', '2026-11-12T20:00:00Z', { tem_maquiagem: true, maquiagem_pessoas: 2 }),
      // Quinta 12/11, 17h às 19h — começa quando a outra termina (sem conflito)
      evento('qui2', 'Festa do Theo', '2026-11-12T20:00:00Z', '2026-11-12T22:00:00Z'),
      // Quinta 12/11, 16h às 18h — sobrepõe a Festa da Laura
      evento('qui3', 'Festa do Miguel', '2026-11-12T19:00:00Z', '2026-11-12T21:00:00Z'),
      // Sábado 14/11, 22h em São Paulo = domingo 15/11 01h UTC: ainda é sábado
      evento('sab', 'Festa da Noite', '2026-11-15T01:00:00Z', '2026-11-15T02:30:00Z'),
      // Domingo 15/11, 0h30 em São Paulo: já é a semana seguinte
      evento('dom2', 'Festa da Madrugada', '2026-11-15T03:30:00Z', '2026-11-15T05:00:00Z'),
      // Sexta 13/11 cancelada: não conta
      evento('sex', 'Festa Cancelada', '2026-11-13T18:00:00Z', '2026-11-13T21:00:00Z', { situacao: 'cancelado' }),
      // Terça 24/11: fora da janela de 7 dias
      evento('longe', 'Festa Distante', '2026-11-24T18:00:00Z', '2026-11-24T21:00:00Z'),
      // Segunda 09/11: terminou e voltou com fantasia sem conferência
      evento('seg', 'Festa de Segunda', '2026-11-09T18:00:00Z', '2026-11-09T21:00:00Z', { situacao: 'realizado' }),
    ],
    // O banco não deixa a mesma pessoa, personagem, fantasia ou veículo em dois horários
    // que se sobrepõem; a base respeita essa trava.
    evento_escala: [
      escala('s1', 'qui', 'ana', 'artista', { personagem_id: 'pe1', fantasia_id: 'f2', maquiar: true }),
      escala('s2', 'qui', 'bruno', 'produtor'),
      escala('s11', 'qui', 'davi', 'artista', { fantasia_id: 'f4' }),
      escala('s3', 'qui3', 'carla', 'artista', { fantasia_id: 'f1' }),
      escala('s4', 'qui2', 'davi', 'artista', { fantasia_id: 'f4' }),
      escala('s5', 'seg', 'eva', 'artista', { fantasia_id: 'f1' }),
      escala('s6', 'seg', 'davi', 'artista', { fantasia_id: 'f3' }),
      escala('s7', 'longe', 'ana', 'artista'),
      escala('s8', 'qui2', 'eva', 'produtor'),
      escala('s9', 'sab', 'eva', 'produtor'),
    ],
    reservas_veiculo: [
      // Veículo da Festa do Theo: sai 16h e volta 22h de quinta
      reserva('r1', 'qui2', '2026-11-12T19:00:00Z', '2026-11-13T01:00:00Z'),
      // Uso do veículo no sábado até 21h30 em São Paulo: trava a saída (21h) da Festa da Noite
      reserva('r2', null, '2026-11-14T20:00:00Z', '2026-11-15T00:30:00Z'),
    ],
    evento_financeiro: [
      { evento_id: 'qui', valor_contratado: 1000 }, { evento_id: 'qui2', valor_contratado: 800 },
      { evento_id: 'qui3', valor_contratado: 500 },
    ],
    recebimentos: [
      { id: 'rc1', evento_id: 'qui2', valor: 300, recebido_em: '2026-11-01', forma: null, observacoes: null },
      { id: 'rc2', evento_id: 'qui3', valor: 200, recebido_em: '2026-11-01', forma: null, observacoes: null },
      { id: 'rc3', evento_id: 'qui3', valor: 300, recebido_em: '2026-11-02', forma: null, observacoes: null },
    ],
    pagamentos_profissionais: [
      { id: 'pg1', evento_id: 'qui', profissional_id: 'ana', valor_combinado: 150, situacao: 'pendente', pago_em: null, observacoes: null },
      { id: 'pg2', evento_id: 'qui2', profissional_id: 'ana', valor_combinado: 150, situacao: 'pendente', pago_em: null, observacoes: null },
      { id: 'pg3', evento_id: 'qui2', profissional_id: 'davi', valor_combinado: 120, situacao: 'pendente', pago_em: null, observacoes: null },
      { id: 'pg4', evento_id: 'qui3', profissional_id: 'carla', valor_combinado: 100, situacao: 'pago', pago_em: '2026-11-05', observacoes: null },
    ],
    despesas: [
      { id: 'd1', evento_id: 'qui', tipo: 'extra', descricao: 'Balões', valor: 40, responsavel_id: null, comprovante: null, aprovacao: 'aprovada', observacoes: null, criado_por: null, criado_em: '2026-11-10' },
      { id: 'd2', evento_id: 'qui', tipo: 'insumo', descricao: 'Tinta', valor: 25.5, responsavel_id: null, comprovante: null, aprovacao: 'nao_requer', observacoes: null, criado_por: null, criado_em: '2026-11-10' },
    ],
    substituicoes: [
      troca('t1', 's1', 'aguardando_aprovacao', 'carla'),   // Carla está na Festa do Miguel, que sobrepõe
      troca('t2', 's4', 'aguardando_aceite', 'bruno'),      // Bruno termina a Laura quando o Theo começa
      troca('t3', 's7', 'aguardando_aprovacao', 'eva'),     // evento fora da semana
    ],
    conferencias_fantasia: [
      { id: 'cf1', evento_id: 'seg', fantasia_id: 'f1', devolvida: true, condicao: 'ok', precisa_limpeza: false, precisa_reparo: false, pendencias: null, conferido_em: '2026-11-10T12:00:00Z' },
    ],
    historico: [], notificacoes: [], notificacao_preferencias: [], trocas_para_mim: [],
    profissionais_notas: [], contratantes_notas: [],
  };
}
const db = base();
const ev = (id) => db.eventos.find((e) => e.id === id);

console.log(`Aparelho em ${process.env.FUSO_DO_TESTE}`);

// ---------------------------------------------------------------------
console.log('\nDatas no fuso de São Paulo');
// ---------------------------------------------------------------------
teste('22h30 em São Paulo continua no mesmo dia (UTC já virou)', () =>
  assert.equal(c.chaveDia('2026-11-12T01:30:00Z'), '2026-11-11'));
teste('meia-noite em São Paulo vira o dia', () => {
  assert.equal(c.chaveDia('2026-11-12T02:59:00Z'), '2026-11-11');
  assert.equal(c.chaveDia('2026-11-12T03:00:00Z'), '2026-11-12');
});
teste('data sem horário não muda de dia', () => assert.equal(c.chaveDia('2026-11-20'), '2026-11-20'));
teste('hora no formato das telas', () => {
  assert.equal(c.hora('2026-11-11T17:15:00Z'), '14h15');
  assert.equal(c.hora('2026-11-11T18:00:00Z'), '15h');
  assert.equal(c.hora('2026-11-12T02:30:00Z'), '23h30');
});
teste('dia curto e data longa usam o dia de São Paulo', () => {
  assert.equal(c.diaCurto('2026-11-15T01:00:00Z'), 'sáb 14');
  assert.equal(c.dataLonga('2026-11-15T01:00:00Z'), 'Sábado, 14 de novembro de 2026');
  assert.equal(c.dataLonga('2026-11-15T01:00:00Z', false), 'Sábado, 14 de novembro');
  assert.equal(c.dataLongaDaChave('2026-11-14'), 'Sábado, 14 de novembro');
});
teste('somar dias atravessa mês e ano', () => {
  assert.equal(c.somarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(c.somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(c.somarDias('2028-03-01', -1), '2028-02-29');
});
teste('dia da semana de uma chave', () => {
  assert.equal(c.diaSemanaDaChave('2026-11-08'), 0);
  assert.equal(c.diaSemanaDaChave('2026-11-14'), 6);
});
teste('campos do formulário vão e voltam sem mudar data nem hora', () => {
  assert.deepEqual(c.paraCampos(c.deCampos('2026-11-14', '23:30')), { data: '2026-11-14', hora: '23:30' });
  assert.deepEqual(c.paraCampos(c.deCampos('2026-12-31', '00:15')), { data: '2026-12-31', hora: '00:15' });
});
teste('"Hoje" e "Ontem" seguem a virada do dia em São Paulo', () => {
  assert.equal(c.quando('2026-11-11T12:40:00Z', HOJE), 'Hoje, 9h40');
  assert.equal(c.quando('2026-11-11T02:00:00Z', HOJE), 'Ontem, 23h');
  assert.equal(c.quando('2026-10-12T19:02:00Z', HOJE), '12 out, 16h02');
});
teste('valores digitados viram número', () => {
  assert.equal(c.lerValor('1.200,50'), 1200.5);
  assert.equal(c.lerValor('R$ 45'), 45);
  assert.equal(c.lerValor('45.5'), 45.5);
  assert.equal(c.lerValor(''), null);
  assert.equal(c.lerValor('abc'), null);
});
teste('moeda inteira sem centavos e quebrada com centavos', () => {
  assert.equal(c.moeda(1800), 'R$ 1.800');
  assert.equal(c.moeda(45.5), 'R$ 45,50');
  assert.equal(c.moeda(0), 'R$ 0');
});

// ---------------------------------------------------------------------
console.log('\nNúmeros e pendências da semana');
// ---------------------------------------------------------------------
const numeros = c.numerosDaSemana(db, HOJE);
teste('semana de domingo a sábado: conta sábado 22h e ignora domingo 0h30 e cancelados', () =>
  assert.equal(numeros.eventosSemana, 6)); // dom, qui, qui2, qui3, sab, seg
teste('evento de sábado à noite conta como sábado', () => assert.equal(numeros.eventosSabado, 1));
teste('próximos 7 dias: de hoje em diante, sem realizados e cancelados, em ordem', () =>
  assert.deepEqual(c.proximosEventos(db, HOJE).map((e) => e.id), ['qui', 'qui3', 'qui2', 'sab', 'dom2']));
teste('eventos do dia ignoram cancelados e usam o dia de São Paulo', () => {
  assert.deepEqual(c.eventosDoDia(db, '2026-11-14').map((e) => e.id), ['sab']);
  assert.deepEqual(c.eventosDoDia(db, '2026-11-13').map((e) => e.id), []);
});

const pend = c.pendenciasDaSemana(db, HOJE);
const tipos = (lista) => lista.map((p) => `${p.tipo}:${p.eventoId}`).sort();
teste('pendências esperadas, sem conferência para quem não confere', () =>
  assert.deepEqual(tipos(pend), ['escala:qui', 'fantasia:qui', 'troca:qui', 'troca:qui2', 'veiculo:qui', 'veiculo:sab']));
teste('troca aceita aparece para aprovar; a não aceita, aguardando aceite', () => {
  const t = pend.filter((p) => p.tipo === 'troca');
  assert.equal(t.find((p) => p.eventoId === 'qui').rotulo, 'Troca para aprovar');
  assert.match(t.find((p) => p.eventoId === 'qui').texto, /Ana indicou Carla para o Princesa\. Carla já aceitou\./);
  assert.equal(t.find((p) => p.eventoId === 'qui2').rotulo, 'Troca aguardando aceite');
});
teste('troca de evento fora da semana não vira pendência', () =>
  assert.ok(!pend.some((p) => p.eventoId === 'longe')));
teste('sem veículo: produtor sem reserva', () =>
  assert.equal(pend.find((p) => p.tipo === 'veiculo' && p.eventoId === 'qui').texto, 'O produtor ainda não reservou o veículo.'));
teste('sem veículo: veículo ainda fora 1h antes do evento', () =>
  assert.equal(pend.find((p) => p.tipo === 'veiculo' && p.eventoId === 'sab').texto, 'A Doblò está bloqueada até as 21h30. Defina outro transporte.'));
teste('evento com reserva ou sem produtor não pede veículo', () => {
  assert.ok(!pend.some((p) => p.tipo === 'veiculo' && p.eventoId === 'qui2'));
  assert.ok(!pend.some((p) => p.tipo === 'veiculo' && p.eventoId === 'qui3'));
});
teste('maquiagem sem maquiador pede escala', () =>
  assert.equal(pend.find((p) => p.tipo === 'escala').texto, 'Falta escalar quem faz a maquiagem para 2 pessoas.'));
teste('fantasia em limpeza reservada para o evento', () => {
  const f = pend.find((p) => p.tipo === 'fantasia');
  assert.equal(f.rotulo, 'Fantasia em limpeza');
  assert.equal(f.texto, 'Volta da limpeza na sex 13. Reservada para a Festa da Laura.');
});
teste('conferência pendente só para quem confere fantasias', () => {
  const comConferencia = c.pendenciasDaSemana(db, HOJE, true).filter((p) => p.tipo === 'conferencia');
  assert.deepEqual(comConferencia.map((p) => [p.eventoId, p.texto]), [['seg', '1 fantasia volta sem conferência de devolução e limpeza.']]);
});
teste('números do painel batem com as pendências', () => {
  assert.equal(numeros.pendencias, pend.length);
  assert.equal(numeros.tiposPendencia, 'troca, veículo, escala e fantasia');
  assert.equal(numeros.trocas, 2); // só as que já foram aceitas, inclusive fora da semana
  assert.equal(numeros.trocaDescricao, 'Festa da Laura, qui');
  assert.equal(numeros.profissionaisAPagar, 2); // Ana (2 eventos) conta uma vez; Carla já recebeu
});
teste('semana vazia não inventa números', () => {
  const vazia = { ...base(), eventos: [], evento_escala: [], substituicoes: [], reservas_veiculo: [], pagamentos_profissionais: [] };
  const n = c.numerosDaSemana(vazia, HOJE, true);
  assert.deepEqual([n.eventosSemana, n.eventosSabado, n.pendencias, n.tiposPendencia, n.trocas, n.trocaDescricao, n.profissionaisAPagar],
    [0, 0, 0, '', 0, 'nenhuma no momento', 0]);
});

// ---------------------------------------------------------------------
console.log('\nConflitos de escala e transporte');
// ---------------------------------------------------------------------
const trocas = c.trocasPendentes(db);
teste('substituto escalado num evento que sobrepõe tem conflito', () =>
  assert.equal(trocas.find((t) => t.troca.id === 't1').semConflito, false));
teste('evento que começa quando o outro termina não é conflito', () =>
  assert.equal(trocas.find((t) => t.troca.id === 't2').semConflito, true));
teste('trocas de um evento só', () =>
  assert.deepEqual(c.trocasPendentes(db, 'qui').map((t) => t.troca.id), ['t1']));
teste('equipe em ordem de função e sem escalas encerradas', () => {
  const comEncerrada = { ...db, evento_escala: [...db.evento_escala, escala('s10', 'qui', 'davi', 'artista', { ativo: false })] };
  assert.deepEqual(c.equipeDoEvento(comEncerrada, 'qui2').map((m) => m.escala.funcao), ['artista', 'produtor']);
  assert.ok(!c.equipeDoEvento(comEncerrada, 'qui').some((m) => m.escala.id === 's10'));
});
teste('transporte mostra a reserva anterior do mesmo veículo no mesmo dia', () => {
  const comDuas = { ...db, reservas_veiculo: [...db.reservas_veiculo, reserva('r3', 'qui', '2026-11-12T16:00:00Z', '2026-11-12T19:00:00Z')] };
  const t = c.transporteDoEvento(comDuas, ev('qui2'));
  assert.equal(t.reserva.id, 'r1');
  assert.equal(t.bloqueioAnterior.reserva.id, 'r3');
  assert.equal(t.bloqueioAnterior.evento.id, 'qui');
});
teste('uso do veículo no sábado à noite conta como mesmo dia em São Paulo', () =>
  assert.equal(c.transporteDoEvento(db, ev('sab')).bloqueioAnterior?.reserva.id, 'r2'));
teste('reserva de outro dia não aparece como uso anterior', () =>
  assert.equal(c.transporteDoEvento(db, ev('dom2')).bloqueioAnterior, undefined));
teste('sem reserva: transporte vazio com o nome do veículo', () => {
  const t = c.transporteDoEvento(db, ev('qui3'));
  assert.equal(t.reserva, undefined);
  assert.equal(t.veiculoNome, 'Doblò');
});

// ---------------------------------------------------------------------
console.log('\nSituação das fantasias');
// ---------------------------------------------------------------------
const f = (id) => db.fantasias.find((x) => x.id === id);
teste('em limpeza com previsão', () =>
  assert.deepEqual(c.situacaoFantasiaNoEvento(db, f('f2'), ev('qui')), { texto: 'Em limpeza · volta sex 13', tom: 'alerta', detalhe: null }));
teste('em manutenção sem previsão', () =>
  assert.equal(c.situacaoFantasiaNoEvento(db, f('f3'), ev('qui')).texto, 'Em manutenção · sem previsão'));
teste('usada antes no mesmo dia por outro evento', () => {
  const s = c.situacaoFantasiaNoEvento(db, f('f4'), ev('qui2'));
  assert.equal(s.texto, 'Em uso até qui 12, 17h');
  assert.equal(s.detalhe, 'Volta da Festa da Laura antes da saída');
});
teste('uso depois do evento ou em outro dia não atrapalha', () => {
  assert.equal(c.situacaoFantasiaNoEvento(db, f('f1'), ev('qui3')).texto, 'Disponível');
  assert.equal(c.situacaoFantasiaNoEvento(db, f('f1'), ev('sab')).texto, 'Disponível');
});
teste('conferência do evento: sem fantasias, pendente e concluída', () => {
  assert.equal(c.conferenciaDoEvento(db, 'qui3'), 'pendente');
  assert.equal(c.conferenciaDoEvento(db, 'sab'), 'sem_fantasias');
  assert.equal(c.conferenciaDoEvento(db, 'seg'), 'pendente');
  const tudo = { ...db, conferencias_fantasia: [...db.conferencias_fantasia, { ...db.conferencias_fantasia[0], id: 'cf2', fantasia_id: 'f3' }] };
  assert.equal(c.conferenciaDoEvento(tudo, 'seg'), 'concluida');
});
teste('conferências pendentes dos últimos dias, sem eventos futuros ou cancelados', () =>
  assert.deepEqual(c.conferenciasPendentes(db, HOJE).map((x) => [x.evento.id, x.faltam]), [['seg', 1]]));

// ---------------------------------------------------------------------
console.log('\nFinanceiro do evento');
// ---------------------------------------------------------------------
teste('nada recebido = pendente', () => {
  const r = c.financeiroDoEvento(db, 'qui');
  assert.deepEqual([r.contratado, r.recebido, r.situacao, r.despesas], [1000, 0, 'pendente', 65.5]);
});
teste('recebido em parte = parcial', () => assert.equal(c.financeiroDoEvento(db, 'qui2').situacao, 'parcial'));
teste('recebido tudo (em mais de uma vez) = pago', () => {
  const r = c.financeiroDoEvento(db, 'qui3');
  assert.deepEqual([r.recebido, r.situacao], [500, 'pago']);
});
teste('pagamentos da equipe vêm com o nome do profissional', () =>
  assert.deepEqual(c.financeiroDoEvento(db, 'qui2').pagamentos.map((p) => p.profissional.nome), ['Ana Souza', 'Davi Souza']));
teste('evento sem financeiro não gera NaN', () => {
  const r = c.financeiroDoEvento(db, 'sab');
  assert.deepEqual([r.contratado, r.recebido, r.situacao, r.despesas], [0, 0, 'pendente', 0]);
});

// ---------------------------------------------------------------------
teste('nenhum cálculo altera a base carregada', () => {
  const antes = JSON.stringify(db);
  c.numerosDaSemana(db, HOJE, true);
  c.conferenciasPendentes(db, HOJE);
  db.eventos.forEach((e) => { c.transporteDoEvento(db, e); c.financeiroDoEvento(db, e.id); });
  assert.equal(JSON.stringify(db), antes);
});

console.log(`\n${passou} testes dos cálculos passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
