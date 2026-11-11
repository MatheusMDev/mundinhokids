-- =====================================================================
-- Mundinho Kids — aviso de conferência para quem cuida das fantasias
--
-- Quando uma festa termina e alguma fantasia usada nela ainda não foi
-- conferida (devolução, limpeza, reparo), quem cuida das fantasias recebe
-- um aviso para conferir. "Quem cuida" = login com perfil Fantasias ou
-- ligado a um profissional com a função Fantasias.
--
-- O aviso é gerado pela mesma rotina que já roda a cada 5 minutos
-- (gerar_notificacoes_gestao, chamada pela Edge Function enviar-notificacoes),
-- então não é preciso publicar a função de novo.
--
-- Cada festa gera no máximo um aviso por pessoa. Festas canceladas não avisam.
-- Só olha festas que terminaram nos últimos 3 dias, para não avisar sobre
-- festas antigas quando esta migração for aplicada.
-- =====================================================================

alter table notificacoes drop constraint if exists notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario',
   'conferencia_fantasias'));

alter table notificacao_preferencias drop constraint if exists notificacao_preferencias_tipo_check;
alter table notificacao_preferencias add constraint notificacao_preferencias_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario',
   'conferencia_fantasias'));

create function gerar_avisos_conferencia() returns void
language sql security definer set search_path = public as $$
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select u.id, e.id, 'conferencia_fantasias',
         'Festa encerrada: confira as fantasias da ' || e.titulo
  from eventos e
  cross join usuarios u
  where e.situacao <> 'cancelado'
    and e.fim <= now()
    and e.fim > now() - interval '3 days'
    -- alguma fantasia da festa ainda sem conferência
    and exists (
      select 1 from evento_escala es
      where es.evento_id = e.id and es.ativo and es.fantasia_id is not null
        and not exists (
          select 1 from conferencias_fantasia c
          where c.evento_id = e.id and c.fantasia_id = es.fantasia_id
        )
    )
    -- quem cuida das fantasias
    and u.ativo
    and (
      u.perfil = 'fantasias'
      or exists (
        select 1 from profissionais p
        where p.usuario_id = u.id and p.ativo and 'fantasias'::funcao_profissional = any (p.funcoes)
      )
    )
    -- um aviso por festa e por pessoa
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.evento_id = e.id and n.tipo = 'conferencia_fantasias'
    );
$$;

-- Só a rotina do servidor gera avisos
revoke execute on function gerar_avisos_conferencia() from public, anon, authenticated;

-- Mesma rotina de antes (avisos da gestão), agora também com o aviso de conferência
create or replace function gerar_notificacoes_gestao() returns void
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

  perform gerar_avisos_conferencia();
end;
$$;
