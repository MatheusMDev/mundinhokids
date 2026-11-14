import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const result = await build({ entryPoints: [raiz + 'src/lib/financeiro.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
const modulo = new Module(raiz + 'scripts/financeiro-test.cjs');
modulo.filename = modulo.id;
modulo._compile(result.outputFiles[0].text, modulo.filename);
const { resumoDoFinanceiro } = modulo.exports;
const base = {
  eventos: [
    { id: 'e1', titulo: 'Evento parcial', inicio: '2026-11-06T18:00:00Z', situacao: 'confirmado' },
    { id: 'e2', titulo: 'Evento pago', inicio: '2026-11-07T18:00:00Z', situacao: 'confirmado' },
    { id: 'e3', titulo: 'Evento cancelado', inicio: '2026-11-08T18:00:00Z', situacao: 'cancelado' },
  ],
  profissionais: [{ id: 'p1', nome: 'Profissional antigo', ativo: false, excluido_em: '2026-11-01' }, { id: 'p2', nome: 'Profissional ativo', ativo: true }],
  evento_financeiro: [{ evento_id: 'e1', valor_contratado: 1000 }, { evento_id: 'e2', valor_contratado: 500 }, { evento_id: 'e3', valor_contratado: 600 }],
  recebimentos: [{ evento_id: 'e1', valor: 400 }, { evento_id: 'e2', valor: 500 }],
  pagamentos_profissionais: [
    { evento_id: 'e1', profissional_id: 'p1', valor_combinado: 150, situacao: 'pendente' },
    { evento_id: 'e1', profissional_id: 'p2', valor_combinado: 50, situacao: 'pago' },
    { evento_id: 'e2', profissional_id: 'p1', valor_combinado: 100, situacao: 'pendente' },
    { evento_id: 'e3', profissional_id: 'p2', valor_combinado: 60, situacao: 'pendente' },
  ],
  multas_cancelamento: [
    { id: 'm1', evento_id: 'e3', tipo: 'percentual', percentual: 10, valor_base: 600, valor: 60, justificativa: 'Teste', aplicado_por: 'u1', aplicado_em: '2026-11-09' },
  ],
  despesas: [
    { id: 'd1', evento_id: 'e1', valor: 100, criado_em: '2026-11-01', aprovacao: 'aprovada' },
    { id: 'd2', evento_id: null, valor: 40, criado_em: '2026-11-02', aprovacao: 'pendente' },
    { id: 'd3', evento_id: null, valor: 10, criado_em: '2026-11-03', aprovacao: 'nao_requer' },
  ],
};
let passou = 0;
function teste(nome, fn) { fn(); passou++; console.log('ok ' + nome); }
const r = resumoDoFinanceiro(base);
teste('totais de contratado, recebido e despesas preservados', () => assert.deepEqual(r.totais, { contratado: 1500, recebido: 900, aPagar: 310, despesas: 150 }));
teste('situação parcial e paga por evento', () => assert.deepEqual(r.eventos.map(e => e.situacao), ['parcial', 'pago']));
teste('multa de evento cancelado fica em lista separada e não duplica contratado/recebido', () => {
  assert.equal(r.multasCancelamento.length, 1);
  assert.equal(r.multasCancelamento[0].valor, 60);
  assert.equal(r.totais.contratado, 1500);
  assert.equal(r.totais.recebido, 900);
});
teste('equipe a pagar por evento exclui valores já pagos', () => assert.deepEqual(r.eventos.map(e => e.aPagar), [150, 100]));
teste('pendências agrupadas por profissional, com eventos e valores', () => assert.deepEqual(r.equipe.map(p => ({ nome: p.nome, total: p.total, eventos: p.eventos.length })), [
  { nome: 'Profissional antigo', total: 250, eventos: 2 }, { nome: 'Profissional ativo', total: 60, eventos: 1 },
]));
teste('indicador da equipe corresponde à lista mesmo com evento cancelado', () => assert.equal(r.totais.aPagar, r.equipe.reduce((s,p)=>s+p.total,0)));
teste('profissionais excluídos continuam identificados nas obrigações financeiras', () => assert.equal(r.equipe[0].nome, 'Profissional antigo'));
teste('despesas gerais ordenadas e aprovações contadas', () => { assert.deepEqual(r.despesasGerais.map(d => d.id), ['d3', 'd2']); assert.equal(r.pendentesAprovacao.length, 1); });
teste('zero e estado vazio não produzem NaN nem pendências fictícias', () => {
  const vazia = resumoDoFinanceiro(Object.fromEntries(Object.keys(base).map(k=>[k,[]])));
  assert.deepEqual(vazia.totais,{contratado:0,recebido:0,aPagar:0,despesas:0}); assert.equal(vazia.equipe.length,0);
});
teste('consolidação não altera dados carregados', () => { const antes=JSON.stringify(base); resumoDoFinanceiro(base); assert.equal(JSON.stringify(base),antes); });
console.log(passou + ' testes do Financeiro passaram');
