import { useEffect, useMemo, useState } from 'react';
import { Dialogo } from './Formulario';
import { Icone } from './Icone';
import { useEstado } from '../lib/estado';
import { chaveDia, dataCurta, diaSemanaDaChave, paraCampos, somarDias } from '../lib/formato';
import { salvarDisponibilidadeSemanal } from '../lib/acoes';
import type { BaseDados } from '../lib/tipos';

const NOMES_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const SIGLAS_DIAS = ['2ª', '3ª', '4ª', '5ª', '6ª', 'SÁ', 'DO'];

export function inicioSemanaAtual() {
  const hoje = chaveDia(new Date().toISOString());
  const dia = diaSemanaDaChave(hoje);
  return somarDias(hoje, -((dia + 6) % 7));
}

function linhasDaSemana(db: BaseDados, profissionalId: string, semanaInicio: string) {
  return db.disponibilidade_semanal.filter((linha) =>
    linha.profissional_id === profissionalId && linha.semana_inicio === semanaInicio,
  );
}

interface DiaEditavel {
  dia: number;
  disponivel: boolean | null;
  hora_inicio: string;
  hora_fim: string;
}

function ModalDisponibilidade({ onFechar }: { onFechar: () => void }) {
  const { db, usuario, cliente, executar } = useEstado();
  const semanaInicio = inicioSemanaAtual();
  const existentes = useMemo(() => linhasDaSemana(db, usuario.profissionalId ?? '', semanaInicio), [db, usuario.profissionalId, semanaInicio]);
  const [dias, setDias] = useState<DiaEditavel[]>(() => Array.from({ length: 7 }, (_, i) => {
    const existente = existentes.find((linha) => linha.dia === i + 1);
    return {
      dia: i + 1,
      disponivel: existente?.disponivel ?? null,
      hora_inicio: existente?.hora_inicio?.slice(0, 5) ?? '',
      hora_fim: existente?.hora_fim?.slice(0, 5) ?? '',
    };
  }));
  const [observacoes, setObservacoes] = useState(() => existentes.find((linha) => linha.observacoes)?.observacoes ?? '');
  const tituloSemana = `${dataCurta(semanaInicio)} a ${dataCurta(somarDias(semanaInicio, 6))}`;

  function atualizarDia(indice: number, patch: Partial<DiaEditavel>) {
    setDias((atuais) => atuais.map((dia) => dia.dia === indice ? { ...dia, ...patch } : dia));
  }

  function validar() {
    if (dias.some((dia) => dia.disponivel === null)) return 'Marque disponível ou indisponível para cada dia.';
    if (dias.some((dia) => dia.disponivel && (!!dia.hora_inicio !== !!dia.hora_fim))) return 'Preencha os dois horários ou deixe ambos em branco.';
    if (dias.some((dia) => dia.disponivel && dia.hora_inicio && dia.hora_fim && dia.hora_inicio >= dia.hora_fim)) return 'O horário final precisa ser depois do inicial.';
    return null;
  }

  return (
    <Dialogo
      titulo="Disponibilidade da semana"
      className="disponibilidade-dialogo"
      onFechar={onFechar}
      textoSalvar="Salvar semana"
      validar={validar}
      onSalvar={() => executar(() => salvarDisponibilidadeSemanal(cliente, semanaInicio, dias.map((dia) => ({
        dia: dia.dia,
        disponivel: dia.disponivel === true,
        hora_inicio: dia.disponivel ? dia.hora_inicio || null : null,
        hora_fim: dia.disponivel ? dia.hora_fim || null : null,
        observacoes: observacoes.trim() || null,
      }))), 'Disponibilidade semanal salva.')}
    >
      <p className="suave disponibilidade-instrucao">Informe quando pode trabalhar nesta semana ({tituloSemana}). Se deixar os horários vazios, indicará o dia todo.</p>
      <div className="disponibilidade-atalhos">
        <button type="button" className="botao pequeno" onClick={() => setDias((atuais) => atuais.map((dia) => ({ ...dia, disponivel: true })))}>Marcar todos disponíveis</button>
        <button type="button" className="botao pequeno" onClick={() => setDias((atuais) => atuais.map((dia) => ({ ...dia, disponivel: false, hora_inicio: '', hora_fim: '' })))}>Indisponível a semana toda</button>
      </div>
      <div className="disponibilidade-dias">
        {dias.map((dia) => {
          const data = somarDias(semanaInicio, dia.dia - 1);
          const hoje = diaSemanaDaChave(chaveDia(new Date().toISOString())) === diaSemanaDaChave(data) && data === chaveDia(new Date().toISOString());
          return (
            <section key={dia.dia} className={`disponibilidade-dia${hoje ? ' hoje' : ''}`}>
              <header><strong>{NOMES_DIAS[dia.dia - 1]}</strong><small>{dataCurta(data)}{hoje ? ' · hoje' : ''}</small></header>
              <div className="disponibilidade-opcoes" role="group" aria-label={`${NOMES_DIAS[dia.dia - 1]}: disponibilidade`}>
                <button type="button" aria-pressed={dia.disponivel === true} className={dia.disponivel === true ? 'selecionado' : ''} onClick={() => atualizarDia(dia.dia, { disponivel: true })}>Disponível</button>
                <button type="button" aria-pressed={dia.disponivel === false} className={dia.disponivel === false ? 'selecionado' : ''} onClick={() => atualizarDia(dia.dia, { disponivel: false, hora_inicio: '', hora_fim: '' })}>Indisponível</button>
              </div>
              {dia.disponivel && <div className="disponibilidade-horarios">
                <label>Das <input type="time" aria-label={`Horário inicial de ${NOMES_DIAS[dia.dia - 1]}`} value={dia.hora_inicio} onChange={(e) => atualizarDia(dia.dia, { hora_inicio: e.target.value })} /></label>
                <label>às <input type="time" aria-label={`Horário final de ${NOMES_DIAS[dia.dia - 1]}`} value={dia.hora_fim} onChange={(e) => atualizarDia(dia.dia, { hora_fim: e.target.value })} /></label>
                <small>Opcional</small>
              </div>}
            </section>
          );
        })}
      </div>
      <label className="disponibilidade-observacoes">
        <span>Observação da semana <small>Opcional</small></span>
        <textarea value={observacoes} maxLength={500} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: só consigo trabalhar na região central." rows={2} />
      </label>
    </Dialogo>
  );
}

