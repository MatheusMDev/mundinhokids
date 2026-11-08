import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@mundinhokids.com.br',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const cabecalhos: Record<string, string> = {
  escalado: 'Você foi escalado',
  lembrete: 'Lembrete de evento',
  alterado: 'Evento alterado',
  cancelado: 'Evento cancelado',
  removido: 'Você saiu da escala',
  substituicao: 'Atualização de troca',
  despesa_aprovacao: 'Despesa aguardando aprovação',
  evento_gestao: 'Mudança em evento',
  pendencia_operacional: 'Pendência operacional',
  resumo_diario: 'Resumo diário',
};

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405);

  await supabase.rpc('gerar_notificacoes_gestao');

  const { data: notificacoes, error } = await supabase
    .from('notificacoes')
    .select('id, usuario_id, evento_id, tipo, mensagem, eventos(titulo)')
    .is('enviada_em', null)
    .lte('agendada_para', new Date().toISOString())
    .order('agendada_para')
    .limit(100);
  if (error) return resposta({ erro: error.message }, 500);

  let enviadas = 0;
  let ignoradas = 0;
  for (const notificacao of notificacoes ?? []) {
    const [{ data: inscricoes }, { data: preferencias }] = await Promise.all([
      supabase.from('push_inscricoes').select('id, endpoint, p256dh, auth').eq('usuario_id', notificacao.usuario_id),
      supabase.from('notificacao_preferencias').select('tipo, ativa').eq('usuario_id', notificacao.usuario_id).eq('tipo', notificacao.tipo),
    ]);
    if (preferencias?.[0]?.ativa === false) {
      await supabase.from('notificacoes').update({ enviada_em: new Date().toISOString() }).eq('id', notificacao.id);
      ignoradas++;
      continue;
    }
    if (!inscricoes?.length) continue;

    const tituloEvento = (notificacao.eventos as { titulo?: string } | null)?.titulo ?? '';
    const payload = JSON.stringify({
      title: cabecalhos[notificacao.tipo] ?? 'Mundinho Kids',
      body: notificacao.mensagem ?? (tituloEvento ? `${cabecalhos[notificacao.tipo] ?? 'Novo aviso'}: ${tituloEvento}` : 'Você tem um novo aviso.'),
      tag: notificacao.id,
      url: notificacao.evento_id ? `/eventos/${notificacao.evento_id}` : '/notificacoes',
    });
    let entregue = false;
    const erros: string[] = [];
    for (const inscricao of inscricoes) {
      try {
        await webpush.sendNotification({ endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } }, payload);
        entregue = true;
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from('push_inscricoes').delete().eq('id', inscricao.id);
        erros.push(status ? `HTTP ${status}` : String(erro));
      }
    }
    if (entregue) {
      await supabase.from('notificacoes').update({ enviada_em: new Date().toISOString(), erro: erros.length ? erros.join('; ') : null }).eq('id', notificacao.id);
      enviadas++;
    } else if (erros.length) {
      await supabase.from('notificacoes').update({ erro: erros.join('; ') }).eq('id', notificacao.id);
    }
  }

  return resposta({ processadas: notificacoes?.length ?? 0, enviadas, ignoradas });
});
