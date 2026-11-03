-- =====================================================================
-- Mundinho Kids — quem foi indicado para uma troca vê o pedido
--
-- O artista indicado ainda não está na escala, então as permissões não
-- deixam ele ler o evento. Esta função mostra só o necessário para ele
-- decidir (evento, horário, local, personagem e quem pediu), e só dos
-- pedidos em que ele é o substituto.
-- =====================================================================

create function trocas_para_mim()
returns table (
  substituicao_id uuid,
  situacao        situacao_substituicao,
  evento_id       uuid,
  titulo          text,
  inicio          timestamptz,
  fim             timestamptz,
  local_nome      text,
  personagem      text,
  solicitante     text,
  motivo          text,
  solicitado_em   timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.situacao, e.id, e.titulo, e.inicio, e.fim, l.nome, pe.nome, p.nome, s.motivo, s.solicitado_em
  from substituicoes s
  join evento_escala x on x.id = s.escala_id
  join eventos e on e.id = x.evento_id
  join locais l on l.id = e.local_id
  left join personagens pe on pe.id = x.personagem_id
  join profissionais p on p.id = s.solicitante_id
  where s.substituto_id = meu_profissional_id()
    and s.situacao in ('aguardando_aceite', 'aguardando_aprovacao')
  order by e.inicio
$$;

revoke execute on function trocas_para_mim() from public, anon;
grant  execute on function trocas_para_mim() to authenticated;
