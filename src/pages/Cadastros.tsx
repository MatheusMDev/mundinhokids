// Listas dos cadastros com os formulários de criar e editar.
// Quem não é da operação vê as listas, mas não os botões de cadastrar.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { abasDoPerfil, Layout, MENU } from '../components/Layout';
import { Icone } from '../components/Icone';
import { ResumoDisponibilidadeEquipe } from '../components/DisponibilidadeSemanal';
import {
  FormContratante, FormFantasia, FormLocal, FormPersonagem, FormVeiculo, ROTULO_FANTASIA,
} from '../components/FormulariosCadastro';
import { FormEvento } from '../components/FormulariosEvento';
import { FormReserva } from '../components/FormulariosValores';
import { ReservaNoCard } from '../components/CartoesEvento';
import { FormConferencia } from '../components/FormularioConferencia';
import { Dialogo, SeletorData } from '../components/Formulario';
import { excluirProfissional } from '../lib/acoes';
import type { Profissional } from '../lib/tipos';
import { BotaoMinhaSenha } from '../components/MinhaSenha';
import { SeletorFiltro } from '../components/SeletorFiltro';
import { Paginacao } from '../components/Paginacao';
import { DocumentosProfissional } from '../components/DocumentosProfissional';
import { nomeDosPapeis, useEstado } from '../lib/estado';
import { dataLonga, diaCurto, hora, MESES, mesAno, partes, semAcentos } from '../lib/formato';
import {
  conferenciasPendentes, eventosOrdenados, localDe, ROTULO_SITUACAO,
  profissionalDisponivel,
} from '../lib/consultas';

const ROTULO_FUNCAO_PROF = { artista: 'Artista', produtor: 'Produção', maquiador: 'Maquiagem', fantasias: 'Fantasias' };
const ROTULO_TIPO_LOCAL = { buffet: 'Buffet', casa: 'Casa ou condomínio', escola: 'Escola', outro: 'Outro' };
const SITUACOES = ['agendado', 'confirmado', 'realizado', 'cancelado'] as const;

function FiltrosEventos({ eventos, db }: { eventos: ReturnType<typeof eventosOrdenados>; db: ReturnType<typeof useEstado>['db'] }) {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const local = parametros.get('local') ?? '';
  const meses = useMemo(() => {
    const unicos = new Map<string, string>();
    eventos.forEach((evento) => {
      const { ano, mes: numeroMes } = partes(evento.inicio);
      unicos.set(`${ano}-${String(numeroMes).padStart(2, '0')}`, mesAno(ano, numeroMes));
    });
    return [...unicos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [eventos]);
  const locais = useMemo(() => {
    const unicos = new Map<string, string>();
    eventos.forEach((evento) => {
      const nome = localDe(db, evento)?.nome;
      if (nome) unicos.set(evento.local_id, nome);
    });
    return [...unicos.entries()].sort(([, a], [, b]) => a.localeCompare(b));
  }, [db, eventos]);

  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    if (nome !== 'pagina') novos.delete('pagina');
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
      <SeletorFiltro label="Mês" icon="calendario" value={mes} options={[[ '', 'Todos os meses' ], ...meses]} onChange={(valor) => alterar('mes', valor)} />
      <SeletorFiltro label="Situação" icon="lista" value={situacao} options={[[ '', 'Todas as situações' ], ...SITUACOES.map((valor) => [valor, ROTULO_SITUACAO[valor]] as [string, string])]} onChange={(valor) => alterar('situacao', valor)} />
      <SeletorFiltro label="Buffet ou local" icon="local" value={local} options={[[ '', 'Todos os locais' ], ...locais]} onChange={(valor) => alterar('local', valor)} />
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

function Pagina({ titulo, descricao, acao, classe, children }: { titulo: string; descricao: string; acao?: ReactNode; classe?: string; children: ReactNode }) {
  return (
    <Layout>
      <div className={`lista-topo${classe ? ` ${classe}` : ''}`}>
        <div><h1>{titulo}</h1><p>{descricao}</p></div>
        {acao}
      </div>
      {children}
    </Layout>
  );
}


function FiltrosProfissionais({ db }: { db: ReturnType<typeof useEstado>['db'] }) {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const personagem = parametros.get('personagem') ?? '';
  const funcao = parametros.get('funcao') ?? '';
  const status = parametros.get('status') ?? 'ativo';
  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    if (nome !== 'pagina') novos.delete('pagina');
    setParametros(novos);
  };
  const personagens = [...db.personagens].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <section className="filtros-eventos filtros-profissionais" aria-label="Filtros de profissionais">
      <label className="busca-eventos">
        <span className="busca-icone" aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar profissional</span>
        <input type="search" value={busca} onChange={(evento) => alterar('busca', evento.target.value)} placeholder="Buscar por nome" />
        {busca && <button type="button" className="limpar-busca" onClick={() => alterar('busca', '')} aria-label="Limpar busca">×</button>}
      </label>
      <SeletorFiltro
        label="Personagem"
        icon="pessoas"
        value={personagem}
        options={[['', 'Todos os personagens'], ...personagens.map((item) => [item.id, item.nome] as [string, string])]}
        onChange={(valor) => alterar('personagem', valor)}
      />
      <SeletorFiltro
        label="Função"
        icon="lista"
        value={funcao}
        options={[['', 'Todas as funções'], ...Object.entries(ROTULO_FUNCAO_PROF)]}
        onChange={(valor) => alterar('funcao', valor)}
      />
      <SeletorFiltro label="Situação" icon="lista" value={status}
        options={[[ 'ativo', 'Ativos' ], [ 'inativo', 'Inativos / sem acesso ativo' ], [ 'todos', 'Todos' ]]}
        onChange={(valor) => alterar('status', valor)} />
    </section>
  );
}

function FiltrosPersonagens() {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const status = parametros.get('status') ?? '';
  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    if (nome !== 'pagina') novos.delete('pagina');
    setParametros(novos);
  };

  return (
    <section className="filtros-eventos filtros-personagens" aria-label="Filtros de personagens">
      <label className="busca-eventos">
        <span className="busca-icone" aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar personagem</span>
        <input type="search" value={busca} onChange={(evento) => alterar('busca', evento.target.value)} placeholder="Buscar por nome" />
        {busca && <button type="button" className="limpar-busca" onClick={() => alterar('busca', '')} aria-label="Limpar busca">×</button>}
      </label>
      <SeletorFiltro
        label="Status"
        icon="lista"
        value={status}
        options={[['', 'Todos os status'], ['ativo', 'Ativos'], ['inativo', 'Inativos']]}
        onChange={(valor) => alterar('status', valor)}
      />
    </section>
  );
}

