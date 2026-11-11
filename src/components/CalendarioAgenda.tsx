import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarioMes, MiniCalendario, type Mes } from './Calendario';
import { useCelular } from './Layout';
import { chaveDia, dataLongaDaChave, hora, partes } from '../lib/formato';
import { ROTULO_SITUACAO } from '../lib/consultas';
import type { Evento } from '../lib/tipos';

interface Props {
  /** Eventos que aparecem no calendário (cancelados são ignorados) */
  eventos: Evento[];
  hoje: string;
  /** Linha extra embaixo do título no celular (ex.: função, fantasias do evento) */
  detalhe?: (evento: Evento) => ReactNode;
  /** Para onde o "Voltar" do evento leva */
  voltarPara?: string;
}

/**
 * Calendário de um conjunto de eventos: mês inteiro no computador; no celular,
 * mini calendário e a lista do dia escolhido.
 */
export function CalendarioAgenda({ eventos, hoje, detalhe, voltarPara = '/' }: Props) {
  const celular = useCelular();
  // Abre no dia de hoje se tiver evento; senão, no dia do próximo evento
  const [inicial] = useState(() => {
    const hojeChave = chaveDia(hoje);
    const futuros = eventos.filter((e) => e.situacao !== 'cancelado').map((e) => chaveDia(e.inicio))
      .filter((chave) => chave >= hojeChave).sort();
    return futuros[0] ?? hojeChave;
  });
  const p = partes(inicial);
  const [mes, setMes] = useState<Mes>({ ano: p.ano, mes: p.mes });
  const [selecionado, setSelecionado] = useState(inicial);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const e of [...eventos].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
      if (e.situacao === 'cancelado') continue;
      const chave = chaveDia(e.inicio);
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    }
    return mapa;
  }, [eventos]);

  if (!celular) return <CalendarioMes mes={mes} onMudar={setMes} hoje={chaveDia(hoje)} eventosPorDia={eventosPorDia} />;

  const doDia = eventosPorDia.get(selecionado) ?? [];
  return (
    <div className="calendario-agenda">
      <MiniCalendario
        mes={mes} onMudar={setMes} hoje={chaveDia(hoje)} eventosPorDia={eventosPorDia}
        selecionado={selecionado} onSelecionar={setSelecionado}
      />
      <h2 className="secao-titulo">{dataLongaDaChave(selecionado)}</h2>
      {doDia.length ? doDia.map((e) => (
        <Link key={e.id} to={`/eventos/${e.id}`} state={{ voltarPara }} className="evento-linha">
          <span className={`evento-hora ${e.situacao}`}>{hora(e.inicio)}</span>
          <span>
            <strong>{e.titulo}</strong>
            {detalhe && <small>{detalhe(e)}</small>}
            <span className={`selo ${e.situacao}`}>{ROTULO_SITUACAO[e.situacao]}</span>
          </span>
        </Link>
      )) : <div className="vazio">Nenhum evento neste dia.</div>}
    </div>
  );
}
