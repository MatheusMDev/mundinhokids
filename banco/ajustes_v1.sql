-- =====================================================================
-- Mundinho de Kids — ajustes sobre o schema.sql (V1)
-- Rodar logo depois do schema.sql, no mesmo banco.
--
-- 1. Nome do evento (título, aniversariante e idade)
-- 2. Quantidade de pessoas para maquiar
-- 3. Fantasia em limpeza pode ser reservada para depois da previsão de volta
-- 4. Função escalada precisa estar entre as funções do profissional
-- 5. Quem saiu da escala deixa de ver o evento
-- 6. Observações internas saem das tabelas que a equipe enxerga
-- 7. Despesa não pode ser lançada já aprovada por quem não é da gestão
-- 8. Funções do banco só para quem fez login
--
-- Fica para decisão da direção (não alterado aqui):
--   - fantasias.quantidade: a trava trata cada fantasia como peça única.
--     Se "quantidade" for o número de cópias iguais, cada cópia precisa
--     virar um cadastro próprio (ex.: "Elsa 1", "Elsa 2").
--   - Criar o login de um profissional exige a chave de administrador do
--     Supabase: precisa de uma Edge Function de convite (fora deste SQL).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 e 2. Eventos: nome e maquiagem
-- ---------------------------------------------------------------------

alter table eventos add column titulo text not null default 'Evento';
alter table eventos alter column titulo drop default;
alter table eventos add constraint eventos_titulo_preenchido check (trim(titulo) <> '');

alter table eventos add column aniversariante text;
alter table eventos add column idade int check (idade is null or idade between 0 and 120);

-- Quantas pessoas a maquiagem vai atender (briefing, item 4)
alter table eventos add column maquiagem_pessoas int not null default 0 check (maquiagem_pessoas >= 0);

-- ---------------------------------------------------------------------
-- 3. Fantasias: previsão de volta da limpeza ou da manutenção
-- ---------------------------------------------------------------------

alter table fantasias add column previsao_disponivel timestamptz;

comment on column fantasias.previsao_disponivel is
  'Quando a fantasia em limpeza ou manutenção volta. Pode ser escalada para eventos que começam depois disso.';

-- ---------------------------------------------------------------------
-- 3 e 4. Validação da escala (substitui a função do schema)
-- ---------------------------------------------------------------------

create or replace function validar_escala() returns trigger
language plpgsql set search_path = public as $$
declare
  v_evento   eventos%rowtype;
  v_fantasia fantasias%rowtype;
begin
  select * into v_evento from eventos where id = new.evento_id;

  if new.ativo and v_evento.situacao = 'cancelado' then
    raise exception 'Evento cancelado não pode receber escala.';
  end if;

  new.periodo := v_evento.periodo;   -- sempre o período do evento

  if new.ativo and (tg_op = 'INSERT'
                    or new.profissional_id is distinct from old.profissional_id
                    or new.funcao          is distinct from old.funcao) then
    if not exists (
      select 1 from profissionais
      where id = new.profissional_id and new.funcao::text = any (funcoes::text[])
    ) then
      raise exception 'Este profissional não está cadastrado para a função escolhida.';
    end if;
  end if;

  if new.ativo and (tg_op = 'INSERT'
                    or new.profissional_id is distinct from old.profissional_id
                    or new.personagem_id   is distinct from old.personagem_id) then
    if new.personagem_id is not null and not exists (
      select 1 from profissional_personagens
      where profissional_id = new.profissional_id and personagem_id = new.personagem_id
    ) then
      raise exception 'Este artista não está cadastrado para o personagem escolhido.';
    end if;
  end if;

  if new.ativo and new.fantasia_id is not null
     and (tg_op = 'INSERT' or new.fantasia_id is distinct from old.fantasia_id) then
    select * into v_fantasia from fantasias where id = new.fantasia_id;
    if v_fantasia.personagem_id is distinct from new.personagem_id then
      raise exception 'A fantasia escolhida não é deste personagem.';
    end if;
    if v_fantasia.situacao = 'inativa' then
      raise exception 'Fantasia inativa.';
    end if;
    if v_fantasia.situacao in ('limpeza', 'manutencao')
       and (v_fantasia.previsao_disponivel is null or v_fantasia.previsao_disponivel > v_evento.inicio) then
      raise exception 'Fantasia em % sem previsão de volta antes do evento.', v_fantasia.situacao;
    end if;
  end if;

  return new;
