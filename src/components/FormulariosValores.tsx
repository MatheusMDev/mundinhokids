// Reserva do veículo, recebimentos, pagamento da equipe e despesas.

import { useMemo, useState } from 'react';
import { Campo, Dialogo, Linha, Marcador } from './Formulario';
import { useEstado } from '../lib/estado';
import {
  cancelarReserva, registrarDevolucao, salvarDespesa, salvarPagamentos, salvarRecebimento, salvarReserva, vazioParaNulo,
  type DadosPagamento,
} from '../lib/acoes';
import { dataLonga, deCampos, hojeCampo, hora, lerValor, moeda, paraCampos } from '../lib/formato';
import { equipeDoEvento, ROTULO_FUNCAO } from '../lib/consultas';
import type { Despesa, Evento, Recebimento, ReservaVeiculo } from '../lib/tipos';

const antes = (a: string, b: string) => new Date(a) < new Date(b);
const somarHoras = (iso: string, horas: number) => new Date(new Date(iso).getTime() + horas * 3600_000).toISOString();

// ---------------------------------------------------------------------
// Reserva do veículo
// ---------------------------------------------------------------------

export function FormReserva({ evento, reserva, onFechar }: { evento?: Evento; reserva?: ReservaVeiculo; onFechar: () => void }) {
  const { db, cliente, executar, permissoes, usuario } = useEstado();
  const veiculos = db.veiculos.filter((v) => v.ativo || v.id === reserva?.veiculo_id);

  // Quem pode ser responsável: o próprio produtor; para a operação, os produtores do evento (ou todos, sem evento)
  const produtoresDoEvento = evento ? equipeDoEvento(db, evento.id).filter((m) => m.escala.funcao === 'produtor').map((m) => m.escala.profissional_id) : [];
  const responsaveis = permissoes.operacao
    ? db.profissionais.filter((p) => p.ativo && p.funcoes.includes('produtor'))
        .sort((a, b) => Number(produtoresDoEvento.includes(b.id)) - Number(produtoresDoEvento.includes(a.id)) || a.nome.localeCompare(b.nome))
    : db.profissionais.filter((p) => p.id === usuario.profissionalId);

  const retiradaPadrao = paraCampos(reserva?.retirada ?? (evento ? somarHoras(evento.inicio, -1) : new Date().toISOString()));
  const devolucaoPadrao = paraCampos(reserva?.devolucao_prevista ?? (evento ? somarHoras(evento.fim, 1) : somarHoras(new Date().toISOString(), 4)));

  const [veiculo, setVeiculo] = useState(reserva?.veiculo_id ?? veiculos[0]?.id ?? '');
  const [responsavel, setResponsavel] = useState(reserva?.responsavel_id ?? produtoresDoEvento[0] ?? usuario.profissionalId ?? '');
  const [dataRetirada, setDataRetirada] = useState(retiradaPadrao.data);
  const [horaRetirada, setHoraRetirada] = useState(retiradaPadrao.hora);
  const [dataDevolucao, setDataDevolucao] = useState(devolucaoPadrao.data);
  const [horaDevolucao, setHoraDevolucao] = useState(devolucaoPadrao.hora);
  const [observacoes, setObservacoes] = useState(reserva?.observacoes ?? '');

  const retirada = dataRetirada && horaRetirada ? deCampos(dataRetirada, horaRetirada) : '';
  const devolucao = dataDevolucao && horaDevolucao ? deCampos(dataDevolucao, horaDevolucao) : '';

  // Outras reservas do mesmo veículo perto desse horário, para a pessoa ver antes de salvar
  const vizinhas = useMemo(() => {
    if (!retirada || !devolucao) return [];
    const inicioJanela = somarHoras(retirada, -12);
    const fimJanela = somarHoras(devolucao, 12);
    return db.reservas_veiculo
      .filter((r) => r.ativo && r.id !== reserva?.id && r.veiculo_id === veiculo
        && antes(r.retirada, fimJanela) && antes(inicioJanela, r.devolucao_prevista))
      .sort((a, b) => a.retirada.localeCompare(b.retirada));
  }, [db.reservas_veiculo, reserva?.id, veiculo, retirada, devolucao]);
  const conflito = vizinhas.find((r) => antes(r.retirada, devolucao) && antes(retirada, r.devolucao_prevista));

  return (
    <Dialogo
      titulo={reserva ? 'Alterar reserva do veículo' : 'Reservar veículo'}
      onFechar={onFechar}
      textoSalvar={reserva ? 'Salvar' : 'Reservar'}
      validar={() => (!veiculo ? 'Escolha o veículo.'
        : !responsavel ? 'Escolha quem fica com o veículo.'
        : !retirada || !devolucao ? 'Informe a retirada e a devolução.'
        : !antes(retirada, devolucao) ? 'A devolução precisa ser depois da retirada.'
        : conflito ? 'O veículo já está reservado nesse período. Ajuste os horários.'
        : null)}
      onSalvar={() => executar(() => salvarReserva(cliente, reserva?.id, {
        veiculo_id: veiculo, evento_id: reserva ? reserva.evento_id : evento?.id ?? null, responsavel_id: responsavel,
        retirada, devolucao_prevista: devolucao, observacoes: vazioParaNulo(observacoes),
      }), reserva ? 'Reserva atualizada.' : 'Veículo reservado.')}
    >
      {evento && <p className="suave" style={{ margin: 0 }}>{evento.titulo}: {dataLonga(evento.inicio, false)}, {hora(evento.inicio)} às {hora(evento.fim)}.</p>}
      <Linha>
        <Campo rotulo="Veículo" obrigatorio>
          {(id) => (
            <select id={id} value={veiculo} onChange={(e) => setVeiculo(e.target.value)} required>
              {veiculos.length === 0 && <option value="">Nenhum veículo cadastrado</option>}
              {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` · ${v.placa}` : ''}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Responsável" obrigatorio>
          {(id) => (
            <select id={id} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required disabled={!permissoes.operacao}>
              <option value="">Escolha…</option>
              {responsaveis.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}{produtoresDoEvento.includes(p.id) ? ' (produz o evento)' : ''}</option>
              ))}
            </select>
          )}
        </Campo>
      </Linha>
      <Linha>
        <Campo rotulo="Retirada" obrigatorio>{(id) => <input id={id} type="date" value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)} required />}</Campo>
        <Campo rotulo="Horário">{(id) => <input id={id} type="time" value={horaRetirada} onChange={(e) => setHoraRetirada(e.target.value)} required />}</Campo>
      </Linha>
      <Linha>
        <Campo rotulo="Devolução prevista" obrigatorio>{(id) => <input id={id} type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} required />}</Campo>
        <Campo rotulo="Horário">{(id) => <input id={id} type="time" value={horaDevolucao} onChange={(e) => setHoraDevolucao(e.target.value)} required />}</Campo>
      </Linha>
      {vizinhas.length > 0 && (
        <div className={`trava${conflito ? ' conflito' : ''}`}>
          <span>
            <strong>{conflito ? 'Conflito de horário' : 'Outras reservas perto desse horário'}</strong>
            {vizinhas.map((r) => {
              const outro = r.evento_id ? db.eventos.find((e) => e.id === r.evento_id)?.titulo : null;
              return <span key={r.id} style={{ display: 'block' }}>{hora(r.retirada)} às {hora(r.devolucao_prevista)}{outro ? ` · ${outro}` : ''}</span>;
            })}
          </span>
        </div>
      )}
      <Campo rotulo="Observações" dica="Ex.: buscar a chave com a gerente.">
        {(id) => <input id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}
      </Campo>
    </Dialogo>
  );
}

