-- Anexos privados para comprovantes das despesas dos eventos.
alter table public.despesas
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_mime text,
  add column if not exists comprovante_tamanho bigint;

create unique index if not exists despesas_comprovante_path_uidx
  on public.despesas (comprovante_path) where comprovante_path is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'despesas_comprovante_mime_check' and conrelid = 'public.despesas'::regclass) then
    alter table public.despesas add constraint despesas_comprovante_mime_check
      check (comprovante_mime is null or comprovante_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'despesas_comprovante_tamanho_check' and conrelid = 'public.despesas'::regclass) then
    alter table public.despesas add constraint despesas_comprovante_tamanho_check
      check (comprovante_tamanho is null or (comprovante_tamanho > 0 and comprovante_tamanho <= 10485760));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'despesas_comprovante_metadados_check' and conrelid = 'public.despesas'::regclass) then
    alter table public.despesas add constraint despesas_comprovante_metadados_check
      check (
        (comprovante_path is null and comprovante_nome is null and comprovante_mime is null and comprovante_tamanho is null)
        or (comprovante_path is not null and comprovante_nome is not null and comprovante_mime is not null and comprovante_tamanho is not null)
      );
  end if;
end $$;

-- Produção registra a própria despesa e inclui o comprovante no lançamento.
drop policy if exists desp_criar on public.despesas;
create policy desp_criar on public.despesas for insert to authenticated
  with check (
    eh_gestao()
    or (
      criado_por = auth.uid()
      and evento_id is not null
      and responsavel_id = meu_profissional_id()
      and tenho_funcao('produtor')
      and participa_do_evento(evento_id)
      and (comprovante_path is not null or comprovante is not null)
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'despesas-comprovantes', 'despesas-comprovantes', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists despesas_comprovantes_ler on storage.objects;
create policy despesas_comprovantes_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'despesas-comprovantes'
    and (
      eh_gestao()
      or exists (
        select 1 from public.despesas d
        where d.comprovante_path = name and d.criado_por = auth.uid()
      )
    )
  );

drop policy if exists despesas_comprovantes_criar on storage.objects;
create policy despesas_comprovantes_criar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'despesas-comprovantes'
    and (
      eh_gestao()
      or (
        split_part(name, '/', 2) = auth.uid()::text
        and exists (
          select 1 from public.eventos e
          where e.id::text = split_part(name, '/', 1)
            and participa_do_evento(e.id)
            and tenho_funcao('produtor')
        )
      )
    )
  );

drop policy if exists despesas_comprovantes_alterar on storage.objects;
create policy despesas_comprovantes_alterar on storage.objects for update to authenticated
  using (bucket_id = 'despesas-comprovantes' and eh_gestao())
  with check (bucket_id = 'despesas-comprovantes' and eh_gestao());

drop policy if exists despesas_comprovantes_apagar on storage.objects;
create policy despesas_comprovantes_apagar on storage.objects for delete to authenticated
  using (
    bucket_id = 'despesas-comprovantes'
    and (
      eh_gestao()
      or (
        split_part(name, '/', 2) = auth.uid()::text
        and not exists (select 1 from public.despesas d where d.comprovante_path = name)
      )
    )
  );
