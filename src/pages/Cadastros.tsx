// Listas dos cadastros com os formulários de criar e editar.
// Quem não é da operação vê as listas, mas não os botões de cadastrar.

import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Layout, useCelular } from '../components/Layout';
import { Icone } from '../components/Icone';
import {
  FormContratante, FormFantasia, FormLocal, FormPersonagem, FormProfissional, FormVeiculo, ROTULO_FANTASIA,
} from '../components/FormulariosCadastro';
import { FormEvento } from '../components/FormulariosEvento';
import { FormDespesa, FormReserva } from '../components/FormulariosValores';
import { FormConferencia } from '../components/FormularioConferencia';
import { BotaoMinhaSenha } from '../components/MinhaSenha';
import { NOME_PERFIL, useEstado } from '../lib/estado';
import { dataLonga, diaCurto, hora, mesAno, moeda, partes, semAcentos } from '../lib/formato';
import {
  conferenciasPendentes, eventosOrdenados, financeiroDoEvento, localDe, ROTULO_SITUACAO, veValores,
} from '../lib/consultas';
import { LinhaEvento } from './Painel';

const ROTULO_FUNCAO_PROF = { artista: 'Artista', produtor: 'Produção', maquiador: 'Maquiagem', fantasias: 'Fantasias' };
const SITUACOES = ['agendado', 'confirmado', 'realizado', 'cancelado'] as const;

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

/** Guarda qual formulário está aberto: novo (item indefinido) ou edição */
function useFormulario<T>() {
  const [aberto, setAberto] = useState<{ item?: T } | null>(null);
  return {
    aberto,
    novo: () => setAberto({}),
    editar: (item: T) => setAberto({ item }),
    fechar: () => setAberto(null),
  };
}

function BotaoNovo({ texto, onClick }: { texto: string; onClick: () => void }) {
  const { permissoes } = useEstado();
  if (!permissoes.operacao) return null;
  return <button type="button" className="botao primario" onClick={onClick}><Icone nome="mais" /> {texto}</button>;
}

function Pagina({ titulo, descricao, acao, children }: { titulo: string; descricao: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <Layout>
      <div className="lista-topo">
        <div><h1>{titulo}</h1><p>{descricao}</p></div>
        {acao}
      </div>
      {children}
    </Layout>
  );
}

interface Linha {
  chave: string;
  celulas: ReactNode[];
  inativo?: boolean;
  onAbrir?: () => void;
}

