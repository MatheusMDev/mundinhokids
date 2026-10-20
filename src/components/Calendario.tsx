import { Link } from 'react-router-dom';
import { Icone } from './Icone';
import { chaveDe, DIAS_CURTOS, hora, mesAno, somarDias } from '../lib/formato';
import type { Evento } from '../lib/tipos';

export interface Mes { ano: number; mes: number }

export const mesSeguinte = ({ ano, mes }: Mes, passo: number): Mes => {
  const total = ano * 12 + (mes - 1) + passo;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
};

/** Dias exibidos no mês: começa no domingo e completa as semanas */
export function diasDoMes({ ano, mes }: Mes): { chave: string; dia: number; doMes: boolean }[] {
  const primeiro = chaveDe(ano, mes, 1);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const totalDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const semanas = Math.ceil((diaSemana + totalDias) / 7);
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const chave = somarDias(primeiro, i - diaSemana);
    const [, m, d] = chave.split('-').map(Number);
    return { chave, dia: d, doMes: m === mes };
  });
}

function TopoMes({ mes, onMudar }: { mes: Mes; onMudar: (m: Mes) => void }) {
  return (
    <>
      <button type="button" className="icone-botao" onClick={() => onMudar(mesSeguinte(mes, -1))} aria-label="Mês anterior">
        <Icone nome="esquerda" />
      </button>
      <h2>{mesAno(mes.ano, mes.mes)}</h2>
      <button type="button" className="icone-botao" onClick={() => onMudar(mesSeguinte(mes, 1))} aria-label="Próximo mês">
        <Icone nome="direita" />
      </button>
    </>
  );
}

interface Props {
  mes: Mes;
  onMudar: (m: Mes) => void;
  hoje: string;
  eventosPorDia: Map<string, Evento[]>;
}

export function CalendarioMes({ mes, onMudar, hoje, eventosPorDia }: Props) {
  return (
    <section className="cartao" aria-label="Calendário de eventos">
      <div className="cal-topo">
        <TopoMes mes={mes} onMudar={onMudar} />
        <div className="legenda">
          <span><i style={{ background: 'var(--marca)' }} /> Confirmado</span>
          <span><i style={{ background: 'var(--laranja)' }} /> Agendado</span>
          <span><i style={{ background: 'var(--texto-fraco)' }} /> Realizado</span>
        </div>
      </div>
      <div className="cal-grade">
        {DIAS_CURTOS.map((d) => <div key={d} className="cal-semana">{d}</div>)}
        {diasDoMes(mes).map(({ chave, dia, doMes }) => (
          <div key={chave} className={`cal-dia${doMes ? '' : ' fora'}${chave === hoje ? ' hoje' : ''}`}>
            <span className="cal-num">{dia}</span>
            {doMes && (eventosPorDia.get(chave) ?? []).map((e) => (
              <Link key={e.id} to={`/eventos/${e.id}`} className={`chip ${e.situacao}`} title={`${hora(e.inicio)} · ${e.titulo}`}>
                {hora(e.inicio)} · {e.titulo}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

interface PropsMini extends Props {
  selecionado: string;
  onSelecionar: (chave: string) => void;
}

export function MiniCalendario({ mes, onMudar, hoje, eventosPorDia, selecionado, onSelecionar }: PropsMini) {
  return (
    <section className="cartao mini-cal" aria-label="Calendário">
      <div className="cal-topo"><TopoMes mes={mes} onMudar={onMudar} /></div>
      <div className="mini-grade">
        {DIAS_CURTOS.map((d) => <div key={d} className="cal-semana">{d.charAt(0).toUpperCase()}</div>)}
        {diasDoMes(mes).map(({ chave, dia, doMes }) => {
          const eventos = doMes ? eventosPorDia.get(chave) ?? [] : [];
          const classes = ['dia-mini', doMes ? '' : 'fora', chave === hoje ? 'hoje' : '', chave === selecionado ? 'selecionado' : '']
            .filter(Boolean).join(' ');
          return (
            <button
              key={chave} type="button" className={classes} onClick={() => onSelecionar(chave)}
              aria-pressed={chave === selecionado}
              aria-label={`${dia}${eventos.length ? `, ${eventos.length} evento${eventos.length > 1 ? 's' : ''}` : ''}`}
            >
              {dia}
              {eventos.length > 0 && (
                <span className="pontos">{eventos.slice(0, 3).map((e) => <i key={e.id} className={e.situacao} />)}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
