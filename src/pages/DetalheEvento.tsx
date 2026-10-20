import { Link, useParams } from 'react-router-dom';
import { Layout, SeletorPerfil } from '../components/Layout';
import { Icone } from '../components/Icone';
import { useEstado } from '../lib/estado';
import { dataLonga, hora, iniciais, moeda, quando } from '../lib/formato';
import {
  aprovaTrocas, avisosDoEvento, conferenciaDoEvento, contratanteDe, descricaoMaquiagem, equipeDoEvento, eventoPorId,
  financeiroDoEvento, historicoDoEvento, localDe, primeiroNome, ROTULO_FUNCAO, ROTULO_SITUACAO, situacaoFantasiaNoEvento,
  transporteDoEvento, trocasPendentes, veValores, type MembroEquipe,
} from '../lib/consultas';
import type { Evento } from '../lib/tipos';

export const tituloEvento = (e: Evento) => (e.idade ? `${e.titulo} · ${e.idade} anos` : e.titulo);

function situacaoMembro(m: MembroEquipe) {
  if (m.troca) return <span className="selo alerta">{m.troca.situacao === 'aguardando_aceite' ? 'Troca pedida' : 'Troca solicitada'}</span>;
  return <span className="selo ok">Confirmada</span>;
}

function personagemDoMembro(db: ReturnType<typeof useEstado>['db'], evento: Evento, m: MembroEquipe) {
  if (m.escala.funcao === 'maquiador') return descricaoMaquiagem(db, evento, m);
  return m.personagem?.nome ?? '—';
}