end;
$$;

-- Ao voltar a ficar disponível, a previsão perde o sentido
create function limpar_previsao_fantasia() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.situacao = 'disponivel' then
    new.previsao_disponivel := null;
  end if;
  return new;
end;
$$;

create trigger fantasias_limpar_previsao before update of situacao on fantasias
  for each row execute function limpar_previsao_fantasia();

-- ---------------------------------------------------------------------
-- 5. Quem saiu da escala deixa de ver o evento
--    Exceção: evento cancelado continua visível para quem foi avisado,
--    porque o cancelamento desativa toda a escala.
-- ---------------------------------------------------------------------

create or replace function participa_do_evento(p_evento_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from evento_escala x
    join eventos e on e.id = x.evento_id
    where x.evento_id = p_evento_id
      and x.profissional_id = meu_profissional_id()
      and (x.ativo or e.situacao = 'cancelado')
  )
$$;

create or replace function colega_de_evento(p_profissional_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from evento_escala minha
    join evento_escala outra on outra.evento_id = minha.evento_id
    where minha.profissional_id = meu_profissional_id()
      and outra.profissional_id = p_profissional_id
      and minha.ativo and outra.ativo
  )
$$;

-- ---------------------------------------------------------------------
-- 6. Observações internas em tabelas só da operação
--    (as permissões escolhem linhas, não colunas: o que a equipe não
--    deve ler não pode ficar na mesma linha que ela lê)
-- ---------------------------------------------------------------------

create table profissionais_notas (
  profissional_id uuid primary key references profissionais (id) on delete cascade,
  observacoes     text not null,
  atualizado_em   timestamptz not null default now()
);

create table contratantes_notas (
  contratante_id uuid primary key references contratantes (id) on delete cascade,
  observacoes    text not null,
  atualizado_em  timestamptz not null default now()
);

insert into profissionais_notas (profissional_id, observacoes)
select id, observacoes from profissionais where coalesce(trim(observacoes), '') <> '';
insert into contratantes_notas (contratante_id, observacoes)
select id, observacoes from contratantes where coalesce(trim(observacoes), '') <> '';

alter table profissionais drop column observacoes;
alter table contratantes  drop column observacoes;

alter table profissionais_notas enable row level security;
alter table contratantes_notas  enable row level security;

create policy pnota_tudo on profissionais_notas for all to authenticated
  using (eh_operacao()) with check (eh_operacao());
create policy cnota_tudo on contratantes_notas for all to authenticated
  using (eh_operacao()) with check (eh_operacao());

-- ---------------------------------------------------------------------
-- 7. Despesas: aprovação só pela gestão (substitui a função do schema)
-- ---------------------------------------------------------------------

create or replace function classificar_despesa() returns trigger
language plpgsql set search_path = public as $$
declare
  v_limite numeric := nullif(config_texto('despesa_aprovacao_acima_de'), '')::numeric;
begin
  if tg_op = 'INSERT' then
    if not eh_gestao() then
      -- quem não é da gestão não escolhe a situação nem quem aprovou
      new.aprovacao    := 'nao_requer';
      new.aprovado_por := null;
      new.aprovado_em  := null;
    end if;
    if v_limite is not null and new.valor > v_limite and new.aprovacao <> 'aprovada' then
      new.aprovacao := 'pendente';
    end if;
  end if;

  if new.aprovacao in ('aprovada', 'recusada')
     and (tg_op = 'INSERT' or old.aprovacao is distinct from new.aprovacao) then
    new.aprovado_por := auth.uid();
    new.aprovado_em  := now();
  end if;

  return new;
end;
$$;

drop trigger despesa_classificar on despesas;
create trigger despesa_classificar before insert or update on despesas
  for each row execute function classificar_despesa();

-- ---------------------------------------------------------------------
-- 8. Funções do banco só para quem fez login
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
