-- Preferência pessoal das três abas principais exibidas no celular.
-- Diferente de usuarios.telas, esta configuração não altera permissões.
alter table usuarios add column if not exists abas_mobile text[];

alter table usuarios drop constraint if exists usuarios_abas_mobile_validas;
alter table usuarios add constraint usuarios_abas_mobile_validas check (
  abas_mobile is null
  or (
    cardinality(abas_mobile) = 3
    and abas_mobile <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
      '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]
  )
);

create or replace function public.atualizar_abas_mobile(p_abas text[]) returns void
language plpgsql
security definer
set search_path = public
as $$
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

revoke execute on function public.atualizar_abas_mobile(text[]) from public, anon;
grant execute on function public.atualizar_abas_mobile(text[]) to authenticated;
