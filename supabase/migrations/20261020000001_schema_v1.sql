-- =====================================================================
-- Mundinho Kids — estrutura do banco de dados (V1)
-- PostgreSQL 15+ / Supabase. Versão para validação.
--
-- Pontos marcados com "A CONFIRMAR" dependem das respostas da direção
-- (seção 15 do briefing). Quando possível, eles viram um valor na
-- tabela `configuracoes`, para mudar sem alterar a estrutura.
--
-- O sistema não guarda imagens, vídeos nem arquivos. O formulário do
-- produtor (feedback e vídeo) fica fora do sistema; aqui só o link.
-- =====================================================================

create extension if not exists btree_gist;   -- necessário para as travas de conflito de horário

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------

create type perfil_acesso as enum (
  'diretora', 'gerente', 'supervisora', 'produtor', 'artista', 'maquiador', 'fantasias'
);
create type funcao_profissional  as enum ('artista', 'produtor', 'maquiador', 'fantasias');
create type funcao_escala        as enum ('artista', 'produtor', 'maquiador');
create type situacao_evento      as enum ('agendado', 'confirmado', 'realizado', 'cancelado');
-- "em uso" não é guardado: é calculado pela escala (ver vw_fantasias)
create type situacao_fantasia    as enum ('disponivel', 'limpeza', 'manutencao', 'inativa');
create type situacao_pagamento   as enum ('pendente', 'pago');
create type situacao_aprovacao   as enum ('nao_requer', 'pendente', 'aprovada', 'recusada');
create type situacao_substituicao as enum (
  'aguardando_aceite', 'aguardando_aprovacao', 'aprovada', 'recusada', 'cancelada'
);
create type condicao_peca        as enum ('ok', 'danificada', 'faltando');

-- ---------------------------------------------------------------------
-- 2. Configurações (respostas da direção viram valores aqui)
-- ---------------------------------------------------------------------

create table configuracoes (
  chave     text primary key,
  valor     text not null,
  descricao text
);

insert into configuracoes (chave, valor, descricao) values
  ('link_formulario_produtor',          '',      'Link do formulário de feedback atual (aberto em cada evento)'),
  ('link_respostas_formulario',         '',      'Atalho da direção para onde as respostas já ficam hoje'),
  ('lembrete_antecedencia_minutos',     '120',   'Último aviso antes do evento (definido: 2 horas)'),
  ('substituicao_antecedencia_minutos', '90',    'A CONFIRMAR (pergunta 5): antecedência mínima para pedir troca'),
  ('supervisora_pode_cancelar',         'false', 'A CONFIRMAR (pergunta 3)'),
  ('supervisora_pode_alterar_equipe',   'false', 'A CONFIRMAR (pergunta 4): alterar equipe já escalada'),
  ('despesa_aprovacao_acima_de',        '',      'A CONFIRMAR (pergunta 2): valor a partir do qual a despesa precisa de aprovação; vazio = nunca');

-- ---------------------------------------------------------------------
-- 3. Pessoas e acesso
-- ---------------------------------------------------------------------

