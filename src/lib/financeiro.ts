import type { BaseDados } from './tipos';
import { eventosOrdenados, financeiroDoEvento } from './consultas';

/** Consolida os registros existentes; não depende dos filtros de apresentação. */
export function resumoDoFinanceiro(db: BaseDados) {
  const eventos = eventosOrdenados(db).filter((e) => e.situacao !== 'cancelado'
    && (db.evento_financeiro.some((f) => f.evento_id === e.id)
      || db.pagamentos_profissionais.some((p) => p.evento_id === e.id && !p.cancelado_em)))
    .map((evento) => {
      const financeiro = financeiroDoEvento(db, evento.id);
      const aPagar = financeiro.pagamentos.filter((p) => p.situacao === 'pendente').reduce((s, p) => s + p.valor_combinado, 0);
      return { evento, ...financeiro, aPagar };
    });
  const despesasGerais = db.despesas.filter((d) => !d.evento_id).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const adicionaisGerais = [...(db.adicionais_produtores ?? [])].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
  const pendentesAprovacao = db.despesas.filter((d) => d.aprovacao === 'pendente');
  const multasCancelamento = (db.multas_cancelamento ?? []).map((multa) => ({
    ...multa,
    evento: db.eventos.find((evento) => evento.id === multa.evento_id),
    responsavel: db.usuarios?.find((usuario) => usuario.id === multa.aplicado_por)?.nome ?? 'Gestão',
  })).sort((a, b) => b.aplicado_em.localeCompare(a.aplicado_em));
  const totais = eventos.reduce((t, r) => ({
    contratado: t.contratado + r.contratado, recebido: t.recebido + r.recebido,
    aPagar: t.aPagar + r.aPagar, despesas: t.despesas + r.despesas,
  }), { contratado: 0, recebido: 0, aPagar: 0, despesas: despesasGerais.reduce((s, d) => s + d.valor, 0) });

  const equipe = new Map<string, { id: string; nome: string; total: number; eventos: { id: string; titulo: string; valor: number }[] }>();
  for (const p of db.pagamentos_profissionais.filter((x) => x.situacao === 'pendente' && !x.cancelado_em)) {
    const atual = equipe.get(p.profissional_id)
      ?? { id: p.profissional_id, nome: db.profissionais.find((x) => x.id === p.profissional_id)?.nome ?? 'Profissional', total: 0, eventos: [] };
    atual.total += p.valor_combinado;
    atual.eventos.push({ id: p.evento_id, titulo: db.eventos.find((e) => e.id === p.evento_id)?.titulo ?? 'Evento', valor: p.valor_combinado });
    equipe.set(p.profissional_id, atual);
  }
  const pagamentosPendentes = [...equipe.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  // O indicador deve coincidir com a lista, inclusive obrigações de eventos cancelados.
  totais.aPagar = pagamentosPendentes.reduce((s, p) => s + p.total, 0);
  return { eventos, despesasGerais, adicionaisGerais, multasCancelamento, pendentesAprovacao, totais, equipe: pagamentosPendentes };
}
