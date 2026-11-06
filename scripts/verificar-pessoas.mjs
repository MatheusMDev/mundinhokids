// Regressões de carregamento e renderização: usa componentes reais e uma base
// fictícia. Não conecta ao Supabase nem altera dados do usuário.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const entry = String.raw`
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { carregarBase } from './src/lib/dados';
import { profissionalDisponivel, equipeDoEvento } from './src/lib/consultas';
import { FormEscala } from './src/components/FormulariosEvento';
import { FormDespesa, FormReserva, FormPagamentos } from './src/components/FormulariosValores';
import { Profissionais, ConfirmarExclusaoProfissional, Eventos, Personagens, Fantasias, Veiculos, Financeiro, CadastrosGerais, Mais } from './src/pages/Cadastros';
import { excluirProfissional } from './src/lib/acoes';
import { Usuarios } from './src/pages/Usuarios';
import { Configuracoes } from './src/pages/Configuracoes';
import { DetalheEvento } from './src/pages/DetalheEvento';
import { PdfEvento } from './src/pages/PdfEvento';
import { Painel } from './src/pages/Painel';
import { TODAS, telasPadrao } from './src/lib/estado';

globalThis.window = { matchMedia: () => ({ matches: true }), history: { state: { idx: 0 } } };
const originalError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect')) originalError(...args); };
const evento = { id: 'evento', titulo: 'Festa de teste', inicio: '2030-01-01T18:00:00Z', fim: '2030-01-01T21:00:00Z', situacao: 'confirmado', contratante_id: 'c', local_id: 'l', tem_maquiagem: false, maquiagem_pessoas: 0 };
const pessoa = (id, nome, ativo, usuario_id) => ({ id, nome, ativo, usuario_id, funcoes: ['artista', 'produtor', 'maquiador'], telefone: null, email: null, disponibilidade: null });
const dados = {
  usuarios: [{ id: 'gestao', nome: 'Gestão', perfil: 'gerente', ativo: true, email: 'gestao@example.test' }, { id: 'login-inativo', nome: 'Login inativo', ativo: false, perfil: 'artista' }],
  profissionais: [pessoa('ativo', 'Pessoa elegível', true, 'gestao'), pessoa('sem-login', 'Sem login legítimo', true, null), pessoa('inativo', 'Profissional desativado', false, null), pessoa('excluido', 'Profissional do login excluído', false, null), pessoa('bloqueado', 'Profissional com login inativo', true, 'login-inativo')],
  profissionais_disponiveis: ['ativo', 'sem-login'],
  eventos: [evento], personagens: [], profissional_personagens: [], fantasias: [], veiculos: [], reservas_veiculo: [],
  contratantes: [{ id: 'c', nome: 'Contratante' }], locais: [{ id: 'l', nome: 'Local', tipo: 'buffet', ativo: true }],
  evento_escala: [{ id: 'escala', evento_id: 'evento', profissional_id: 'excluido', funcao: 'produtor', ativo: true }],
  evento_financeiro: [{ evento_id: 'evento', valor_contratado: 900 }], recebimentos: [],
  pagamentos_profissionais: [{ id: 'pg', evento_id: 'evento', profissional_id: 'excluido', valor_combinado: 100, situacao: 'pendente' }],
  despesas: [], substituicoes: [], conferencias_fantasia: [], notificacoes: [], profissionais_notas: [], contratantes_notas: [], configuracoes: {}, historico: [], trocas_para_mim: [],
};
globalThis.__estadoPessoas = { db: dados, hoje: '2029-12-31T12:00:00Z', perfil: 'gerente', usuario: { id: 'gestao', nome: 'Gestão', perfil: 'gerente', profissionalId: null },
  permissoes: { operacao: true, gestao: true, alterarEquipe: true, cancelarEvento: true, conferirFantasias: true },
  papeis: new Set(['gerente']), telas: new Set(TODAS), inicio: '/', cliente: {}, executar: async () => true, sair() {}, avisar() {}, decidirTroca() {} };
