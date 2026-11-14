-- Observações gerais dos artistas vinculadas ao evento (não a uma fantasia).
-- Cada envio é preservado como uma entrada própria, com autor e data.
create table if not exists public.observacoes_artistas_eventos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  profissional_id uuid not null references public.profissionais (id),
  texto text not null check (char_length(trim(texto)) between 1 and 1000),
  criado_em timestamptz not null default now()
);

create index if not exists observacoes_artistas_eventos_evento_idx
  on public.observacoes_artistas_eventos (evento_id, criado_em desc);

alter table public.observacoes_artistas_eventos enable row level security;
revoke all on public.observacoes_artistas_eventos from anon, authenticated;
grant select, insert on public.observacoes_artistas_eventos to authenticated;

drop policy if exists observacoes_artistas_eventos_ler on public.observacoes_artistas_eventos;
create policy observacoes_artistas_eventos_ler
  on public.observacoes_artistas_eventos for select to authenticated
  using (
    eh_gestao()
    or exists (
      select 1 from public.evento_escala e
      where e.evento_id = observacoes_artistas_eventos.evento_id
        and e.profissional_id = meu_profissional_id()
        and e.ativo
    )
  );

drop policy if exists observacoes_artistas_eventos_criar on public.observacoes_artistas_eventos;
create policy observacoes_artistas_eventos_criar
  on public.observacoes_artistas_eventos for insert to authenticated
  with check (
    profissional_id = meu_profissional_id()
    and tenho_funcao('artista')
    and exists (
      select 1 from public.evento_escala e
      join public.eventos ev on ev.id = e.evento_id
      where e.evento_id = observacoes_artistas_eventos.evento_id
        and e.profissional_id = meu_profissional_id()
        and e.funcao = 'artista'
        and e.ativo
        and ev.situacao <> 'cancelado'
    )
  );

-- Sem políticas/grants de UPDATE ou DELETE: cada observação enviada permanece
-- como histórico, identificada por artista e data.
