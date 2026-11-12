-- Comprovantes de valores adicionais pagos ou devidos a produtores fora de eventos.
create table adicionais_produtores (
  id              uuid primary key default gen_random_uuid(),
  produtor_id     uuid not null references profissionais (id),
  valor           numeric(10, 2) not null check (valor > 0),
  data            date not null default current_date,
  descricao       text not null check (char_length(trim(descricao)) between 1 and 500),
  foto_path       text not null unique,
  foto_nome       text not null check (char_length(trim(foto_nome)) between 1 and 255),
  foto_mime       text not null check (foto_mime in ('image/jpeg', 'image/png', 'image/webp')),
  foto_tamanho    bigint not null check (foto_tamanho > 0 and foto_tamanho <= 10485760),
  criado_por      uuid not null references usuarios (id) default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  cancelado_em    timestamptz,
  cancelado_por   uuid references usuarios (id)
);

create index adicionais_produtores_produtor_idx on adicionais_produtores (produtor_id, data desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adicionais-produtores', 'adicionais-produtores', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table adicionais_produtores enable row level security;

grant select, insert, update on adicionais_produtores to authenticated;

create policy adicionais_ler on adicionais_produtores for select to authenticated
  using (eh_gestao() or produtor_id = meu_profissional_id());

create policy adicionais_criar on adicionais_produtores for insert to authenticated
  with check (eh_gestao() and criado_por = auth.uid());

create policy adicionais_alterar on adicionais_produtores for update to authenticated
  using (eh_gestao()) with check (eh_gestao());

create trigger historico_adicionais_produtores
  after insert or update on adicionais_produtores
  for each row execute function registrar_historico('true');

create policy adicionais_storage_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'adicionais-produtores'
    and (
      eh_gestao()
      or exists (
        select 1 from adicionais_produtores a
        where a.foto_path = name and a.produtor_id = meu_profissional_id()
      )
    )
  );

create policy adicionais_storage_criar on storage.objects for insert to authenticated
  with check (bucket_id = 'adicionais-produtores' and eh_gestao());

create policy adicionais_storage_alterar on storage.objects for update to authenticated
  using (bucket_id = 'adicionais-produtores' and eh_gestao())
  with check (bucket_id = 'adicionais-produtores' and eh_gestao());

create policy adicionais_storage_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'adicionais-produtores' and eh_gestao());