let passaram = 0;
function teste(nome, fn) { fn(); passaram++; console.log('  ok   ' + nome); }
function render(Componente, props = {}, path = '/') {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/eventos/:id/*', element: React.createElement(Componente, props) }),
      React.createElement(Route, { path: '*', element: React.createElement(Componente, props) }))));
}
const indisponiveis = ['Profissional desativado', 'Profissional do login excluído', 'Profissional com login inativo'];
function semIndisponiveis(html) { for (const nome of indisponiveis) assert(!html.includes(nome), nome + ' apareceu numa nova seleção'); }

async function executar() {
  teste('Fantasias acessa eventos e conferência sem liberar Financeiro ou Usuários', () => {
    const telas = telasPadrao('fantasias', []);
    assert(telas.has('eventos') && telas.has('fantasias'));
    assert(!telas.has('financeiro') && !telas.has('usuarios') && !telas.has('configuracoes'));
  });
  teste('regra central permite ativo e sem login, bloqueia excluído/desativado/login inativo', () => {
    assert.deepEqual(dados.profissionais.filter(p => profissionalDisponivel(dados, p)).map(p => p.id), ['ativo', 'sem-login']);
  });
  teste('Gerência e Direção enxergam o botão de excluir profissional', () => {
    const estado = globalThis.__estadoPessoas;
    for (const perfil of ['gerente', 'diretora']) {
      estado.usuario.perfil = perfil;
      assert(render(Profissionais, {}, '/profissionais').includes('aria-label="Excluir profissional Pessoa elegível"'));
    }
    estado.usuario.perfil = 'gerente';
  });
  teste('outros perfis não enxergam botão nem confirmação de exclusão', () => {
    const estado = globalThis.__estadoPessoas;
    estado.permissoes.gestao = false;
    try {
      assert(!render(Profissionais, {}, '/profissionais').includes('aria-label="Excluir profissional'));
      assert(!render(ConfirmarExclusaoProfissional, { profissional: dados.profissionais[0], onFechar() {} }).includes('<dialog'));
    } finally { estado.permissoes.gestao = true; }
  });
  teste('confirmação identifica o profissional e explica preservação de login/histórico', () => {
    const html = render(ConfirmarExclusaoProfissional, { profissional: dados.profissionais[0], onFechar() {} });
    assert(html.includes('Pessoa elegível') && html.includes('O login será mantido') && html.includes('histórico de eventos e pagamentos'));
    assert(html.includes('botao perigo'));
  });
  teste('excluído não reaparece na lista nem com filtro Todos, mas permanece no histórico', () => {
    const pessoa = dados.profissionais.find(p => p.id === 'excluido');
    pessoa.excluido_em = '2026-11-05T23:00:00Z';
    try {
      assert(!render(Profissionais, {}, '/profissionais?status=todos').includes(pessoa.nome));
      assert.equal(equipeDoEvento(dados, evento.id)[0].profissional.nome, pessoa.nome);
    } finally { delete pessoa.excluido_em; }
  });
  let parametros;
  await excluirProfissional({ rpc: async (nome, args) => { parametros = { nome, args }; return { data: null, error: null }; } }, 'id-correto');
  teste('ação de excluir envia apenas o ID selecionado para a RPC protegida', () => assert.deepEqual(parametros, { nome: 'excluir_profissional', args: { p_profissional_id: 'id-correto' } }));
  await assert.rejects(() => excluirProfissional({ rpc: async () => ({ error: { code: 'PGRST202' } }) }, 'id-correto'), /precisa ser ativada/);
  passaram++;
  console.log('  ok   migração de exclusão ausente apresenta mensagem clara');
  teste('escala de artista só oferece elegíveis', () => { const html = render(FormEscala, { evento, onFechar() {} }); semIndisponiveis(html); assert(html.includes('Sem login legítimo')); });
  teste('despesa geral só oferece elegíveis', () => semIndisponiveis(render(FormDespesa, { onFechar() {} })));
  teste('despesa do evento não oferece excluído ainda presente na escala histórica', () => semIndisponiveis(render(FormDespesa, { evento, onFechar() {} })));
  teste('profissionais abre apenas ativos e elegíveis por padrão', () => { const html = render(Profissionais, {}, '/profissionais'); semIndisponiveis(html); assert(html.includes('Sem login legítimo')); });
  teste('filtro explícito permite consulta administrativa a inativos', () => {
    const html = render(Profissionais, {}, '/profissionais?status=inativo');
    for (const nome of indisponiveis) assert(html.includes(nome));
    assert(!html.includes('Pessoa elegível'));
  });
  teste('base histórica preserva quem já foi escalado', () => assert.equal(equipeDoEvento(dados, evento.id)[0].profissional.nome, 'Profissional do login excluído'));
  teste('pagamento histórico continua identificando o profissional excluído', () => assert(render(FormPagamentos, { evento, onFechar() {} }).includes('Profissional do login excluído')));
  teste('despesa antiga exibe responsável indisponível sem oferecê-lo para novo vínculo', () => {
    const html = render(FormDespesa, { item: { id: 'despesa', responsavel_id: 'excluido', valor: 10, descricao: 'Antiga', tipo: 'extra' }, onFechar() {} });
    assert(html.includes('Profissional do login excluído (indisponível'));
    assert(/<option[^>]*value="excluido"[^>]*disabled/.test(html));
  });
  for (const [Componente, path] of [[Painel, '/'], [Eventos, '/eventos'], [Profissionais, '/profissionais'], [Personagens, '/personagens'], [Fantasias, '/fantasias'], [Veiculos, '/veiculos'], [Financeiro, '/financeiro'], [CadastrosGerais, '/cadastros'], [Usuarios, '/usuarios'], [Configuracoes, '/configuracoes'], [Mais, '/mais'], [DetalheEvento, '/eventos/evento'], [PdfEvento, '/eventos/evento/pdf']]) {
    teste('renderização da tela ' + path + ' com profissional excluído no histórico', () => assert(render(Componente, {}, path).includes('Navegação')));
  }
  const chamadas = [];
  function mockCliente(falhar = false, elegiveis = [{ id: 'ativo' }, { id: 'sem-login' }]) {
    return {
      from(tabela) { const consulta = { select() { return this; }, not() { return this; }, order() { return this; }, limit() { return this; }, then(resolve) { resolve({ data: tabela === 'configuracoes' || tabela === 'historico' ? [] : dados[tabela] || [], error: null }); } }; return consulta; },
      rpc(nome) { chamadas.push(nome); return Promise.resolve({ data: nome === 'profissionais_disponiveis' ? elegiveis : [], error: falhar && nome === 'profissionais_disponiveis' ? (typeof falhar === 'object' ? falhar : { message: 'Falha ao consultar elegibilidade' }) : null }); },
    };
  }
  const base = await carregarBase(mockCliente());
  teste('carregamento mantém histórico e lê elegibilidade do banco', () => {
    assert(chamadas.includes('profissionais_disponiveis'));
    assert.equal(base.profissionais.length, 5);
    assert.deepEqual(base.profissionais_disponiveis, ['ativo', 'sem-login']);
  });
  await assert.rejects(() => carregarBase(mockCliente(true)), /Falha ao consultar elegibilidade/);
  passaram++;
  console.log('  ok   falha de elegibilidade não libera pessoas por padrão');
  for (const erro of [
    { code: 'PGRST202', message: 'Could not find the function public.profissionais_disponiveis without parameters in the schema cache' },
    { code: '42883', message: 'function public.profissionais_disponiveis() does not exist' },
  ]) {
    const compativel = await carregarBase(mockCliente(erro));
    teste('função ausente ' + erro.code + ' permite carregar com elegibilidade conservadora', () => {
      assert.equal(compativel.profissionais.length, 5);
      assert.deepEqual(compativel.profissionais_disponiveis, ['ativo']);
      for (const p of compativel.profissionais.filter(p => profissionalDisponivel(compativel, p))) {
        assert(p.ativo && p.usuario_id && compativel.usuarios.some(u => u.id === p.usuario_id && u.ativo));
      }
    });
  }
  const vazia = await carregarBase(mockCliente(false, []));
  teste('RPC existente com lista vazia não aciona compatibilidade', () => assert.deepEqual(vazia.profissionais_disponiveis, []));
  await assert.rejects(() => carregarBase(mockCliente({ code: '42501', message: 'profissionais_disponiveis: permission denied' })), /permission denied/);
  passaram++;
  console.log('  ok   erro real de permissão não é mascarado como função ausente');
  console.log('\n' + passaram + ' verificações de interface/carregamento passaram');
}
module.exports = executar();
`;

const resultado = await build({
  stdin: { contents: entry, resolveDir: raiz, sourcefile: 'verificar-pessoas.entry.js' },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  plugins: [{ name: 'estado-ficticio', setup(b) {
    b.onLoad({ filter: /[\\/]lib[\\/]estado\.tsx$/ }, ({ path }) => ({
      contents: readFileSync(path, 'utf8').replace(/export function useEstado\(\): Estado \{[\s\S]*$/, 'export function useEstado(): Estado { return (globalThis as any).__estadoPessoas; }'),
      loader: 'tsx', resolveDir: fileURLToPath(new URL('../src/lib/', import.meta.url)),
    }));
  } }],
});
const modulo = new Module(fileURLToPath(new URL('./verificar-pessoas.entry.cjs', import.meta.url)));
modulo.filename = modulo.id;
modulo.paths = Module._nodeModulePaths(raiz);
modulo._compile(resultado.outputFiles[0].text, modulo.filename);
await modulo.exports;
