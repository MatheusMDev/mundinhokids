// Formulários do evento: criar/editar, escalar a equipe, remarcar e cancelar.
// As travas (horário, personagem, fantasia) são do banco; aqui elas só
// aparecem antes, para a pessoa não escolher o que vai ser recusado.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Campo, Dialogo, Linha, Marcador } from './Formulario';
import { FormContratante } from './FormulariosCadastro';
import { useEstado } from '../lib/estado';
import { disponibilidadeNoEvento } from './DisponibilidadeSemanal';
import { cancelarEvento, escalar, remarcarEvento, salvarEvento, tirarDaEscala, vazioParaNulo } from '../lib/acoes';
import { deCampos, diaCurto, hora, paraCampos } from '../lib/formato';
import { profissionalDisponivel, ROTULO_FUNCAO } from '../lib/consultas';
import type { BaseDados, Evento, FuncaoEscala, SituacaoEvento } from '../lib/tipos';

const antes = (a: string, b: string) => new Date(a) < new Date(b);
const sobrepoe = (aInicio: string, aFim: string, bInicio: string, bFim: string) => antes(aInicio, bFim) && antes(bInicio, aFim);

/** Eventos ativos que ocupam o mesmo horário (inclui o próprio, para travas de personagem e fantasia) */
function eventosNoHorario(db: BaseDados, evento: Evento) {
  return db.eventos.filter((e) => e.situacao !== 'cancelado' && sobrepoe(e.inicio, e.fim, evento.inicio, evento.fim));
}

function validarHorario(data: string, inicio: string, fim: string) {
  if (!data || !inicio || !fim) return 'Informe a data e os horários de início e fim.';
  if (!antes(deCampos(data, inicio), deCampos(data, fim))) return 'O fim precisa ser depois do início.';
  return null;
}

// ---------------------------------------------------------------------
// Criar e editar
// ---------------------------------------------------------------------