export function DetalheEvento() {
  const { id = '' } = useParams();
  const { db, hoje, perfil, decidirTroca, avisar } = useEstado();
  const evento = eventoPorId(db, id);

  if (!evento) {
    return (
      <Layout tituloMobile="Evento">
        <Link to="/" className="voltar"><Icone nome="esquerda" /> Voltar ao calendário</Link>
        <div className="vazio">Evento não encontrado.</div>
      </Layout>
    );
  }

  const local = localDe(db, evento);
  const contratante = contratanteDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const trocas = trocasPendentes(db, evento.id);
  const transporte = transporteDoEvento(db, evento);
  const avisos = avisosDoEvento(db, evento.id);
  const conferencia = conferenciaDoEvento(db, evento.id);
  const historico = historicoDoEvento(db, evento.id, perfil);
  const orientacoes = (evento.orientacoes ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fantasias = equipe.flatMap((m) => (m.fantasia ? [m.fantasia] : []));
  const linkFeedback = db.configuracoes.link_formulario_produtor;
  const horario = `${hora(evento.inicio)} às ${hora(evento.fim)}`;

  return (
    <Layout tituloMobile="Detalhe do evento" comBarra>
      <Link to="/" className="voltar"><Icone nome="esquerda" /> Voltar ao calendário</Link>

      <div className="detalhe-topo">
        <div>
          <div className="selos">
            <span className={`selo ${evento.situacao}`}>{ROTULO_SITUACAO[evento.situacao]}</span>
            {trocas.length > 0 && (
              <span className="selo alerta">
                {trocas.length === 1 ? '1 troca aguardando aprovação' : `${trocas.length} trocas aguardando aprovação`}
              </span>
            )}
          </div>
          <h1>{tituloEvento(evento)}</h1>
          <p className="so-desktop">{dataLonga(evento.inicio)} · {horario} · {local?.nome}</p>
          <ul className="meta so-mobile">
            <li><Icone nome="calendario" tamanho={15} /> {dataLonga(evento.inicio, false)} · {horario}</li>
            <li>
              <Icone nome="local" tamanho={15} /> {local?.nome}
              {local?.link_localizacao && <> · <a className="link-marca" href={local.link_localizacao} target="_blank" rel="noreferrer">Abrir no mapa</a></>}
            </li>
            {contratante && <li><Icone nome="usuario" tamanho={15} /> {contratante.nome} · {contratante.telefone}</li>}
          </ul>
        </div>
        <div className="acoes">
          <Link to={`/eventos/${evento.id}/pdf`} className="botao"><Icone nome="arquivo" /> Gerar PDF da equipe</Link>
          <button type="button" className="botao primario" onClick={() => avisar('A edição de eventos entra na próxima etapa.')}>
            <Icone nome="lapis" /> Editar evento
          </button>
        </div>
      </div>

      <div className="so-mobile" style={{ marginBottom: 14 }}>
        <SeletorPerfil rotulos={{ gerente: 'Ver como gerente', supervisora: 'Ver como supervisora' }} />
      </div>

      <div className="detalhe">
        <div className="coluna">
          {trocas.map((t) => (
            <section key={t.troca.id} className="troca-cartao">
              <div>
                <span className="rotulo">
                  {t.troca.situacao === 'aguardando_aprovacao' ? 'Troca aguardando aprovação' : 'Troca aguardando aceite'}
                </span>
                <strong>{t.solicitante?.nome} indicou {t.substituto?.nome} para o {t.personagem?.nome}</strong>
                <p>
                  Pedido feito {quando(t.troca.solicitado_em, hoje).toLowerCase().replace(', ', ' às ')}
                  {t.troca.respondido_em && ` · ${primeiroNome(t.substituto)} aceitou às ${hora(t.troca.respondido_em)}`}
                  {t.semConflito ? ' · Sem conflito de horário' : ' · Atenção: conflito de horário'}
                </p>
              </div>
              {t.troca.situacao === 'aguardando_aprovacao' && aprovaTrocas(perfil) ? (
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => decidirTroca(t.troca.id, false)}>Recusar</button>
                  <button type="button" className="botao primario" onClick={() => decidirTroca(t.troca.id, true)}>Aprovar troca</button>
                </div>
              ) : (
                <div className="troca-espera">
                  {t.troca.situacao === 'aguardando_aceite'
                    ? `Aguardando ${primeiroNome(t.substituto)} aceitar`
                    : 'Aguardando aprovação da gerente ou da direção'}
                </div>
              )}
            </section>
          ))}

          <section className="cartao">
            <h2>{`Equipe${equipe.length ? ' escalada' : ''}`}</h2>
            {equipe.length === 0 ? (
              <div className="vazio">Ninguém escalado ainda.</div>
            ) : (
              <>
                <table className="tabela so-desktop">
                  <thead><tr><th>Função</th><th>Personagem</th><th>Profissional</th><th>Situação</th></tr></thead>
                  <tbody>
                    {equipe.map((m) => (
                      <tr key={m.escala.id}>
                        <td>{ROTULO_FUNCAO[m.escala.funcao]}</td>
                        <td className="suave">{personagemDoMembro(db, evento, m)}</td>
                        <td><strong>{m.profissional?.nome}</strong></td>
                        <td>{situacaoMembro(m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="equipe-lista">
                  {equipe.map((m) => (
                    <div key={m.escala.id}>
                      <span className="avatar">{iniciais(m.profissional?.nome ?? '?')}</span>
                      <span>
                        <strong>{m.profissional?.nome}</strong>
                        <small>{ROTULO_FUNCAO[m.escala.funcao]}{m.escala.funcao !== 'produtor' ? ` · ${personagemDoMembro(db, evento, m)}` : ''}</small>
                      </span>
                      {situacaoMembro(m)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="cartao">
            <h2>Orientações para a equipe</h2>
            {orientacoes.length ? (
              <ul className="orientacoes">{orientacoes.map((o) => <li key={o}>{o}</li>)}</ul>
            ) : (
              <div className="vazio">Sem orientações específicas.</div>
            )}
          </section>

          <section className="cartao">
            <div className="cartao-topo">
              <h2>Fantasias</h2>
              {conferencia !== 'sem_fantasias' && (
                <small>Conferência pós-evento: {conferencia === 'concluida' ? 'concluída' : 'pendente'}</small>
              )}
            </div>
            {fantasias.length ? (
              <div className="fantasias">
                {fantasias.map((f) => {
                  const s = situacaoFantasiaNoEvento(db, f, evento);
                  return (
                    <div key={f.id} className="fantasia">
                      <strong>{f.identificacao} · {f.tamanho ?? 'único'}</strong>
                      <span className={s.tom}>{s.texto}</span>
                      {s.detalhe && <small>{s.detalhe}</small>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="vazio">Nenhuma fantasia escalada.</div>
            )}
          </section>
        </div>

        <div className="coluna">
          <section className="cartao so-desktop">
            <div className="bloco">
              <span className="rotulo">Local</span>
              <strong>{local?.nome}</strong>
              <p>{local?.endereco}</p>
              {local?.link_localizacao && <a className="link-marca" href={local.link_localizacao} target="_blank" rel="noreferrer">Abrir no mapa</a>}
            </div>
            {contratante && (
              <div className="bloco">
                <span className="rotulo">Contratante</span>
                <strong>{contratante.nome}</strong>
                <p>{contratante.telefone}</p>
              </div>
            )}
          </section>

          <section className="cartao">
            <h2>Transporte</h2>
            {transporte.reserva ? (
              <>
                <strong>{transporte.veiculoNome} · reservada por {transporte.responsavel?.nome}</strong>
                <p className="suave" style={{ margin: '4px 0 0' }}>
                  Retirada {hora(transporte.reserva.retirada)} · devolução prevista {hora(transporte.reserva.devolucao_prevista)}
                </p>
              </>
            ) : (
              <div className="vazio">Sem reserva de veículo.</div>
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
          </section>

          <section className="cartao">
            <h2>Avisos e agenda</h2>
            <ul className="avisos">
              {avisos.convite && <li><span className="ponto verde" /> Convite na agenda enviado para os {avisos.equipe} profissionais</li>}
              {avisos.lembrete && (
                <li>
                  <span className="ponto laranja" />
                  Último aviso programado: {dataLonga(avisos.lembrete.agendada_para, false).split(',')[0].toLowerCase()} às {hora(avisos.lembrete.agendada_para)} ({avisos.antecedencia}h antes)
                </li>
              )}
              {!avisos.convite && !avisos.lembrete && <li className="suave">Nenhum aviso enviado ainda.</li>}
            </ul>
            {linkFeedback && (
              <a className="botao" href={linkFeedback} target="_blank" rel="noreferrer" style={{ marginTop: 14, width: '100%' }}>
                <Icone nome="link" tamanho={16} /> Formulário de feedback
              </a>
            )}
          </section>

          {veValores(perfil) ? <CartaoFinanceiro eventoId={evento.id} /> : (
            <section className="cartao oculto">
              <h3>Valores ocultos para este perfil</h3>
              <p>A supervisora vê e edita o evento, mas não vê o valor da festa nem os pagamentos.</p>
            </section>
          )}

          <section className="cartao">
            <h2>Histórico</h2>
            {historico.length ? (
              <ul className="historico">
                {historico.map((h) => (
                  <li key={h.id}>
                    <strong>{h.descricao}</strong>
                    <small>{quando(h.em, hoje)} · {h.usuario_nome}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="vazio">Sem alterações registradas.</div>
            )}
          </section>
        </div>
      </div>

      <div className="barra-acoes">
        <Link to={`/eventos/${evento.id}/pdf`} className="botao">Gerar PDF</Link>
        <button type="button" className="botao primario" onClick={() => avisar('A edição de eventos entra na próxima etapa.')}>Editar evento</button>
      </div>
    </Layout>
  );
}

function CartaoFinanceiro({ eventoId }: { eventoId: string }) {
  const { db } = useEstado();
  const f = financeiroDoEvento(db, eventoId);
  const falta = f.contratado - f.recebido;
  return (
    <section className="cartao">
      <div className="cartao-topo"><h2>Financeiro</h2><small>Só direção e gerente</small></div>
      <div className="valores">
        <div><span>Valor contratado</span><strong>{moeda(f.contratado)}</strong></div>
        <div>
          <span>Recebido</span><strong>{moeda(f.recebido)}</strong>
          {f.situacao === 'parcial' && <small>Parcial · falta {moeda(falta)}</small>}
          {f.situacao === 'pendente' && f.contratado > 0 && <small>Pendente</small>}
        </div>
      </div>
      {f.pagamentos.length > 0 && (
        <>
          <span className="rotulo">Pagamento da equipe</span>
          <div className="linhas" style={{ marginTop: 6 }}>
            {f.pagamentos.map((p) => (
              <div key={p.id}>
                <span>{p.profissional?.nome}</span>
                <span>{moeda(p.valor_combinado)} · <span className={p.situacao}>{p.situacao}</span></span>
              </div>
            ))}
            {f.despesas > 0 && <div className="suave"><span>Despesas</span><span>{moeda(f.despesas)}</span></div>}
          </div>
        </>
      )}
    </section>
  );
}
