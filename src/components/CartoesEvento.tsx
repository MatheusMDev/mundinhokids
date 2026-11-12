// Cartões do detalhe do evento com ações próprias: transporte, financeiro,
// despesas e o valor de cada profissional. Cada um mostra só o que o perfil pode ver
// e só oferece o que o banco vai aceitar.

import { useState } from 'react';
import { Icone } from './Icone';
import {
  FormCancelarReserva, FormDespesa, FormDevolucao, FormPagamentos, FormRecebimento, FormReserva,
} from './FormulariosValores';
import { producaoDoEvento, useEstado } from '../lib/estado';
import { decidirDespesa } from '../lib/acoes';
import { dataCurta, hora, moeda, quando } from '../lib/formato';
import { equipeDoEvento, financeiroDoEvento, transporteDoEvento } from '../lib/consultas';
import type { Despesa, Evento, Recebimento } from '../lib/tipos';

const ativo = (e: Evento) => e.situacao === 'agendado' || e.situacao === 'confirmado';

/** O login é de alguém escalado neste evento? */
function useEscalado(evento: Evento) {
  const { db, usuario } = useEstado();
  if (!usuario.profissionalId) return { escalado: false };
  const minhas = equipeDoEvento(db, evento.id).filter((m) => m.escala.profissional_id === usuario.profissionalId);
  return { escalado: minhas.length > 0 };
}

/**
 * Quem pode reservar o veículo de um evento, só com ele agendado ou confirmado:
 * gestão e assistente, ou quem tem a função Produção e está escalado no evento
 * (em qualquer função, ex.: artista que também é produtor). É a mesma regra do
 * banco (política res_criar).
 */
function usePodeReservar(evento: Evento) {
  const { db, usuario, permissoes, papeis } = useEstado();
  return ativo(evento) && producaoDoEvento(db, evento.id, usuario.profissionalId, permissoes, papeis);
}

/**
 * Reserva do veículo direto no card do evento (lista de Eventos e Minha agenda):
 * mostra a reserva feita ou o botão "Reservar veículo". Não aparece para quem não pode reservar.
 */
