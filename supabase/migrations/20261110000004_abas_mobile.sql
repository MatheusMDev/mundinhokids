-- =====================================================================
-- Mundinho Kids — abas do celular escolhidas por cada pessoa
--
-- RECUPERADA do banco em 2026-11-10: esta mudança foi aplicada direto no
-- projeto Supabase e não está em nenhuma branch do repositório (nem a
-- migração nem o código do app que a usa). O conteúdo abaixo é a definição
-- exata que está no banco. A data no nome é a da recuperação, não a original.
--
-- Cada login pode escolher 3 menus para a barra de baixo do celular.
-- null = abas padrão do perfil.
-- =====================================================================

alter table usuarios add column abas_mobile text[];
alter table usuarios add constraint usuarios_abas_mobile_validas check (
  abas_mobile is null or (
    cardinality(abas_mobile) = 3
    and abas_mobile <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
                             '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]
  )
);

create function atualizar_abas_mobile(p_abas text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_abas, 1), 0) <> 3 then
    raise exception 'Escolha exatamente três menus.';
  end if;
  if (select count(distinct aba) from unnest(p_abas) as aba) <> 3 then
    raise exception 'Escolha três menus diferentes.';
  end if;
  if not (p_abas <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
    '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]) then
    raise exception 'Menu mobile inválido.';
  end if;

  update usuarios set abas_mobile = p_abas where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;
revoke execute on function atualizar_abas_mobile(text[]) from public, anon;
grant execute on function atualizar_abas_mobile(text[]) to authenticated;