export function FormCancelarReserva({ reserva, onFechar }: { reserva: ReservaVeiculo; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  return (
    <Dialogo
      titulo="Cancelar a reserva do veículo?" onFechar={onFechar} perigo textoSalvar="Cancelar reserva"
      onSalvar={() => executar(() => cancelarReserva(cliente, reserva.id), 'Reserva cancelada. O veículo ficou livre nesse horário.')}
    >
      <p style={{ margin: 0 }}>Retirada {hora(reserva.retirada)}, devolução prevista {hora(reserva.devolucao_prevista)}. A reserva fica registrada no histórico.</p>
    </Dialogo>
  );
}

export function FormDevolucao({ reserva, onFechar }: { reserva: ReservaVeiculo; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  const agora = paraCampos(new Date().toISOString());
  const [data, setData] = useState(agora.data);
  const [horaDevolvido, setHoraDevolvido] = useState(agora.hora);
  return (
    <Dialogo
      titulo="Registrar devolução do veículo" onFechar={onFechar} textoSalvar="Registrar"
      validar={() => (!data || !horaDevolvido ? 'Informe quando o veículo voltou.' : null)}
      onSalvar={() => executar(() => registrarDevolucao(cliente, reserva.id, deCampos(data, horaDevolvido)), 'Devolução registrada.')}
    >
      <p className="suave" style={{ margin: 0 }}>Devolução prevista: {hora(reserva.devolucao_prevista)}.</p>
      <Linha>
        <Campo rotulo="Data">{(id) => <input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} required />}</Campo>
        <Campo rotulo="Horário">{(id) => <input id={id} type="time" value={horaDevolvido} onChange={(e) => setHoraDevolvido(e.target.value)} required />}</Campo>
      </Linha>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------
// Recebimento (o que o contratante pagou)
// ---------------------------------------------------------------------

const FORMAS = ['pix', 'transferência', 'dinheiro', 'cartão'];

export function FormRecebimento({ evento, item, onFechar }: { evento: Evento; item?: Recebimento; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  const [valor, setValor] = useState(item ? String(item.valor).replace('.', ',') : '');
  const [data, setData] = useState(item?.recebido_em ?? hojeCampo());
  const [forma, setForma] = useState(item?.forma ?? 'pix');
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? '');
  const numero = lerValor(valor);

  return (
    <Dialogo
      titulo={item ? 'Alterar recebimento' : 'Registrar recebimento'} onFechar={onFechar}
      validar={() => (numero === null || numero <= 0 ? 'Informe um valor maior que zero.' : !data ? 'Informe a data.' : null)}
      onSalvar={() => executar(() => salvarRecebimento(cliente, item?.id, {
        evento_id: evento.id, valor: numero!, recebido_em: data, forma, observacoes: vazioParaNulo(observacoes),
      }), item ? 'Recebimento atualizado.' : 'Recebimento registrado.')}
    >
      <p className="suave" style={{ margin: 0 }}>{evento.titulo}. O sistema só registra: o pagamento em si acontece fora dele.</p>
      <Linha>
        <Campo rotulo="Valor (R$)" obrigatorio>{(id) => <input id={id} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="900" required autoFocus />}</Campo>
        <Campo rotulo="Data" obrigatorio>{(id) => <input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} required />}</Campo>
        <Campo rotulo="Forma">
          {(id) => (
            <select id={id} value={forma} onChange={(e) => setForma(e.target.value)}>
              {FORMAS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          )}
        </Campo>
      </Linha>
      <Campo rotulo="Observações" dica="Ex.: sinal de 50%.">{(id) => <input id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</Campo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------
// Pagamento da equipe (valor combinado e se já foi pago)
// ---------------------------------------------------------------------

interface LinhaPagamento { profissional_id: string; nome: string; funcao: string; valor: string; pago: boolean; pagoEm: string; foraDaEquipe: boolean }

export function FormPagamentos({ evento, onFechar }: { evento: Evento; onFechar: () => void }) {
  const { db, cliente, executar } = useEstado();

  const [linhas, setLinhas] = useState<LinhaPagamento[]>(() => {
    const equipe = equipeDoEvento(db, evento.id);
    const existentes = db.pagamentos_profissionais.filter((p) => p.evento_id === evento.id);
    const nome = (id: string) => db.profissionais.find((p) => p.id === id)?.nome ?? 'Profissional';
    const daEquipe = equipe.map((m) => m.escala.profissional_id);
    const ids = [...new Set([...daEquipe, ...existentes.map((p) => p.profissional_id)])];
    return ids.map((id) => {
      const pagamento = existentes.find((p) => p.profissional_id === id);
      const membro = equipe.find((m) => m.escala.profissional_id === id);
      return {
        profissional_id: id, nome: nome(id),
        funcao: membro ? `${ROTULO_FUNCAO[membro.escala.funcao]}${membro.personagem ? ` · ${membro.personagem.nome}` : ''}` : 'Saiu da equipe',
        valor: pagamento ? String(pagamento.valor_combinado).replace('.', ',') : '',
        pago: pagamento?.situacao === 'pago',
        pagoEm: pagamento?.pago_em ?? hojeCampo(),
        foraDaEquipe: !membro,
      };
    });
  });

  const mudar = (id: string, campo: Partial<LinhaPagamento>) =>
    setLinhas((atual) => atual.map((l) => (l.profissional_id === id ? { ...l, ...campo } : l)));

  const total = linhas.reduce((s, l) => s + (lerValor(l.valor) ?? 0), 0);

  return (
    <Dialogo
      titulo={`Pagamento da equipe · ${evento.titulo}`} onFechar={onFechar}
      validar={() => {
        const invalida = linhas.find((l) => l.valor.trim() && (lerValor(l.valor) === null || lerValor(l.valor)! < 0));
        if (invalida) return `Valor inválido para ${invalida.nome}.`;
        const pagoSemValor = linhas.find((l) => l.pago && !l.valor.trim());
        return pagoSemValor ? `Informe o valor de ${pagoSemValor.nome} antes de marcar como pago.` : null;
      }}
      onSalvar={() => executar(() => salvarPagamentos(cliente, evento.id, linhas
        .filter((l) => l.valor.trim())
        .map((l): DadosPagamento => ({
          profissional_id: l.profissional_id, valor_combinado: lerValor(l.valor)!,
          situacao: l.pago ? 'pago' : 'pendente', pago_em: l.pago ? l.pagoEm || hojeCampo() : null,
        }))), 'Valores da equipe salvos.')}
    >
      {linhas.length === 0 && <div className="vazio">Ninguém escalado ainda.</div>}
      {linhas.map((l) => (
        <div key={l.profissional_id} className="linha-pagamento">
          <div>
            <strong>{l.nome}</strong>
            <small className={l.foraDaEquipe ? 'alerta-texto' : ''}>{l.funcao}</small>
          </div>
          <Campo rotulo="Valor (R$)">{(id) => <input id={id} inputMode="decimal" value={l.valor} onChange={(e) => mudar(l.profissional_id, { valor: e.target.value })} placeholder="250" />}</Campo>
          <div className="pago">
            <Marcador texto="Pago" marcado={l.pago} onMudar={(pago) => mudar(l.profissional_id, { pago })} />
            {l.pago && <input type="date" aria-label={`Data do pagamento de ${l.nome}`} value={l.pagoEm} onChange={(e) => mudar(l.profissional_id, { pagoEm: e.target.value })} />}
          </div>
        </div>
      ))}
      {linhas.length > 0 && <p className="suave" style={{ margin: 0, textAlign: 'right' }}>Total da equipe: <strong>{moeda(total)}</strong></p>}
      <small className="suave">Cada profissional vê só o próprio valor. Deixe em branco quem não tem valor combinado ainda.</small>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------
// Despesas (gastos extras do evento e insumos)
// ---------------------------------------------------------------------

export function FormDespesa({ evento, item, onFechar }: { evento?: Evento; item?: Despesa; onFechar: () => void }) {
  const { db, cliente, executar, permissoes, usuario } = useEstado();
  const limite = lerValor(db.configuracoes.despesa_aprovacao_acima_de ?? '');

  const [tipo, setTipo] = useState<Despesa['tipo']>(item?.tipo ?? (evento ? 'extra' : 'insumo'));
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [valor, setValor] = useState(item ? String(item.valor).replace('.', ',') : '');
  const [responsavel, setResponsavel] = useState(item?.responsavel_id ?? usuario.profissionalId ?? '');
  const [comprovante, setComprovante] = useState(item?.comprovante ?? '');
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? '');
  const numero = lerValor(valor);

  const pessoas = evento
    ? equipeDoEvento(db, evento.id).map((m) => m.profissional).filter((p): p is NonNullable<typeof p> => !!p)
    : db.profissionais.filter((p) => p.ativo);

  return (
    <Dialogo
      titulo={item ? 'Alterar despesa' : evento ? `Despesa · ${evento.titulo}` : 'Despesa geral ou insumo'}
      onFechar={onFechar}
      textoSalvar={item ? 'Salvar' : 'Lançar despesa'}
      validar={() => (!descricao.trim() ? 'Descreva a despesa.' : numero === null || numero <= 0 ? 'Informe um valor maior que zero.' : null)}
      onSalvar={() => executar(() => salvarDespesa(cliente, item?.id, {
        evento_id: item ? item.evento_id : evento?.id ?? null, tipo, descricao: descricao.trim(), valor: numero!,
        responsavel_id: responsavel || null, comprovante: vazioParaNulo(comprovante), observacoes: vazioParaNulo(observacoes),
      }), limite !== null && numero! > limite && !permissoes.gestao
        ? 'Despesa lançada. Ela aguarda a aprovação da gestão.'
        : 'Despesa lançada.')}
    >
      <Linha>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as Despesa['tipo'])}>
              <option value="extra">Gasto extra</option>
              <option value="insumo">Insumo (reposição ou dano)</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Valor (R$)" obrigatorio>{(id) => <input id={id} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="45" required />}</Campo>
      </Linha>
      <Campo rotulo="Descrição" obrigatorio dica="Ex.: balões para a entrada, peruca nova da Princesa do Gelo.">
        {(id) => <input id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} required autoFocus />}
      </Campo>
      <Campo rotulo="Quem gastou">
        {(id) => (
          <select id={id} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value="">Não informado</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
      </Campo>
      <Campo rotulo="Comprovante" dica="Link da foto ou referência (ex.: nota enviada no WhatsApp). O sistema não guarda arquivos.">
        {(id) => <input id={id} value={comprovante} onChange={(e) => setComprovante(e.target.value)} />}
      </Campo>
      <Campo rotulo="Observações">{(id) => <input id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</Campo>
      {limite !== null && <small className="suave">Despesas acima de {moeda(limite)} passam pela aprovação da gestão.</small>}
    </Dialogo>
  );
}
