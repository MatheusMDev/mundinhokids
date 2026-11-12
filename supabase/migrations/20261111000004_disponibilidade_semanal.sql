-- Disponibilidade semanal preenchida por cada profissional.
-- A ausência de resposta é diferente de marcar todos os dias indisponíveis.

create table public.disponibilidade_semanal (
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  semana_inicio date not null,
  dia smallint not null,
  disponivel boolean not null,
  hora_inicio time,
  hora_fim time,
  observacoes text,
  atualizado_em timestamptz not null default now(),
  primary key (profissional_id, semana_inicio, dia),
  constraint disponibilidade_semana_segunda check (extract(isodow from semana_inicio) = 1),
  constraint disponibilidade_dia_valido check (dia between 1 and 7),
  constraint disponibilidade_horario_valido check (
    (hora_inicio is null and hora_fim is null)
    or (hora_inicio is not null and hora_fim is not null and hora_inicio < hora_fim)
  ),
  constraint disponibilidade_indisponivel_sem_horario check (
    disponivel or (hora_inicio is null and hora_fim is null)
  )
);

create index disponibilidade_semanal_periodo_idx
  on public.disponibilidade_semanal (semana_inicio, dia);

alter table public.disponibilidade_semanal enable row level security;
grant select on public.disponibilidade_semanal to authenticated;

create policy disponibilidade_semanal_ler on public.disponibilidade_semanal
  for select to authenticated
  using (eh_operacao() or profissional_id = meu_profissional_id());

-- A gravação é atômica e sempre registra uma resposta para cada dia da semana.
create or replace function public.salvar_disponibilidade_semanal(
  p_semana_inicio date,
  p_dias jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profissional_id uuid := meu_profissional_id();
  v_total integer;
  v_dias_distintos integer;
begin
  if auth.uid() is null or v_profissional_id is null then
    raise exception 'sem_permissao';
  end if;
  if p_semana_inicio is null or extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'A semana precisa começar na segunda-feira.';
  end if;
  if coalesce(jsonb_typeof(p_dias), '') <> 'array' then
    raise exception 'Informe a disponibilidade para os sete dias.';
  end if;
  if jsonb_array_length(p_dias) <> 7 then
    raise exception 'Informe a disponibilidade para os sete dias.';
  end if;

  select count(*), count(distinct x.dia)
    into v_total, v_dias_distintos
  from jsonb_to_recordset(p_dias) as x(
    dia smallint,
    disponivel boolean,
    hora_inicio time,
    hora_fim time,
    observacoes text
  );
  if v_total <> 7 or v_dias_distintos <> 7 then
    raise exception 'Informe cada dia da semana uma única vez.';
  end if;

  insert into public.disponibilidade_semanal (
    profissional_id, semana_inicio, dia, disponivel, hora_inicio, hora_fim, observacoes, atualizado_em
  )
  select
    v_profissional_id,
    p_semana_inicio,
    x.dia,
    x.disponivel,
    case when x.disponivel then x.hora_inicio else null end,
    case when x.disponivel then x.hora_fim else null end,
    nullif(btrim(x.observacoes), ''),
    now()
  from jsonb_to_recordset(p_dias) as x(
    dia smallint,
    disponivel boolean,
    hora_inicio time,
    hora_fim time,
    observacoes text
  )
  on conflict (profissional_id, semana_inicio, dia) do update set
    disponivel = excluded.disponivel,
    hora_inicio = excluded.hora_inicio,
    hora_fim = excluded.hora_fim,
    observacoes = excluded.observacoes,
    atualizado_em = excluded.atualizado_em;
end;
$$;

revoke all on function public.salvar_disponibilidade_semanal(date, jsonb) from public, anon;
grant execute on function public.salvar_disponibilidade_semanal(date, jsonb) to authenticated;