function PaginacaoEventos({ pagina, total, onMudar }: { pagina: number; total: number; onMudar: (pagina: number) => void }) {
  if (total <= 1) return null;
  return (
    <nav className="paginacao-eventos" aria-label="Paginação dos eventos">
      <button type="button" className="paginacao-botao" disabled={pagina === 1} onClick={() => onMudar(pagina - 1)}>
        Anterior
      </button>
      <span>Página <strong>{pagina}</strong> de {total}</span>
      <button type="button" className="paginacao-botao" disabled={pagina === total} onClick={() => onMudar(pagina + 1)}>
        Próxima
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------

export function Eventos() {
  const { db, hoje } = useEstado();
  const location = useLocation();
  const [novo, setNovo] = useState(false);
  const todosEventos = eventosOrdenados(db);
  const [parametros, setParametros] = useSearchParams();
  const busca = semAcentos(parametros.get('busca') ?? '');
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const local = parametros.get('local') ?? '';
  const voltarPara = `${location.pathname}${location.search}`;
  const eventos = todosEventos.filter((evento) => {
    const partesEvento = partes(evento.inicio);
    const nome = semAcentos(`${evento.titulo} ${evento.aniversariante ?? ''}`);
    const mesEvento = `${partesEvento.ano}-${String(partesEvento.mes).padStart(2, '0')}`;
    return (!busca || nome.includes(busca)) && (!mes || mesEvento === mes)
      && (!situacao || evento.situacao === situacao) && (!local || evento.local_id === local);
  }).sort((a, b) => {
    const agora = new Date(hoje).getTime();
    const inicioA = new Date(a.inicio).getTime();
    const inicioB = new Date(b.inicio).getTime();
    const passadoA = inicioA < agora;
    const passadoB = inicioB < agora;
    if (passadoA !== passadoB) return passadoA ? 1 : -1;
    return passadoA ? inicioB - inicioA : inicioA - inicioB;
  });
  const totalPaginas = Math.max(1, Math.ceil(eventos.length / 10));
  const paginaSolicitada = Number(parametros.get('pagina') ?? '1');
  const pagina = Math.min(totalPaginas, Math.max(1, Number.isFinite(paginaSolicitada) ? paginaSolicitada : 1));
  const eventosDaPagina = eventos.slice((pagina - 1) * 10, pagina * 10);
  const mudarPagina = (novaPagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (novaPagina === 1) novos.delete('pagina');
    else novos.set('pagina', String(novaPagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const vazio = todosEventos.length ? 'Nenhum evento encontrado com esses filtros.' : 'Nenhum evento cadastrado ainda.';
  return (
    <Pagina
      titulo="Eventos" descricao={`${eventos.length} de ${todosEventos.length} eventos`}
      acao={<BotaoNovo texto="Novo evento" onClick={() => setNovo(true)} />}
    >
      <FiltrosEventos eventos={todosEventos} db={db} />
      {eventos.length ? (
        <div className="eventos-grade">
          {eventosDaPagina.map((e) => (
            <div key={e.id} className="evento-cartao-bloco">
              <Link to={`/eventos/${e.id}`} state={{ voltarPara }} className="evento-cartao">
                <div className={`evento-cartao-data ${e.situacao}`}>
                  <strong>{partes(e.inicio).dia}</strong>
                  <small className="evento-cartao-mes">{MESES[partes(e.inicio).mes - 1]}</small>
                  <small>{diaCurto(e.inicio).split(' ')[0]}</small>
                </div>
                <div className="evento-cartao-corpo">
                  <div className="evento-cartao-topo">
                    <span className={`selo ${e.situacao}`}>{ROTULO_SITUACAO[e.situacao]}</span>
                    <Icone nome="direita" tamanho={16} />
                  </div>
                  <strong className="evento-cartao-titulo">{e.titulo}</strong>
                  <span className="evento-cartao-info">{hora(e.inicio)} · {localDe(db, e)?.nome ?? 'Local não informado'}</span>
                  {e.aniversariante && <span className="evento-cartao-aniversariante">Aniversariante: {e.aniversariante}</span>}
                </div>
              </Link>
              <ReservaNoCard evento={e} />
            </div>
          ))}
        </div>
      ) : <div className="vazio">{vazio}</div>}
      <Paginacao pagina={pagina} total={totalPaginas} onMudar={mudarPagina} />
      {novo && <FormEvento onFechar={() => setNovo(false)} />}
    </Pagina>
  );
}

export function ConfirmarExclusaoProfissional({ profissional, onFechar }: { profissional: Profissional; onFechar: () => void }) {
  const { cliente, executar, permissoes } = useEstado();
  if (!permissoes.gestao) return null;
  return (
    <Dialogo titulo="Excluir profissional" textoSalvar="Excluir profissional" perigo onFechar={onFechar}
      onSalvar={() => executar(() => excluirProfissional(cliente, profissional.id), `Profissional ${profissional.nome} excluído.`)}>
      <p style={{ margin: 0 }}>Excluir <strong>{profissional.nome}</strong>{profissional.email ? ` (${profissional.email})` : ''} do cadastro de profissionais?</p>
      <p className="suave" style={{ margin: 0 }}>Ele deixará de aparecer na lista de profissionais e nas opções para novas escalas, reservas e despesas. O histórico de eventos e pagamentos será preservado.</p>
      {profissional.usuario_id && <p className="suave" style={{ margin: 0 }}>O login será mantido, mas perderá o vínculo com este profissional. Para remover também o acesso, use Usuários e acessos.</p>}
    </Dialogo>
  );
}

// Cadastro/edição junto ao acesso; exclusão disponível diretamente nesta tela.
export function Profissionais() {
  const { db, permissoes, usuario } = useEstado();
  const [excluindo, setExcluindo] = useState<Profissional | null>(null);
  const [parametros, setParametros] = useSearchParams();
  const lista = useMemo(() => db.profissionais.filter((p) => !p.excluido_em).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)), [db.profissionais]);
  const busca = semAcentos(parametros.get('busca') ?? '');
  const personagem = parametros.get('personagem') ?? '';
  const funcao = parametros.get('funcao') ?? '';
  const status = parametros.get('status') ?? 'ativo';
  const filtrados = lista.filter((profissional) => {
    const personagens = db.profissional_personagens.filter((item) => item.profissional_id === profissional.id);
    return (!busca || semAcentos(profissional.nome).includes(busca))
      && (!personagem || personagens.some((item) => item.personagem_id === personagem))
      && (!funcao || profissional.funcoes.includes(funcao as keyof typeof ROTULO_FUNCAO_PROF))
      && (status === 'todos' || (status === 'inativo' ? !profissionalDisponivel(db, profissional) : profissionalDisponivel(db, profissional)));
  });
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const paginaSolicitada = Number(parametros.get('pagina') ?? '1');
  const pagina = Math.min(totalPaginas, Math.max(1, Number.isFinite(paginaSolicitada) ? paginaSolicitada : 1));
  const listaDaPagina = filtrados.slice((pagina - 1) * 10, pagina * 10);
  const mudarPagina = (novaPagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (novaPagina === 1) novos.delete('pagina');
    else novos.set('pagina', String(novaPagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Pagina
      titulo="Profissionais" descricao={`${filtrados.length} de ${lista.length} profissionais`}
      acao={permissoes.gestao ? <Link to="/usuarios" className="botao"><Icone nome="acessos" /> Cadastrar em Usuários e acessos</Link> : undefined}
    >
      {permissoes.gestao && (
        <p className="suave" style={{ margin: '-6px 0 14px' }}>
          Cadastre e edite a equipe em <Link to="/usuarios" className="link-marca">Usuários e acessos</Link>.
        </p>
      )}
      <ResumoDisponibilidadeEquipe />
      <FiltrosProfissionais db={db} />
      {listaDaPagina.length ? (
        <div className="profissionais-grade">
          {listaDaPagina.map((p) => {
            const disponivel = profissionalDisponivel(db, p);
            const personagens = db.profissional_personagens.filter((x) => x.profissional_id === p.id)
              .map((x) => db.personagens.find((pe) => pe.id === x.personagem_id)?.nome)
              .filter(Boolean) as string[];
            return (
              <article key={p.id} className={`profissional-cartao${!disponivel ? ' inativo' : ''}`}>
                <div className="profissional-cartao-cabecalho">
                  <div className="profissional-identidade">
                    <span className="profissional-avatar"><Icone nome="usuario" tamanho={19} /></span>
                    <div>
                      <strong>{p.nome}</strong>
                      <span className={`selo ${disponivel ? 'confirmado' : 'realizado'}`}>{disponivel ? 'Ativo' : p.ativo ? 'Acesso inativo' : 'Inativo'}</span>
                    </div>
                  </div>
                  {!p.usuario_id && <span className="selo neutro" title="Ainda não tem acesso ao sistema">Sem acesso</span>}
                </div>
                <div className="profissional-funcoes">
                  <small>Função</small>
                  {p.funcoes.length ? p.funcoes.map((funcao) => <span key={funcao}>{ROTULO_FUNCAO_PROF[funcao]}</span>) : <span>Sem função definida</span>}
                </div>
                 <div className="profissional-detalhes">
                  <div><Icone nome="pessoas" tamanho={15} /><span><small>Personagens</small><strong>{personagens.length ? personagens.join(', ') : 'Nenhum vinculado'}</strong></span></div>
                  <div><Icone nome="telefone" tamanho={15} /><span><small>Contato</small><strong>{p.telefone ?? 'Não informado'}</strong></span></div>
                  <div><Icone nome="relogio" tamanho={15} /><span><small>Disponibilidade</small><strong>{p.disponibilidade ?? 'Não informada'}</strong></span></div>
                 </div>
                 <DocumentosProfissional
                   profissional={p}
                   documentos={db.documentos_artistas.filter((documento) => documento.profissional_id === p.id)}
                   usuarios={db.usuarios}
                   podeGerenciar={permissoes.gestao}
                 />
                {permissoes.gestao && (usuario.perfil === 'diretora' || !db.usuarios.some((u) => u.id === p.usuario_id && u.perfil === 'diretora')) && (
                  <div className="acoes-linha">
                    <button type="button" className="botao pequeno texto-perigo" aria-label={`Excluir profissional ${p.nome}`} onClick={() => setExcluindo(p)}>
                      <Icone nome="lixeira" tamanho={15} /> Excluir profissional
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : <div className="vazio">{lista.length ? 'Nenhum profissional encontrado com esses filtros.' : 'Nenhum profissional cadastrado ainda.'}</div>}
      <Paginacao pagina={pagina} total={totalPaginas} onMudar={mudarPagina} />
      {excluindo && permissoes.gestao && <ConfirmarExclusaoProfissional profissional={excluindo} onFechar={() => setExcluindo(null)} />}
    </Pagina>
  );
}

export function Personagens() {
  const { db, permissoes } = useEstado();
  const form = useFormulario<(typeof db.personagens)[number]>();
  const lista = [...db.personagens].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  const [parametros, setParametros] = useSearchParams();
  const busca = semAcentos(parametros.get('busca') ?? '');
  const status = parametros.get('status') ?? '';
  const filtrados = lista.filter((personagem) => (!busca || semAcentos(personagem.nome).includes(busca))
    && (!status || (status === 'ativo' ? personagem.ativo : !personagem.ativo)));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const paginaSolicitada = Number(parametros.get('pagina') ?? '1');
  const pagina = Math.min(totalPaginas, Math.max(1, Number.isFinite(paginaSolicitada) ? paginaSolicitada : 1));
  const personagensDaPagina = filtrados.slice((pagina - 1) * 10, pagina * 10);
  const mudarPagina = (novaPagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (novaPagina === 1) novos.delete('pagina');
    else novos.set('pagina', String(novaPagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Pagina
      titulo="Personagens" descricao={`${filtrados.length} de ${lista.length} personagens`}
      acao={<BotaoNovo texto="Novo personagem" onClick={form.novo} />}
    >
      <FiltrosPersonagens />
      {personagensDaPagina.length ? (
        <div className="personagens-grade">
          {personagensDaPagina.map((pe) => {
            const abrir = permissoes.operacao ? () => form.editar(pe) : undefined;
            const artistas = db.profissional_personagens.filter((x) => x.personagem_id === pe.id).length;
            return (
              <article
                key={pe.id}
                className={`personagem-cartao${!pe.ativo ? ' inativo' : ''}${abrir ? ' clicavel' : ''}`}
                onClick={abrir}
                onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }}
                role={abrir ? 'button' : undefined}
                tabIndex={abrir ? 0 : undefined}
              >
                <div className="personagem-cartao-cabecalho">
                  <div className="personagem-identidade">
                    <span className="personagem-avatar"><Icone nome="estrela" tamanho={19} /></span>
                    <div><strong>{pe.nome}</strong><span className={`selo ${pe.ativo ? 'confirmado' : 'realizado'}`}>{pe.ativo ? 'Ativo' : 'Inativo'}</span></div>
                  </div>
                  {abrir && <Icone nome="lapis" tamanho={16} />}
                </div>
                <div className="personagem-detalhes">
                  <div><Icone nome="arquivo" tamanho={15} /><span><small>Descrição</small><strong>{pe.descricao ?? 'Não informada'}</strong></span></div>
                  <div><Icone nome="lista" tamanho={15} /><span><small>Orientações</small><strong>{pe.orientacoes ?? 'Não informadas'}</strong></span></div>
                  <div><Icone nome="pessoas" tamanho={15} /><span><small>Artistas vinculados</small><strong>{artistas || 'Nenhum artista vinculado'}</strong></span></div>
                </div>
                {pe.referencias && <p className="personagem-referencias"><strong>Referências:</strong> {pe.referencias}</p>}
              </article>
            );
          })}
        </div>
      ) : <div className="vazio">{lista.length ? 'Nenhum personagem encontrado com esses filtros.' : 'Nenhum personagem cadastrado ainda.'}</div>}
      <PaginacaoEventos pagina={pagina} total={totalPaginas} onMudar={mudarPagina} />
      {form.aberto && <FormPersonagem item={form.aberto.item} onFechar={form.fechar} />}
    </Pagina>
  );
}

export function Fantasias() {
  const { db, permissoes, hoje, papeis, usuario } = useEstado();
  const form = useFormulario<(typeof db.fantasias)[number]>();
  const [conferir, setConferir] = useState<(typeof db.eventos)[number] | null>(null);
  const [conferenciasAberto, setConferenciasAberto] = useState(() => {
    try {
      return localStorage.getItem(`mundinho:fantasias:${usuario.id}:conferencias`) !== 'fechada';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`mundinho:fantasias:${usuario.id}:conferencias`, conferenciasAberto ? 'aberta' : 'fechada');
    } catch {
      // A tela segue funcionando se o navegador bloquear o armazenamento local.
    }
  }, [conferenciasAberto, usuario.id]);
  const pendentes = permissoes.conferirFantasias ? conferenciasPendentes(db, hoje) : [];
  const nomePersonagem = (id: string) => db.personagens.find((p) => p.id === id)?.nome ?? '';
  const lista = [...db.fantasias].sort((a, b) =>
    nomePersonagem(a.personagem_id).localeCompare(nomePersonagem(b.personagem_id)) || a.identificacao.localeCompare(b.identificacao));
  const [parametros, setParametros] = useSearchParams();
  const situacaoFiltro = parametros.get('situacao') ?? '';
  const buscaConferencia = semAcentos(parametros.get('buscaConferencia') ?? '');
  const dataConferencia = parametros.get('dataConferencia') ?? '';
  const listaFiltrada = lista.filter((fantasia) => !situacaoFiltro || fantasia.situacao === situacaoFiltro);
  const totalPaginasFantasias = Math.max(1, Math.ceil(listaFiltrada.length / 10));
  const paginaFantasiasSolicitada = Number(parametros.get('paginaFantasias') ?? '1');
  const paginaFantasias = Math.min(totalPaginasFantasias, Math.max(1, Number.isFinite(paginaFantasiasSolicitada) ? paginaFantasiasSolicitada : 1));
  const fantasiasDaPagina = listaFiltrada.slice((paginaFantasias - 1) * 10, paginaFantasias * 10);
  const pendentesFiltradas = pendentes.filter(({ evento }) => {
    const partesEvento = partes(evento.inicio);
    const dataEvento = `${partesEvento.ano}-${String(partesEvento.mes).padStart(2, '0')}-${String(partesEvento.dia).padStart(2, '0')}`;
    return (!buscaConferencia || semAcentos(evento.titulo).includes(buscaConferencia))
      && (!dataConferencia || dataEvento === dataConferencia);
  });
  const totalPaginasConferencias = Math.max(1, Math.ceil(pendentesFiltradas.length / 10));
  const paginaConferenciasSolicitada = Number(parametros.get('paginaConferencias') ?? '1');
  const paginaConferencias = Math.min(totalPaginasConferencias, Math.max(1, Number.isFinite(paginaConferenciasSolicitada) ? paginaConferenciasSolicitada : 1));
  const conferenciasDaPagina = pendentesFiltradas.slice((paginaConferencias - 1) * 10, paginaConferencias * 10);
  // A responsável pelas fantasias também atualiza a situação (limpeza, manutenção)
  const podeEditar = permissoes.operacao || papeis.has('fantasias');
  const filtrarSituacao = (situacao: string) => {
    const novos = new URLSearchParams(parametros);
    if (situacao === situacaoFiltro) novos.delete('situacao');
    else novos.set('situacao', situacao);
    novos.delete('paginaFantasias');
    setParametros(novos);
  };
  const filtrarConferencias = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    novos.delete('paginaConferencias');
    setParametros(novos);
  };
  const mudarPagina = (parametro: string, novaPagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (novaPagina === 1) novos.delete(parametro);
    else novos.set(parametro, String(novaPagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Pagina
      titulo="Fantasias" descricao={`${listaFiltrada.length} de ${lista.length} fantasias · situação e previsão de volta da limpeza`} classe="fantasias-pagina"
      acao={<BotaoNovo texto="Nova fantasia" onClick={form.novo} />}
    >
      <div className="fantasias-resumo" aria-label="Resumo das fantasias">
        {(['disponivel', 'limpeza', 'manutencao', 'inativa'] as const).map((situacao) => (
          <button key={situacao} type="button" className={`fantasia-resumo-item ${situacao}${situacaoFiltro === situacao ? ' ativo' : ''}`} aria-pressed={situacaoFiltro === situacao} onClick={() => filtrarSituacao(situacao)}>
            <span>{ROTULO_FANTASIA[situacao]}</span>
            <strong>{lista.filter((fantasia) => fantasia.situacao === situacao).length}</strong>
          </button>
        ))}
      </div>
      {pendentes.length > 0 && (
        <section className="conferencias-pendentes" aria-labelledby="titulo-conferencias-pendentes">
          <div className="conferencias-pendentes-topo">
            <div><span className="etiqueta-alerta">Ação necessária</span><h2 id="titulo-conferencias-pendentes">Conferências pendentes</h2></div>
            <div className="conferencias-pendentes-acoes">
              <span>{pendentesFiltradas.length} {pendentesFiltradas.length === 1 ? 'evento' : 'eventos'}</span>
              <button type="button" className="conferencias-toggle" aria-expanded={conferenciasAberto} aria-controls="conteudo-conferencias-pendentes" onClick={() => setConferenciasAberto((atual) => !atual)}>
                {conferenciasAberto ? 'Ocultar' : 'Mostrar'} <Icone nome="direita" tamanho={14} />
              </button>
            </div>
          </div>
          {conferenciasAberto && <div id="conteudo-conferencias-pendentes">
            <div className="filtros-conferencias">
              <label className="busca-eventos">
                <span className="filtro-campo-rotulo">Evento</span>
                <span className="busca-icone" aria-hidden="true">⌕</span>
                <span className="sr-only">Buscar evento pendente</span>
                <input type="search" value={parametros.get('buscaConferencia') ?? ''} onChange={(evento) => filtrarConferencias('buscaConferencia', evento.target.value)} placeholder="Buscar evento" />
                {buscaConferencia && <button type="button" className="limpar-busca" onClick={() => filtrarConferencias('buscaConferencia', '')} aria-label="Limpar busca">×</button>}
              </label>
              <SeletorData rotulo="Data" valor={dataConferencia} onMudar={(valor) => filtrarConferencias('dataConferencia', valor)} />
            </div>
            <div className="conferencias-grade">
              {conferenciasDaPagina.length ? conferenciasDaPagina.map(({ evento, faltam }) => (
                <article key={evento.id} className="conferencia-cartao">
                  <div className="conferencia-cartao-icone"><Icone nome="camiseta" tamanho={20} /></div>
                  <div className="conferencia-cartao-corpo">
                    <Link to={`/eventos/${evento.id}`} className="conferencia-evento">{evento.titulo}</Link>
                    <span className="conferencia-data"><Icone nome="calendario" tamanho={14} /> {diaCurto(evento.inicio)} · {hora(evento.inicio)}</span>
                    <strong>{faltam} {faltam === 1 ? 'fantasia aguarda' : 'fantasias aguardam'} conferência</strong>
                  </div>
                  <button type="button" className="botao pequeno primario" onClick={() => setConferir(evento)}>Conferir</button>
                </article>
              )) : <div className="vazio">Nenhuma conferência encontrada com esses filtros.</div>}
            </div>
            <PaginacaoEventos pagina={paginaConferencias} total={totalPaginasConferencias} onMudar={(pagina) => mudarPagina('paginaConferencias', pagina)} />
          </div>}
        </section>
      )}
      {fantasiasDaPagina.length ? (
        <div className="fantasias-grade">
          {fantasiasDaPagina.map((f) => {
            const abrir = podeEditar ? () => form.editar(f) : undefined;
            const situacao = f.situacao === 'disponivel' ? 'ok' : f.situacao === 'inativa' ? 'neutro' : 'alerta';
            return (
              <article
                key={f.id}
                className={`fantasia-cartao ${f.situacao}${f.situacao === 'inativa' ? ' inativo' : ''}${abrir ? ' clicavel' : ''}`}
                onClick={abrir}
                onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }}
                role={abrir ? 'button' : undefined}
                tabIndex={abrir ? 0 : undefined}
              >
                <div className="fantasia-cartao-cabecalho">
                  <div className="fantasia-identidade">
                    <span className="fantasia-avatar"><Icone nome="camiseta" tamanho={19} /></span>
                    <div><strong>{f.identificacao}</strong><span className={`selo ${situacao} ${f.situacao}`}>{ROTULO_FANTASIA[f.situacao]}</span></div>
                  </div>
                  {abrir && <Icone nome="lapis" tamanho={16} />}
                </div>
                <div className="fantasia-detalhes">
                  <div><Icone nome="estrela" tamanho={15} /><span><small>Personagem</small><strong>{nomePersonagem(f.personagem_id) || 'Não informado'}</strong></span></div>
                  <div><Icone nome="lista" tamanho={15} /><span><small>Tamanho</small><strong>{f.tamanho ?? 'Não informado'}</strong></span></div>
                  <div><Icone nome="calendario" tamanho={15} /><span><small>Previsão de volta</small><strong>{f.previsao_disponivel ? `${diaCurto(f.previsao_disponivel)} · ${hora(f.previsao_disponivel)}` : 'Sem previsão'}</strong></span></div>
                  <div><Icone nome="arquivo" tamanho={15} /><span><small>Observações</small><strong>{f.observacoes ?? 'Nenhuma observação'}</strong></span></div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="vazio">{lista.length ? 'Nenhuma fantasia encontrada nessa situação.' : 'Nenhuma fantasia cadastrada ainda.'}</div>}
      <PaginacaoEventos pagina={paginaFantasias} total={totalPaginasFantasias} onMudar={(pagina) => mudarPagina('paginaFantasias', pagina)} />
      {form.aberto && <FormFantasia item={form.aberto.item} onFechar={form.fechar} />}
      {conferir && <FormConferencia evento={conferir} onFechar={() => setConferir(null)} />}
    </Pagina>
  );
}

export function Veiculos() {
  const { db, permissoes, usuario, papeis } = useEstado();
  const form = useFormulario<(typeof db.veiculos)[number]>();
  const [reserva, setReserva] = useState<{ item?: (typeof db.reservas_veiculo)[number] } | null>(null);
  const veiculos = [...db.veiculos].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  const reservas = [...db.reservas_veiculo].filter((r) => r.ativo).sort((a, b) => b.retirada.localeCompare(a.retirada));
  const podeReservar = permissoes.operacao || papeis.has('produtor');
  const nomeVeiculo = (id: string) => db.veiculos.find((v) => v.id === id)?.nome ?? '';
  const [parametros, setParametros] = useSearchParams();
  const buscaReserva = semAcentos(parametros.get('buscaReserva') ?? '');
  const veiculoReserva = parametros.get('veiculoReserva') ?? '';
  const situacaoReserva = parametros.get('situacaoReserva') ?? '';
  const dataReserva = parametros.get('dataReserva') ?? '';
  const buscaVeiculo = semAcentos(parametros.get('buscaVeiculo') ?? '');
  const statusVeiculo = parametros.get('statusVeiculo') ?? '';
  const veiculosFiltrados = veiculos.filter((veiculo) => (!buscaVeiculo || semAcentos(`${veiculo.nome} ${veiculo.placa ?? ''}`).includes(buscaVeiculo))
    && (!statusVeiculo || (statusVeiculo === 'ativo' ? veiculo.ativo : !veiculo.ativo)));
  const totalPaginasVeiculos = Math.max(1, Math.ceil(veiculosFiltrados.length / 10));
  const paginaVeiculosSolicitada = Number(parametros.get('paginaVeiculos') ?? '1');
  const paginaVeiculos = Math.min(totalPaginasVeiculos, Math.max(1, Number.isFinite(paginaVeiculosSolicitada) ? paginaVeiculosSolicitada : 1));
  const veiculosDaPagina = veiculosFiltrados.slice((paginaVeiculos - 1) * 10, paginaVeiculos * 10);
  const reservasFiltradas = reservas.filter((reserva) => {
    const evento = reserva.evento_id ? db.eventos.find((item) => item.id === reserva.evento_id)?.titulo ?? '' : reserva.observacoes ?? '';
    const responsavel = db.profissionais.find((item) => item.id === reserva.responsavel_id)?.nome ?? '';
    const dataRetirada = partes(reserva.retirada);
    const chaveData = `${dataRetirada.ano}-${String(dataRetirada.mes).padStart(2, '0')}-${String(dataRetirada.dia).padStart(2, '0')}`;
    return (!buscaReserva || semAcentos(`${evento} ${responsavel}`).includes(buscaReserva))
      && (!veiculoReserva || reserva.veiculo_id === veiculoReserva)
      && (!situacaoReserva || (situacaoReserva === 'devolvida' ? Boolean(reserva.devolvido_em) : !reserva.devolvido_em))
      && (!dataReserva || chaveData === dataReserva);
  });
  const totalPaginasReservas = Math.max(1, Math.ceil(reservasFiltradas.length / 10));
  const paginaReservasSolicitada = Number(parametros.get('paginaReservas') ?? '1');
  const paginaReservas = Math.min(totalPaginasReservas, Math.max(1, Number.isFinite(paginaReservasSolicitada) ? paginaReservasSolicitada : 1));
  const reservasDaPagina = reservasFiltradas.slice((paginaReservas - 1) * 10, paginaReservas * 10);
  const alterarReserva = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    novos.delete('paginaReservas');
    setParametros(novos);
  };
  const alterarVeiculo = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    novos.delete('paginaVeiculos');
    setParametros(novos);
  };
  const mudarPaginaVeiculos = (pagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (pagina === 1) novos.delete('paginaVeiculos');
    else novos.set('paginaVeiculos', String(pagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const mudarPaginaReservas = (pagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (pagina === 1) novos.delete('paginaReservas');
    else novos.set('paginaReservas', String(pagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Pagina
      titulo="Veículos" descricao="Veículos da empresa e reservas, da retirada à devolução"
      acao={<BotaoNovo texto="Novo veículo" onClick={form.novo} />}
    >
      <div className="coluna">
        <div className="veiculos-topo"><div><h2>Veículos</h2><p>{veiculosFiltrados.length} de {veiculos.length} veículos</p></div></div>
        <div className="filtros-veiculos">
          <label className="busca-eventos"><span className="busca-icone" aria-hidden="true">⌕</span><span className="sr-only">Buscar veículo</span><input type="search" value={parametros.get('buscaVeiculo') ?? ''} onChange={(evento) => alterarVeiculo('buscaVeiculo', evento.target.value)} placeholder="Buscar por nome ou placa" />{buscaVeiculo && <button type="button" className="limpar-busca" onClick={() => alterarVeiculo('buscaVeiculo', '')} aria-label="Limpar busca">×</button>}</label>
          <SeletorFiltro label="Status" icon="lista" value={statusVeiculo} options={[['', 'Todos os status'], ['ativo', 'Ativos'], ['inativo', 'Inativos']]} onChange={(valor) => alterarVeiculo('statusVeiculo', valor)} />
        </div>
        {veiculosDaPagina.length ? (
          <div className="veiculos-grade">
            {veiculosDaPagina.map((v) => {
              const abrir = permissoes.operacao ? () => form.editar(v) : undefined;
              return (
                <article
                  key={v.id}
                  className={`veiculo-cartao${!v.ativo ? ' inativo' : ''}${abrir ? ' clicavel' : ''}`}
                  onClick={abrir}
                  onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }}
                  role={abrir ? 'button' : undefined}
                  tabIndex={abrir ? 0 : undefined}
                >
                  <div className="veiculo-cartao-cabecalho">
                    <div className="veiculo-identidade">
                      <span className="veiculo-avatar"><Icone nome="carro" tamanho={19} /></span>
                      <div><strong>{v.nome}</strong><span className={`selo ${v.ativo ? 'confirmado' : 'realizado'}`}>{v.ativo ? 'Ativo' : 'Inativo'}</span></div>
                    </div>
                    {abrir && <Icone nome="lapis" tamanho={16} />}
                  </div>
                  <div className="veiculo-detalhes">
                    <div><Icone nome="carro" tamanho={15} /><span><small>Placa</small><strong>{v.placa ?? 'Não informada'}</strong></span></div>
                    <div><Icone nome="arquivo" tamanho={15} /><span><small>Observações</small><strong>{v.observacoes ?? 'Nenhuma observação'}</strong></span></div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="vazio">{veiculos.length ? 'Nenhum veículo encontrado com esses filtros.' : 'Nenhum veículo cadastrado ainda.'}</div>}
        <PaginacaoEventos pagina={paginaVeiculos} total={totalPaginasVeiculos} onMudar={mudarPaginaVeiculos} />
        <section className="reservas-bloco cartao">
          <div className="reservas-topo">
            <div><h2>Reservas</h2><p>{reservasFiltradas.length} de {reservas.length} reservas</p></div>
            {podeReservar && db.veiculos.some((v) => v.ativo) && <button type="button" className="botao pequeno" onClick={() => setReserva({})}><Icone nome="mais" tamanho={14} /> Reserva sem evento</button>}
          </div>
          <div className="filtros-reservas">
            <label className="busca-eventos"><span className="busca-icone" aria-hidden="true">⌕</span><span className="sr-only">Buscar reserva</span><input type="search" value={parametros.get('buscaReserva') ?? ''} onChange={(evento) => alterarReserva('buscaReserva', evento.target.value)} placeholder="Buscar evento ou responsável" />{buscaReserva && <button type="button" className="limpar-busca" onClick={() => alterarReserva('buscaReserva', '')} aria-label="Limpar busca">×</button>}</label>
            <SeletorFiltro label="Veículo" icon="carro" value={veiculoReserva} options={[['', 'Todos os veículos'], ...db.veiculos.map((v) => [v.id, v.nome] as [string, string])]} onChange={(valor) => alterarReserva('veiculoReserva', valor)} />
            <SeletorFiltro label="Situação" icon="lista" value={situacaoReserva} options={[['', 'Todas'], ['aberta', 'Em aberto'], ['devolvida', 'Devolvidas']]} onChange={(valor) => alterarReserva('situacaoReserva', valor)} />
            <SeletorData rotulo="Retirada" valor={dataReserva} onMudar={(valor) => alterarReserva('dataReserva', valor)} />
          </div>
          {reservasDaPagina.length ? <div className="reservas-grade">
            {reservasDaPagina.map((r) => {
              const pode = permissoes.operacao || r.responsavel_id === usuario.profissionalId;
              const abrir = pode ? () => setReserva({ item: r }) : undefined;
              const evento = r.evento_id ? db.eventos.find((e) => e.id === r.evento_id) : undefined;
              const responsavel = db.profissionais.find((p) => p.id === r.responsavel_id)?.nome ?? 'Responsável não informado';
              return <article key={r.id} className={`reserva-cartao${abrir ? ' clicavel' : ''}`} onClick={abrir} onKeyDown={(e) => { if (e.key === 'Enter') abrir?.(); }} role={abrir ? 'button' : undefined} tabIndex={abrir ? 0 : undefined}>
                <div className="reserva-cartao-topo"><span className="reserva-data"><Icone nome="calendario" tamanho={15} /> {dataLonga(r.retirada, false)}</span><span className={`selo ${r.devolvido_em ? 'ok' : 'alerta'}`}>{r.devolvido_em ? 'Devolvida' : 'Em aberto'}</span></div>
                <strong className="reserva-veiculo"><Icone nome="carro" tamanho={16} /> {nomeVeiculo(r.veiculo_id)}</strong>
                <div className="reserva-horarios"><span>Retirada <strong>{hora(r.retirada)}</strong></span><span>Devolução <strong>{hora(r.devolucao_prevista)}</strong></span></div>
                <div className="reserva-cartao-rodape"><span>{evento ? <Link to={`/eventos/${evento.id}`} className="link-marca" onClick={(e) => e.stopPropagation()}>{evento.titulo}</Link> : (r.observacoes ?? 'Sem evento')}</span><small>{responsavel}</small></div>
              </article>;
            })}
          </div> : <div className="vazio">{reservas.length ? 'Nenhuma reserva encontrada com esses filtros.' : 'Nenhuma reserva.'}</div>}
          <PaginacaoEventos pagina={paginaReservas} total={totalPaginasReservas} onMudar={mudarPaginaReservas} />
        </section>
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

export { Financeiro } from './Financeiro';

export function CadastrosGerais() {
  const { db, permissoes } = useEstado();
  const formContratante = useFormulario<(typeof db.contratantes)[number]>();
  const formLocal = useFormulario<(typeof db.locais)[number]>();
  const [parametros, setParametros] = useSearchParams();
  const buscaContratante = semAcentos(parametros.get('buscaContratante') ?? '');
  const buscaLocal = semAcentos(parametros.get('buscaLocal') ?? '');
  const tipoLocal = parametros.get('tipoLocal') ?? '';
  const statusLocal = parametros.get('statusLocal') ?? '';
  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    novos.delete(nome === 'buscaContratante' ? 'paginaContratantes' : 'paginaLocais');
    setParametros(novos);
  };
  const mudarPagina = (parametro: string, pagina: number) => {
    const novos = new URLSearchParams(parametros);
    if (pagina === 1) novos.delete(parametro);
    else novos.set(parametro, String(pagina));
    setParametros(novos);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const contratantes = [...db.contratantes]
    .filter((contratante) => !buscaContratante || semAcentos(`${contratante.nome} ${contratante.telefone ?? ''} ${contratante.email ?? ''}`).includes(buscaContratante))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const locais = [...db.locais]
    .filter((local) => (!buscaLocal || semAcentos(`${local.nome} ${local.endereco ?? ''} ${local.contato ?? ''}`).includes(buscaLocal))
      && (!tipoLocal || local.tipo === tipoLocal)
      && (!statusLocal || (statusLocal === 'ativo' ? local.ativo : !local.ativo)))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  const totalPaginasContratantes = Math.max(1, Math.ceil(contratantes.length / 10));
  const paginaContratantesSolicitada = Number(parametros.get('paginaContratantes') ?? '1');
  const paginaContratantes = Math.min(totalPaginasContratantes, Math.max(1, Number.isFinite(paginaContratantesSolicitada) ? paginaContratantesSolicitada : 1));
  const contratantesDaPagina = contratantes.slice((paginaContratantes - 1) * 10, paginaContratantes * 10);
  const totalPaginasLocais = Math.max(1, Math.ceil(locais.length / 10));
  const paginaLocaisSolicitada = Number(parametros.get('paginaLocais') ?? '1');
  const paginaLocais = Math.min(totalPaginasLocais, Math.max(1, Number.isFinite(paginaLocaisSolicitada) ? paginaLocaisSolicitada : 1));
  const locaisDaPagina = locais.slice((paginaLocais - 1) * 10, paginaLocais * 10);

  return (
    <Pagina titulo="Cadastros" descricao={`${contratantes.length} contratantes · ${locais.length} locais encontrados`}>
      <div className="coluna">
        <section className="cadastros-secao">
          <div className="cadastros-secao-topo">
            <div><h2>Contratantes</h2><p>{contratantes.length} de {db.contratantes.length} cadastrados</p></div>
            <BotaoNovo texto="Novo contratante" onClick={formContratante.novo} />
          </div>
          <div className="filtros-cadastros">
            <label className="busca-eventos">
              <span className="busca-icone" aria-hidden="true">⌕</span>
              <span className="sr-only">Buscar contratante</span>
              <input type="search" value={parametros.get('buscaContratante') ?? ''} onChange={(evento) => alterar('buscaContratante', evento.target.value)} placeholder="Buscar por nome, telefone ou e-mail" />
              {buscaContratante && <button type="button" className="limpar-busca" onClick={() => alterar('buscaContratante', '')} aria-label="Limpar busca">×</button>}
            </label>
          </div>
          {contratantesDaPagina.length ? <div className="cadastros-grade contratantes-grade">
            {contratantesDaPagina.map((contratante) => {
              const abrir = permissoes.operacao ? () => formContratante.editar(contratante) : undefined;
              const eventos = db.eventos.filter((evento) => evento.contratante_id === contratante.id).length;
              return <article key={contratante.id} className={`cadastro-cartao contratante-cartao${abrir ? ' clicavel' : ''}`} onClick={abrir} onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }} role={abrir ? 'button' : undefined} tabIndex={abrir ? 0 : undefined}>
                <div className="cadastro-cartao-cabecalho"><div className="cadastro-identidade"><span className="cadastro-avatar"><Icone nome="pessoas" tamanho={19} /></span><strong>{contratante.nome}</strong></div>{abrir && <Icone nome="lapis" tamanho={16} />}</div>
                <div className="cadastro-detalhes">
                  <div><Icone nome="telefone" tamanho={15} /><span><small>Telefone</small><strong>{contratante.telefone ?? 'Não informado'}</strong></span></div>
                  <div><Icone nome="email" tamanho={15} /><span><small>E-mail</small><strong>{contratante.email ?? 'Não informado'}</strong></span></div>
                  <div><Icone nome="calendario" tamanho={15} /><span><small>Eventos</small><strong>{eventos || 'Nenhum evento vinculado'}</strong></span></div>
                </div>
              </article>;
            })}
          </div> : <div className="vazio">{db.contratantes.length ? 'Nenhum contratante encontrado com esses filtros.' : 'Nenhum contratante cadastrado ainda.'}</div>}
          <Paginacao pagina={paginaContratantes} total={totalPaginasContratantes} onMudar={(pagina) => mudarPagina('paginaContratantes', pagina)} rotulo="Paginação dos contratantes" />
        </section>
        <section className="cadastros-secao">
          <div className="cadastros-secao-topo">
            <div><h2>Buffets e locais</h2><p>{locais.length} de {db.locais.length} cadastrados</p></div>
            <BotaoNovo texto="Novo local" onClick={formLocal.novo} />
          </div>
          <div className="filtros-cadastros filtros-locais">
            <label className="busca-eventos">
              <span className="busca-icone" aria-hidden="true">⌕</span>
              <span className="sr-only">Buscar local</span>
              <input type="search" value={parametros.get('buscaLocal') ?? ''} onChange={(evento) => alterar('buscaLocal', evento.target.value)} placeholder="Buscar por nome, endereço ou contato" />
              {buscaLocal && <button type="button" className="limpar-busca" onClick={() => alterar('buscaLocal', '')} aria-label="Limpar busca">×</button>}
            </label>
            <SeletorFiltro label="Tipo" icon="local" value={tipoLocal} options={[['', 'Todos os tipos'], ...Object.entries(ROTULO_TIPO_LOCAL)]} onChange={(valor) => alterar('tipoLocal', valor)} />
            <SeletorFiltro label="Situação" icon="lista" value={statusLocal} options={[['', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']]} onChange={(valor) => alterar('statusLocal', valor)} />
          </div>
          {locaisDaPagina.length ? <div className="cadastros-grade locais-grade">
            {locaisDaPagina.map((local) => {
              const abrir = permissoes.operacao ? () => formLocal.editar(local) : undefined;
              return <article key={local.id} className={`cadastro-cartao local-cartao${!local.ativo ? ' inativo' : ''}${abrir ? ' clicavel' : ''}`} onClick={abrir} onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }} role={abrir ? 'button' : undefined} tabIndex={abrir ? 0 : undefined}>
                <div className="cadastro-cartao-cabecalho"><div className="cadastro-identidade"><span className="cadastro-avatar"><Icone nome="local" tamanho={19} /></span><div><strong>{local.nome}</strong><span className={`selo ${local.ativo ? 'confirmado' : 'realizado'}`}>{local.ativo ? 'Ativo' : 'Inativo'}</span></div></div>{abrir && <Icone nome="lapis" tamanho={16} />}</div>
                <div className="cadastro-detalhes">
                  <div><Icone nome="lista" tamanho={15} /><span><small>Tipo</small><strong>{ROTULO_TIPO_LOCAL[local.tipo as keyof typeof ROTULO_TIPO_LOCAL] ?? local.tipo}</strong></span></div>
                  <div><Icone nome="local" tamanho={15} /><span><small>Endereço</small><strong>{local.endereco ?? 'Não informado'}</strong></span></div>
                  <div><Icone nome="telefone" tamanho={15} /><span><small>Contato</small><strong>{local.contato ?? 'Não informado'}</strong></span></div>
                </div>
                <div className="local-cartao-acesso"><Icone nome="arquivo" tamanho={15} /><span><small>Orientações de acesso</small><strong>{local.orientacoes_acesso ?? 'Nenhuma orientação cadastrada'}</strong></span></div>
                {local.link_localizacao && <a href={local.link_localizacao} target="_blank" rel="noreferrer" className="link-marca local-cartao-link" onClick={(evento) => evento.stopPropagation()}>Abrir localização <Icone nome="direita" tamanho={13} /></a>}
              </article>;
            })}
          </div> : <div className="vazio">{db.locais.length ? 'Nenhum local encontrado com esses filtros.' : 'Nenhum local cadastrado ainda.'}</div>}
          <Paginacao pagina={paginaLocais} total={totalPaginasLocais} onMudar={(pagina) => mudarPagina('paginaLocais', pagina)} rotulo="Paginação dos locais" />
        </section>
      </div>
      {formContratante.aberto && <FormContratante item={formContratante.aberto.item} onFechar={formContratante.fechar} />}
      {formLocal.aberto && <FormLocal item={formLocal.aberto.item} onFechar={formLocal.fechar} />}
    </Pagina>
  );
}

export function Mais() {
  const { telas, usuario } = useEstado();
  // O que o perfil enxerga e ainda não está nas abas de baixo
  const nasAbas = new Set(abasDoPerfil(telas, usuario.abasMobile).map((a) => a.para));
  const itens = MENU
    .filter((i) => i.tela !== 'notificacoes' && telas.has(i.tela) && !nasAbas.has(i.para))
    .map((i) => (i.tela === 'cadastros' ? { ...i, texto: 'Contratantes e locais' } : i));
  return (
    <Layout>
      <h1 style={{ marginBottom: 14 }}>Mais</h1>
      {itens.length > 0 && (
        <section className="cartao proximos" style={{ marginBottom: 18 }}>
           {itens.map((i) => <Link key={i.para} to={i.para}>{i.texto} <Icone nome="direita" /></Link>)}
        </section>
      )}
      <ContaUsuario />
    </Layout>
  );
}

function ContaUsuario() {
  const { usuario, papeis, sair } = useEstado();
  return (
    <section className="cartao">
      <span className="rotulo">Conectado como</span>
      <Link to="/minha-conta" className="conta-link-nome"><strong>{usuario.nome}</strong></Link>
      <p className="suave" style={{ margin: '0 0 12px' }}>{nomeDosPapeis(usuario.perfil, papeis)}</p>
      <BotaoMinhaSenha estilo={{ width: '100%', marginBottom: 8 }} />
      <button type="button" className="botao" onClick={sair} style={{ width: '100%' }}>Sair</button>
    </section>
  );
}