function Tabela({ titulo, acao, cabecalho, linhas, vazio }: {
  titulo?: string; acao?: ReactNode; cabecalho: string[]; linhas: Linha[]; vazio?: string;
}) {
  return (
    <section className="cartao tabela-rolagem">
      {(titulo || acao) && <div className="cartao-topo">{titulo && <h2>{titulo}</h2>}{acao}</div>}
      {linhas.length === 0 ? <div className="vazio">{vazio ?? 'Nada cadastrado ainda.'}</div> : (
        <table className="tabela tabela-desktop">
          <thead><tr>{cabecalho.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className={`${l.onAbrir ? 'clicavel' : ''}${l.inativo ? ' inativo' : ''}`} onClick={l.onAbrir}>
                {l.celulas.map((c, j) => <td key={j}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {linhas.length > 0 && (
        <div className="tabela-cartoes">
          {linhas.map((linha) => (
            <article
              key={linha.chave}
              className={`tabela-card${linha.inativo ? ' inativo' : ''}${linha.onAbrir ? ' clicavel' : ''}`}
              onClick={linha.onAbrir}
              onKeyDown={(evento) => { if (evento.key === 'Enter') linha.onAbrir?.(); }}
              role={linha.onAbrir ? 'button' : undefined}
              tabIndex={linha.onAbrir ? 0 : undefined}
            >
              <div className="tabela-card-titulo">{linha.celulas[0]}</div>
              <dl>
                {linha.celulas.slice(1).map((valor, j) => (
                  <div key={cabecalho[j + 1]}>
                    <dt>{cabecalho[j + 1]}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Nome que abre a edição: um botão de verdade, para funcionar no teclado */
function NomeEditavel({ texto, inativo, onAbrir }: { texto: string; inativo?: boolean; onAbrir?: () => void }) {
  if (!onAbrir) return <strong>{texto}</strong>;
  return (
    <span>
      <button type="button" className="link-botao" onClick={(e) => { e.stopPropagation(); onAbrir(); }}>{texto}</button>
      {inativo && <span className="selo neutro" style={{ marginLeft: 8 }}>Inativo</span>}
    </span>
  );
}

// ---------------------------------------------------------------------

export function Eventos() {
  const { db } = useEstado();
  const celular = useCelular();
  const location = useLocation();
  const [novo, setNovo] = useState(false);
  const todosEventos = eventosOrdenados(db);
  const [parametros] = useSearchParams();
  const busca = semAcentos(parametros.get('busca') ?? '');
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const voltarPara = `${location.pathname}${location.search}`;
  const eventos = todosEventos.filter((evento) => {
    const partesEvento = partes(evento.inicio);
    const nome = semAcentos(`${evento.titulo} ${evento.aniversariante ?? ''}`);
    const mesEvento = `${partesEvento.ano}-${String(partesEvento.mes).padStart(2, '0')}`;
    return (!busca || nome.includes(busca)) && (!mes || mesEvento === mes) && (!situacao || evento.situacao === situacao);
  });
  const vazio = todosEventos.length ? 'Nenhum evento encontrado com esses filtros.' : 'Nenhum evento cadastrado ainda.';
  return (
    <Pagina
      titulo="Eventos" descricao={`${eventos.length} de ${todosEventos.length} eventos`}
      acao={<BotaoNovo texto="Novo evento" onClick={() => setNovo(true)} />}
    >
      <FiltrosEventos eventos={todosEventos} />
      {celular ? (
        eventos.length ? eventos.map((e) => <LinhaEvento key={e.id} evento={e} />) : <div className="vazio">{vazio}</div>
      ) : (
        <Tabela
          cabecalho={['Data', 'Evento', 'Local', 'Situação']}
          vazio={vazio}
          linhas={eventos.map((e) => ({
            chave: e.id,
            celulas: [
              `${diaCurto(e.inicio)} · ${hora(e.inicio)}`,
              <Link to={`/eventos/${e.id}`} state={{ voltarPara }} className="link-marca">{e.titulo}</Link>,
              localDe(db, e)?.nome,
              <span className={`selo ${e.situacao}`}>{ROTULO_SITUACAO[e.situacao]}</span>,
            ],
          }))}
        />
      )}
      {novo && <FormEvento onFechar={() => setNovo(false)} />}
    </Pagina>
  );
}

export function Profissionais() {
  const { db, permissoes } = useEstado();
  const form = useFormulario<(typeof db.profissionais)[number]>();
  const lista = [...db.profissionais].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return (
    <Pagina
      titulo="Profissionais" descricao="Artistas, produção, maquiagem e responsáveis pelas fantasias"
      acao={<BotaoNovo texto="Novo profissional" onClick={form.novo} />}
    >
      <Tabela
        cabecalho={['Nome', 'Funções', 'Personagens', 'Contato', 'Disponibilidade']}
        linhas={lista.map((p) => {
          const abrir = permissoes.operacao ? () => form.editar(p) : undefined;
          return {
            chave: p.id, inativo: !p.ativo, onAbrir: abrir,
            celulas: [
              <NomeEditavel texto={p.nome} inativo={!p.ativo} onAbrir={abrir} />,
              p.funcoes.map((f) => ROTULO_FUNCAO_PROF[f]).join(', '),
              db.profissional_personagens.filter((x) => x.profissional_id === p.id)
                .map((x) => db.personagens.find((pe) => pe.id === x.personagem_id)?.nome).join(', ') || '—',
              p.telefone ?? '—',
              p.disponibilidade ?? '—',
            ],
          };
        })}
      />
      {form.aberto && <FormProfissional item={form.aberto.item} onFechar={form.fechar} />}
    </Pagina>
  );
}

export function Personagens() {
  const { db, permissoes } = useEstado();
  const form = useFormulario<(typeof db.personagens)[number]>();
  const lista = [...db.personagens].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return (
    <Pagina
      titulo="Personagens" descricao="Perfil, referências e orientações da apresentação"
      acao={<BotaoNovo texto="Novo personagem" onClick={form.novo} />}
    >
      <Tabela
        cabecalho={['Personagem', 'Descrição', 'Orientações', 'Artistas']}
        linhas={lista.map((pe) => {
          const abrir = permissoes.operacao ? () => form.editar(pe) : undefined;
          return {
            chave: pe.id, inativo: !pe.ativo, onAbrir: abrir,
            celulas: [
              <NomeEditavel texto={pe.nome} inativo={!pe.ativo} onAbrir={abrir} />,
              pe.descricao ?? '—',
              pe.orientacoes ?? '—',
              db.profissional_personagens.filter((x) => x.personagem_id === pe.id).length,
            ],
          };
        })}
      />
      {form.aberto && <FormPersonagem item={form.aberto.item} onFechar={form.fechar} />}
    </Pagina>
  );
}

export function Fantasias() {
  const { db, permissoes, usuario, hoje } = useEstado();
  const form = useFormulario<(typeof db.fantasias)[number]>();
  const [conferir, setConferir] = useState<(typeof db.eventos)[number] | null>(null);
  const pendentes = permissoes.conferirFantasias ? conferenciasPendentes(db, hoje) : [];
  const nomePersonagem = (id: string) => db.personagens.find((p) => p.id === id)?.nome ?? '';
  const lista = [...db.fantasias].sort((a, b) =>
    nomePersonagem(a.personagem_id).localeCompare(nomePersonagem(b.personagem_id)) || a.identificacao.localeCompare(b.identificacao));
  // A responsável pelas fantasias também atualiza a situação (limpeza, manutenção)
  const podeEditar = permissoes.operacao || usuario.perfil === 'fantasias';

  return (
    <Pagina
      titulo="Fantasias" descricao="Situação de cada peça e previsão de volta da limpeza"
      acao={<BotaoNovo texto="Nova fantasia" onClick={form.novo} />}
    >
      {pendentes.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Tabela
            titulo="Conferências pendentes"
            cabecalho={['Evento', 'Quando', 'Fantasias sem conferência', '']}
            linhas={pendentes.map(({ evento, faltam }) => ({
              chave: evento.id,
              celulas: [
                <Link to={`/eventos/${evento.id}`} className="link-marca">{evento.titulo}</Link>,
                `${diaCurto(evento.inicio)} · ${hora(evento.inicio)}`,
                faltam,
                <button type="button" className="botao pequeno primario" onClick={() => setConferir(evento)}>Conferir</button>,
              ],
            }))}
          />
        </div>
      )}
      <Tabela
        cabecalho={['Fantasia', 'Personagem', 'Tamanho', 'Situação', 'Previsão de volta', 'Observações']}
        linhas={lista.map((f) => {
          const abrir = podeEditar ? () => form.editar(f) : undefined;
          return {
            chave: f.id, inativo: f.situacao === 'inativa', onAbrir: abrir,
            celulas: [
              <NomeEditavel texto={f.identificacao} onAbrir={abrir} />,
              nomePersonagem(f.personagem_id),
              f.tamanho ?? '—',
              <span className={`selo ${f.situacao === 'disponivel' ? 'ok' : f.situacao === 'inativa' ? 'neutro' : 'alerta'}`}>{ROTULO_FANTASIA[f.situacao]}</span>,
              f.previsao_disponivel ? `${diaCurto(f.previsao_disponivel)} · ${hora(f.previsao_disponivel)}` : '—',
              f.observacoes ?? '—',
            ],
          };
        })}
      />
      {form.aberto && <FormFantasia item={form.aberto.item} onFechar={form.fechar} />}
      {conferir && <FormConferencia evento={conferir} onFechar={() => setConferir(null)} />}
    </Pagina>
  );
}

export function Veiculos() {
  const { db, permissoes, usuario } = useEstado();
  const form = useFormulario<(typeof db.veiculos)[number]>();
  const [reserva, setReserva] = useState<{ item?: (typeof db.reservas_veiculo)[number] } | null>(null);
  const reservas = [...db.reservas_veiculo].filter((r) => r.ativo).sort((a, b) => b.retirada.localeCompare(a.retirada));
  const podeReservar = permissoes.operacao || usuario.perfil === 'produtor';
  const nomeVeiculo = (id: string) => db.veiculos.find((v) => v.id === id)?.nome ?? '';

  return (
    <Pagina
      titulo="Veículos" descricao="Veículos da empresa e reservas, da retirada à devolução"
      acao={<BotaoNovo texto="Novo veículo" onClick={form.novo} />}
    >
      <div className="coluna">
        <Tabela
          titulo="Veículos"
          cabecalho={['Veículo', 'Placa', 'Observações']}
          linhas={db.veiculos.map((v) => {
            const abrir = permissoes.operacao ? () => form.editar(v) : undefined;
            return {
              chave: v.id, inativo: !v.ativo, onAbrir: abrir,
              celulas: [<NomeEditavel texto={v.nome} inativo={!v.ativo} onAbrir={abrir} />, v.placa ?? '—', v.observacoes ?? '—'],
            };
          })}
        />
        <Tabela
          titulo="Reservas"
          acao={podeReservar && db.veiculos.some((v) => v.ativo)
            ? <button type="button" className="botao pequeno" onClick={() => setReserva({})}><Icone nome="mais" tamanho={14} /> Reserva sem evento</button>
            : undefined}
          cabecalho={['Dia', 'Veículo', 'Retirada', 'Devolução', 'Evento', 'Responsável']}
          vazio="Nenhuma reserva."
          linhas={reservas.map((r) => {
            const pode = permissoes.operacao || r.responsavel_id === usuario.profissionalId;
            const abrir = pode ? () => setReserva({ item: r }) : undefined;
            return {
              chave: r.id, onAbrir: abrir,
              celulas: [
                <NomeEditavel texto={dataLonga(r.retirada, false)} onAbrir={abrir} />,
                nomeVeiculo(r.veiculo_id),
                hora(r.retirada),
                r.devolvido_em
                  ? <span>{hora(r.devolucao_prevista)} <span className="selo ok">devolvido {hora(r.devolvido_em)}</span></span>
                  : hora(r.devolucao_prevista),
                r.evento_id
                  ? <Link to={`/eventos/${r.evento_id}`} className="link-marca" onClick={(e) => e.stopPropagation()}>{db.eventos.find((e) => e.id === r.evento_id)?.titulo}</Link>
                  : (r.observacoes ?? 'Sem evento'),
                db.profissionais.find((p) => p.id === r.responsavel_id)?.nome,
              ],
            };
          })}
        />
      </div>
      {form.aberto && <FormVeiculo item={form.aberto.item} onFechar={form.fechar} />}
      {reserva && (
        <FormReserva
          evento={reserva.item?.evento_id ? db.eventos.find((e) => e.id === reserva.item!.evento_id) : undefined}
          reserva={reserva.item} onFechar={() => setReserva(null)}
        />
      )}
    </Pagina>
  );
}

export function Financeiro() {
  const { db, perfil } = useEstado();
  const [despesa, setDespesa] = useState<{ item?: (typeof db.despesas)[number] } | null>(null);
  if (!veValores(perfil)) {
    return (
      <Pagina titulo="Financeiro" descricao="Valores dos eventos, recebimentos, pagamentos e despesas">
        <section className="cartao oculto"><h3>Sem acesso para este perfil</h3><p>Só a direção e a gerente veem os valores.</p></section>
      </Pagina>
    );
  }

  const eventos = eventosOrdenados(db).filter((e) => e.situacao !== 'cancelado'
    && (db.evento_financeiro.some((f) => f.evento_id === e.id) || db.pagamentos_profissionais.some((p) => p.evento_id === e.id)));
  const resumo = eventos.map((e) => {
    const f = financeiroDoEvento(db, e.id);
    const aPagar = f.pagamentos.filter((p) => p.situacao === 'pendente').reduce((s, p) => s + p.valor_combinado, 0);
    return { evento: e, ...f, aPagar };
  });
  const despesasGerais = db.despesas.filter((d) => !d.evento_id).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const pendentesAprovacao = db.despesas.filter((d) => d.aprovacao === 'pendente');
  const totais = resumo.reduce((t, r) => ({
    contratado: t.contratado + r.contratado, recebido: t.recebido + r.recebido,
    aPagar: t.aPagar + r.aPagar, despesas: t.despesas + r.despesas,
  }), { contratado: 0, recebido: 0, aPagar: 0, despesas: despesasGerais.reduce((s, d) => s + d.valor, 0) });

  // Quem tem valor a receber, somando os eventos
  const porProfissional = new Map<string, { nome: string; total: number; eventos: string[] }>();
  for (const p of db.pagamentos_profissionais.filter((x) => x.situacao === 'pendente')) {
    const atual = porProfissional.get(p.profissional_id)
      ?? { nome: db.profissionais.find((x) => x.id === p.profissional_id)?.nome ?? 'Profissional', total: 0, eventos: [] };
    atual.total += p.valor_combinado;
    atual.eventos.push(db.eventos.find((e) => e.id === p.evento_id)?.titulo ?? '');
    porProfissional.set(p.profissional_id, atual);
  }

  return (
    <Pagina titulo="Financeiro" descricao="Valores dos eventos, recebimentos, pagamentos e despesas">
      <div className="numeros">
        <div className="cartao numero"><span>Contratado</span><strong>{moeda(totais.contratado)}</strong><small>{eventos.length} eventos</small></div>
        <div className="cartao numero"><span>Recebido</span><strong>{moeda(totais.recebido)}</strong><small>falta {moeda(Math.max(0, totais.contratado - totais.recebido))}</small></div>
        <div className="cartao numero"><span>Equipe a pagar</span><strong className="marca">{moeda(totais.aPagar)}</strong><small>{porProfissional.size} profissionais</small></div>
        <div className="cartao numero">
          <span>Despesas</span><strong>{moeda(totais.despesas)}</strong>
          <small>{pendentesAprovacao.length ? `${pendentesAprovacao.length} aguardando aprovação` : 'eventos e gerais'}</small>
        </div>
      </div>
      <div className="coluna">
        <Tabela
          titulo="Por evento"
          cabecalho={['Evento', 'Contratado', 'Recebido', 'Situação', 'Equipe a pagar', 'Despesas']}
          vazio="Nenhum evento com valores registrados."
          linhas={resumo.map((r) => ({
            chave: r.evento.id,
            celulas: [
              <Link to={`/eventos/${r.evento.id}`} className="link-marca">{r.evento.titulo}</Link>,
              moeda(r.contratado),
              moeda(r.recebido),
              <span className={`selo ${r.situacao === 'pago' ? 'ok' : r.situacao === 'parcial' ? 'alerta' : 'neutro'}`}>{r.situacao}</span>,
              r.aPagar ? moeda(r.aPagar) : '—',
              r.despesas ? moeda(r.despesas) : '—',
            ],
          }))}
        />
        <Tabela
          titulo="A pagar por profissional"
          cabecalho={['Profissional', 'Eventos', 'Total']}
          vazio="Nenhum pagamento pendente."
          linhas={[...porProfissional.entries()].sort((a, b) => b[1].total - a[1].total).map(([id, p]) => ({
            chave: id, celulas: [<strong>{p.nome}</strong>, p.eventos.join(', '), moeda(p.total)],
          }))}
        />
        <Tabela
          titulo="Despesas gerais e insumos"
          acao={<button type="button" className="botao pequeno" onClick={() => setDespesa({})}><Icone nome="mais" tamanho={14} /> Lançar</button>}
          cabecalho={['Descrição', 'Tipo', 'Quem gastou', 'Valor']}
          vazio="Nenhuma despesa fora de evento."
          linhas={despesasGerais.map((d) => ({
            chave: d.id, onAbrir: () => setDespesa({ item: d }),
            celulas: [
              <NomeEditavel texto={d.descricao} onAbrir={() => setDespesa({ item: d })} />,
              d.tipo === 'insumo' ? 'Insumo' : 'Gasto extra',
              db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? '—',
              moeda(d.valor),
            ],
          }))}
        />
      </div>
      {despesa && <FormDespesa item={despesa.item} onFechar={() => setDespesa(null)} />}
    </Pagina>
  );
}

export function CadastrosGerais() {
  const { db, permissoes } = useEstado();
  const formContratante = useFormulario<(typeof db.contratantes)[number]>();
  const formLocal = useFormulario<(typeof db.locais)[number]>();

  return (
    <Pagina titulo="Cadastros" descricao="Contratantes e locais">
      <div className="coluna">
        <Tabela
          titulo="Contratantes"
          acao={<BotaoNovo texto="Novo contratante" onClick={formContratante.novo} />}
          cabecalho={['Contratante', 'Telefone', 'Eventos']}
          linhas={[...db.contratantes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => {
            const abrir = permissoes.operacao ? () => formContratante.editar(c) : undefined;
            return {
              chave: c.id, onAbrir: abrir,
              celulas: [<NomeEditavel texto={c.nome} onAbrir={abrir} />, c.telefone ?? '—', db.eventos.filter((e) => e.contratante_id === c.id).length],
            };
          })}
        />
        <Tabela
          titulo="Buffets e locais"
          acao={<BotaoNovo texto="Novo local" onClick={formLocal.novo} />}
          cabecalho={['Local', 'Endereço', 'Orientações de acesso']}
          linhas={[...db.locais].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)).map((l) => {
            const abrir = permissoes.operacao ? () => formLocal.editar(l) : undefined;
            return {
              chave: l.id, inativo: !l.ativo, onAbrir: abrir,
              celulas: [<NomeEditavel texto={l.nome} inativo={!l.ativo} onAbrir={abrir} />, l.endereco ?? '—', l.orientacoes_acesso ?? '—'],
            };
          })}
        />
      </div>
      {formContratante.aberto && <FormContratante item={formContratante.aberto.item} onFechar={formContratante.fechar} />}
      {formLocal.aberto && <FormLocal item={formLocal.aberto.item} onFechar={formLocal.fechar} />}
    </Pagina>
  );
}

export function Mais() {
  const { permissoes } = useEstado();
  const itens = [
    { para: '/personagens', texto: 'Personagens' },
    { para: '/fantasias', texto: 'Fantasias' },
    { para: '/veiculos', texto: 'Veículos' },
    { para: '/financeiro', texto: 'Financeiro' },
    { para: '/cadastros', texto: 'Contratantes e locais' },
    ...(permissoes.operacao ? [
      { para: '/usuarios', texto: 'Usuários e acessos' },
      { para: '/configuracoes', texto: 'Configurações' },
    ] : []),
  ];
  return (
    <Layout>
      <h1 style={{ marginBottom: 14 }}>Mais</h1>
      <section className="cartao proximos" style={{ marginBottom: 18 }}>
        {itens.map((i) => <Link key={i.para} to={i.para}>{i.texto} <Icone nome="direita" /></Link>)}
      </section>
      <ContaUsuario />
    </Layout>
  );
}

function ContaUsuario() {
  const { usuario, sair } = useEstado();
  return (
    <section className="cartao">
      <span className="rotulo">Conectado como</span>
      <strong style={{ display: 'block', margin: '4px 0 2px' }}>{usuario.nome}</strong>
      <p className="suave" style={{ margin: '0 0 12px' }}>{NOME_PERFIL[usuario.perfil]}</p>
      <BotaoMinhaSenha estilo={{ width: '100%', marginBottom: 8 }} />
      <button type="button" className="botao" onClick={sair} style={{ width: '100%' }}>Sair</button>
    </section>
  );
}
