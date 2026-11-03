// Listas simples dos cadastros, para o menu não levar a telas vazias.
// Os formulários de cadastro entram na etapa de cadastros (semanas 2 a 4).

import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout, SeletorPerfil, useCelular } from '../components/Layout';
import { Icone } from '../components/Icone';
import { useEstado } from '../lib/estado';
import { dataLonga, diaCurto, hora, mesAno, partes, moeda } from '../lib/formato';
import {
  eventosOrdenados, financeiroDoEvento, localDe, ROTULO_SITUACAO, veValores,
} from '../lib/consultas';
import { LinhaEvento } from './Painel';

const ROTULO_FUNCAO_PROF = { artista: 'Artista', produtor: 'Produção', maquiador: 'Maquiagem', fantasias: 'Fantasias' };
const ROTULO_FANTASIA = { disponivel: 'Disponível', limpeza: 'Em limpeza', manutencao: 'Em manutenção', inativa: 'Inativa' };
const SITUACOES = ['agendado', 'confirmado', 'realizado', 'cancelado'] as const;

function semAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function FiltrosEventos({ eventos }: { eventos: ReturnType<typeof eventosOrdenados> }) {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const meses = useMemo(() => {
    const unicos = new Map<string, string>();
    eventos.forEach((evento) => {
      const { ano, mes: numeroMes } = partes(evento.inicio);
      unicos.set(`${ano}-${String(numeroMes).padStart(2, '0')}`, mesAno(ano, numeroMes));
    });
    return [...unicos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [eventos]);

  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    setParametros(novos);
  };

  return (
    <section className="filtros-eventos" aria-label="Filtros de eventos">
      <label className="busca-eventos">
        <span className="busca-icone" aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar evento</span>
        <input
          type="search"
          value={busca}
          onChange={(evento) => alterar('busca', evento.target.value)}
          placeholder="Buscar por evento ou aniversariante"
        />
        {busca && <button type="button" className="limpar-busca" onClick={() => alterar('busca', '')} aria-label="Limpar busca">×</button>}
      </label>
      <label className="filtro-select">
        <span>Mês</span>
        <select value={mes} onChange={(evento) => alterar('mes', evento.target.value)}>
          <option value="">Todos os meses</option>
          {meses.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
      <label className="filtro-select">
        <span>Situação</span>
        <select value={situacao} onChange={(evento) => alterar('situacao', evento.target.value)}>
          <option value="">Todas as situações</option>
          {SITUACOES.map((valor) => <option key={valor} value={valor}>{ROTULO_SITUACAO[valor]}</option>)}
        </select>
      </label>
    </section>
  );
}

function Pagina({ titulo, descricao, children, tituloMobile }: { titulo: string; descricao: string; children: ReactNode; tituloMobile?: string }) {
  const { avisar } = useEstado();
  return (
    <Layout tituloMobile={tituloMobile}>
      <div className="lista-topo">
        <div><h1>{titulo}</h1><p>{descricao}</p></div>
        <button type="button" className="botao primario so-desktop" onClick={() => avisar('Os formulários de cadastro entram na próxima etapa.')}>
          <Icone nome="mais" /> Novo
        </button>
      </div>
      {children}
    </Layout>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: ReactNode[][] }) {
  return (
    <section className="cartao tabela-rolagem">
      <table className="tabela">
        <thead><tr>{cabecalho.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}

export function Eventos() {
  const { db } = useEstado();
  const celular = useCelular();
  const todosEventos = eventosOrdenados(db);
  const [parametros] = useSearchParams();
  const busca = semAcentos(parametros.get('busca') ?? '');
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const eventos = todosEventos.filter((evento) => {
    const partesEvento = partes(evento.inicio);
    const nome = semAcentos(`${evento.titulo} ${evento.aniversariante ?? ''}`);
    const mesEvento = `${partesEvento.ano}-${String(partesEvento.mes).padStart(2, '0')}`;
    return (!busca || nome.includes(busca)) && (!mes || mesEvento === mes) && (!situacao || evento.situacao === situacao);
  });
  const filtros = <FiltrosEventos eventos={todosEventos} />;
  if (celular) {
    return (
      <Pagina titulo="Eventos" descricao={`${eventos.length} de ${todosEventos.length} eventos`}>
        {filtros}
        {eventos.length ? eventos.map((e) => <LinhaEvento key={e.id} evento={e} />) : <div className="vazio">Nenhum evento encontrado com esses filtros.</div>}
      </Pagina>
    );
  }
  return (
    <Pagina titulo="Eventos" descricao={`${eventos.length} de ${todosEventos.length} eventos`}>
      {filtros}
      {eventos.length ? (
        <Tabela
          cabecalho={['Data', 'Evento', 'Local', 'Situação']}
          linhas={eventos.map((e) => [
            `${diaCurto(e.inicio)} · ${hora(e.inicio)}`,
            <Link to={`/eventos/${e.id}`} className="link-marca">{e.titulo}</Link>,
            localDe(db, e)?.nome,
            <span className={`selo ${e.situacao}`}>{ROTULO_SITUACAO[e.situacao]}</span>,
          ])}
        />
      ) : <div className="vazio">Nenhum evento encontrado com esses filtros.</div>}
    </Pagina>
  );
}

export function Profissionais() {
  const { db } = useEstado();
  return (
    <Pagina titulo="Profissionais" descricao="Artistas, produção, maquiagem e responsáveis pelas fantasias">
      <Tabela
        cabecalho={['Nome', 'Funções', 'Personagens', 'Contato', 'Disponibilidade']}
        linhas={db.profissionais.map((p) => [
          <strong>{p.nome}</strong>,
          p.funcoes.map((f) => ROTULO_FUNCAO_PROF[f]).join(', '),
          db.profissional_personagens.filter((x) => x.profissional_id === p.id)
            .map((x) => db.personagens.find((pe) => pe.id === x.personagem_id)?.nome).join(', ') || '—',
          p.telefone ?? '—',
          p.disponibilidade ?? '—',
        ])}
      />
    </Pagina>
  );
}

export function Personagens() {
  const { db } = useEstado();
  return (
    <Pagina titulo="Personagens" descricao="Perfil, referências e orientações da apresentação">
      <Tabela
        cabecalho={['Personagem', 'Descrição', 'Orientações', 'Artistas']}
        linhas={db.personagens.map((pe) => [
          <strong>{pe.nome}</strong>,
          pe.descricao ?? '—',
          pe.orientacoes ?? '—',
          db.profissional_personagens.filter((x) => x.personagem_id === pe.id).length,
        ])}
      />
    </Pagina>
  );
}

export function Fantasias() {
  const { db } = useEstado();
  return (
    <Pagina titulo="Fantasias" descricao="Situação de cada peça e previsão de volta da limpeza">
      <Tabela
        cabecalho={['Fantasia', 'Tamanho', 'Situação', 'Previsão de volta', 'Observações']}
        linhas={db.fantasias.map((f) => [
          <strong>{f.identificacao}</strong>,
          f.tamanho ?? '—',
          <span className={`selo ${f.situacao === 'disponivel' ? 'ok' : f.situacao === 'inativa' ? 'neutro' : 'alerta'}`}>{ROTULO_FANTASIA[f.situacao]}</span>,
          f.previsao_disponivel ? `${diaCurto(f.previsao_disponivel)} · ${hora(f.previsao_disponivel)}` : '—',
          f.observacoes ?? '—',
        ])}
      />
    </Pagina>
  );
}

export function Veiculos() {
  const { db } = useEstado();
  const reservas = [...db.reservas_veiculo].filter((r) => r.ativo).sort((a, b) => a.retirada.localeCompare(b.retirada));
  return (
    <Pagina titulo="Veículos" descricao="Reservas da Doblò, da retirada à devolução">
      <Tabela
        cabecalho={['Dia', 'Retirada', 'Devolução prevista', 'Evento', 'Responsável']}
        linhas={reservas.map((r) => [
          dataLonga(r.retirada, false),
          hora(r.retirada),
          hora(r.devolucao_prevista),
          r.evento_id ? <Link to={`/eventos/${r.evento_id}`} className="link-marca">{db.eventos.find((e) => e.id === r.evento_id)?.titulo}</Link> : '—',
          db.profissionais.find((p) => p.id === r.responsavel_id)?.nome,
        ])}
      />
    </Pagina>
  );
}

export function Financeiro() {
  const { db, perfil } = useEstado();
  if (!veValores(perfil)) {
    return (
      <Pagina titulo="Financeiro" descricao="Valores dos eventos, recebimentos, pagamentos e despesas">
        <section className="cartao oculto"><h3>Sem acesso para este perfil</h3><p>Só a direção e a gerente veem os valores.</p></section>
      </Pagina>
    );
  }
  const eventos = eventosOrdenados(db).filter((e) => db.evento_financeiro.some((f) => f.evento_id === e.id));
  return (
    <Pagina titulo="Financeiro" descricao="Valores dos eventos, recebimentos, pagamentos e despesas">
      <Tabela
        cabecalho={['Evento', 'Contratado', 'Recebido', 'Situação', 'Equipe a pagar', 'Despesas']}
        linhas={eventos.map((e) => {
          const f = financeiroDoEvento(db, e.id);
          const aPagar = f.pagamentos.filter((p) => p.situacao === 'pendente').reduce((s, p) => s + p.valor_combinado, 0);
          return [
            <Link to={`/eventos/${e.id}`} className="link-marca">{e.titulo}</Link>,
            moeda(f.contratado),
            moeda(f.recebido),
            <span className={`selo ${f.situacao === 'pago' ? 'ok' : f.situacao === 'parcial' ? 'alerta' : 'neutro'}`}>{f.situacao}</span>,
            aPagar ? moeda(aPagar) : '—',
            f.despesas ? moeda(f.despesas) : '—',
          ];
        })}
      />
    </Pagina>
  );
}

export function CadastrosGerais() {
  const { db } = useEstado();
  return (
    <Pagina titulo="Cadastros" descricao="Contratantes e locais">
      <div className="coluna">
        <Tabela
          cabecalho={['Contratante', 'Telefone', 'Eventos']}
          linhas={db.contratantes.map((c) => [<strong>{c.nome}</strong>, c.telefone ?? '—', db.eventos.filter((e) => e.contratante_id === c.id).length])}
        />
        <Tabela
          cabecalho={['Local', 'Endereço', 'Orientações de acesso']}
          linhas={db.locais.map((l) => [<strong>{l.nome}</strong>, l.endereco ?? '—', l.orientacoes_acesso ?? '—'])}
        />
      </div>
    </Pagina>
  );
}

export function Mais() {
  const itens = [
    { para: '/personagens', texto: 'Personagens' },
    { para: '/fantasias', texto: 'Fantasias' },
    { para: '/veiculos', texto: 'Veículos' },
    { para: '/financeiro', texto: 'Financeiro' },
    { para: '/cadastros', texto: 'Contratantes e locais' },
  ];
  return (
    <Layout>
      <h1 style={{ marginBottom: 14 }}>Mais</h1>
      <section className="cartao proximos" style={{ marginBottom: 18 }}>
        {itens.map((i) => <Link key={i.para} to={i.para}>{i.texto} <Icone nome="direita" /></Link>)}
      </section>
      <h2 className="secao-titulo">Ver tela como</h2>
      <SeletorPerfil />
    </Layout>
  );
}
