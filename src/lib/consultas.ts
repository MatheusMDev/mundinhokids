// Leituras que as telas fazem sobre a base. Tudo calculado a partir das
// tabelas, sem valores fixos, para valer igual com os dados do Supabase.

import type {
  BaseDados, EscalaItem, Evento, Fantasia, FuncaoEscala, Personagem, Profissional, ReservaVeiculo, Substituicao,
} from './tipos';
import { chaveDia, diaCurto, hora, somarDias } from './formato';

export type PerfilTela = 'gerente' | 'assistente' | 'equipe';

export const veValores = (perfil: PerfilTela) => perfil === 'gerente' || perfil === 'assistente';

export const ROTULO_FUNCAO: Record<FuncaoEscala, string> = {
  artista: 'Artista',
  produtor: 'Produção',
  maquiador: 'Maquiagem',
};

export const ROTULO_SITUACAO: Record<Evento['situacao'], string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

const porId = <T extends { id: string }>(lista: T[], id: string | null) =>
  id ? lista.find((x) => x.id === id) : undefined;

export const eventoPorId = (db: BaseDados, id: string) => porId(db.eventos, id);
export const localDe = (db: BaseDados, e: Evento) => porId(db.locais, e.local_id);
export const contratanteDe = (db: BaseDados, e: Evento) => porId(db.contratantes, e.contratante_id);

/** Não filtrar a base histórica: esta regra vale apenas para novas seleções. */
export const profissionalDisponivel = (db: BaseDados, p: Profissional) =>
  !p.excluido_em && p.ativo && db.profissionais_disponiveis.includes(p.id);