-- Quem faz login. O id é o mesmo do usuário no Supabase Auth.
create table usuarios (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,
  email     text not null unique,
  perfil    perfil_acesso not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cadastro de profissionais. Pode existir antes de a pessoa ter login.
create table profissionais (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid unique references usuarios (id),
  nome            text not null,
  telefone        text,
  email           text,
  funcoes         funcao_profissional[] not null default '{}',
  disponibilidade text,                 -- observação livre (ex.: "só fins de semana")
  observacoes     text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Cadastros
-- ---------------------------------------------------------------------

create table personagens (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  descricao   text,
  referencias text,                     -- links de referência visual (sem upload)
  orientacoes text,                     -- orientações para a apresentação
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Quais personagens cada artista pode fazer
create table profissional_personagens (
  profissional_id uuid not null references profissionais (id) on delete cascade,
  personagem_id   uuid not null references personagens (id) on delete cascade,
  primary key (profissional_id, personagem_id)
);

create table contratantes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  email       text,
  observacoes text,
  criado_em   timestamptz not null default now()
);

create table locais (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  tipo               text not null default 'buffet',
  endereco           text,
  contato            text,
  link_localizacao   text,
  orientacoes_acesso text,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

create table fantasias (
  id            uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references personagens (id),
  identificacao text not null,          -- ex.: "Elsa 1", "Elsa infantil"
  tamanho       text,
  quantidade    int not null default 1 check (quantidade > 0),
  situacao      situacao_fantasia not null default 'disponivel',
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create table veiculos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,            -- hoje: Doblò
  placa       text unique,
  observacoes text,
  ativo       boolean not null default true
);

-- ---------------------------------------------------------------------
-- 5. Eventos e escala
-- ---------------------------------------------------------------------

create table eventos (
  id                  uuid primary key default gen_random_uuid(),
  contratante_id      uuid not null references contratantes (id),
  local_id            uuid not null references locais (id),
  inicio              timestamptz not null,
  fim                 timestamptz not null,
  periodo             tstzrange generated always as (tstzrange(inicio, fim, '[)')) stored,
  situacao            situacao_evento not null default 'agendado',
  tem_maquiagem       boolean not null default false,
  orientacoes         text,
  motivo_cancelamento text,
  google_agenda_id    text,             -- id do evento criado no Google Agenda da empresa
  criado_por          uuid references usuarios (id) default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (fim > inicio)
);

-- Remarcações ficam registradas com a data anterior e o motivo
create table evento_remarcacoes (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos (id),
  inicio_anterior timestamptz not null,
  fim_anterior    timestamptz not null,
  inicio_novo     timestamptz not null,
  fim_novo        timestamptz not null,
  motivo          text not null,
  alterado_por    uuid references usuarios (id) default auth.uid(),
  alterado_em     timestamptz not null default now()
);

-- Equipe do evento: artistas (com personagem e fantasia), produtores e maquiadores.
-- Ninguém sai da tabela: quem deixa a escala fica com ativo = false (histórico).
create table evento_escala (
  id                uuid primary key default gen_random_uuid(),
  evento_id         uuid not null references eventos (id),
  profissional_id   uuid not null references profissionais (id),
  funcao            funcao_escala not null,
  personagem_id     uuid references personagens (id),
  fantasia_id       uuid references fantasias (id),
  maquiar           boolean not null default false,
  horario_maquiagem timestamptz,
  periodo           tstzrange not null,  -- copiado do evento automaticamente
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  check (funcao = 'artista' or (personagem_id is null and fantasia_id is null)),
  check (fantasia_id is null or personagem_id is not null),

  -- Regra definida: ninguém em dois eventos no mesmo horário
  constraint escala_conflito_profissional
    exclude using gist (profissional_id with =, periodo with &&) where (ativo),
  -- Regra definida: personagem não pode estar em dois eventos no mesmo horário
  constraint escala_conflito_personagem
    exclude using gist (personagem_id with =, periodo with &&) where (ativo and personagem_id is not null),
  constraint escala_conflito_fantasia
    exclude using gist (fantasia_id with =, periodo with &&) where (ativo and fantasia_id is not null)
);

-- Reserva de veículo: o período vai da retirada até a devolução prevista
create table reservas_veiculo (
  id                 uuid primary key default gen_random_uuid(),
  veiculo_id         uuid not null references veiculos (id),
  evento_id          uuid references eventos (id),
  responsavel_id     uuid not null references profissionais (id),
  retirada           timestamptz not null,
  devolucao_prevista timestamptz not null,
  devolvido_em       timestamptz,
  periodo            tstzrange generated always as (tstzrange(retirada, devolucao_prevista, '[)')) stored,
  observacoes        text,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  check (devolucao_prevista > retirada),
  constraint reserva_conflito_veiculo
    exclude using gist (veiculo_id with =, periodo with &&) where (ativo)
);

-- ---------------------------------------------------------------------
-- 6. Financeiro (separado em três grupos, como no briefing)
-- ---------------------------------------------------------------------

-- Grupo 1: o que o cliente paga
create table evento_financeiro (
  evento_id        uuid primary key references eventos (id),
  valor_contratado numeric(10, 2) not null default 0 check (valor_contratado >= 0),
  observacoes      text,
  atualizado_em    timestamptz not null default now()
);

create table recebimentos (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references eventos (id),
  valor       numeric(10, 2) not null check (valor > 0),
  recebido_em date not null default current_date,
  forma       text,                     -- pix, dinheiro, cartão...
  observacoes text,
  criado_em   timestamptz not null default now()
);
-- A CONFIRMAR (pergunta 1): multa, sinal ou crédito em cancelamento.
-- Se existir, entra como um recebimento ou numa tabela própria.

-- Grupo 2: o que a empresa paga aos profissionais
create table pagamentos_profissionais (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos (id),
  profissional_id uuid not null references profissionais (id),
  valor_combinado numeric(10, 2) not null check (valor_combinado >= 0),
  situacao        situacao_pagamento not null default 'pendente',
  pago_em         date,
  observacoes     text,
  unique (evento_id, profissional_id)
);

-- Grupo 3: despesas do evento e compras de insumos
create table despesas (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid references eventos (id),   -- vazio = despesa geral (ex.: insumo de estoque)
  tipo           text not null default 'extra' check (tipo in ('extra', 'insumo')),
  descricao      text not null,
  valor          numeric(10, 2) not null check (valor > 0),
  responsavel_id uuid references profissionais (id),
  comprovante    text,                  -- referência ou link (o sistema não guarda arquivos)
  aprovacao      situacao_aprovacao not null default 'nao_requer',
  aprovado_por   uuid references usuarios (id),
  aprovado_em    timestamptz,
  observacoes    text,
  criado_por     uuid references usuarios (id) default auth.uid(),
  criado_em      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Substituição de artistas
-- ---------------------------------------------------------------------

create table substituicoes (
  id             uuid primary key default gen_random_uuid(),
  escala_id      uuid not null references evento_escala (id),
  solicitante_id uuid not null references profissionais (id),
  substituto_id  uuid not null references profissionais (id),
  motivo         text,
  situacao       situacao_substituicao not null default 'aguardando_aceite',
  solicitado_em  timestamptz not null default now(),
  respondido_em  timestamptz,
  decidido_por   uuid references usuarios (id),
  decidido_em    timestamptz,
  check (solicitante_id <> substituto_id)
);

-- Só um pedido em andamento por vaga na escala
create unique index substituicoes_um_pedido_aberto
  on substituicoes (escala_id) where situacao in ('aguardando_aceite', 'aguardando_aprovacao');

-- ---------------------------------------------------------------------
-- 8. Conferência das fantasias depois do evento
-- ---------------------------------------------------------------------

create table conferencias_fantasia (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos (id),
  fantasia_id     uuid not null references fantasias (id),
  responsavel_id  uuid references usuarios (id) default auth.uid(),
  devolvida       boolean not null,
  condicao        condicao_peca not null default 'ok',
  precisa_limpeza boolean not null default false,
  precisa_reparo  boolean not null default false,
  pendencias      text,
  conferido_em    timestamptz not null default now(),
  unique (evento_id, fantasia_id)
);

-- ---------------------------------------------------------------------
-- 9. Notificações (push do sistema) e histórico
-- ---------------------------------------------------------------------

create table push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade default auth.uid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  criado_em  timestamptz not null default now()
);

-- Fila lida por uma Edge Function a cada 5 minutos (pg_cron)
create table notificacoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios (id) on delete cascade,
  evento_id     uuid references eventos (id),
  tipo          text not null check (tipo in
                  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao')),
  mensagem      text,
  agendada_para timestamptz not null default now(),
  enviada_em    timestamptz,
  erro          text,
  criado_em     timestamptz not null default now()
);

create table historico (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid,
  evento_id   uuid,
  acao        text not null,            -- INSERT ou UPDATE
  financeiro  boolean not null default false,
  antes       jsonb,
  depois      jsonb,
  usuario_id  uuid default auth.uid(),
  em          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. Índices
-- ---------------------------------------------------------------------

create index eventos_inicio_idx              on eventos (inicio);
create index evento_escala_evento_idx        on evento_escala (evento_id);
create index evento_escala_profissional_idx  on evento_escala (profissional_id);
create index reservas_veiculo_evento_idx     on reservas_veiculo (evento_id);
create index recebimentos_evento_idx         on recebimentos (evento_id);
create index pagamentos_profissional_idx     on pagamentos_profissionais (profissional_id);
create index despesas_evento_idx             on despesas (evento_id);
create index historico_evento_idx            on historico (evento_id, em desc);
create index notificacoes_pendentes_idx      on notificacoes (agendada_para) where enviada_em is null;

-- ---------------------------------------------------------------------
-- 11. Funções auxiliares de permissão
-- ---------------------------------------------------------------------

create function config_texto(p_chave text) returns text
language sql stable security definer set search_path = public as $$
  select valor from configuracoes where chave = p_chave
$$;

create function meu_perfil() returns perfil_acesso
language sql stable security definer set search_path = public as $$
  select perfil from usuarios where id = auth.uid() and ativo
$$;

-- Diretora e gerente: veem valores
create function eh_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil() in ('diretora', 'gerente'), false)
$$;

-- Diretora, gerente e supervisora: cadastram e editam eventos
create function eh_operacao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil() in ('diretora', 'gerente', 'supervisora'), false)
$$;

create function meu_profissional_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profissionais where usuario_id = auth.uid()
$$;

create function participa_do_evento(p_evento_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from evento_escala
    where evento_id = p_evento_id and profissional_id = meu_profissional_id()
  )
$$;

-- Produtor e equipe enxergam os colegas de um mesmo evento
create function colega_de_evento(p_profissional_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from evento_escala minha
    join evento_escala outra on outra.evento_id = minha.evento_id
    where minha.profissional_id = meu_profissional_id()
      and outra.profissional_id = p_profissional_id
  )
$$;

create function contratante_visivel(p_contratante_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eventos e
    where e.contratante_id = p_contratante_id and participa_do_evento(e.id)
  )
$$;

create function pode_cancelar_evento() returns boolean
language sql stable security definer set search_path = public as $$
  select eh_gestao()
      or (meu_perfil() = 'supervisora' and config_texto('supervisora_pode_cancelar') = 'true')
$$;

create function pode_alterar_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select eh_gestao()
      or (meu_perfil() = 'supervisora' and config_texto('supervisora_pode_alterar_equipe') = 'true')
$$;

-- ---------------------------------------------------------------------
-- 12. Regras automáticas (triggers)
-- ---------------------------------------------------------------------

-- 12.1 Histórico de alterações
create function registrar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_linha  jsonb;
begin
  if tg_op = 'INSERT' then
    v_depois := to_jsonb(new);
    v_linha  := v_depois;
  else
    v_antes  := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_linha  := v_depois;
    if v_antes = v_depois then
      return null;
    end if;
  end if;

  insert into historico (tabela, registro_id, evento_id, acao, financeiro, antes, depois)
  values (
    tg_table_name,
    coalesce(v_linha ->> 'id', v_linha ->> 'evento_id')::uuid,
    case when tg_table_name = 'eventos' then v_linha ->> 'id' else v_linha ->> 'evento_id' end::uuid,
    tg_op,
    coalesce(tg_argv[0], 'false')::boolean,
    v_antes,
    v_depois
  );
  return null;
end;
$$;

create trigger historico_eventos         after insert or update on eventos                  for each row execute function registrar_historico();
create trigger historico_escala          after insert or update on evento_escala            for each row execute function registrar_historico();
create trigger historico_reservas        after insert or update on reservas_veiculo         for each row execute function registrar_historico();
create trigger historico_financeiro      after insert or update on evento_financeiro        for each row execute function registrar_historico('true');
create trigger historico_recebimentos    after insert or update on recebimentos             for each row execute function registrar_historico('true');
create trigger historico_pagamentos      after insert or update on pagamentos_profissionais for each row execute function registrar_historico('true');
create trigger historico_despesas        after insert or update on despesas                 for each row execute function registrar_historico('true');

-- 12.2 Proteção do evento: cancelamento com permissão e motivo; data só por remarcação
create function proteger_evento() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    if not pode_cancelar_evento() then
      raise exception 'Seu perfil não pode cancelar eventos.';
    end if;
    if coalesce(trim(new.motivo_cancelamento), '') = '' then
      raise exception 'Informe o motivo do cancelamento.';
    end if;
  end if;

  if old.situacao = 'cancelado' and new.situacao <> 'cancelado' then
    raise exception 'Evento cancelado não pode ser reaberto. Crie um novo evento.';
  end if;

  if (new.inicio, new.fim) is distinct from (old.inicio, old.fim)
     and coalesce(current_setting('app.remarcacao', true), '') <> 'on' then
    raise exception 'Para mudar data ou horário, use a remarcação informando o motivo.';
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create trigger eventos_proteger before update on eventos
  for each row execute function proteger_evento();

-- 12.3 Validações da escala
create function validar_escala() returns trigger
language plpgsql set search_path = public as $$
declare
  v_evento eventos%rowtype;
begin
  select * into v_evento from eventos where id = new.evento_id;

  if new.ativo and v_evento.situacao = 'cancelado' then
    raise exception 'Evento cancelado não pode receber escala.';
  end if;

  new.periodo := v_evento.periodo;   -- sempre o período do evento

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
    if not exists (select 1 from fantasias where id = new.fantasia_id and personagem_id = new.personagem_id) then
      raise exception 'A fantasia escolhida não é deste personagem.';
    end if;
    if exists (select 1 from fantasias where id = new.fantasia_id and situacao <> 'disponivel') then
      raise exception 'Fantasia indisponível (limpeza, manutenção ou inativa).';
    end if;
  end if;

  return new;
end;
$$;

create trigger escala_validar before insert or update on evento_escala
  for each row execute function validar_escala();

-- 12.4 Avisos para a equipe ao entrar ou sair da escala
create function notificar_escala() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_usuario  uuid;
  v_evento   eventos%rowtype;
  v_minutos  int := coalesce(nullif(config_texto('lembrete_antecedencia_minutos'), '')::int, 120);
begin
  select usuario_id into v_usuario from profissionais where id = new.profissional_id;
  if v_usuario is null then
    return null;                      -- profissional ainda sem login: sem push
  end if;
  select * into v_evento from eventos where id = new.evento_id;

  if tg_op = 'INSERT' and new.ativo then
    insert into notificacoes (usuario_id, evento_id, tipo) values (v_usuario, new.evento_id, 'escalado');
    insert into notificacoes (usuario_id, evento_id, tipo, agendada_para)
    values (v_usuario, new.evento_id, 'lembrete', v_evento.inicio - make_interval(mins => v_minutos));

  elsif tg_op = 'UPDATE' and old.ativo and not new.ativo then
    delete from notificacoes
    where usuario_id = v_usuario and evento_id = new.evento_id and tipo = 'lembrete' and enviada_em is null;
    insert into notificacoes (usuario_id, evento_id, tipo)
    values (v_usuario, new.evento_id,
            case when v_evento.situacao = 'cancelado' then 'cancelado' else 'removido' end);
  end if;

  return null;
end;
$$;

create trigger escala_notificar after insert or update of ativo on evento_escala
  for each row execute function notificar_escala();

-- 12.5 Cancelamento e remarcação refletem na escala, reservas e avisos
create function propagar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_minutos int := coalesce(nullif(config_texto('lembrete_antecedencia_minutos'), '')::int, 120);
begin
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    -- libera equipe, personagens, fantasias e veículo (o registro fica no histórico)
    update evento_escala    set ativo = false where evento_id = new.id and ativo;
    update reservas_veiculo set ativo = false where evento_id = new.id and ativo;

  elsif new.periodo is distinct from old.periodo then
    -- a nova data passa pelas mesmas travas de conflito
    update evento_escala set periodo = new.periodo where evento_id = new.id and ativo;

    update notificacoes
       set agendada_para = new.inicio - make_interval(mins => v_minutos)
     where evento_id = new.id and tipo = 'lembrete' and enviada_em is null;

    insert into notificacoes (usuario_id, evento_id, tipo)
    select p.usuario_id, new.id, 'alterado'
    from evento_escala e
    join profissionais p on p.id = e.profissional_id
    where e.evento_id = new.id and e.ativo and p.usuario_id is not null;
  end if;

  return null;
end;
$$;

create trigger eventos_propagar after update on eventos
  for each row execute function propagar_evento();

-- 12.6 Conferência atualiza a situação da fantasia
create function aplicar_conferencia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.precisa_reparo or new.condicao = 'danificada' then
    update fantasias set situacao = 'manutencao' where id = new.fantasia_id;
  elsif new.precisa_limpeza then
    update fantasias set situacao = 'limpeza' where id = new.fantasia_id;
  end if;
  return null;
end;
$$;

create trigger conferencia_aplicar after insert or update on conferencias_fantasia
  for each row execute function aplicar_conferencia();

-- 12.7 Despesa acima do limite entra como "pendente" de aprovação
create function classificar_despesa() returns trigger
language plpgsql set search_path = public as $$
declare
  v_limite numeric := nullif(config_texto('despesa_aprovacao_acima_de'), '')::numeric;
begin
  if tg_op = 'INSERT' and v_limite is not null and new.valor > v_limite then
    new.aprovacao := 'pendente';
  end if;
  return new;
end;
$$;

create trigger despesa_classificar before insert on despesas
  for each row execute function classificar_despesa();

-- ---------------------------------------------------------------------
-- 13. Ações do sistema (chamadas pelo app via RPC)
-- ---------------------------------------------------------------------

create function cancelar_evento(p_evento_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update eventos
     set situacao = 'cancelado', motivo_cancelamento = p_motivo
   where id = p_evento_id and situacao <> 'cancelado';
  if not found then
    raise exception 'Evento não encontrado ou já cancelado.';
  end if;
end;
$$;

create function remarcar_evento(p_evento_id uuid, p_inicio timestamptz, p_fim timestamptz, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_evento eventos%rowtype;
begin
  if not eh_operacao() then
    raise exception 'Seu perfil não pode remarcar eventos.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da remarcação.';
  end if;

  select * into v_evento from eventos where id = p_evento_id for update;
  if not found then
    raise exception 'Evento não encontrado.';
  end if;
  if v_evento.situacao in ('cancelado', 'realizado') then
    raise exception 'Evento % não pode ser remarcado.', v_evento.situacao;
  end if;

  insert into evento_remarcacoes (evento_id, inicio_anterior, fim_anterior, inicio_novo, fim_novo, motivo)
  values (p_evento_id, v_evento.inicio, v_evento.fim, p_inicio, p_fim, p_motivo);

  perform set_config('app.remarcacao', 'on', true);
  update eventos set inicio = p_inicio, fim = p_fim where id = p_evento_id;
  perform set_config('app.remarcacao', 'off', true);
end;
$$;

-- Artistas que fazem o personagem e estão livres no horário (passo 1 do fluxo)
create function substitutos_disponiveis(p_escala_id uuid)
returns table (profissional_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome
  from evento_escala e
  join profissional_personagens pp on pp.personagem_id = e.personagem_id
  join profissionais p on p.id = pp.profissional_id
  where e.id = p_escala_id
    and (eh_operacao() or e.profissional_id = meu_profissional_id())
    and p.ativo
    and 'artista' = any (p.funcoes)
    and p.id <> e.profissional_id
    and not exists (
      select 1 from evento_escala x
      where x.profissional_id = p.id and x.ativo and x.periodo && e.periodo
    )
  order by p.nome
$$;

create function solicitar_substituicao(p_escala_id uuid, p_substituto_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_escala   evento_escala%rowtype;
  v_inicio   timestamptz;
  v_minutos  int := coalesce(nullif(config_texto('substituicao_antecedencia_minutos'), '')::int, 90);
  v_id       uuid;
begin
  select * into v_escala from evento_escala where id = p_escala_id;
  if not found or not v_escala.ativo then
    raise exception 'Escala não encontrada.';
  end if;
  if v_escala.profissional_id is distinct from meu_profissional_id() then
    raise exception 'Só o artista escalado pode pedir a própria troca.';
  end if;
  if v_escala.funcao <> 'artista' then
    raise exception 'A troca pelo sistema é só para artistas.';
  end if;

  select inicio into v_inicio from eventos where id = v_escala.evento_id;
  if now() > v_inicio - make_interval(mins => v_minutos) then
    raise exception 'Prazo para pedir troca encerrado. Fale com a gerente ou a direção.';
  end if;

  if not exists (select 1 from substitutos_disponiveis(p_escala_id) s where s.profissional_id = p_substituto_id) then
    raise exception 'Este artista não faz o personagem ou não está livre no horário.';
  end if;

  insert into substituicoes (escala_id, solicitante_id, substituto_id, motivo)
  values (p_escala_id, v_escala.profissional_id, p_substituto_id, p_motivo)
  returning id into v_id;

  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select p.usuario_id, v_escala.evento_id, 'substituicao', 'Você foi indicado para assumir um evento'
  from profissionais p where p.id = p_substituto_id and p.usuario_id is not null;

  return v_id;
end;
$$;

-- Passo 2: o artista indicado aceita ou recusa
create function responder_substituicao(p_substituicao_id uuid, p_aceita boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub substituicoes%rowtype;
begin
  select * into v_sub from substituicoes where id = p_substituicao_id for update;
  if not found or v_sub.situacao <> 'aguardando_aceite' then
    raise exception 'Pedido não está aguardando resposta.';
  end if;
  if v_sub.substituto_id is distinct from meu_profissional_id() then
    raise exception 'Só o artista indicado pode responder.';
  end if;

  update substituicoes
     set situacao = case when p_aceita then 'aguardando_aprovacao'::situacao_substituicao
                         else 'recusada'::situacao_substituicao end,
         respondido_em = now()
   where id = p_substituicao_id;

  -- A CONFIRMAR (pergunta 7): quem mais é avisado em caso de recusa
  insert into notificacoes (usuario_id, tipo, mensagem)
  select u.id, 'substituicao',
         case when p_aceita then 'Troca de artista aguardando aprovação' else 'Artista indicado recusou a troca' end
  from usuarios u
  where u.ativo and (u.perfil in ('diretora', 'gerente')
                     or u.id = (select usuario_id from profissionais where id = v_sub.solicitante_id));
end;
$$;

-- Passo 3 e 4: gerente ou diretora aprova; a escala é atualizada
create function decidir_substituicao(p_substituicao_id uuid, p_aprova boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub    substituicoes%rowtype;
  v_escala evento_escala%rowtype;
begin
  if not eh_gestao() then
    raise exception 'Só a gerente ou a direção aprovam trocas.';
  end if;

  select * into v_sub from substituicoes where id = p_substituicao_id for update;
  if not found or v_sub.situacao <> 'aguardando_aprovacao' then
    raise exception 'Pedido não está aguardando aprovação.';
  end if;

  update substituicoes
     set situacao = case when p_aprova then 'aprovada'::situacao_substituicao
                         else 'recusada'::situacao_substituicao end,
         decidido_por = auth.uid(), decidido_em = now()
   where id = p_substituicao_id;

  if p_aprova then
    select * into v_escala from evento_escala where id = v_sub.escala_id;
    update evento_escala set ativo = false where id = v_escala.id;
    insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id, maquiar, horario_maquiagem)
    values (v_escala.evento_id, v_sub.substituto_id, v_escala.funcao, v_escala.personagem_id,
            v_escala.fantasia_id, v_escala.maquiar, v_escala.horario_maquiagem);
    -- o pagamento do evento continua com a gestão (ajustar em pagamentos_profissionais)
  end if;
end;
$$;

-- Até a aprovação, o artista original pode desistir do pedido
create function cancelar_substituicao(p_substituicao_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update substituicoes
     set situacao = 'cancelada'
   where id = p_substituicao_id
     and solicitante_id = meu_profissional_id()
     and situacao in ('aguardando_aceite', 'aguardando_aprovacao');
  if not found then
    raise exception 'Pedido não encontrado ou já finalizado.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 14. Visões
-- ---------------------------------------------------------------------

-- Situação do recebimento calculada (pendente, parcial ou pago)
create view vw_evento_financeiro with (security_invoker = true) as
select f.evento_id,
       f.valor_contratado,
       coalesce(sum(r.valor), 0) as valor_recebido,
       case
         when coalesce(sum(r.valor), 0) = 0                then 'pendente'
         when coalesce(sum(r.valor), 0) < f.valor_contratado then 'parcial'
         else 'pago'
       end as situacao_recebimento
from evento_financeiro f
left join recebimentos r on r.evento_id = f.evento_id
group by f.evento_id, f.valor_contratado;

-- Fantasia "em uso" quando está numa escala ativa agora
create view vw_fantasias with (security_invoker = true) as
select f.*,
       case
         when f.situacao <> 'disponivel' then f.situacao::text
         when exists (
           select 1 from evento_escala e
           where e.fantasia_id = f.id and e.ativo and e.periodo @> now()
         ) then 'em_uso'
         else 'disponivel'
       end as situacao_atual
from fantasias f;

-- ---------------------------------------------------------------------
-- 15. Permissões (Row Level Security)
-- ---------------------------------------------------------------------

alter table configuracoes            enable row level security;
alter table usuarios                 enable row level security;
alter table profissionais            enable row level security;
alter table personagens              enable row level security;
alter table profissional_personagens enable row level security;
alter table contratantes             enable row level security;
alter table locais                   enable row level security;
alter table fantasias                enable row level security;
alter table veiculos                 enable row level security;
alter table eventos                  enable row level security;
alter table evento_remarcacoes       enable row level security;
alter table evento_escala            enable row level security;
alter table reservas_veiculo         enable row level security;
alter table evento_financeiro        enable row level security;
alter table recebimentos             enable row level security;
alter table pagamentos_profissionais enable row level security;
alter table despesas                 enable row level security;
alter table substituicoes            enable row level security;
alter table conferencias_fantasia    enable row level security;
alter table push_inscricoes          enable row level security;
alter table notificacoes             enable row level security;
alter table historico                enable row level security;

-- Configurações: todos leem, só a gestão altera
create policy cfg_ler      on configuracoes for select to authenticated using (true);
create policy cfg_alterar  on configuracoes for update to authenticated using (eh_gestao()) with check (eh_gestao());

-- Usuários (logins e perfis): cada um vê o próprio; operação vê todos; gestão cria e altera
create policy usu_ler      on usuarios for select to authenticated using (id = auth.uid() or eh_operacao());
create policy usu_criar    on usuarios for insert to authenticated with check (eh_gestao());
create policy usu_alterar  on usuarios for update to authenticated using (eh_gestao()) with check (eh_gestao());

-- Profissionais: operação cadastra; cada um vê o próprio e os colegas de evento
create policy prof_ler     on profissionais for select to authenticated
  using (eh_operacao() or usuario_id = auth.uid() or colega_de_evento(id));
create policy prof_criar   on profissionais for insert to authenticated with check (eh_operacao());
create policy prof_alterar on profissionais for update to authenticated using (eh_operacao()) with check (eh_operacao());

-- Cadastros de apoio: todos leem; operação altera
create policy pers_ler     on personagens for select to authenticated using (true);
create policy pers_criar   on personagens for insert to authenticated with check (eh_operacao());
create policy pers_alterar on personagens for update to authenticated using (eh_operacao()) with check (eh_operacao());

create policy pp_ler       on profissional_personagens for select to authenticated using (true);
create policy pp_criar     on profissional_personagens for insert to authenticated with check (eh_operacao());
create policy pp_remover   on profissional_personagens for delete to authenticated using (eh_operacao());

create policy loc_ler      on locais for select to authenticated using (true);
create policy loc_criar    on locais for insert to authenticated with check (eh_operacao());
create policy loc_alterar  on locais for update to authenticated using (eh_operacao()) with check (eh_operacao());

create policy vei_ler      on veiculos for select to authenticated using (true);
create policy vei_criar    on veiculos for insert to authenticated with check (eh_operacao());
create policy vei_alterar  on veiculos for update to authenticated using (eh_operacao()) with check (eh_operacao());

create policy fan_ler      on fantasias for select to authenticated using (true);
create policy fan_criar    on fantasias for insert to authenticated with check (eh_operacao());
create policy fan_alterar  on fantasias for update to authenticated
  using (eh_operacao() or meu_perfil() = 'fantasias') with check (eh_operacao() or meu_perfil() = 'fantasias');

-- Contratantes: operação vê todos; profissional vê os dos próprios eventos
create policy cont_ler     on contratantes for select to authenticated
  using (eh_operacao() or contratante_visivel(id));
create policy cont_criar   on contratantes for insert to authenticated with check (eh_operacao());
create policy cont_alterar on contratantes for update to authenticated using (eh_operacao()) with check (eh_operacao());

-- Eventos: operação vê e edita todos; profissional vê só onde participa. Sem exclusão.
create policy ev_ler       on eventos for select to authenticated
  using (eh_operacao() or meu_perfil() = 'fantasias' or participa_do_evento(id));
create policy ev_criar     on eventos for insert to authenticated with check (eh_operacao());
create policy ev_alterar   on eventos for update to authenticated using (eh_operacao()) with check (eh_operacao());

create policy rem_ler      on evento_remarcacoes for select to authenticated
  using (eh_operacao() or participa_do_evento(evento_id));

-- Escala: operação monta; alterar equipe já escalada depende do perfil (A CONFIRMAR)
create policy esc_ler      on evento_escala for select to authenticated
  using (eh_operacao() or meu_perfil() = 'fantasias' or participa_do_evento(evento_id));
create policy esc_criar    on evento_escala for insert to authenticated with check (eh_operacao());
create policy esc_alterar  on evento_escala for update to authenticated
  using (pode_alterar_equipe()) with check (pode_alterar_equipe());

-- Veículos: todos veem a ocupação; produtor reserva em nome próprio
create policy res_ler      on reservas_veiculo for select to authenticated using (true);
create policy res_criar    on reservas_veiculo for insert to authenticated
  with check (eh_operacao()
              or (meu_perfil() = 'produtor' and responsavel_id = meu_profissional_id()
                  and (evento_id is null or participa_do_evento(evento_id))));
create policy res_alterar  on reservas_veiculo for update to authenticated
  using (eh_operacao() or responsavel_id = meu_profissional_id())
  with check (eh_operacao() or responsavel_id = meu_profissional_id());

-- Financeiro do evento e recebimentos: só diretora e gerente
create policy fin_tudo     on evento_financeiro for all to authenticated using (eh_gestao()) with check (eh_gestao());
create policy rec_tudo     on recebimentos      for all to authenticated using (eh_gestao()) with check (eh_gestao());

-- Pagamento dos profissionais: gestão vê todos; cada profissional vê só o próprio valor
create policy pag_ler      on pagamentos_profissionais for select to authenticated
  using (eh_gestao() or profissional_id = meu_profissional_id());
create policy pag_criar    on pagamentos_profissionais for insert to authenticated with check (eh_gestao());
create policy pag_alterar  on pagamentos_profissionais for update to authenticated using (eh_gestao()) with check (eh_gestao());

-- Despesas: gestão vê todas; quem lançou vê as próprias. A CONFIRMAR: quem pode lançar.
create policy desp_ler     on despesas for select to authenticated using (eh_gestao() or criado_por = auth.uid());
create policy desp_criar   on despesas for insert to authenticated
  with check (eh_gestao()
              or (criado_por = auth.uid() and evento_id is not null and participa_do_evento(evento_id)));
create policy desp_alterar on despesas for update to authenticated using (eh_gestao()) with check (eh_gestao());

-- Substituições: leitura para envolvidos e operação; escrita só pelas funções acima
create policy sub_ler      on substituicoes for select to authenticated
  using (eh_operacao()
         or solicitante_id = meu_profissional_id()
         or substituto_id  = meu_profissional_id());

-- Conferência de fantasias: responsável pelas fantasias e operação
create policy conf_ler     on conferencias_fantasia for select to authenticated
  using (eh_operacao() or meu_perfil() = 'fantasias');
create policy conf_criar   on conferencias_fantasia for insert to authenticated
  with check (eh_operacao() or meu_perfil() = 'fantasias');
create policy conf_alterar on conferencias_fantasia for update to authenticated
  using (eh_operacao() or meu_perfil() = 'fantasias') with check (eh_operacao() or meu_perfil() = 'fantasias');

-- Push e notificações: cada um cuida das próprias
create policy push_proprio on push_inscricoes for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy not_ler      on notificacoes for select to authenticated using (usuario_id = auth.uid());

-- Histórico: gestão vê tudo; supervisora vê sem as alterações financeiras
create policy hist_ler     on historico for select to authenticated
  using (eh_gestao() or (meu_perfil() = 'supervisora' and not financeiro));

-- Nada é excluído pelo app: eventos cancelam, escala desativa, histórico é permanente
revoke delete on eventos, evento_escala, evento_remarcacoes, reservas_veiculo,
                 substituicoes, historico, notificacoes
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 16. Agendamento do envio de avisos (ativar no Supabase depois de
--     criar a Edge Function "enviar-notificacoes")
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'enviar-notificacoes', '*/5 * * * *',
--   $$ select net.http_post(
--        url     := 'https://<projeto>.supabase.co/functions/v1/enviar-notificacoes',
--        headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb) $$
-- );
