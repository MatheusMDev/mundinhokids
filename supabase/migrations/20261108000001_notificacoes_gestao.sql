-- Avisos específicos para Direção e Gerente.
alter table notificacoes drop constraint if exists notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario'));

alter table notificacao_preferencias drop constraint if exists notificacao_preferencias_tipo_check;
alter table notificacao_preferencias add constraint notificacao_preferencias_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario'));

create index notificacoes_gestao_idx on notificacoes (usuario_id, tipo, criado_em desc);

create function notificar_gestao(p_tipo text, p_evento_id uuid, p_mensagem text) returns void
language sql security definer set search_path = public as $$
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select id, p_evento_id, p_tipo, p_mensagem
  from usuarios
  where ativo and perfil in ('diretora', 'gerente');
$$;

create function notificar_despesa_gestao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.aprovacao = 'pendente'
     and (tg_op = 'INSERT' or old.aprovacao is distinct from new.aprovacao) then
    perform notificar_gestao(
      'despesa_aprovacao', new.evento_id,
      'Despesa aguardando aprovação: ' || coalesce(new.descricao, 'sem descrição')
    );
  end if;
  return new;
end;
$$;

create trigger despesa_notificar_gestao after insert or update of aprovacao on despesas
  for each row execute function notificar_despesa_gestao();

create function notificar_evento_gestao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    perform notificar_gestao('evento_gestao', new.id, 'Evento cancelado: ' || new.titulo);
  elsif new.periodo is distinct from old.periodo then
    perform notificar_gestao('evento_gestao', new.id, 'Evento remarcado: ' || new.titulo);
  end if;
  return new;
end;
$$;

create trigger evento_notificar_gestao after update of situacao, inicio, fim on eventos
  for each row execute function notificar_evento_gestao();

-- A regra inicial de pendência é evento nas próximas 48h sem nenhuma pessoa ativa.
create function gerar_notificacoes_gestao() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select u.id, e.id, 'pendencia_operacional',
         'Evento sem equipe escalada nas próximas 48 horas: ' || e.titulo
  from usuarios u
  cross join eventos e
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and e.situacao not in ('cancelado', 'realizado')
    and e.inicio between now() and now() + interval '48 hours'
    and not exists (select 1 from evento_escala es where es.evento_id = e.id and es.ativo)
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.evento_id = e.id and n.tipo = 'pendencia_operacional'
        and n.criado_em >= date_trunc('day', now())
    );

  insert into notificacoes (usuario_id, tipo, mensagem)
  select u.id, 'resumo_diario',
         'Resumo diário: ' || count(e.id)::text || ' evento(s) previsto(s) para os próximos 7 dias.'
  from usuarios u
  left join eventos e on e.situacao not in ('cancelado', 'realizado')
                       and e.inicio between now() and now() + interval '7 days'
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.tipo = 'resumo_diario'
        and n.criado_em >= date_trunc('day', now())
    )
  group by u.id;
end;
$$;
