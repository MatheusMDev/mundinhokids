-- Dados editáveis pela própria pessoa e armazenamento de avatar.
alter table usuarios add column if not exists telefone text;
alter table usuarios add column if not exists foto_path text;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

create policy avatares_inserir_proprio
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatares_alterar_proprio
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatares_apagar_proprio
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.atualizar_minha_conta(
  p_nome text,
  p_telefone text,
  p_disponibilidade text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'nome_obrigatorio'; end if;

  update usuarios
     set nome = trim(p_nome), telefone = nullif(trim(p_telefone), '')
   where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;

  update profissionais
     set nome = trim(p_nome),
         telefone = nullif(trim(p_telefone), ''),
         disponibilidade = nullif(trim(p_disponibilidade), '')
   where usuario_id = v_usuario and ativo;
end;
$$;

create or replace function public.atualizar_foto_minha_conta(p_foto_path text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update usuarios set foto_path = nullif(trim(p_foto_path), '')
   where id = auth.uid() and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;

grant execute on function public.atualizar_minha_conta(text, text, text) to authenticated;
grant execute on function public.atualizar_foto_minha_conta(text) to authenticated;

create or replace function public.sincronizar_email_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update usuarios set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists sincronizar_email_usuario on auth.users;
create trigger sincronizar_email_usuario
  after update of email on auth.users
  for each row execute function public.sincronizar_email_usuario();
