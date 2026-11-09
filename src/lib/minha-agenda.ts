import type { BaseDados } from './tipos';

/** Filtra pelo vínculo pessoal mesmo quando o login possui outras funções. */
export function minhaAgenda(db: BaseDados, profissionalId: string | null, hoje: string) {
  const escalas = profissionalId ? db.evento_escala.filter(e => e.profissional_id === profissionalId) : [];
  const pagamentos = profissionalId ? db.pagamentos_profissionais.filter(p => p.profissional_id === profissionalId) : [];
  const agora = new Date(hoje).getTime();
  const proximos = db.eventos.filter(e => e.situacao !== 'cancelado' && e.situacao !== 'realizado'
    && new Date(e.fim).getTime() > agora && escalas.some(s => s.evento_id === e.id && s.ativo))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const historico = db.eventos.filter(e => escalas.some(s => s.evento_id === e.id)
    && (e.situacao === 'realizado' || e.situacao === 'cancelado' || new Date(e.fim).getTime() <= agora))
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  const somar = (situacao: 'pago' | 'pendente') => pagamentos.filter(p => p.situacao === situacao)
    .reduce((total, p) => total + Math.round(Number(p.valor_combinado) * 100), 0) / 100;
  return { escalas, pagamentos, proximos, historico, aReceber: somar('pendente'), recebido: somar('pago') };
}
