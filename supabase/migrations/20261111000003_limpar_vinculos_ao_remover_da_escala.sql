-- Ao retirar alguém da escala, encerra os vínculos operacionais daquela
-- pessoa com o evento e preserva os registros necessários para auditoria.

alter table public.pagamentos_profissionais
  add column cancelado_em timestamptz;

comment on column public.pagamentos_profissionais.cancelado_em is
  'Quando um valor pendente foi cancelado porque o profissional saiu da escala. Mantém o histórico financeiro sem contar como obrigação ativa.';

create function public.limpar_vinculos_ao_sair_da_escala() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O cancelamento completo do evento tem regras próprias e não deve ser
  -- confundido com a remoção individual de uma pessoa da equipe.
  if exists (
    select 1 from public.eventos e
    where e.id = new.evento_id and e.situacao <> 'cancelado'
  ) then
    -- A maquiagem, personagem e fantasia pertencem à linha da escala. Ela
    -- fica inativa como histórico e deixa de aparecer nas consultas atuais.
    -- Uma obrigação pendente vira cancelada, sem apagar valores já pagos.
    update public.pagamentos_profissionais
       set cancelado_em = clock_timestamp(),
           observacoes = concat_ws(E'\n', nullif(observacoes, ''),
             'Valor pendente cancelado ao remover o profissional da escala.')
     where evento_id = new.evento_id
       and profissional_id = new.profissional_id
       and situacao = 'pendente'
       and cancelado_em is null;

    -- Pedidos de troca em andamento não podem continuar apontando para uma
    -- vaga que já não está ativa.
    update public.substituicoes
       set situacao = 'cancelada',
           respondido_em = coalesce(respondido_em, clock_timestamp())
     where escala_id = new.id
       and situacao in ('aguardando_aceite', 'aguardando_aprovacao');

    -- O veículo é uma associação operacional do mesmo evento. Preserva-se
    -- a linha inativa no histórico e libera-se a reserva atual.
    update public.reservas_veiculo
       set ativo = false
     where evento_id = new.evento_id
       and responsavel_id = new.profissional_id
       and ativo;
  end if;

  return new;
end;
$$;

revoke execute on function public.limpar_vinculos_ao_sair_da_escala() from public, anon, authenticated;

create trigger escala_limpar_vinculos_ao_sair
  after update of ativo on public.evento_escala
  for each row
  when (old.ativo and not new.ativo)
  execute function public.limpar_vinculos_ao_sair_da_escala();

-- Uma gravação atrasada da tela não pode reabrir o valor pendente depois que
-- a pessoa saiu. Um novo pagamento só volta a ficar pendente após nova escala.
create function public.proteger_pagamento_de_escala_encerrada() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.situacao = 'pendente'
     and new.cancelado_em is null
     and not exists (
       select 1 from public.evento_escala e
       where e.evento_id = new.evento_id
         and e.profissional_id = new.profissional_id
         and e.ativo
     ) then
    if tg_op = 'INSERT' then
      raise exception 'Não é possível criar um pagamento pendente sem uma escala ativa para este evento.';
    elsif old.cancelado_em is not null then
      raise exception 'Não é possível criar ou reabrir um pagamento pendente sem uma escala ativa para este evento.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.proteger_pagamento_de_escala_encerrada() from public, anon, authenticated;

create trigger pagamento_exige_escala_ativa
  before insert or update on public.pagamentos_profissionais
  for each row execute function public.proteger_pagamento_de_escala_encerrada();