export function eventosOrdenados(db: BaseDados): Evento[] {
  return [...db.eventos].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function eventosDoDia(db: BaseDados, chave: string): Evento[] {
  return eventosOrdenados(db).filter((e) => e.situacao !== 'cancelado' && chaveDia(e.inicio) === chave);
}

/** Eventos de hoje até hoje + (dias - 1), sem os realizados e cancelados */
export function proximosEventos(db: BaseDados, hojeIso: string, dias = 7): Evento[] {
  const inicio = chaveDia(hojeIso);
  const fim = somarDias(inicio, dias - 1);
  return eventosOrdenados(db).filter((e) => {
    const dia = chaveDia(e.inicio);
    return dia >= inicio && dia <= fim && (e.situacao === 'agendado' || e.situacao === 'confirmado');
  });
}

// ---------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------

export interface MembroEquipe {
  escala: EscalaItem;
  profissional: Profissional | undefined;
  personagem: Personagem | undefined;
  fantasia: Fantasia | undefined;
  troca: Substituicao | undefined;
}

const ORDEM_FUNCAO: Record<FuncaoEscala, number> = { artista: 0, produtor: 1, maquiador: 2 };

export function equipeDoEvento(db: BaseDados, eventoId: string): MembroEquipe[] {
  return db.evento_escala
    .filter((x) => x.evento_id === eventoId && x.ativo)
    .sort((a, b) => ORDEM_FUNCAO[a.funcao] - ORDEM_FUNCAO[b.funcao])
    .map((escala) => ({
      escala,
      profissional: porId(db.profissionais, escala.profissional_id),
      personagem: porId(db.personagens, escala.personagem_id),
      fantasia: porId(db.fantasias, escala.fantasia_id),
      troca: db.substituicoes.find(
        (s) => s.escala_id === escala.id && (s.situacao === 'aguardando_aceite' || s.situacao === 'aguardando_aprovacao'),
      ),
    }));
}

/** Um evento futuro ou cancelado não conta; só uma escala ativa em evento realizado conta. */
export function ehPrimeiroEventoDoArtista(db: BaseDados, eventoId: string, profissionalId: string): boolean {
  const evento = eventoPorId(db, eventoId);
  if (!evento || evento.situacao === 'cancelado') return false;
  const estaNaEscala = db.evento_escala.some((escala) => escala.ativo
    && escala.evento_id === eventoId && escala.funcao === 'artista' && escala.profissional_id === profissionalId);
  if (!estaNaEscala) return false;
  return !db.evento_escala.some((escala) => {
    if (!escala.ativo || escala.funcao !== 'artista' || escala.profissional_id !== profissionalId || escala.evento_id === eventoId) return false;
    const anterior = eventoPorId(db, escala.evento_id);
    return !!anterior && anterior.situacao === 'realizado' && new Date(anterior.inicio) < new Date(evento.inicio);
  });
}

/** "Maquia os 2 artistas · 14h" */
export function descricaoMaquiagem(db: BaseDados, evento: Evento, membro: Pick<MembroEquipe, 'escala'>): string {
  const quantos = evento.maquiagem_pessoas
    || db.evento_escala.filter((x) => x.evento_id === evento.id && x.ativo && x.maquiar).length;
  const quando = membro.escala.horario_maquiagem ? ` · ${hora(membro.escala.horario_maquiagem)}` : '';
  return `Maquia ${quantos === 1 ? '1 pessoa' : `${quantos} pessoas`}${quando}`;
}

// ---------------------------------------------------------------------
// Trocas
// ---------------------------------------------------------------------

export interface TrocaPendente {
  troca: Substituicao;
  evento: Evento;
  solicitante: Profissional | undefined;
  substituto: Profissional | undefined;
  personagem: Personagem | undefined;
  semConflito: boolean;
}

export function trocasPendentes(db: BaseDados, eventoId?: string): TrocaPendente[] {
  return db.substituicoes
    .filter((s) => s.situacao === 'aguardando_aceite' || s.situacao === 'aguardando_aprovacao')
    .flatMap((troca) => {
      const escala = db.evento_escala.find((x) => x.id === troca.escala_id);
      const evento = escala && porId(db.eventos, escala.evento_id);
      if (!escala || !evento || (eventoId && evento.id !== eventoId)) return [];
      return [{
        troca, evento,
        solicitante: porId(db.profissionais, troca.solicitante_id),
        substituto: porId(db.profissionais, troca.substituto_id),
        personagem: porId(db.personagens, escala.personagem_id),
        semConflito: !profissionalOcupado(db, troca.substituto_id, evento, escala.id),
      }];
    });
}

const antes = (a: string, b: string) => new Date(a) < new Date(b);

function sobrepoe(aInicio: string, aFim: string, bInicio: string, bFim: string) {
  return new Date(aInicio) < new Date(bFim) && new Date(bInicio) < new Date(aFim);
}

function profissionalOcupado(db: BaseDados, profissionalId: string, evento: Evento, ignorarEscala?: string) {
  return db.evento_escala.some((x) => {
    if (!x.ativo || x.profissional_id !== profissionalId || x.id === ignorarEscala) return false;
    const outro = porId(db.eventos, x.evento_id);
    return !!outro && outro.id !== evento.id && sobrepoe(outro.inicio, outro.fim, evento.inicio, evento.fim);
  });
}

// ---------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------

export interface TransporteEvento {
  reserva: ReservaVeiculo | undefined;
  veiculoNome: string;
  responsavel: Profissional | undefined;
  /** Reserva anterior do mesmo veículo no mesmo dia (o que travou a retirada) */
  bloqueioAnterior: { reserva: ReservaVeiculo; evento: Evento | undefined } | undefined;
}

export function transporteDoEvento(db: BaseDados, evento: Evento): TransporteEvento {
  const reserva = db.reservas_veiculo.find((r) => r.evento_id === evento.id && r.ativo);
  const veiculo = porId(db.veiculos, reserva?.veiculo_id ?? db.veiculos[0]?.id ?? null);
  const referencia = reserva?.retirada ?? evento.inicio;
  const anterior = db.reservas_veiculo
    .filter((r) => r.ativo && r.id !== reserva?.id && r.veiculo_id === veiculo?.id
      && chaveDia(r.retirada) === chaveDia(referencia) && antes(r.retirada, referencia))
    .sort((a, b) => b.retirada.localeCompare(a.retirada))[0];

  return {
    reserva,
    veiculoNome: veiculo?.nome ?? 'Veículo',
    responsavel: reserva && porId(db.profissionais, reserva.responsavel_id),
    bloqueioAnterior: anterior && { reserva: anterior, evento: anterior.evento_id ? porId(db.eventos, anterior.evento_id) : undefined },
  };
}

/** Reserva do veículo que ainda está fora quando a equipe precisaria sair (1h antes) */
function veiculoBloqueadoPara(db: BaseDados, evento: Evento) {
  const saida = new Date(new Date(evento.inicio).getTime() - 60 * 60 * 1000).toISOString();
  return db.reservas_veiculo.find((r) => r.ativo && r.evento_id !== evento.id
    && sobrepoe(r.retirada, r.devolucao_prevista, saida, evento.inicio));
}

// ---------------------------------------------------------------------
// Fantasias
// ---------------------------------------------------------------------

export interface SituacaoFantasiaEvento {
  texto: string;
  tom: 'ok' | 'alerta' | 'neutro';
  detalhe: string | null;
}

export function situacaoFantasiaNoEvento(db: BaseDados, fantasia: Fantasia, evento: Evento): SituacaoFantasiaEvento {
  if (fantasia.situacao === 'limpeza' || fantasia.situacao === 'manutencao') {
    const motivo = fantasia.situacao === 'limpeza' ? 'Em limpeza' : 'Em manutenção';
    return {
      texto: fantasia.previsao_disponivel ? `${motivo} · volta ${diaCurto(fantasia.previsao_disponivel)}` : `${motivo} · sem previsão`,
      tom: 'alerta',
      detalhe: fantasia.observacoes,
    };
  }
  // Usada antes, no mesmo dia, por outro evento
  const usoAnterior = db.evento_escala
    .filter((x) => x.ativo && x.fantasia_id === fantasia.id && x.evento_id !== evento.id)
    .map((x) => porId(db.eventos, x.evento_id))
    .filter((e): e is Evento => !!e && chaveDia(e.inicio) === chaveDia(evento.inicio) && !antes(evento.inicio, e.fim))
    .sort((a, b) => b.fim.localeCompare(a.fim))[0];
  if (usoAnterior) {
    return {
      texto: `Em uso até ${diaCurto(usoAnterior.fim)}, ${hora(usoAnterior.fim)}`,
      tom: 'alerta',
      detalhe: `Volta da ${usoAnterior.titulo} antes da saída`,
    };
  }
  return { texto: 'Disponível', tom: 'ok', detalhe: fantasia.observacoes };
}

export function conferenciaDoEvento(db: BaseDados, eventoId: string): 'pendente' | 'concluida' | 'sem_fantasias' {
  const fantasias = equipeDoEvento(db, eventoId).flatMap((m) => (m.fantasia ? [m.fantasia.id] : []));
  if (!fantasias.length) return 'sem_fantasias';
  const conferidas = new Set(db.conferencias_fantasia.filter((c) => c.evento_id === eventoId).map((c) => c.fantasia_id));
  return fantasias.every((id) => conferidas.has(id)) ? 'concluida' : 'pendente';
}

// ---------------------------------------------------------------------
// Financeiro (só gestão)
// ---------------------------------------------------------------------

export function financeiroDoEvento(db: BaseDados, eventoId: string) {
  const contratado = db.evento_financeiro.find((f) => f.evento_id === eventoId)?.valor_contratado ?? 0;
  const recebido = db.recebimentos.filter((r) => r.evento_id === eventoId).reduce((s, r) => s + r.valor, 0);
  const situacao: 'pendente' | 'parcial' | 'pago' = recebido === 0 ? 'pendente' : recebido < contratado ? 'parcial' : 'pago';
  const pagamentos = db.pagamentos_profissionais
    .filter((p) => p.evento_id === eventoId && !p.cancelado_em)
    .map((p) => ({ ...p, profissional: porId(db.profissionais, p.profissional_id) }));
  const despesas = db.despesas.filter((d) => d.evento_id === eventoId).reduce((s, d) => s + d.valor, 0);
  return { contratado, recebido, situacao, pagamentos, despesas };
}

// ---------------------------------------------------------------------
// Pendências da semana
// ---------------------------------------------------------------------

export type TipoPendencia = 'troca' | 'veiculo' | 'escala' | 'fantasia' | 'conferencia';

export interface Pendencia {
  tipo: TipoPendencia;
  rotulo: string;
  titulo: string;
  texto: string;
  eventoId: string;
}

const tituloComDia = (e: Evento) => `${e.titulo} · ${diaCurto(e.inicio)}, ${hora(e.inicio)}`;

/**
 * Eventos que já terminaram (nos últimos dias) com fantasias ainda sem conferência.
 * Só faz sentido para quem lê as conferências (operação e responsável pelas fantasias).
 */
export function conferenciasPendentes(db: BaseDados, hojeIso: string, dias = 30) {
  const limite = new Date(new Date(hojeIso).getTime() - dias * 86_400_000);
  return eventosOrdenados(db)
    .filter((e) => e.situacao !== 'cancelado' && new Date(e.fim) < new Date(hojeIso) && new Date(e.fim) >= limite)
    .map((evento) => {
      const fantasias = [...new Set(equipeDoEvento(db, evento.id).flatMap((m) => (m.fantasia ? [m.fantasia.id] : [])))];
      const conferidas = new Set(db.conferencias_fantasia.filter((c) => c.evento_id === evento.id).map((c) => c.fantasia_id));
      return { evento, faltam: fantasias.filter((id) => !conferidas.has(id)).length };
    })
    .filter((x) => x.faltam > 0)
    .reverse();
}

export function pendenciasDaSemana(db: BaseDados, hojeIso: string, verConferencias = false): Pendencia[] {
  const eventos = proximosEventos(db, hojeIso);
  const lista: Pendencia[] = [];

  for (const t of trocasPendentes(db)) {
    if (!eventos.some((e) => e.id === t.evento.id)) continue;
    const aceitou = t.troca.situacao === 'aguardando_aprovacao';
    lista.push({
      tipo: 'troca', rotulo: aceitou ? 'Troca para aprovar' : 'Troca aguardando aceite',
      titulo: tituloComDia(t.evento),
      texto: `${primeiroNome(t.solicitante)} indicou ${primeiroNome(t.substituto)} para o ${t.personagem?.nome ?? 'personagem'}.${aceitou ? ` ${primeiroNome(t.substituto)} já aceitou.` : ''}`,
      eventoId: t.evento.id,
    });
  }

  for (const e of eventos) {
    const equipe = equipeDoEvento(db, e.id);
    const temProdutor = equipe.some((m) => m.escala.funcao === 'produtor');
    if (temProdutor && !db.reservas_veiculo.some((r) => r.evento_id === e.id && r.ativo)) {
      const bloqueio = veiculoBloqueadoPara(db, e);
      const veiculo = porId(db.veiculos, bloqueio?.veiculo_id ?? db.veiculos[0]?.id ?? null);
      const outro = bloqueio?.evento_id ? porId(db.eventos, bloqueio.evento_id) : undefined;
      lista.push({
        tipo: 'veiculo', rotulo: 'Sem veículo', titulo: tituloComDia(e),
        texto: bloqueio
          ? `A ${veiculo?.nome ?? 'van'} está bloqueada até as ${hora(bloqueio.devolucao_prevista)}${outro ? ` pela ${outro.titulo}` : ''}. Defina outro transporte.`
          : 'O produtor ainda não reservou o veículo.',
        eventoId: e.id,
      });
    }

    if (e.tem_maquiagem && !equipe.some((m) => m.escala.funcao === 'maquiador')) {
      const quantos = e.maquiagem_pessoas || equipe.filter((m) => m.escala.maquiar).length;
      lista.push({
        tipo: 'escala', rotulo: 'Escala incompleta', titulo: tituloComDia(e),
        texto: `Falta escalar quem faz a maquiagem para ${quantos === 1 ? '1 pessoa' : `${quantos} pessoas`}.`,
        eventoId: e.id,
      });
    }

    for (const m of equipe) {
      const f = m.fantasia;
      if (f && (f.situacao === 'limpeza' || f.situacao === 'manutencao')) {
        lista.push({
          tipo: 'fantasia', rotulo: f.situacao === 'limpeza' ? 'Fantasia em limpeza' : 'Fantasia em manutenção',
          titulo: `${f.identificacao} · tamanho ${f.tamanho ?? 'único'}`,
          texto: `${f.previsao_disponivel ? `Volta ${f.situacao === 'limpeza' ? 'da limpeza' : 'da manutenção'} na ${diaCurto(f.previsao_disponivel)}. ` : 'Sem previsão de volta. '}Reservada para a ${e.titulo}.`,
          eventoId: e.id,
        });
      }
    }
  }

  if (verConferencias) {
    for (const { evento, faltam } of conferenciasPendentes(db, hojeIso, 7)) {
      lista.push({
        tipo: 'conferencia', rotulo: 'Conferir fantasias', titulo: tituloComDia(evento),
        texto: `${faltam === 1 ? '1 fantasia volta' : `${faltam} fantasias voltam`} sem conferência de devolução e limpeza.`,
        eventoId: evento.id,
      });
    }
  }

  return lista;
}

export function primeiroNome(p: Profissional | undefined) {
  return p?.nome.split(' ')[0] ?? 'Alguém';
}

// ---------------------------------------------------------------------
// Números do painel
// ---------------------------------------------------------------------

export function numerosDaSemana(db: BaseDados, hojeIso: string, verConferencias = false) {
  // semana de domingo a sábado que contém hoje
  const hoje = chaveDia(hojeIso);
  const diaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const domingo = somarDias(hoje, -diaSemana);
  const sabado = somarDias(domingo, 6);
  const daSemana = db.eventos.filter((e) => {
    const dia = chaveDia(e.inicio);
    return e.situacao !== 'cancelado' && dia >= domingo && dia <= sabado;
  });
  const noSabado = daSemana.filter((e) => chaveDia(e.inicio) === sabado).length;

  const pendencias = pendenciasDaSemana(db, hojeIso, verConferencias);
  const trocas = trocasPendentes(db).filter((t) => t.troca.situacao === 'aguardando_aprovacao');
  const aPagar = new Set(db.pagamentos_profissionais
    .filter((p) => p.situacao === 'pendente' && !p.cancelado_em)
    .map((p) => p.profissional_id));

  const tipos = [...new Set(pendencias.map((p) => p.tipo))];
  const nomesTipo: Record<TipoPendencia, string> = { troca: 'troca', veiculo: 'veículo', escala: 'escala', fantasia: 'fantasia', conferencia: 'conferência' };

  return {
    eventosSemana: daSemana.length,
    eventosSabado: noSabado,
    pendencias: pendencias.length,
    tiposPendencia: juntar(tipos.map((t) => nomesTipo[t])),
    trocas: trocas.length,
    trocaDescricao: trocas[0] ? `${trocas[0].evento.titulo}, ${diaCurto(trocas[0].evento.inicio).split(' ')[0]}` : 'nenhuma no momento',
    profissionaisAPagar: aPagar.size,
  };
}

function juntar(itens: string[]) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

// ---------------------------------------------------------------------
// Histórico e avisos
// ---------------------------------------------------------------------

export function historicoDoEvento(db: BaseDados, eventoId: string, perfil: PerfilTela) {
  return db.historico
    .filter((h) => h.evento_id === eventoId && (veValores(perfil) || !h.financeiro))
    .sort((a, b) => b.em.localeCompare(a.em));
}

export function avisosDoEvento(db: BaseDados, evento: Evento) {
  const equipe = equipeDoEvento(db, evento.id).length;
  // Cada um só lê as próprias notificações: o convite aparece quando houver registro visível
  const convite = db.notificacoes.some((n) => n.evento_id === evento.id && n.tipo === 'escalado' && n.enviada_em);
  // O lembrete é agendado pelo banco com a antecedência das configurações
  const minutos = Number(db.configuracoes.lembrete_antecedencia_minutos || 120);
  const ativo = evento.situacao === 'agendado' || evento.situacao === 'confirmado';
  const lembreteEm = ativo && equipe ? new Date(new Date(evento.inicio).getTime() - minutos * 60_000).toISOString() : null;
  return { equipe, convite, lembreteEm, antecedencia: minutos / 60 };
}
