import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const resultado = await build({ entryPoints: [raiz + 'src/lib/minha-agenda.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const modulo = new Module(raiz + 'scripts/agenda-test.cjs');
modulo.filename = modulo.id;
modulo._compile(resultado.outputFiles[0].text, modulo.filename);
const { minhaAgenda } = modulo.exports;
const evento = (id, inicio, fim, situacao = 'confirmado') => ({ id, inicio, fim, situacao });
const escala = (evento_id, profissional_id = 'julia', ativo = true) => ({ evento_id, profissional_id, ativo });
const db = {
  eventos: [
    evento('futuro', '2026-11-10T15:00:00-03:00', '2026-11-10T18:00:00-03:00'),
    evento('andamento', '2026-11-09T10:00:00-03:00', '2026-11-09T18:00:00-03:00'),
    evento('encerrado', '2026-11-08T15:00:00-03:00', '2026-11-08T18:00:00-03:00'),
    evento('cancelado', '2026-11-12T15:00:00-03:00', '2026-11-12T18:00:00-03:00', 'cancelado'),
    evento('troca', '2026-11-13T15:00:00-03:00', '2026-11-13T18:00:00-03:00'),
    evento('outro', '2026-11-14T15:00:00-03:00', '2026-11-14T18:00:00-03:00'),
  ],
  evento_escala: [escala('futuro'), escala('futuro'), escala('andamento'), escala('encerrado', 'julia', false), escala('cancelado'), escala('troca', 'julia', false), escala('outro', 'bruno')],
  pagamentos_profissionais: [
    { evento_id: 'futuro', profissional_id: 'julia', valor_combinado: 100.1, situacao: 'pendente' },
    { evento_id: 'cancelado', profissional_id: 'julia', valor_combinado: 0.2, situacao: 'pendente' },
    { evento_id: 'encerrado', profissional_id: 'julia', valor_combinado: 150, situacao: 'pago' },
    { evento_id: 'indisponivel', profissional_id: 'julia', valor_combinado: 50, situacao: 'pendente' },
    { evento_id: 'outro', profissional_id: 'bruno', valor_combinado: 9999, situacao: 'pago' },
  ],
};
const antes = JSON.stringify(db);
const r = minhaAgenda(db, 'julia', '2026-11-09T12:00:00-03:00');
let n = 0;
function teste(nome, fn) { fn(); n++; console.log('ok ' + nome); }
teste('próximos incluem evento em andamento e não duplicam várias funções', () => assert.deepEqual(r.proximos.map(e => e.id), ['andamento', 'futuro']));
teste('cancelado e escala substituída não viram compromisso futuro', () => assert(!r.proximos.some(e => ['cancelado', 'troca'].includes(e.id))));
teste('histórico inclui cancelado e escala antiga, em ordem recente', () => assert.deepEqual(r.historico.map(e => e.id), ['cancelado', 'encerrado']));
teste('totais preservam centavos e obrigações de evento cancelado/indisponível', () => assert.deepEqual([r.aReceber, r.recebido], [150.3, 150]));
teste('valores e eventos alheios são filtrados mesmo com base ampliada', () => assert(!r.pagamentos.some(p => p.profissional_id !== 'julia') && !r.proximos.some(e => e.id === 'outro')));
teste('trocar profissional recalcula dados sem reaproveitar o anterior', () => { const b = minhaAgenda(db, 'bruno', '2026-11-09T12:00:00-03:00'); assert.equal(b.recebido, 9999); assert.deepEqual(b.proximos.map(e => e.id), ['outro']); });
teste('sem vínculo não mostra dados ou totais de ninguém', () => { const v = minhaAgenda(db, null, '2026-11-09T12:00:00-03:00'); assert.equal(v.pagamentos.length + v.proximos.length + v.historico.length + v.aReceber + v.recebido, 0); });
teste('consulta não altera a base', () => assert.equal(JSON.stringify(db), antes));
console.log(`${n} testes da Minha agenda passaram`);
