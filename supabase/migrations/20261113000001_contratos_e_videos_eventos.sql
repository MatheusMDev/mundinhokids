-- Contratos privados para qualquer profissional e vídeo obrigatório nos eventos concluídos.

-- Só Direção/Gerência pode ver e administrar contratos. Os outros documentos
-- continuam visíveis ao próprio profissional quando não são do tipo Contrato.
drop policy if exists documentos_artistas_ler on public.documentos_artistas;
create policy documentos_artistas_ler on public.documentos_artistas for select to authenticated
  using (
    eh_gestao()
    or (lower(trim(tipo)) <> 'contrato' and profissional_id = meu_profissional_id())
  );

drop policy if exists documentos_artistas_criar on public.documentos_artistas;
create policy documentos_artistas_criar on public.documentos_artistas for insert to authenticated
  with check (eh_gestao() and enviado_por = auth.uid());

drop policy if exists documentos_artistas_apagar on public.documentos_artistas;
create policy documentos_artistas_apagar on public.documentos_artistas for delete to authenticated
  using (eh_gestao());

drop policy if exists documentos_storage_ler on storage.objects;
create policy documentos_storage_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-artistas'
    and (
      eh_gestao()
      or exists (
        select 1 from public.documentos_artistas d
        where d.storage_path = name
          and d.profissional_id = meu_profissional_id()
          and lower(trim(d.tipo)) <> 'contrato'
      )
    )
  );

drop policy if exists documentos_storage_criar on storage.objects;
create policy documentos_storage_criar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-artistas' and eh_gestao());

drop policy if exists documentos_storage_alterar on storage.objects;
create policy documentos_storage_alterar on storage.objects for update to authenticated
  using (bucket_id = 'documentos-artistas' and eh_gestao())
  with check (bucket_id = 'documentos-artistas' and eh_gestao());

drop policy if exists documentos_storage_apagar on storage.objects;
create policy documentos_storage_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-artistas' and eh_gestao());

create table if not exists public.videos_eventos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null unique references public.eventos (id) on delete cascade,
  storage_path text not null unique,
  nome text not null check (char_length(trim(nome)) between 1 and 255),
  mime_type text not null check (mime_type in ('video/mp4', 'video/webm', 'video/quicktime')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 52428800),
  enviado_por uuid not null references public.usuarios (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos-eventos', 'videos-eventos', false, 52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.videos_eventos enable row level security;
grant select, insert, update on public.videos_eventos to authenticated;

drop policy if exists videos_eventos_ler on public.videos_eventos;
create policy videos_eventos_ler on public.videos_eventos for select to authenticated
  using (eh_operacao() or participa_do_evento(evento_id));

drop policy if exists videos_eventos_criar on public.videos_eventos;
create policy videos_eventos_criar on public.videos_eventos for insert to authenticated
  with check (
    enviado_por = auth.uid()
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.situacao <> 'cancelado' and e.fim <= now()
    )
    and (
      eh_gestao()
      or (tenho_funcao('produtor') and participa_do_evento(evento_id))
    )
  );

drop policy if exists videos_eventos_alterar on public.videos_eventos;
create policy videos_eventos_alterar on public.videos_eventos for update to authenticated
  using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.situacao <> 'cancelado' and e.fim <= now()
    )
    and (eh_gestao() or (tenho_funcao('produtor') and participa_do_evento(evento_id)))
  )
  with check (
    enviado_por = auth.uid()
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.situacao <> 'cancelado' and e.fim <= now()
    )
    and (eh_gestao() or (tenho_funcao('produtor') and participa_do_evento(evento_id)))
  );

drop policy if exists videos_eventos_storage_ler on storage.objects;
create policy videos_eventos_storage_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'videos-eventos'
    and (
      eh_operacao()
      or exists (
        select 1 from public.videos_eventos v
        where v.storage_path = name and participa_do_evento(v.evento_id)
      )
    )
  );

drop policy if exists videos_eventos_storage_criar on storage.objects;
create policy videos_eventos_storage_criar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'videos-eventos'
    and (
      eh_gestao()
      or (
        split_part(name, '/', 2) = auth.uid()::text
        and tenho_funcao('produtor')
        and exists (
          select 1 from public.eventos e
          where e.id::text = split_part(name, '/', 1)
            and e.situacao <> 'cancelado' and e.fim <= now()
            and participa_do_evento(e.id)
        )
      )
    )
  );

drop policy if exists videos_eventos_storage_apagar on storage.objects;
create policy videos_eventos_storage_apagar on storage.objects for delete to authenticated
  using (
    bucket_id = 'videos-eventos'
    and (
      eh_gestao()
      or (
        not exists (select 1 from public.videos_eventos v where v.storage_path = name)
        and tenho_funcao('produtor')
        and exists (
          select 1 from public.eventos e
          where e.id::text = split_part(name, '/', 1)
            and e.situacao <> 'cancelado' and e.fim <= now()
            and participa_do_evento(e.id)
        )
      )
    )
  );

create or replace function public.exigir_video_antes_de_concluir_evento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.situacao = 'realizado'
     and (tg_op = 'INSERT' or old.situacao is distinct from new.situacao)
     and not exists (select 1 from public.videos_eventos v where v.evento_id = new.id) then
    raise exception 'Anexe o vídeo do evento antes de marcá-lo como realizado.';
  end if;
  return new;
end;
$$;

drop trigger if exists exigir_video_antes_de_concluir_evento on public.eventos;
create trigger exigir_video_antes_de_concluir_evento
  before insert or update on public.eventos
  for each row execute function public.exigir_video_antes_de_concluir_evento();
