import { Link, useLocation, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useState } from 'react';
import { Icone } from '../components/Icone';
import { FormCancelar, FormEscala, FormEvento, FormRemarcar, FormTirarDaEscala } from '../components/FormulariosEvento';
import { FormConferencia, ROTULO_CONDICAO } from '../components/FormularioConferencia';
import { BotaoDesistir, FormPedirTroca, prazoDaTroca } from '../components/Trocas';
import { CartaoDespesas, CartaoFinanceiro, CartaoMeuValor, CartaoTransporte } from '../components/CartoesEvento';
import { useEstado } from '../lib/estado';
import { marcarRealizado } from '../lib/acoes';
import { dataLonga, hora, iniciais, quando } from '../lib/formato';
import {
  avisosDoEvento, conferenciaDoEvento, contratanteDe, descricaoMaquiagem, equipeDoEvento, eventoPorId,
  historicoDoEvento, localDe, primeiroNome, ROTULO_FUNCAO, ROTULO_SITUACAO, situacaoFantasiaNoEvento,
  trocasPendentes, veValores, type MembroEquipe,
} from '../lib/consultas';
import type { Evento } from '../lib/tipos';

export const tituloEvento = (e: Evento) => (e.idade ? `${e.titulo} · ${e.idade} anos` : e.titulo);

function situacaoMembro(m: MembroEquipe) {
  if (m.troca) return <span className="selo alerta">{m.troca.situacao === 'aguardando_aceite' ? 'Troca pedida' : 'Troca solicitada'}</span>;
  return <span className="selo ok">Confirmada</span>;
}

type Janela =
  | { tipo: 'editar' | 'escalar' | 'remarcar' | 'cancelar' | 'conferir' }
  | { tipo: 'tirar'; escalaId: string; nome: string }
  | { tipo: 'trocar'; membro: MembroEquipe };

function personagemDoMembro(db: ReturnType<typeof useEstado>['db'], evento: Evento, m: MembroEquipe) {
  if (m.escala.funcao === 'maquiador') return descricaoMaquiagem(db, evento, m);
  return m.personagem?.nome ?? '—';
}

