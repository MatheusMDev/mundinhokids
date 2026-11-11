-- Guarda o título no próprio aviso porque, após a remoção, a RLS deixa de
-- permitir que o profissional consulte o evento pela participação ativa.
create or replace function notificar_escala() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_usuario  uuid;
  v_evento   eventos%rowtype;
  v_minutos  int := coalesce(nullif(config_texto('lembrete_antecedencia_minutos'), '')::int, 120);
begin
  select usuario_id into v_usuario from profissionais where id = new.profissional_id;
  if v_usuario is null then
    return null;
  end if;
  select * into v_evento from eventos where id = new.evento_id;

  if tg_op = 'INSERT' and new.ativo then
    insert into notificacoes (usuario_id, evento_id, tipo)
    values (v_usuario, new.evento_id, 'escalado');
    insert into notificacoes (usuario_id, evento_id, tipo, agendada_para)
    values (v_usuario, new.evento_id, 'lembrete', v_evento.inicio - make_interval(mins => v_minutos));

  elsif tg_op = 'UPDATE' and old.ativo and not new.ativo then
    update notificacoes
    set mensagem = case tipo
      when 'escalado' then 'Você foi escalado: ' || v_evento.titulo
      when 'lembrete' then 'Lembrete de evento: ' || v_evento.titulo
      when 'alterado' then 'Evento alterado: ' || v_evento.titulo
      when 'cancelado' then 'Evento cancelado: ' || v_evento.titulo
      when 'removido' then 'Você saiu da escala: ' || v_evento.titulo
      when 'substituicao' then 'Atualização de troca: ' || v_evento.titulo
      else 'Evento: ' || v_evento.titulo
    end
    where usuario_id = v_usuario and evento_id = new.evento_id and mensagem is null;

    delete from notificacoes
    where usuario_id = v_usuario and evento_id = new.evento_id and tipo = 'lembrete' and enviada_em is null;
    insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
    values (
      v_usuario,
      new.evento_id,
      case when v_evento.situacao = 'cancelado' then 'cancelado' else 'removido' end,
      case when v_evento.situacao = 'cancelado'
        then 'Evento cancelado: ' || v_evento.titulo
        else 'Você saiu da escala: ' || v_evento.titulo
      end
    );
  end if;

  return null;
end;
$$;

-- Preenche avisos antigos que foram criados antes do título ser armazenado.
update notificacoes n
set mensagem = case n.tipo
  when 'escalado' then 'Você foi escalado: ' || e.titulo
  when 'lembrete' then 'Lembrete de evento: ' || e.titulo
  when 'alterado' then 'Evento alterado: ' || e.titulo
  when 'cancelado' then 'Evento cancelado: ' || e.titulo
  when 'removido' then 'Você saiu da escala: ' || e.titulo
  when 'substituicao' then 'Atualização de troca: ' || e.titulo
  else 'Evento: ' || e.titulo
end
from eventos e
where n.evento_id = e.id
  and n.mensagem is null;