export function LembreteDisponibilidadeSemanal() {
  const { db, usuario } = useEstado();
  const profissionalId = usuario.profissionalId;
  const semanaInicio = inicioSemanaAtual();
  const respondeu = profissionalId ? linhasDaSemana(db, profissionalId, semanaInicio).length === 7 : true;
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!profissionalId || respondeu) return;
    const chave = `disponibilidade-semanal:${usuario.id}:${semanaInicio}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, 'aberto');
    } catch { /* O lembrete continua acessível pelo botão da página. */ }
    setModal(true);
  }, [profissionalId, respondeu, usuario.id, semanaInicio]);

  if (!profissionalId || respondeu) return null;
  return <>
    <aside className="disponibilidade-lembrete">
      <span className="disponibilidade-lembrete-icone"><Icone nome="calendario" tamanho={19} /></span>
      <div><strong>Conte à equipe quando você pode trabalhar</strong><small>Preencha sua disponibilidade para esta semana. Você pode alterar depois.</small></div>
      <button type="button" className="botao primario pequeno" onClick={() => setModal(true)}>Informar agora</button>
    </aside>
    {modal && <ModalDisponibilidade onFechar={() => setModal(false)} />}
  </>;
}

export function EditorDisponibilidadeConta() {
  const { db, usuario } = useEstado();
  const [modal, setModal] = useState(false);
  if (!usuario.profissionalId) return null;
  const semana = inicioSemanaAtual();
  const linhas = linhasDaSemana(db, usuario.profissionalId, semana).sort((a, b) => a.dia - b.dia);
  return <section className="cartao conta-disponibilidade" id="disponibilidade-semanal">
    <div className="cartao-topo"><div><h2>Disponibilidade semanal</h2><p>Semana {dataCurta(semana)} a {dataCurta(somarDias(semana, 6))}. A gestão usa sua resposta ao montar as escalas.</p></div><span className={`selo ${linhas.length === 7 ? 'ok' : 'alerta'}`}>{linhas.length === 7 ? 'Informada' : 'Pendente'}</span></div>
    <div className="conta-disponibilidade-dias">
      {NOMES_DIAS.map((nome, indice) => {
        const linha = linhas.find((item) => item.dia === indice + 1);
        const texto = !linha ? 'Sem resposta' : !linha.disponivel ? 'Indisponível' : linha.hora_inicio && linha.hora_fim ? `${linha.hora_inicio.slice(0, 5)}–${linha.hora_fim.slice(0, 5)}` : 'O dia todo';
        const curto = !linha ? '—' : !linha.disponivel ? 'Não' : linha.hora_inicio && linha.hora_fim ? `${linha.hora_inicio.slice(0, 5)}–${linha.hora_fim.slice(0, 5)}` : 'Todo';
        return <div key={nome}><strong>{SIGLAS_DIAS[indice]}</strong><span title={texto} className={!linha ? 'pendente' : linha.disponivel ? 'disponivel' : 'indisponivel'}>{curto}</span></div>;
      })}
    </div>
    <button type="button" className="botao" onClick={() => setModal(true)}>{linhas.length === 7 ? 'Alterar esta semana' : 'Preencher esta semana'}</button>
    {modal && <ModalDisponibilidade onFechar={() => setModal(false)} />}
  </section>;
}

export function ResumoDisponibilidadeEquipe() {
  const { db, permissoes } = useEstado();
  if (!permissoes.operacao) return null;
  const semana = inicioSemanaAtual();
  const profissionais = db.profissionais.filter((p) => p.ativo && !p.excluido_em && p.usuario_id
    && db.usuarios.some((u) => u.id === p.usuario_id && u.ativo)).sort((a, b) => a.nome.localeCompare(b.nome));
  const respostas = profissionais.filter((p) => linhasDaSemana(db, p.id, semana).length === 7).length;
  return <details className="cartao resumo-disponibilidade">
    <summary><span><strong>Disponibilidade desta semana</strong><small>{respostas} de {profissionais.length} profissionais responderam</small></span><Icone nome="direita" tamanho={17} /></summary>
    <div className="resumo-disponibilidade-lista">
      {profissionais.map((profissional) => {
        const linhas = linhasDaSemana(db, profissional.id, semana);
        const concluiu = linhas.length === 7;
        return <div className="resumo-disponibilidade-pessoa" key={profissional.id}>
          <strong>{profissional.nome}</strong>
          <div className="resumo-disponibilidade-dias" aria-label={`Disponibilidade de ${profissional.nome}`}>
            {SIGLAS_DIAS.map((sigla, indice) => {
              const linha = linhas.find((item) => item.dia === indice + 1);
              const estado = !linha ? 'pendente' : linha.disponivel ? 'disponivel' : 'indisponivel';
              const descricao = !linha ? 'Sem resposta' : !linha.disponivel ? 'Indisponível' : linha.hora_inicio && linha.hora_fim ? `Disponível das ${linha.hora_inicio.slice(0, 5)} às ${linha.hora_fim.slice(0, 5)}` : 'Disponível o dia todo';
              return <span key={sigla} className={estado} title={`${NOMES_DIAS[indice]}: ${descricao}`} aria-label={`${NOMES_DIAS[indice]}: ${descricao}`}>{sigla}</span>;
            })}
          </div>
          <span className={`selo ${concluiu ? 'ok' : 'alerta'}`}>{concluiu ? 'Informada' : 'Pendente'}</span>
        </div>;
      })}
      {!profissionais.length && <p className="suave">Nenhum profissional com acesso ativo pode responder esta semana.</p>}
    </div>
    <small className="suave resumo-disponibilidade-legenda">Verde: disponível · Cinza: indisponível · Laranja: sem resposta</small>
  </details>;
}

export function disponibilidadeNoEvento(db: BaseDados, profissionalId: string, inicio: string, fim: string) {
  const data = chaveDia(inicio);
  const semana = somarDias(data, -((diaSemanaDaChave(data) + 6) % 7));
  const indiceDia = diaSemanaDaChave(data) || 7;
  const linha = db.disponibilidade_semanal.find((item) => item.profissional_id === profissionalId
    && item.semana_inicio === semana && item.dia === indiceDia);
  if (!linha) return 'Sem resposta';
  if (!linha.disponivel) return 'Indisponível';
  if (!linha.hora_inicio || !linha.hora_fim) return 'Disponível';
  const inicioEvento = paraCampos(inicio);
  const fimEvento = paraCampos(fim);
  if (inicioEvento.data !== fimEvento.data) return 'Confirmar horário';
  const minutos = (hora: string) => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  };
  return minutos(inicioEvento.hora) >= minutos(linha.hora_inicio)
    && minutos(fimEvento.hora) <= minutos(linha.hora_fim) ? 'Disponível' : 'Fora do horário';
}
