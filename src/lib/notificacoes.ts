import type { Notificacao } from './tipos';

export function textoNotificacao(notificacao: Notificacao, tituloEvento: string) {
  if (notificacao.mensagem) {
    if (notificacao.tipo === 'removido' && tituloEvento && !notificacao.mensagem.includes(tituloEvento)) {
      return `${notificacao.mensagem}: ${tituloEvento}`;
    }
    return notificacao.mensagem;
  }
  const nomes: Record<Notificacao['tipo'], string> = {
    escalado: 'Você foi escalado', lembrete: 'Lembrete de evento', alterado: 'Evento alterado',
    cancelado: 'Evento cancelado', removido: 'Você saiu da escala', substituicao: 'Atualização de troca',
    despesa_aprovacao: 'Despesa aguardando aprovação', evento_gestao: 'Mudança em evento',
    pendencia_operacional: 'Pendência operacional', resumo_diario: 'Resumo diário',
    conferencia_fantasias: 'Conferir fantasias',
  };
  return `${nomes[notificacao.tipo]}${tituloEvento ? `: ${tituloEvento}` : '.'}`;
}
