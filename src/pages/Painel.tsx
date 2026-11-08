import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout, useCelular } from '../components/Layout';
import { CalendarioMes, MiniCalendario, type Mes } from '../components/Calendario';
import { Icone } from '../components/Icone';
import { FormEvento } from '../components/FormulariosEvento';
import { TrocasParaMim } from '../components/Trocas';
import { useEstado } from '../lib/estado';
import { chaveDia, dataLonga, dataLongaDaChave, diaCurto, hora, partes } from '../lib/formato';
import {
  eventosDoDia, eventosOrdenados, localDe, numerosDaSemana, pendenciasDaSemana, proximosEventos,
  ROTULO_SITUACAO, veValores, type Pendencia,
} from '../lib/consultas';
import type { Evento } from '../lib/tipos';

export function ListaPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  if (!pendencias.length) return <div className="vazio">Nenhuma pendência nesta semana.</div>;
  return (
    <div className="pendencias">
      {pendencias.map((p, i) => (
        <Link key={`${p.tipo}-${p.eventoId}-${i}`} to={`/eventos/${p.eventoId}`} className={`pendencia ${p.tipo}`}>
          <span className="rotulo">{p.rotulo}</span>
          <strong>{p.titulo}</strong>
          <p>{p.texto}</p>
        </Link>
      ))}
    </div>
  );
}

export function LinhaEvento({ evento, voltarPara }: { evento: Evento; voltarPara?: string }) {
  const { db } = useEstado();
  return (
    <Link to={`/eventos/${evento.id}`} state={voltarPara ? { voltarPara } : undefined} className="evento-linha">
      <span className={`evento-hora ${evento.situacao}`}>{hora(evento.inicio)}</span>
      <span>
        <strong>{evento.titulo}</strong>
        <small>{localDe(db, evento)?.nome}</small>
        <span className={`selo ${evento.situacao}`}>{ROTULO_SITUACAO[evento.situacao]}</span>
      </span>
    </Link>
  );
}

export function Painel() {
  const { db, hoje, perfil, permissoes, papeis, usuario } = useEstado();
  // Equipe (artista, produção, maquiagem) vê a própria agenda; pendências só para operação e produção
  const daEquipe = !permissoes.operacao;
  const vePendencias = permissoes.operacao || papeis.has('produtor');
  const [novoEvento, setNovoEvento] = useState(false);
  const celular = useCelular();
  const p = partes(hoje);
  const [mes, setMes] = useState<Mes>({ ano: p.ano, mes: p.mes });
  const [selecionado, setSelecionado] = useState(chaveDia(hoje));

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const e of eventosOrdenados(db)) {
      if (e.situacao === 'cancelado') continue;
      const chave = chaveDia(e.inicio);
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    }
    return mapa;
  }, [db]);

  const pendencias = useMemo(() => pendenciasDaSemana(db, hoje, permissoes.conferirFantasias), [db, hoje, permissoes.conferirFantasias]);
  const numeros = useMemo(() => numerosDaSemana(db, hoje, permissoes.conferirFantasias), [db, hoje, permissoes.conferirFantasias]);
  const proximos = proximosEventos(db, hoje, 14).slice(0, 5);
  const dataHoje = dataLonga(hoje, false);
  const primeiroNome = usuario.nome.trim().split(/\s+/)[0] || usuario.nome;
  const mensagemInicial = daEquipe
    ? `Olá, ${primeiroNome}! Aqui estão seus próximos compromissos.`
    : `Olá, ${primeiroNome}! Vamos deixar a semana do Mundinho em ordem.`;

  if (celular) {
    const doDia = eventosDoDia(db, selecionado);
    return (
      <Layout>
        <div className="cabecalho">
          <div>
            <div className="data">{dataHoje}</div>
            <h1>{mensagemInicial}</h1>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}><TrocasParaMim /></div>
        <MiniCalendario
          mes={mes} onMudar={setMes} hoje={chaveDia(hoje)} eventosPorDia={eventosPorDia}
          selecionado={selecionado} onSelecionar={setSelecionado}
        />
        <h2 className="secao-titulo">{dataLongaDaChave(selecionado)}</h2>
        {doDia.length ? doDia.map((e) => <LinhaEvento key={e.id} evento={e} />) : <div className="vazio">Nenhum evento neste dia.</div>}
        {vePendencias && (
          <>
            <h2 className="secao-titulo">Pendências da semana</h2>
            <ListaPendencias pendencias={pendencias} />
          </>
        )}
        {permissoes.operacao && (
          <button type="button" className="botao primario" style={{ width: '100%', marginTop: 18 }} onClick={() => setNovoEvento(true)}>
            <Icone nome="mais" /> Novo evento
          </button>
        )}
        {novoEvento && <FormEvento onFechar={() => setNovoEvento(false)} />}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cabecalho">
        <div>
          <div className="data">{dataHoje}</div>
          <h1>{mensagemInicial}</h1>
        </div>
        {permissoes.operacao && (
          <button type="button" className="botao primario" onClick={() => setNovoEvento(true)}>
            <Icone nome="mais" /> Novo evento
          </button>
        )}
      </div>

      {!daEquipe && <div className="numeros">
        <div className="cartao numero">
          <span>Eventos nesta semana</span>
          <strong>{numeros.eventosSemana}</strong>
          <small>{numeros.eventosSabado ? `${numeros.eventosSabado} só no sábado` : 'nenhum no sábado'}</small>
        </div>
        <div className="cartao numero">
          <span>Pendências</span>
          <strong className="laranja">{numeros.pendencias}</strong>
          <small>{numeros.tiposPendencia || 'tudo em dia'}</small>
        </div>
        <div className="cartao numero">
          <span>Trocas para aprovar</span>
          <strong className="marca">{numeros.trocas}</strong>
          <small>{numeros.trocaDescricao}</small>
        </div>
        {veValores(perfil) ? (
          <div className="cartao numero">
            <span>Pagamentos pendentes</span>
            <strong>{numeros.profissionaisAPagar}</strong>
            <small>profissionais a pagar</small>
          </div>
        ) : (
          <div className="cartao numero oculto">
            <span>Pagamentos pendentes</span>
            <p>Valores ocultos para este perfil.</p>
          </div>
        )}
      </div>}

      <div className="painel">
        <CalendarioMes mes={mes} onMudar={setMes} hoje={chaveDia(hoje)} eventosPorDia={eventosPorDia} />
        <div className="coluna">
          <TrocasParaMim />
          {vePendencias && (
            <section className="cartao">
              <h2>Pendências da semana</h2>
              <ListaPendencias pendencias={pendencias} />
            </section>
          )}
          <section className="cartao">
            <h2>{daEquipe ? 'Seus próximos eventos' : 'Próximos eventos'}</h2>
            <div className="proximos">
              {proximos.map((e) => (
                <Link key={e.id} to={`/eventos/${e.id}`}>
                  {e.titulo} <small>{diaCurto(e.inicio)} · {hora(e.inicio)}</small>
                </Link>
              ))}
              {!proximos.length && <div className="vazio">Nenhum evento nos próximos 14 dias.</div>}
            </div>
          </section>
        </div>
      </div>
      {novoEvento && <FormEvento onFechar={() => setNovoEvento(false)} />}
    </Layout>
  );
}
