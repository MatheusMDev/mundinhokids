import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone } from '../components/Icone';
import { Paginacao, paginar } from '../components/Paginacao';
import { TrocasParaMim } from '../components/Trocas';
import { useEstado } from '../lib/estado';
import { minhaAgenda } from '../lib/minha-agenda';
import { dataLonga, hora, moeda } from '../lib/formato';
import { ROTULO_FUNCAO, ROTULO_SITUACAO } from '../lib/consultas';

const ABAS = [{ id: 'proximos', nome: 'Próximos' }, { id: 'historico', nome: 'Histórico' }, { id: 'valores', nome: 'Valores' }] as const;

export function MinhaAgenda() {
  const { db, usuario, hoje, telas } = useEstado();
  const [params, setParams] = useSearchParams();
  const dados = useMemo(() => minhaAgenda(db, usuario.profissionalId, hoje), [db, usuario.profissionalId, hoje]);
  const aba = ABAS.find(a => a.id === params.get('aba'))?.id ?? 'proximos';
  const pagina = Math.max(1, Math.floor(Number(params.get('pagina')) || 1));
  const eventos = aba === 'historico' ? dados.historico : dados.proximos;
  const lista = paginar(eventos, pagina, 10);
  const valores = paginar([...dados.pagamentos].sort((a, b) => {
    const ea = db.eventos.find(e => e.id === a.evento_id);
    const eb = db.eventos.find(e => e.id === b.evento_id);
    return Number(a.situacao === 'pago') - Number(b.situacao === 'pago') || (eb?.inicio ?? '').localeCompare(ea?.inicio ?? '');
  }), pagina, 10);
  const mudar = (chave: string, valor: string) => {
    const novos = new URLSearchParams(params);
    novos.set(chave, valor);
    if (chave === 'aba') novos.delete('pagina');
    setParams(novos);
  };
  const linkEvento = (id: string, titulo: string) => telas.has('eventos')
    ? <Link to={`/eventos/${id}`} state={{ voltarPara: `/${params.size ? `?${params}` : ''}` }}>{titulo}<Icone nome="direita" tamanho={16} /></Link>
    : <strong>{titulo}</strong>;

  return <Layout>
    <div className="lista-topo minha-agenda-topo"><div><h1>Minha agenda</h1><p>Seus compromissos e pagamentos em um só lugar.</p></div></div>
    {!usuario.profissionalId ? <section className="cartao"><h2>Seu cadastro ainda não está vinculado</h2><p className="suave">Peça à gerência para vincular seu acesso ao cadastro profissional.</p></section> : <>
      <div className="minha-agenda-resumo">
        <section className="cartao numero"><span>A receber</span><strong className="marca">{moeda(dados.aReceber)}</strong><small>Valores pendentes</small></section>
        <section className="cartao numero"><span>Já recebido</span><strong>{moeda(dados.recebido)}</strong><small>Pagamentos registrados</small></section>
      </div>
      <TrocasParaMim />
      <nav className="financeiro-abas minha-agenda-abas" aria-label="Seções da minha agenda">
        {ABAS.map(a => <Link key={a.id} to={`?aba=${a.id}`} className={aba === a.id ? 'ativo' : ''} aria-current={aba === a.id ? 'page' : undefined}>{a.nome}<small>{a.id === 'proximos' ? dados.proximos.length : a.id === 'historico' ? dados.historico.length : dados.pagamentos.length}</small></Link>)}
      </nav>
      <section aria-label={ABAS.find(a => a.id === aba)?.nome}>
        {aba === 'valores' ? <>
          <p className="suave">Todos os valores combinados com você, incluindo eventos anteriores e cancelados.</p>
          {valores.itens.map(p => {
            const evento = db.eventos.find(e => e.id === p.evento_id);
            return <article className="cartao minha-agenda-evento" key={p.id}>
              <div className="minha-agenda-evento-topo">{evento ? linkEvento(evento.id, evento.titulo) : <strong>Evento indisponível</strong>}<span className={`selo ${p.situacao === 'pago' ? 'ok' : 'alerta'}`}>{p.situacao === 'pago' ? 'Recebido' : 'A receber'}</span></div>
              {evento && <p className="suave">{dataLonga(evento.inicio)} · {ROTULO_SITUACAO[evento.situacao]}</p>}
              <div className="minha-agenda-valor"><strong>{moeda(p.valor_combinado)}</strong>{p.situacao === 'pago' && p.pago_em && <small>Recebido em {dataLonga(p.pago_em, false)}</small>}</div>
            </article>;
          })}
          {!dados.pagamentos.length && <div className="cartao vazio">Nenhum valor registrado para você.</div>}
        </> : <>
          {lista.itens.map(e => {
            const escalas = dados.escalas.filter(s => s.evento_id === e.id && (aba === 'historico' || s.ativo));
            const pagamento = dados.pagamentos.find(p => p.evento_id === e.id);
            return <article className="cartao minha-agenda-evento" key={e.id}>
              <div className="minha-agenda-evento-topo">{linkEvento(e.id, e.titulo)}<span className={`selo ${e.situacao}`}>{ROTULO_SITUACAO[e.situacao]}</span></div>
              <p className="minha-agenda-data"><Icone nome="calendario" tamanho={16} />{dataLonga(e.inicio)} · {hora(e.inicio)} às {hora(e.fim)}</p>
              <p className="suave">{db.locais.find(l => l.id === e.local_id)?.nome ?? 'Local a definir'}</p>
              <div className="minha-agenda-funcoes">{escalas.map(s => <span key={s.id}>{ROTULO_FUNCAO[s.funcao]}{s.personagem_id && ` · ${db.personagens.find(p => p.id === s.personagem_id)?.nome ?? 'Personagem a definir'}`}{!s.ativo && ' · Escala encerrada'}</span>)}</div>
              <div className="minha-agenda-valor">{pagamento ? <><strong>{moeda(pagamento.valor_combinado)}</strong><span>{pagamento.situacao === 'pago' ? 'Recebido' : 'A receber'}</span></> : <span className="suave">Valor ainda não informado</span>}</div>
            </article>;
          })}
          {!eventos.length && <div className="cartao vazio">{aba === 'historico' ? 'Nenhum evento no seu histórico.' : 'Nenhum compromisso agendado para você.'}</div>}
        </>}
        <Paginacao pagina={aba === 'valores' ? valores.atual : lista.atual} total={aba === 'valores' ? valores.totalPaginas : lista.totalPaginas} onMudar={p => mudar('pagina', String(p))} />
      </section>
    </>}
  </Layout>;
}