export function FormEvento({ item, onFechar }: { item?: Evento; onFechar: () => void }) {
  const { db, cliente, executar, permissoes } = useEstado();
  const navegar = useNavigate();
  const inicio = item ? paraCampos(item.inicio) : { data: '', hora: '15:00' };
  const fim = item ? paraCampos(item.fim) : { data: '', hora: '18:00' };
  const valorAtual = item ? db.evento_financeiro.find((f) => f.evento_id === item.id)?.valor_contratado : undefined;

  const [titulo, setTitulo] = useState(item?.titulo ?? '');
  const [aniversariante, setAniversariante] = useState(item?.aniversariante ?? '');
  const [idade, setIdade] = useState(item?.idade?.toString() ?? '');
  const [contratante, setContratante] = useState(item?.contratante_id ?? '');
  const [local, setLocal] = useState(item?.local_id ?? '');
  const [data, setData] = useState(inicio.data);
  const [horaInicio, setHoraInicio] = useState(inicio.hora);
  const [horaFim, setHoraFim] = useState(fim.hora);
  const [situacao, setSituacao] = useState<SituacaoEvento>(item?.situacao ?? 'agendado');
  const [maquiagem, setMaquiagem] = useState(item?.tem_maquiagem ?? false);
  const [pessoas, setPessoas] = useState(item?.maquiagem_pessoas?.toString() ?? '0');
  const [orientacoes, setOrientacoes] = useState(item?.orientacoes ?? '');
  const [valor, setValor] = useState(valorAtual?.toString() ?? '');
  const [novoContratante, setNovoContratante] = useState(false);

  // Ao cadastrar um contratante por aqui, ele já fica escolhido
  const idsAntes = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!idsAntes.current) return;
    const novo = db.contratantes.find((c) => !idsAntes.current!.has(c.id));
    if (novo) {
      setContratante(novo.id);
      idsAntes.current = null;
    }
  }, [db.contratantes]);

  // Nome sugerido a partir do aniversariante
  function mudarAniversariante(nome: string) {
    const sugestaoAnterior = aniversariante ? `Festa de ${aniversariante}` : '';
    if (!titulo || titulo === sugestaoAnterior) setTitulo(nome ? `Festa de ${nome}` : '');
    setAniversariante(nome);
  }

  const situacoes: SituacaoEvento[] = item ? ['agendado', 'confirmado', 'realizado'] : ['agendado', 'confirmado'];

  async function salvar() {
    let criado: string | undefined;
    const ok = await executar(async () => {
      criado = await salvarEvento(cliente, item?.id, {
        titulo: titulo.trim(), aniversariante: vazioParaNulo(aniversariante), idade: idade ? Number(idade) : null,
        contratante_id: contratante, local_id: local,
        inicio: deCampos(data, horaInicio), fim: deCampos(data, horaFim), situacao,
        tem_maquiagem: maquiagem, maquiagem_pessoas: maquiagem ? Number(pessoas) || 0 : 0,
        orientacoes: vazioParaNulo(orientacoes),
      }, permissoes.gestao && valor !== '' ? Number(valor.replace(',', '.')) : null);
    }, item ? 'Evento atualizado.' : 'Evento criado. Agora monte a equipe.');
    if (ok === true && !item && criado) navegar(`/eventos/${criado}`);
    return ok;
  }

  return (
    <>
      <Dialogo
        titulo={item ? `Editar ${item.titulo}` : 'Novo evento'}
        onFechar={onFechar}
        validar={() => (!titulo.trim() ? 'Informe o nome do evento.'
          : !contratante ? 'Escolha o contratante.'
          : !local ? 'Escolha o local.'
          : item && situacao === 'realizado' && item.situacao !== 'realizado'
            && !db.videos_eventos.some((video) => video.evento_id === item.id)
            ? 'Anexe o vídeo deste evento antes de marcá-lo como realizado.'
          : item ? null : validarHorario(data, horaInicio, horaFim))}
        onSalvar={salvar}
        textoSalvar={item ? 'Salvar' : 'Criar evento'}
      >
        <Linha>
          <Campo rotulo="Aniversariante">{(id) => <input id={id} value={aniversariante} onChange={(e) => mudarAniversariante(e.target.value)} autoFocus />}</Campo>
          <Campo rotulo="Idade">{(id) => <input id={id} type="number" min={0} max={120} value={idade} onChange={(e) => setIdade(e.target.value)} />}</Campo>
        </Linha>
        <Campo rotulo="Nome do evento" obrigatorio dica="Aparece no calendário e no PDF.">
          {(id) => <input id={id} value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Festa da Laura" />}
        </Campo>
        <Linha>
          <Campo rotulo="Contratante" obrigatorio>
            {(id) => (
              <div className="com-botao">
                <select id={id} value={contratante} onChange={(e) => setContratante(e.target.value)} required>
                  <option value="">Escolha…</option>
                  {[...db.contratantes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button type="button" className="botao pequeno" onClick={() => {
                  idsAntes.current = new Set(db.contratantes.map((c) => c.id));
                  setNovoContratante(true);
                }}>Novo</button>
              </div>
            )}
          </Campo>
          <Campo rotulo="Local" obrigatorio>
            {(id) => (
              <select id={id} value={local} onChange={(e) => setLocal(e.target.value)} required>
                <option value="">Escolha…</option>
                {db.locais.filter((l) => l.ativo || l.id === local).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            )}
          </Campo>
        </Linha>
        <Linha>
          <Campo rotulo="Data" obrigatorio>{(id) => <input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={!!item} required />}</Campo>
          <Campo rotulo="Início" obrigatorio>{(id) => <input id={id} type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} disabled={!!item} required />}</Campo>
          <Campo rotulo="Fim" obrigatorio>{(id) => <input id={id} type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} disabled={!!item} required />}</Campo>
        </Linha>
        {item && <small className="suave" style={{ marginTop: -6 }}>Para mudar data ou horário, use “Remarcar” no evento: o motivo fica registrado.</small>}
        <Campo rotulo="Situação">
          {(id) => (
            <select id={id} value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoEvento)}>
              {situacoes.map((s) => <option key={s} value={s}>{{ agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' }[s]}</option>)}
            </select>
          )}
        </Campo>
        <Marcador texto="Tem maquiagem" marcado={maquiagem} onMudar={setMaquiagem} />
        {maquiagem && (
          <Campo rotulo="Pessoas para maquiar" dica="Artistas e convidados que a maquiagem vai atender.">
            {(id) => <input id={id} type="number" min={0} value={pessoas} onChange={(e) => setPessoas(e.target.value)} />}
          </Campo>
        )}
        <Campo rotulo="Orientações para a equipe" dica="Uma por linha. Vão para o PDF da equipe.">
          {(id) => <textarea id={id} value={orientacoes} onChange={(e) => setOrientacoes(e.target.value)} rows={4} />}
        </Campo>
        {permissoes.gestao && (
          <Campo rotulo="Valor contratado (R$)" dica="Só a direção e a gerente veem.">
            {(id) => <input id={id} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1800" />}
          </Campo>
        )}
      </Dialogo>
      {novoContratante && <FormContratante onFechar={() => setNovoContratante(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------
// Escalar a equipe
// ---------------------------------------------------------------------

export function FormEscala({ evento, onFechar }: { evento: Evento; onFechar: () => void }) {
  const { db, cliente, executar } = useEstado();
  const [funcao, setFuncao] = useState<FuncaoEscala>('artista');
  const [personagem, setPersonagem] = useState('');
  const [profissional, setProfissional] = useState('');
  const [fantasia, setFantasia] = useState('');
  const [maquiar, setMaquiar] = useState(evento.tem_maquiagem);
  const [horaMaquiagem, setHoraMaquiagem] = useState(() => {
    const umaHoraAntes = new Date(new Date(evento.inicio).getTime() - 60 * 60 * 1000).toISOString();
    return paraCampos(umaHoraAntes).hora;
  });

  const ocupacao = useMemo(() => {
    const noHorario = new Set(eventosNoHorario(db, evento).map((e) => e.id));
    const escalas = db.evento_escala.filter((x) => x.ativo && noHorario.has(x.evento_id));
    const nomeEvento = (id: string) => db.eventos.find((e) => e.id === id)?.titulo ?? 'outro evento';
    const ondeEsta = (filtro: (x: (typeof escalas)[number]) => boolean) => {
      const x = escalas.find(filtro);
      if (!x) return null;
      return x.evento_id === evento.id ? 'já está neste evento' : `ocupado: ${nomeEvento(x.evento_id)}`;
    };
    return {
      profissional: (id: string) => ondeEsta((x) => x.profissional_id === id),
      personagem: (id: string) => ondeEsta((x) => x.personagem_id === id),
      fantasia: (id: string) => ondeEsta((x) => x.fantasia_id === id),
    };
  }, [db, evento]);

  const profissionais = db.profissionais
    .filter((p) => profissionalDisponivel(db, p) && p.funcoes.includes(funcao))
    .filter((p) => funcao !== 'artista' || !personagem
      || db.profissional_personagens.some((x) => x.profissional_id === p.id && x.personagem_id === personagem))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const fantasias = db.fantasias.filter((f) => f.personagem_id === personagem && f.situacao !== 'inativa');
  const motivoFantasia = (f: (typeof fantasias)[number]) => {
    if ((f.situacao === 'limpeza' || f.situacao === 'manutencao')
      && (!f.previsao_disponivel || antes(evento.inicio, f.previsao_disponivel))) {
      return f.situacao === 'limpeza' ? 'em limpeza' : 'em manutenção';
    }
    return ocupacao.fantasia(f.id);
  };

  // Escolhe sozinho a primeira fantasia livre do personagem
  useEffect(() => {
    const livre = db.fantasias.find((f) => f.personagem_id === personagem && f.situacao !== 'inativa' && !motivoFantasia(f));
    setFantasia(livre?.id ?? '');
  }, [personagem]);

  return (
    <Dialogo
      titulo={`Escalar para ${evento.titulo}`}
      onFechar={onFechar}
      textoSalvar="Escalar"
      validar={() => (funcao === 'artista' && !personagem ? 'Escolha o personagem.' : !profissional ? 'Escolha quem vai.'
        : !profissionais.some((p) => p.id === profissional) ? 'Este profissional não está mais disponível. Escolha outra pessoa.' : null)}
      onSalvar={() => executar(() => escalar(cliente, {
        evento_id: evento.id, profissional_id: profissional, funcao,
        personagem_id: funcao === 'artista' ? personagem : null,
        fantasia_id: funcao === 'artista' && fantasia ? fantasia : null,
        maquiar: funcao === 'artista' && maquiar,
        horario_maquiagem: funcao === 'maquiador' && horaMaquiagem ? deCampos(paraCampos(evento.inicio).data, horaMaquiagem) : null,
      }), 'Equipe atualizada.')}
    >
      <Campo rotulo="Função">
        {(id) => (
          <select id={id} value={funcao} onChange={(e) => { setFuncao(e.target.value as FuncaoEscala); setProfissional(''); }}>
            {(['artista', 'produtor', 'maquiador'] as const).map((f) => <option key={f} value={f}>{ROTULO_FUNCAO[f]}</option>)}
          </select>
        )}
      </Campo>
      {funcao === 'artista' && (
        <Campo rotulo="Personagem" obrigatorio>
          {(id) => (
            <select id={id} value={personagem} onChange={(e) => { setPersonagem(e.target.value); setProfissional(''); }}>
              <option value="">Escolha…</option>
              {db.personagens.filter((p) => p.ativo).map((p) => {
                const motivo = ocupacao.personagem(p.id);
                return <option key={p.id} value={p.id} disabled={!!motivo}>{p.nome}{motivo ? ` (${motivo})` : ''}</option>;
              })}
            </select>
          )}
        </Campo>
      )}
      <Campo
        rotulo={funcao === 'artista' ? 'Artista' : funcao === 'produtor' ? 'Quem produz' : 'Quem maquia'} obrigatorio
        dica={profissional
          ? `Disponibilidade informada: ${disponibilidadeNoEvento(db, profissional, evento.inicio, evento.fim).toLowerCase()}.`
          : funcao === 'artista' && personagem && !profissionais.length ? 'Nenhum artista ativo está cadastrado para este personagem.' : undefined}
      >
        {(id) => (
          <select id={id} value={profissional} onChange={(e) => setProfissional(e.target.value)} disabled={funcao === 'artista' && !personagem}>
            <option value="">Escolha…</option>
            {profissionais.map((p) => {
              const motivo = ocupacao.profissional(p.id);
              const disponibilidade = disponibilidadeNoEvento(db, p.id, evento.inicio, evento.fim);
              return <option key={p.id} value={p.id} disabled={!!motivo}>{p.nome}{motivo ? ` (${motivo})` : ` (${disponibilidade})`}</option>;
            })}
          </select>
        )}
      </Campo>
      {funcao === 'artista' && personagem && (
        <Campo rotulo="Fantasia" dica={fantasias.length ? undefined : 'Nenhuma fantasia cadastrada para este personagem.'}>
          {(id) => (
            <select id={id} value={fantasia} onChange={(e) => setFantasia(e.target.value)}>
              <option value="">Sem fantasia definida</option>
              {fantasias.map((f) => {
                const motivo = motivoFantasia(f);
                return <option key={f.id} value={f.id} disabled={!!motivo}>{f.identificacao} · {f.tamanho ?? 'único'}{motivo ? ` (${motivo})` : ''}</option>;
              })}
            </select>
          )}
        </Campo>
      )}
      {funcao === 'artista' && evento.tem_maquiagem && <Marcador texto="Vai ser maquiado(a)" marcado={maquiar} onMudar={setMaquiar} />}
      {funcao === 'maquiador' && (
        <Campo rotulo="Horário da maquiagem">{(id) => <input id={id} type="time" value={horaMaquiagem} onChange={(e) => setHoraMaquiagem(e.target.value)} />}</Campo>
      )}
    </Dialogo>
  );
}

export function FormTirarDaEscala({ escalaId, nome, onFechar }: { escalaId: string; nome: string; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  return (
    <Dialogo
      titulo={`Tirar ${nome} da equipe?`} onFechar={onFechar} perigo textoSalvar="Tirar da equipe"
      onSalvar={() => executar(() => tirarDaEscala(cliente, escalaId), `${nome} saiu da equipe.`)}
    >
      <p style={{ margin: 0 }}>A vaga fica no histórico e a pessoa recebe o aviso. Valores pendentes e reservas de veículo do evento serão cancelados; pagamentos já realizados e outros eventos permanecem no histórico.</p>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------
// Remarcar e cancelar
// ---------------------------------------------------------------------

export function FormRemarcar({ evento, onFechar }: { evento: Evento; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  const atual = paraCampos(evento.inicio);
  const [data, setData] = useState(atual.data);
  const [horaInicio, setHoraInicio] = useState(atual.hora);
  const [horaFim, setHoraFim] = useState(paraCampos(evento.fim).hora);
  const [motivo, setMotivo] = useState('');

  return (
    <Dialogo
      titulo={`Remarcar ${evento.titulo}`} onFechar={onFechar} textoSalvar="Remarcar"
      validar={() => validarHorario(data, horaInicio, horaFim)
        ?? (!motivo.trim() ? 'Informe o motivo da remarcação.' : null)
        ?? (deCampos(data, horaInicio) === evento.inicio && deCampos(data, horaFim) === evento.fim ? 'A data e o horário são os mesmos de hoje.' : null)}
      onSalvar={() => executar(
        () => remarcarEvento(cliente, evento.id, deCampos(data, horaInicio), deCampos(data, horaFim), motivo.trim()),
        'Evento remarcado. A equipe recebe o aviso.',
      )}
    >
      <p className="suave" style={{ margin: 0 }}>Hoje: {diaCurto(evento.inicio)}, {hora(evento.inicio)} às {hora(evento.fim)}. A equipe continua escalada se estiver livre na nova data; se alguém tiver outro evento no horário, o banco recusa e avisa.</p>
      <Linha>
        <Campo rotulo="Nova data" obrigatorio>{(id) => <input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} required />}</Campo>
        <Campo rotulo="Início" obrigatorio>{(id) => <input id={id} type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />}</Campo>
        <Campo rotulo="Fim" obrigatorio>{(id) => <input id={id} type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />}</Campo>
      </Linha>
      <Campo rotulo="Motivo" obrigatorio>{(id) => <textarea id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} required rows={3} />}</Campo>
      <small className="suave">A reserva do veículo não muda sozinha: confira o transporte depois.</small>
    </Dialogo>
  );
}

export function FormCancelar({ evento, onFechar }: { evento: Evento; onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  const [motivo, setMotivo] = useState('');
  return (
    <Dialogo
      titulo={`Cancelar ${evento.titulo}?`} onFechar={onFechar} perigo textoSalvar="Cancelar evento"
      validar={() => (!motivo.trim() ? 'Informe o motivo do cancelamento.' : null)}
      onSalvar={() => executar(() => cancelarEvento(cliente, evento.id, motivo.trim()), 'Evento cancelado. Equipe, personagens e veículo foram liberados.')}
    >
      <p style={{ margin: 0 }}>O evento sai do calendário, a equipe é avisada e personagens, fantasias e veículo ficam livres. <strong>Um evento cancelado não pode ser reaberto</strong>: se o cliente voltar atrás, crie um evento novo.</p>
      <Campo rotulo="Motivo" obrigatorio>{(id) => <textarea id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} required rows={3} />}</Campo>
    </Dialogo>
  );
}
