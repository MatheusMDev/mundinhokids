-- Documentos privados anexados ao cadastro de cada artista.
create table documentos_artistas (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references profissionais (id) on delete cascade,
  tipo            text not null check (char_length(trim(tipo)) between 1 and 40),
  nome            text not null check (char_length(trim(nome)) between 1 and 255),
  storage_path    text not null unique,
  mime_type       text not null,
  tamanho_bytes   bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  enviado_por     uuid not null references usuarios (id) default auth.uid(),
  enviado_em      timestamptz not null default now()
);

create index documentos_artistas_profissional_idx on documentos_artistas (profissional_id, enviado_em desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-artistas', 'documentos-artistas', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table documentos_artistas enable row level security;

grant select, insert, delete on documentos_artistas to authenticated;

create policy documentos_artistas_ler on documentos_artistas for select to authenticated
  using (eh_operacao() or profissional_id = meu_profissional_id());

create policy documentos_artistas_criar on documentos_artistas for insert to authenticated
  with check (eh_operacao() and enviado_por = auth.uid());

create policy documentos_artistas_apagar on documentos_artistas for delete to authenticated
  using (eh_operacao());

create policy documentos_storage_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-artistas'
    and (
      eh_operacao()
      or exists (
        select 1 from documentos_artistas d
        where d.storage_path = name and d.profissional_id = meu_profissional_id()
      )
    )
  );

create policy documentos_storage_criar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-artistas' and eh_operacao());

create policy documentos_storage_alterar on storage.objects for update to authenticated
  using (bucket_id = 'documentos-artistas' and eh_operacao())
  with check (bucket_id = 'documentos-artistas' and eh_operacao());

create policy documentos_storage_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-artistas' and eh_operacao());
