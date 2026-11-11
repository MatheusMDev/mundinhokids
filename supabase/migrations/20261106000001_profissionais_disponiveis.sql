-- =====================================================================
-- Mundinho Kids — só profissionais disponíveis entram em novos vínculos
-- (tasks #63/#64)
--
-- RECUPERADA do banco em 2026-11-10: esta migração foi aplicada no
-- projeto Supabase, mas o arquivo nunca foi commitado. O conteúdo abaixo
-- é a definição exata que está no banco (pg_get_functiondef/triggerdef).
--
-- "Disponível" = profissional ativo e, se tiver login, com o login ativo.
-- Escalas, reservas, despesas e trocas novas recusam quem não está
-- disponível; o histórico (escalas e pagamentos antigos) é preservado.
-- =====================================================================

-- O login só "é" um profissional enquanto os dois estão ativos
create or replace function meu_profissional_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from profissionais p
  join usuarios u on u.id = p.usuario_id and u.ativo
  where p.usuario_id = auth.uid() and p.ativo
$$;

create function profissional_disponivel(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profissionais p
    where p.id = p_id and p.ativo
      and (p.usuario_id is null or exists (
        select 1 from usuarios u where u.id = p.usuario_id and u.ativo
      ))
  )
$$;
revoke execute on function profissional_disponivel(uuid) from public, anon, authenticated;

-- Lista para as telas: só quem o login pode ver e que está disponível
create function profissionais_disponiveis() returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select p.id from profissionais p
  where meu_perfil() is not null
    and (eh_operacao() or p.usuario_id = auth.uid() or colega_de_evento(p.id))
    and profissional_disponivel(p.id)
$$;
revoke execute on function profissionais_disponiveis() from public, anon;
grant execute on function profissionais_disponiveis() to authenticated;

create or replace function substitutos_disponiveis(p_escala_id uuid)
returns table (profissional_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome
  from evento_escala e
  join profissional_personagens pp on pp.personagem_id = e.personagem_id
  join profissionais p on p.id = pp.profissional_id
  where e.id = p_escala_id and e.ativo
    and (eh_operacao() or e.profissional_id = meu_profissional_id())
    and profissional_disponivel(p.id)
    and 'artista' = any (p.funcoes)
    and p.id <> e.profissional_id
    and not exists (
      select 1 from evento_escala x
      where x.profissional_id = p.id and x.ativo and x.periodo && e.periodo
    )
  order by p.nome
$$;

-- Novos vínculos (escala, reserva, despesa, troca) exigem profissional disponível
create function validar_profissional_novo_vinculo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_validar boolean := false;
begin
  if tg_table_name = 'evento_escala' then
    v_id := new.profissional_id;
    if new.ativo then
      if tg_op = 'INSERT' then v_validar := true;
      else v_validar := not old.ativo
        or (new.profissional_id, new.funcao, new.personagem_id, new.fantasia_id)
          is distinct from (old.profissional_id, old.funcao, old.personagem_id, old.fantasia_id);
      end if;
    end if;
  elsif tg_table_name = 'reservas_veiculo' then
    v_id := new.responsavel_id;
    if new.ativo then
      if tg_op = 'INSERT' then v_validar := true;
      else v_validar := not old.ativo
        or (new.responsavel_id, new.veiculo_id, new.evento_id, new.retirada, new.devolucao_prevista)
          is distinct from (old.responsavel_id, old.veiculo_id, old.evento_id, old.retirada, old.devolucao_prevista);
      end if;
    end if;
  elsif tg_table_name = 'despesas' then
    v_id := new.responsavel_id;
    if tg_op = 'INSERT' then v_validar := true;
    else v_validar := new.responsavel_id is distinct from old.responsavel_id;
    end if;
  elsif tg_table_name = 'substituicoes' then
    v_id := new.substituto_id;
    if tg_op = 'INSERT' then v_validar := true;
    else v_validar := new.substituto_id is distinct from old.substituto_id
      or (new.situacao in ('aguardando_aprovacao', 'aprovada') and new.situacao is distinct from old.situacao);
    end if;
  end if;

  if v_validar and v_id is not null then
    -- Serializa a seleção com a exclusão/desativação do profissional e do login.
    perform 1 from profissionais where id = v_id for share;
    perform 1 from usuarios where id = (select usuario_id from profissionais where id = v_id) for share;
    if not profissional_disponivel(v_id) then
      raise exception 'Este profissional não está mais disponível. Atualize a lista e escolha outra pessoa.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function validar_profissional_novo_vinculo() from public, anon, authenticated;

create trigger escala_profissional_disponivel before insert or update on evento_escala
  for each row execute function validar_profissional_novo_vinculo();
create trigger reserva_profissional_disponivel before insert or update on reservas_veiculo
  for each row execute function validar_profissional_novo_vinculo();
create trigger despesa_profissional_disponivel before insert or update on despesas
  for each row execute function validar_profissional_novo_vinculo();
create trigger substituicao_profissional_disponivel before insert or update on substituicoes
  for each row execute function validar_profissional_novo_vinculo();

-- Tirar o login de um profissional também o desativa (não fica um cadastro "órfão" ativo)
create function proteger_desvinculo_profissional() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.usuario_id is not null and new.usuario_id is null then
    new.ativo := false;
  end if;
  return new;
end;
$$;

create trigger profissional_desvincular before update of usuario_id on profissionais
  for each row execute function proteger_desvinculo_profissional();

-- Apagar um login desliga o profissional, mas preserva escalas e pagamentos
create function desligar_profissional_do_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profissionais set usuario_id = null, ativo = false where usuario_id = old.id;
  return old;
end;
$$;
revoke execute on function desligar_profissional_do_usuario() from public, anon, authenticated;

create trigger usuario_desligar_profissional before delete on usuarios
  for each row execute function desligar_profissional_do_usuario();