export function ReservaNoCard({ evento }: { evento: Evento }) {
  const { db } = useEstado();
  const podeReservar = usePodeReservar(evento);
  const [aberto, setAberto] = useState(false);
  const transporte = transporteDoEvento(db, evento);
  const reserva = transporte.reserva;
  if (!podeReservar || (!reserva && !db.veiculos.some((v) => v.ativo))) return null;

  return (
    <div className="reserva-no-card">
      {reserva ? (
        <span className="reserva-no-card-feita">
          <Icone nome="carro" tamanho={15} />
          {transporte.veiculoNome} · {hora(reserva.retirada)} às {hora(reserva.devolucao_prevista)}
        </span>
      ) : (
        <>
          <span className="suave">Sem veículo reservado</span>
          <button type="button" className="botao pequeno" onClick={() => setAberto(true)}>
            <Icone nome="carro" tamanho={15} /> Reservar veículo
          </button>
        </>
      )}
      {aberto && <FormReserva evento={evento} onFechar={() => setAberto(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------

export function CartaoTransporte({ evento }: { evento: Evento }) {
  const { db, permissoes, usuario } = useEstado();
  const [janela, setJanela] = useState<'reservar' | 'alterar' | 'cancelar' | 'devolver' | null>(null);
  const transporte = transporteDoEvento(db, evento);
  const reserva = transporte.reserva;

  const podeReservar = usePodeReservar(evento);
  const temProdutor = equipeDoEvento(db, evento.id).some((m) => m.escala.funcao === 'produtor');
  const podeMexer = !!reserva && (permissoes.operacao || reserva.responsavel_id === usuario.profissionalId);

  return (
    <section className="cartao cartao-transporte">
      <div className="cartao-topo">
        <h2>Transporte</h2>
        {!reserva && podeReservar && db.veiculos.some((v) => v.ativo) && (
          <button type="button" className="botao pequeno" onClick={() => setJanela('reservar')}>
            <Icone nome="carro" tamanho={15} /> Reservar
          </button>
        )}
      </div>
      {reserva ? (
        <>
          <strong>{transporte.veiculoNome} · reservada por {transporte.responsavel?.nome}</strong>
          <p className="suave" style={{ margin: '4px 0 0' }}>
            Retirada {hora(reserva.retirada)} · devolução prevista {hora(reserva.devolucao_prevista)}
          </p>
          {reserva.devolvido_em && <p className="ok-texto" style={{ margin: '4px 0 0' }}>Devolvido às {hora(reserva.devolvido_em)}</p>}
          {reserva.observacoes && <p className="suave" style={{ margin: '4px 0 0' }}>{reserva.observacoes}</p>}
        </>
      ) : (
        <div className="vazio">
          {podeReservar ? 'Sem reserva de veículo.'
            : temProdutor ? 'Sem reserva de veículo. O produtor do evento faz a reserva.'
              : 'Sem reserva de veículo. Este evento ainda não tem produtor: a gestão faz a reserva.'}
        </div>
      )}
      {transporte.bloqueioAnterior && (
        <div className="trava">
          <Icone nome="cadeado" tamanho={15} />
          <span>
            <strong>Bloqueado das {hora(transporte.bloqueioAnterior.reserva.retirada)} às {hora(transporte.bloqueioAnterior.reserva.devolucao_prevista)}</strong>
            {transporte.bloqueioAnterior.evento && ` pela ${transporte.bloqueioAnterior.evento.titulo}`}.
            {' '}O sistema só liberou a retirada depois da devolução.
          </span>
        </div>
      )}
      {reserva && podeMexer && (
        <div className="acoes-linha">
          {!reserva.devolvido_em && <button type="button" className="botao pequeno" onClick={() => setJanela('devolver')}>Registrar devolução</button>}
          {ativo(evento) && <button type="button" className="botao pequeno" onClick={() => setJanela('alterar')}>Alterar</button>}
          {ativo(evento) && <button type="button" className="botao pequeno texto-perigo" onClick={() => setJanela('cancelar')}>Cancelar reserva</button>}
        </div>
      )}

      {janela === 'reservar' && <FormReserva evento={evento} onFechar={() => setJanela(null)} />}
      {janela === 'alterar' && reserva && <FormReserva evento={evento} reserva={reserva} onFechar={() => setJanela(null)} />}
      {janela === 'cancelar' && reserva && <FormCancelarReserva reserva={reserva} onFechar={() => setJanela(null)} />}
      {janela === 'devolver' && reserva && <FormDevolucao reserva={reserva} onFechar={() => setJanela(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------------

export function CartaoFinanceiro({ evento }: { evento: Evento }) {
  const { db } = useEstado();
  const [janela, setJanela] = useState<{ tipo: 'recebimento'; item?: Recebimento } | { tipo: 'pagamentos' } | null>(null);
  const f = financeiroDoEvento(db, evento.id);
  const recebimentos = db.recebimentos.filter((r) => r.evento_id === evento.id).sort((a, b) => a.recebido_em.localeCompare(b.recebido_em));
  const falta = f.contratado - f.recebido;
  const custoEquipe = f.pagamentos.reduce((s, p) => s + p.valor_combinado, 0);
  const cancelado = evento.situacao === 'cancelado';

  return (
    <section className="cartao">
      <div className="cartao-topo"><h2>Financeiro</h2></div>
      <div className="valores">
        <div><span>Valor contratado</span><strong>{moeda(f.contratado)}</strong>{f.contratado === 0 && <small>Defina em “Editar evento”</small>}</div>
        <div>
          <span>Recebido</span><strong>{moeda(f.recebido)}</strong>
          {f.situacao === 'parcial' && <small>Parcial · falta {moeda(falta)}</small>}
          {f.situacao === 'pendente' && f.contratado > 0 && <small>Pendente</small>}
        </div>
      </div>

      <div className="bloco">
        <div className="cartao-topo" style={{ marginBottom: 6 }}>
          <span className="rotulo">Recebimentos</span>
          <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'recebimento' })}>
            <Icone nome="mais" tamanho={14} /> Registrar
          </button>
        </div>
        {recebimentos.length ? (
          <div className="linhas">
            {recebimentos.map((r) => (
              <div key={r.id}>
                <button type="button" className="link-botao normal" onClick={() => setJanela({ tipo: 'recebimento', item: r })}>
                  {dataCurta(r.recebido_em)}{r.forma ? ` · ${r.forma}` : ''}{r.observacoes ? ` · ${r.observacoes}` : ''}
                </button>
                <span>{moeda(r.valor)}</span>
              </div>
            ))}
          </div>
        ) : <p className="suave" style={{ margin: 0 }}>Nenhum recebimento registrado.</p>}
      </div>

      <div className="bloco">
        <div className="cartao-topo" style={{ marginBottom: 6 }}>
          <span className="rotulo">Pagamento da equipe</span>
          {!cancelado && <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'pagamentos' })}>Valores</button>}
        </div>
        {f.pagamentos.length ? (
          <div className="linhas">
            {f.pagamentos.map((p) => (
              <div key={p.id}>
                <span>{p.profissional?.nome}</span>
                <span>{moeda(p.valor_combinado)} · <span className={p.situacao}>{p.situacao === 'pago' && p.pago_em ? `pago ${dataCurta(p.pago_em)}` : p.situacao}</span></span>
              </div>
            ))}
            <div className="suave"><span>Total da equipe</span><span>{moeda(custoEquipe)}</span></div>
          </div>
        ) : <p className="suave" style={{ margin: 0 }}>Nenhum valor combinado ainda.</p>}
      </div>

      {f.contratado > 0 && (
        <div className="bloco">
          <div className="linhas">
            <div><span>Contratado − equipe − despesas</span><strong>{moeda(f.contratado - custoEquipe - f.despesas)}</strong></div>
          </div>
        </div>
      )}

      {janela?.tipo === 'recebimento' && <FormRecebimento evento={evento} item={janela.item} onFechar={() => setJanela(null)} />}
      {janela?.tipo === 'pagamentos' && <FormPagamentos evento={evento} onFechar={() => setJanela(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------------

const ROTULO_APROVACAO: Record<Despesa['aprovacao'], string> = {
  nao_requer: '', pendente: 'aguardando aprovação', aprovada: 'aprovada', recusada: 'recusada',
};

export function CartaoDespesas({ evento }: { evento: Evento }) {
  const { db, permissoes, papeis, cliente, executar, avisar, hoje } = useEstado();
  const { escalado } = useEscalado(evento);
  const [janela, setJanela] = useState<{ item?: Despesa } | null>(null);
  // O banco já filtra: a gestão recebe todas, os demais só as que lançaram
  const despesas = db.despesas.filter((d) => d.evento_id === evento.id).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  // Lança: gestão, ou quem tem a função Produção e está escalado (regra desp_criar do banco)
  const podeLancar = evento.situacao !== 'cancelado' && (permissoes.gestao || (escalado && papeis.has('produtor')));

  if (!podeLancar && despesas.length === 0) return null;

  async function decidir(id: string, aprova: boolean) {
    const resultado = await executar(() => decidirDespesa(cliente, id, aprova), aprova ? 'Despesa aprovada.' : 'Despesa recusada.');
    if (resultado !== true) avisar(resultado);
  }

  return (
    <section className="cartao">
      <div className="cartao-topo">
        <h2>Despesas</h2>
        {podeLancar && (
          <button type="button" className="botao pequeno" onClick={() => setJanela({})}>
            <Icone nome="mais" tamanho={14} /> Lançar
          </button>
        )}
      </div>
      {!permissoes.gestao && <p className="suave" style={{ margin: '0 0 8px', fontSize: 12.5 }}>Você vê as despesas que lançou.</p>}
      {despesas.length ? (
        <ul className="lista-despesas">
          {despesas.map((d) => (
            <li key={d.id}>
              <div>
                {permissoes.gestao
                  ? <button type="button" className="link-botao normal" onClick={() => setJanela({ item: d })}>{d.descricao}</button>
                  : <span>{d.descricao}</span>}
                <small>
                  {d.tipo === 'insumo' ? 'Insumo' : 'Gasto extra'}
                  {d.responsavel_id && ` · ${db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? ''}`}
                  {` · ${quando(d.criado_em, hoje)}`}
                  {d.comprovante && ` · comprovante: ${d.comprovante}`}
                </small>
                {d.aprovacao !== 'nao_requer' && <span className={`selo ${d.aprovacao === 'aprovada' ? 'ok' : d.aprovacao === 'recusada' ? 'neutro' : 'alerta'}`}>{ROTULO_APROVACAO[d.aprovacao]}</span>}
              </div>
              <div className="valor-despesa">
                <strong>{moeda(d.valor)}</strong>
                {permissoes.gestao && d.aprovacao === 'pendente' && (
                  <span className="acoes-linha" style={{ marginTop: 6 }}>
                    <button type="button" className="botao pequeno" onClick={() => void decidir(d.id, false)}>Recusar</button>
                    <button type="button" className="botao pequeno primario" onClick={() => void decidir(d.id, true)}>Aprovar</button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="suave" style={{ margin: 0 }}>Nenhuma despesa lançada.</p>}

      {janela && <FormDespesa evento={evento} item={janela.item} onFechar={() => setJanela(null)} />}
    </section>
  );
}

// ---------------------------------------------------------------------

/** Para quem não é da gestão: o próprio valor neste evento (o banco só envia o dele) */
export function CartaoMeuValor({ evento }: { evento: Evento }) {
  const { db, usuario } = useEstado();
  const meu = db.pagamentos_profissionais.find((p) => p.evento_id === evento.id
    && p.profissional_id === usuario.profissionalId && !p.cancelado_em);
  if (!usuario.profissionalId) return null;
  return (
    <section className="cartao">
      <h2>Seu valor neste evento</h2>
      {meu ? (
        <div className="valores">
          <div><span>Combinado</span><strong>{moeda(meu.valor_combinado)}</strong></div>
          <div><span>Situação</span><strong className={meu.situacao === 'pago' ? 'ok-texto' : ''}>{meu.situacao === 'pago' ? 'Pago' : 'A receber'}</strong>{meu.pago_em && <small>em {dataCurta(meu.pago_em)}</small>}</div>
        </div>
      ) : <p className="suave" style={{ margin: 0 }}>O valor ainda não foi registrado pela gestão.</p>}
    </section>
  );
}
