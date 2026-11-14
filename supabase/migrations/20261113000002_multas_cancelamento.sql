-- Multa opcional registrada no momento do cancelamento.
create table if not exists public.multas_cancelamento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null unique references public.eventos (id) on delete cascade,
  tipo text not null check (tipo in ('percentual', 'fixa')),
  percentual numeric(5, 2) check (percentual is null or percentual > 0 and percentual <= 100),
  valor_base numeric(10, 2) not null default 0 check (valor_base >= 0),
  valor numeric(10, 2) not null check (valor > 0),
  justificativa text not null check (char_length(trim(justificativa)) between 1 and 500),
  aplicado_por uuid not null references public.usuarios (id),
  aplicado_em timestamptz not null default now(),
  constraint multas_cancelamento_valores_validos check (
    (tipo = 'percentual' and percentual is not null and valor_base > 0)
    or (tipo = 'fixa' and percentual is null)
  )
);

alter table public.multas_cancelamento enable row level security;
grant select on public.multas_cancelamento to authenticated;

drop policy if exists multas_cancelamento_ler on public.multas_cancelamento;
create policy multas_cancelamento_ler on public.multas_cancelamento
  for select to authenticated using (eh_gestao());

drop trigger if exists historico_multas_cancelamento on public.multas_cancelamento;
create trigger historico_multas_cancelamento
  after insert on public.multas_cancelamento
  for each row execute function registrar_historico('true');

create or replace function public.cancelar_evento_com_multa(
  p_evento_id uuid,
  p_motivo text,
  p_tipo_multa text,
  p_percentual numeric,
  p_valor_fixo numeric,
  p_justificativa_multa text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_evento public.eventos%rowtype;
  v_base numeric(10, 2) := 0;
  v_valor numeric(10, 2);
begin
  if not pode_cancelar_evento() then
    raise exception 'Seu perfil não pode cancelar eventos.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v_evento from public.eventos where id = p_evento_id for update;
  if not found or v_evento.situacao = 'cancelado' then
    raise exception 'Evento não encontrado ou já cancelado.';
  end if;

  if p_tipo_multa is null or p_tipo_multa = '' then
    if p_percentual is not null or p_valor_fixo is not null or nullif(trim(p_justificativa_multa), '') is not null then
      raise exception 'Selecione um tipo de multa ou limpe os dados da multa.';
    end if;
  else
    if not eh_gestao() then
      raise exception 'Somente Direção e Gerência podem aplicar multa de cancelamento.';
    end if;
    if coalesce(trim(p_justificativa_multa), '') = '' then
      raise exception 'Informe a justificativa da multa.';
    end if;
    select coalesce(valor_contratado, 0) into v_base
      from public.evento_financeiro where evento_id = p_evento_id;
    v_base := coalesce(v_base, 0);

    if p_tipo_multa = 'percentual' then
      if p_percentual is null or p_percentual <= 0 or p_percentual > 100 or p_valor_fixo is not null then
        raise exception 'Informe um percentual entre 0 e 100.';
      end if;
      if v_base <= 0 then
        raise exception 'Defina o valor contratado do evento antes de usar multa percentual.';
      end if;
      v_valor := round(v_base * p_percentual / 100, 2);
      if v_valor <= 0 then
        raise exception 'O percentual informado resulta em multa menor que R$ 0,01.';
      end if;
    elsif p_tipo_multa = 'fixa' then
      if p_valor_fixo is null or p_valor_fixo <= 0 or p_percentual is not null then
        raise exception 'Informe um valor fixo maior que zero.';
      end if;
      v_valor := round(p_valor_fixo, 2);
    else
      raise exception 'Tipo de multa inválido.';
    end if;
  end if;

  update public.eventos
     set situacao = 'cancelado', motivo_cancelamento = trim(p_motivo)
   where id = p_evento_id and situacao <> 'cancelado';
  if not found then
    raise exception 'Evento não encontrado ou já cancelado.';
  end if;

  if p_tipo_multa is not null and p_tipo_multa <> '' then
    insert into public.multas_cancelamento (
      evento_id, tipo, percentual, valor_base, valor, justificativa, aplicado_por
    ) values (
      p_evento_id, p_tipo_multa,
      case when p_tipo_multa = 'percentual' then p_percentual else null end,
      v_base, v_valor, trim(p_justificativa_multa), auth.uid()
    );
  end if;
end;
$$;

revoke all on function public.cancelar_evento_com_multa(uuid, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.cancelar_evento_com_multa(uuid, text, text, numeric, numeric, text) to authenticated;
