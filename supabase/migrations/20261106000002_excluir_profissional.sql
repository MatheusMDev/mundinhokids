-- =====================================================================
-- Mundinho Kids — excluir profissional sem perder o histórico (task #63)
--
-- RECUPERADA do banco em 2026-11-10: esta migração foi aplicada no
-- projeto Supabase, mas o arquivo nunca foi commitado. O conteúdo abaixo
-- é a definição exata que está no banco. Ver docs/exclusao-profissionais.md.
--
-- A exclusão é lógica: excluido_em marca quando ocorreu, o profissional
-- fica inativo e perde o vínculo com o login. Escalas e pagamentos ficam.
-- Só Direção e Gerente excluem; só a Direção exclui quem tem acesso de Direção.
-- =====================================================================

alter table profissionais add column excluido_em timestamptz;
alter table profissionais add constraint profissional_excluido_inativo
  check (excluido_em is null or (not ativo and usuario_id is null));

-- Barra a exclusão por update direto de quem não pode, e impede reativar um excluído
create function proteger_exclusao_profissional() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.excluido_em is distinct from old.excluido_em then
    if not eh_gestao() then
      raise exception 'Só a direção e a gerência podem excluir profissionais.' using errcode = '42501';
    end if;
    if old.excluido_em is not null then
      raise exception 'Este profissional já foi excluído. Crie um novo cadastro se necessário.';
    end if;
    if exists (select 1 from usuarios where id = old.usuario_id and perfil = 'diretora')
      and meu_perfil() <> 'diretora' then
      raise exception 'Só a Direção pode excluir um profissional ligado a um acesso de Direção.';
    end if;
  end if;
  if new.excluido_em is not null then
    new.ativo := false;
    new.usuario_id := null;
  end if;
  return new;
end;
$$;
revoke execute on function proteger_exclusao_profissional() from public, anon, authenticated;

create trigger profissional_proteger_exclusao before update on profissionais
  for each row execute function proteger_exclusao_profissional();

create function excluir_profissional(p_profissional_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profissional profissionais%rowtype;
begin
  if not eh_gestao() then
    raise exception 'Só a direção e a gerência podem excluir profissionais.' using errcode = '42501';
  end if;
  select * into v_profissional from profissionais where id = p_profissional_id for update;
  if not found or v_profissional.excluido_em is not null then
    raise exception 'Profissional não encontrado ou já excluído.';
  end if;
  update profissionais
    set excluido_em = clock_timestamp(), ativo = false, usuario_id = null
    where id = p_profissional_id;
end;
$$;
revoke execute on function excluir_profissional(uuid) from public, anon;
grant execute on function excluir_profissional(uuid) to authenticated;