export function DetalheEvento() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { db, hoje, perfil, decidirTroca, permissoes, executar, cliente, avisar, usuario } = useEstado();
  const origem = (location.state as { voltarPara?: string } | null)?.voltarPara;
  const voltarPara = origem ?? '/';
  const textoVoltar = origem?.startsWith('/financeiro') ? 'Voltar ao financeiro' : origem?.startsWith('/eventos') ? 'Voltar aos eventos' : 'Voltar ao calendário';
  const [janela, setJanela] = useState<Janela | null>(null);
  const evento = eventoPorId(db, id);

  if (!evento) {
    return (
      <Layout tituloMobile="Evento">
        <Link to={voltarPara} className="voltar"><Icone nome="esquerda" /> {textoVoltar}</Link>
        <div className="vazio">Evento não encontrado.</div>
      </Layout>
    );
  }

  const local = localDe(db, evento);
  const contratante = contratanteDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const trocas = trocasPendentes(db, evento.id);
  const avisos = avisosDoEvento(db, evento);
  const conferencia = conferenciaDoEvento(db, evento.id);
  const historico = historicoDoEvento(db, evento.id, perfil);
  const orientacoes = (evento.orientacoes ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fantasias = equipe.flatMap((m) => (m.fantasia ? [m.fantasia] : []));
  const linkFeedback = db.configuracoes.link_formulario_produtor;
  const horario = `${hora(evento.inicio)} às ${hora(evento.fim)}`;
  const cancelado = evento.situacao === 'cancelado';
  const podeEditar = permissoes.operacao && !cancelado;
  const podeEscalar = podeEditar && evento.situacao !== 'realizado';
  const podeTirar = permissoes.alterarEquipe && podeEscalar;
  const terminou = new Date(evento.fim) < new Date(hoje);
  const podeConferir = permissoes.conferirFantasias && !cancelado && (terminou || evento.situacao === 'realizado');
  const fechar = () => setJanela(null);
  // O artista escalado pode pedir a própria troca até o prazo (padrão 1h30 antes)
  const podePedirTroca = (m: MembroEquipe) => m.escala.funcao === 'artista' && !m.troca && !cancelado
    && m.escala.profissional_id === usuario.profissionalId && evento.situacao !== 'realizado'
    && new Date(hoje) < new Date(prazoDaTroca(evento, db.configuracoes));

  return (
    <Layout tituloMobile="Detalhe do evento" comBarra>
      <Link to={voltarPara} className="voltar"><Icone nome="esquerda" /> {textoVoltar}</Link>

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
          {podeEditar && (
            <button type="button" className="botao primario" onClick={() => setJanela({ tipo: 'editar' })}>
              <Icone nome="lapis" /> Editar evento
            </button>
          )}
        </div>
      </div>

      <div className="detalhe">
        <div className="coluna">
          {cancelado && (
            <section className="cartao oculto">
              <h3>Evento cancelado</h3>
              <p>{evento.motivo_cancelamento ? `Motivo: ${evento.motivo_cancelamento.replace(/[.!]?s*$/, '.')}` : 'Sem motivo registrado.'} A equipe, os personagens e o veículo foram liberados.</p>
            </section>
          )}
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
              {t.troca.situacao === 'aguardando_aprovacao' && permissoes.gestao ? (
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => decidirTroca(t.troca.id, false)}>Recusar</button>
                  <button type="button" className="botao primario" onClick={() => decidirTroca(t.troca.id, true)}>Aprovar troca</button>
                </div>
              ) : t.troca.solicitante_id === usuario.profissionalId ? (
                <div className="acoes"><BotaoDesistir substituicaoId={t.troca.id} /></div>
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
            <div className="cartao-topo">
              <h2>{`Equipe${equipe.length ? ' escalada' : ''}`}</h2>
              {podeEscalar && (
                <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'escalar' })}>
                  <Icone nome="mais" tamanho={15} /> Escalar
                </button>
              )}
            </div>
            {equipe.length === 0 ? (
              <div className="vazio">Ninguém escalado ainda.</div>
            ) : (
              <>
                <table className="tabela so-desktop">
                  <thead><tr><th>Função</th><th>Personagem</th><th>Profissional</th><th>Situação</th>{podeTirar && <th><span className="sr-only">Ações</span></th>}</tr></thead>
                  <tbody>
                    {equipe.map((m) => (
                      <tr key={m.escala.id}>
                        <td>{ROTULO_FUNCAO[m.escala.funcao]}</td>
                        <td className="suave">{personagemDoMembro(db, evento, m)}</td>
                        <td><strong>{m.profissional?.nome}</strong></td>
                        <td>
                          {situacaoMembro(m)}
                          {podePedirTroca(m) && (
                            <button type="button" className="botao pequeno" style={{ marginLeft: 8 }} onClick={() => setJanela({ tipo: 'trocar', membro: m })}>Pedir troca</button>
                          )}
                        </td>
                        {podeTirar && (
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'tirar', escalaId: m.escala.id, nome: m.profissional?.nome ?? 'Profissional' })}>Tirar</button>
                          </td>
                        )}
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
                      {podePedirTroca(m) && (
                        <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'trocar', membro: m })}>Trocar</button>
                      )}
                      {podeTirar && (
                        <button type="button" className="botao pequeno" aria-label={`Tirar ${m.profissional?.nome ?? ''} da equipe`}
                          onClick={() => setJanela({ tipo: 'tirar', escalaId: m.escala.id, nome: m.profissional?.nome ?? 'Profissional' })}>✕</button>
                      )}
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
                podeConferir
                  ? <button type="button" className="botao pequeno" onClick={() => setJanela({ tipo: 'conferir' })}>
                      {conferencia === 'concluida' ? 'Rever conferência' : 'Conferir fantasias'}
                    </button>
                  : <small>Conferência pós-evento: {conferencia === 'concluida' ? 'concluída' : 'pendente'}</small>
              )}
            </div>
            {podeConferir && conferencia === 'pendente' && (
              <p className="suave" style={{ margin: '-6px 0 12px', fontSize: 12.5 }}>O evento terminou: confira devolução, limpeza e reparos.</p>
            )}
            {fantasias.length ? (
              <div className="fantasias">
                {fantasias.map((f) => {
                  const s = situacaoFantasiaNoEvento(db, f, evento);
                  const conf = db.conferencias_fantasia.find((c) => c.evento_id === evento.id && c.fantasia_id === f.id);
                  return (
                    <div key={f.id} className="fantasia">
                      <strong>{f.identificacao} · {f.tamanho ?? 'único'}</strong>
                      <span className={s.tom}>{s.texto}</span>
                      {s.detalhe && <small>{s.detalhe}</small>}
                      {conf && (
                        <span className={`conferido ${conf.condicao === 'ok' && conf.devolvida ? 'ok-texto' : 'alerta-texto'}`}>
                          Conferida: {conf.devolvida ? ROTULO_CONDICAO[conf.condicao].toLowerCase() : 'não devolvida'}
                          {conf.precisa_limpeza && ' · limpeza'}{conf.precisa_reparo && ' · reparo'}
                          {conf.pendencias && ` · ${conf.pendencias}`}
                        </span>
                      )}
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

          <CartaoTransporte evento={evento} />

          <section className="cartao">
            <h2>Avisos e agenda</h2>
            <ul className="avisos">
              {avisos.convite && <li><span className="ponto verde" /> Convite na agenda enviado para os {avisos.equipe} profissionais</li>}
              {avisos.lembreteEm && (
                <li>
                  <span className="ponto laranja" />
                  Último aviso programado: {dataLonga(avisos.lembreteEm, false).split(',')[0].toLowerCase()} às {hora(avisos.lembreteEm)} ({avisos.antecedencia}h antes)
                </li>
              )}
              {!avisos.convite && !avisos.lembreteEm && <li className="suave">Nenhum aviso programado.</li>}
            </ul>
            {linkFeedback && (
              <a className="botao" href={linkFeedback} target="_blank" rel="noreferrer" style={{ marginTop: 14, width: '100%' }}>
                <Icone nome="link" tamanho={16} /> Formulário de feedback
              </a>
            )}
          </section>

          {veValores(perfil) ? <CartaoFinanceiro evento={evento} /> : <CartaoMeuValor evento={evento} />}
          <CartaoDespesas evento={evento} />

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

          {podeEscalar && (
            <section className="cartao">
              <h2>Mudanças no evento</h2>
              <div className="acoes-coluna">
                {terminou && (
                  <button type="button" className="botao" onClick={() => void executar(() => marcarRealizado(cliente, evento.id), 'Evento marcado como realizado.').then((r) => { if (r !== true) avisar(r); })}>
                    Marcar como realizado
                  </button>
                )}
                <button type="button" className="botao" onClick={() => setJanela({ tipo: 'remarcar' })}>
                  <Icone nome="calendario" tamanho={16} /> Remarcar data ou horário
                </button>
                {permissoes.cancelarEvento && (
                  <button type="button" className="botao texto-perigo" onClick={() => setJanela({ tipo: 'cancelar' })}>Cancelar evento</button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {janela?.tipo === 'editar' && <FormEvento item={evento} onFechar={fechar} />}
      {janela?.tipo === 'escalar' && <FormEscala evento={evento} onFechar={fechar} />}
      {janela?.tipo === 'remarcar' && <FormRemarcar evento={evento} onFechar={fechar} />}
      {janela?.tipo === 'cancelar' && <FormCancelar evento={evento} onFechar={fechar} />}
      {janela?.tipo === 'trocar' && (
        <FormPedirTroca evento={evento} escala={janela.membro.escala} personagem={janela.membro.personagem?.nome ?? 'personagem'} onFechar={fechar} />
      )}
      {janela?.tipo === 'conferir' && <FormConferencia evento={evento} onFechar={fechar} />}
      {janela?.tipo === 'tirar' && <FormTirarDaEscala escalaId={janela.escalaId} nome={janela.nome} onFechar={fechar} />}

      <div className="barra-acoes">
        <Link to={`/eventos/${evento.id}/pdf`} className="botao">Gerar PDF</Link>
        {podeEditar
          ? <button type="button" className="botao primario" onClick={() => setJanela({ tipo: 'editar' })}>Editar evento</button>
          : <Link to="/" className="botao">Voltar</Link>}
      </div>
    </Layout>
  );
}
