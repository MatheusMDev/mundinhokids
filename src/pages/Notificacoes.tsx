import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone } from '../components/Icone';
import { TIPOS_GESTAO_IDS } from '../components/PreferenciasNotificacao';
import { useEstado } from '../lib/estado';
import { marcarNotificacaoLida } from '../lib/acoes';
import type { Notificacao } from '../lib/tipos';
import { dataLonga, hora } from '../lib/formato';
import { textoNotificacao } from '../lib/notificacoes';

type Filtro = 'todas' | 'nao_lidas' | 'gestao' | 'equipe';

export function Notificacoes() {
  const { db, cliente, executar } = useEstado();
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const naoLidas = db.notificacoes.filter((n) => !n.lida_em).length;
  const notificacoesFiltradas = useMemo(() => db.notificacoes.filter((notificacao) => {
    if (filtro === 'nao_lidas') return !notificacao.lida_em;
    if (filtro === 'gestao') return TIPOS_GESTAO_IDS.has(notificacao.tipo);
    if (filtro === 'equipe') return !TIPOS_GESTAO_IDS.has(notificacao.tipo);
    return true;
  }).sort((a, b) => new Date(b.agendada_para).getTime() - new Date(a.agendada_para).getTime()), [db.notificacoes, filtro]);
  const grupos = useMemo(() => {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const porData = new Map<string, { titulo: string; itens: Notificacao[] }>();
    notificacoesFiltradas.forEach((notificacao) => {
      const data = new Date(notificacao.agendada_para);
      const chave = data.toLocaleDateString('pt-BR');
      const titulo = data.toDateString() === hoje.toDateString() ? 'Hoje'
        : data.toDateString() === ontem.toDateString() ? 'Ontem' : dataLonga(notificacao.agendada_para, false).split(',')[0];
      if (!porData.has(chave)) porData.set(chave, { titulo, itens: [] });
      porData.get(chave)!.itens.push(notificacao);
    });
    return [...porData.values()];
  }, [notificacoesFiltradas]);

  async function marcarTodasComoLidas() {
    await executar(() => Promise.all(db.notificacoes.filter((n) => !n.lida_em).map((n) => marcarNotificacaoLida(cliente, n.id))), 'Notificações marcadas como lidas.');
  }

  async function marcarUmaComoLida(id: string) {
    await executar(() => marcarNotificacaoLida(cliente, id), 'Notificação marcada como lida.');
  }

  return (
    <Layout>
      <div className="lista-topo notificacoes-cabecalho">
        <div><h1>Notificações</h1><p>{naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia'} · Acompanhe avisos e pendências da operação.</p></div>
        {naoLidas > 0 && <button type="button" className="botao" onClick={() => void marcarTodasComoLidas()}>Marcar tudo como lido</button>}
      </div>
      <div className="notificacoes-filtros" role="tablist" aria-label="Filtrar notificações">
        {([['todas', 'Todas', db.notificacoes.length], ['nao_lidas', 'Não lidas', naoLidas], ['gestao', 'Gestão', db.notificacoes.filter((n) => TIPOS_GESTAO_IDS.has(n.tipo)).length], ['equipe', 'Equipe', db.notificacoes.filter((n) => !TIPOS_GESTAO_IDS.has(n.tipo)).length]] as [Filtro, string, number][]).map(([id, nome, quantidade]) => (
          <button type="button" role="tab" aria-selected={filtro === id} className={filtro === id ? 'ativo' : ''} onClick={() => setFiltro(id)} key={id}>{nome}<small>{quantidade}</small></button>
        ))}
      </div>
      <section className="notificacoes-configuracao-acesso cartao">
        <Icone nome="sino" tamanho={19} />
        <div><strong>Preferências de notificações</strong><span>Altere os avisos e as notificações do dispositivo em Minha conta.</span></div>
        <Link className="botao pequeno" to="/minha-conta#notificacoes">Configurar <Icone nome="direita" tamanho={14} /></Link>
      </section>
      <section className="lista-notificacoes">
        <div className="cartao-topo"><h2>{filtro === 'nao_lidas' ? 'Não lidas' : 'Histórico recente'}</h2><span className="suave">{notificacoesFiltradas.length} aviso(s)</span></div>
        {notificacoesFiltradas.length === 0 && <div className="cartao vazio"><Icone nome="sino" tamanho={28} /><strong>{filtro === 'nao_lidas' ? 'Tudo em dia' : 'Nenhuma notificação encontrada'}</strong><p>{filtro === 'nao_lidas' ? 'Você não tem avisos pendentes.' : 'Os avisos aparecerão aqui quando algo acontecer.'}</p></div>}
        {grupos.map((grupo) => <div className="notificacao-grupo" key={grupo.titulo}>
          <h3>{grupo.titulo}</h3>
          {grupo.itens.map((notificacao) => {
            const evento = notificacao.evento_id ? db.eventos.find((item) => item.id === notificacao.evento_id) : undefined;
            const gestao = TIPOS_GESTAO_IDS.has(notificacao.tipo);
            return <article className={`cartao notificacao-item${notificacao.lida_em ? '' : ' nao-lida'}${gestao ? ' gestao' : ''}`} key={notificacao.id}>
              <span className="notificacao-icone"><Icone nome={gestao ? 'acessos' : 'sino'} /></span>
              <div className="notificacao-conteudo"><strong>{textoNotificacao(notificacao, evento?.titulo ?? '')}</strong><small>{hora(notificacao.agendada_para)} · {gestao ? 'Gestão' : 'Equipe'}</small></div>
              <div className="notificacao-acoes">
                {evento && <Link className="botao" to={`/eventos/${evento.id}`}>Abrir</Link>}
                {!notificacao.lida_em && <button type="button" className="link-botao" onClick={() => void marcarUmaComoLida(notificacao.id)}>Marcar lida</button>}
              </div>
            </article>;
          })}
        </div>)}
      </section>
    </Layout>
  );
}
