import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CalendarioAgenda } from '../components/CalendarioAgenda';
import { useEstado } from '../lib/estado';
import { dataLonga, hora, somarDias, chaveDia } from '../lib/formato';
import {
  conferenciasPendentes, equipeDoEvento, eventosOrdenados, situacaoFantasiaNoEvento, type MembroEquipe,
} from '../lib/consultas';
import type { BaseDados, Evento } from '../lib/tipos';

/** Quantos dias à frente a lista de próximas festas mostra */
const DIAS_A_FRENTE = 14;

const fantasiasDoEvento = (db: BaseDados, e: Evento) => equipeDoEvento(db, e.id).filter((m) => m.fantasia);

function LinhaFantasia({ db, evento, membro }: { db: BaseDados; evento: Evento; membro: MembroEquipe }) {
  const f = membro.fantasia!;
  const situacao = situacaoFantasiaNoEvento(db, f, evento);
  return (
    <li className="fantasia-da-festa">
      <span>
        <strong>{f.identificacao}{f.tamanho ? ` · ${f.tamanho}` : ''}</strong>
        <small>{membro.profissional?.nome ?? 'Artista a definir'}</small>
      </span>
      <span className={`selo ${situacao.tom}`} title={situacao.detalhe ?? undefined}>{situacao.texto}</span>
    </li>
  );
}

/**
 * Painel de quem cuida das fantasias: calendário das festas com fantasia,
 * o que falta conferir depois das festas e o que precisa estar limpo antes.
 */
export function PainelFantasias() {
  const { db, hoje, usuario } = useEstado();
  const primeiroNome = usuario.nome.trim().split(/\s+/)[0] || usuario.nome;

  const comFantasia = useMemo(
    () => eventosOrdenados(db).filter((e) => e.situacao !== 'cancelado' && fantasiasDoEvento(db, e).length > 0),
    [db],
  );
  const aConferir = useMemo(() => conferenciasPendentes(db, hoje), [db, hoje]);
  const proximas = useMemo(() => {
    const inicio = chaveDia(hoje);
    const fim = somarDias(inicio, DIAS_A_FRENTE - 1);
    return comFantasia.filter((e) => new Date(e.fim) > new Date(hoje) && chaveDia(e.inicio) <= fim
      && (e.situacao === 'agendado' || e.situacao === 'confirmado'));
  }, [comFantasia, hoje]);
  const emCuidado = db.fantasias.filter((f) => f.situacao === 'limpeza' || f.situacao === 'manutencao');
  // Fantasias de festas próximas que ainda não estão prontas (limpeza, manutenção ou em uso antes)
  const alertas = proximas.reduce((total, e) =>
    total + fantasiasDoEvento(db, e).filter((m) => situacaoFantasiaNoEvento(db, m.fantasia!, e).tom === 'alerta').length, 0);

  return (
    <Layout>
      <div className="cabecalho">
        <div>
          <div className="data">{dataLonga(hoje, false)}</div>
          <h1>Olá, {primeiroNome}!</h1>
          <p className="suave">O que conferir depois das festas e o que precisa estar pronto antes.</p>
        </div>
        <Link to="/fantasias" className="botao so-desktop">Ver todas as fantasias</Link>
      </div>

      <div className="numeros numeros-fantasias">
        <div className="cartao numero">
          <span>Para conferir</span>
          <strong className={aConferir.length ? 'laranja' : undefined}>{aConferir.length}</strong>
          <small>{aConferir.length === 1 ? 'festa já terminou' : 'festas já terminaram'}</small>
        </div>
        <div className="cartao numero">
          <span>Precisam ficar prontas</span>
          <strong className={alertas ? 'laranja' : undefined}>{alertas}</strong>
          <small>fantasias das próximas festas</small>
        </div>
        <div className="cartao numero">
          <span>Em limpeza ou manutenção</span>
          <strong>{emCuidado.length}</strong>
          <small>{emCuidado.length === 1 ? 'fantasia agora' : 'fantasias agora'}</small>
        </div>
      </div>

      <div className="painel">
        <CalendarioAgenda
          eventos={comFantasia} hoje={hoje}
          detalhe={(e) => {
            const n = fantasiasDoEvento(db, e).length;
            return `${n} ${n === 1 ? 'fantasia' : 'fantasias'} · ${hora(e.inicio)} às ${hora(e.fim)}`;
          }}
        />
        <div className="coluna">
          <section className="cartao">
            <h2>Conferir depois da festa</h2>
            {aConferir.length ? (
              <div className="pendencias">
                {aConferir.map(({ evento, faltam }) => (
                  <Link key={evento.id} to={`/eventos/${evento.id}`} state={{ voltarPara: '/' }} className="pendencia conferencia">
                    <span className="rotulo">Conferir fantasias</span>
                    <strong>{evento.titulo}</strong>
                    <p>{faltam === 1 ? '1 fantasia sem conferência' : `${faltam} fantasias sem conferência`} · terminou {dataLonga(evento.fim, false).toLowerCase()}, {hora(evento.fim)}</p>
                  </Link>
                ))}
              </div>
            ) : <div className="vazio">Nenhuma conferência pendente.</div>}
          </section>

          <section className="cartao">
            <h2>Próximas festas</h2>
            {proximas.length ? proximas.map((e) => (
              <article key={e.id} className="festa-fantasias">
                <Link to={`/eventos/${e.id}`} state={{ voltarPara: '/' }}>
                  <strong>{e.titulo}</strong>
                  <small>{dataLonga(e.inicio, false)} · {hora(e.inicio)}</small>
                </Link>
                <ul>
                  {fantasiasDoEvento(db, e).map((m) => <LinhaFantasia key={m.escala.id} db={db} evento={e} membro={m} />)}
                </ul>
              </article>
            )) : <div className="vazio">Nenhuma festa com fantasia nos próximos {DIAS_A_FRENTE} dias.</div>}
          </section>
        </div>
      </div>
    </Layout>
  );
}
