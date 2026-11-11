-- =====================================================================
-- Mundinho Kids — banco de TESTE completo, gerado por npm run banco:juntar
-- Não edite aqui: edite os arquivos de origem e gere de novo.
-- Rodar uma única vez, num projeto novo, no SQL Editor do Supabase.
-- Partes: migrations/20261020000001_schema_v1.sql, migrations/20261020000002_ajustes_v1.sql, migrations/20261021000001_trocas_para_mim.sql, migrations/20261104000001_funcoes_do_login.sql, migrations/20261104000002_telas_do_usuario.sql, migrations/20261106000001_profissionais_disponiveis.sql, migrations/20261106000002_excluir_profissional.sql, migrations/20261107000001_notificacoes_desktop.sql, migrations/20261108000001_notificacoes_gestao.sql, migrations/20261109000001_realtime_notificacoes.sql, migrations/20261110000001_minha_conta.sql, migrations/20261110000002_aviso_conferencia_fantasias.sql, migrations/20261110000003_despesas_so_producao.sql, migrations/20261110000004_abas_mobile.sql, migrations/20261111000001_abas_mobile.sql, migrations/20261111000002_abas_mobile_todos_menus.sql, migrations/20261111000003_limpar_vinculos_ao_remover_da_escala.sql, seed.sql
-- =====================================================================

-- >>>>> migrations/20261020000001_schema_v1.sql

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

-- >>>>> migrations/20261020000002_ajustes_v1.sql

-- =====================================================================
-- Mundinho Kids — ajustes sobre o schema.sql (V1)
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

-- >>>>> migrations/20261021000001_trocas_para_mim.sql

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

-- >>>>> migrations/20261104000001_funcoes_do_login.sql

-- =====================================================================
-- Mundinho Kids — um login pode ter mais de uma função
--
-- Antes, o que só a produção ou só quem cuida das fantasias pode fazer olhava
-- o perfil do login. Agora vale também a função do profissional ligado a ele:
-- um login de perfil Artista cujo profissional tem a função Produção pode
-- reservar veículo; com a função Fantasias, confere e edita fantasias.
-- (Ver eventos e escala já dependia de estar escalado no evento.)
-- =====================================================================

-- O login tem a função pelo perfil ou pelo cadastro do profissional ligado a ele
create function tenho_funcao(p_funcao funcao_profissional) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil()::text = p_funcao::text, false)
      or exists (
        select 1
        from profissionais pr
        join usuarios u on u.id = pr.usuario_id and u.ativo
        where pr.usuario_id = auth.uid() and pr.ativo and p_funcao = any (pr.funcoes)
      )
$$;

revoke execute on function tenho_funcao(funcao_profissional) from public, anon;
grant execute on function tenho_funcao(funcao_profissional) to authenticated;

-- Fantasias: quem tem a função fantasias edita a situação e confere a devolução
drop policy fan_alterar on fantasias;
create policy fan_alterar on fantasias for update to authenticated
  using (eh_operacao() or tenho_funcao('fantasias')) with check (eh_operacao() or tenho_funcao('fantasias'));

drop policy ev_ler on eventos;
create policy ev_ler on eventos for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias') or participa_do_evento(id));

drop policy esc_ler on evento_escala;
create policy esc_ler on evento_escala for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias') or participa_do_evento(evento_id));

drop policy conf_ler on conferencias_fantasia;
create policy conf_ler on conferencias_fantasia for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias'));
drop policy conf_criar on conferencias_fantasia;
create policy conf_criar on conferencias_fantasia for insert to authenticated
  with check (eh_operacao() or tenho_funcao('fantasias'));
drop policy conf_alterar on conferencias_fantasia;
create policy conf_alterar on conferencias_fantasia for update to authenticated
  using (eh_operacao() or tenho_funcao('fantasias')) with check (eh_operacao() or tenho_funcao('fantasias'));

-- Veículos: quem tem a função produção reserva em nome próprio
drop policy res_criar on reservas_veiculo;
create policy res_criar on reservas_veiculo for insert to authenticated
  with check (eh_operacao()
              or (tenho_funcao('produtor') and responsavel_id = meu_profissional_id()
                  and (evento_id is null or participa_do_evento(evento_id))));

-- >>>>> migrations/20261104000002_telas_do_usuario.sql

-- =====================================================================
-- Mundinho Kids — telas escolhidas para cada login
--
-- Por padrão, cada login vê as telas do seu perfil (e das funções do
-- profissional ligado a ele). A Direção e a Gerente podem escolher outras
-- telas na edição do acesso. Vazio (null) = padrão do perfil.
-- Isso só controla o menu: os dados continuam protegidos pelas regras do banco.
-- =====================================================================

alter table usuarios add column telas text[];

alter table usuarios add constraint usuarios_telas_validas check (
  telas is null or telas <@ array[
    'painel', 'eventos', 'profissionais', 'personagens', 'fantasias', 'veiculos',
    'financeiro', 'cadastros', 'usuarios', 'configuracoes'
  ]::text[]
);

-- >>>>> migrations/20261106000001_profissionais_disponiveis.sql

-- =====================================================================
-- Mundinho Kids — só profissionais disponíveis entram em novos vínculos
-- (tasks #63/#64)
--
-- RECUPERADA do banco em 2026-11-10: esta migração foi aplicada no
-- projeto Supabase, mas o arquivo nunca foi commitado. O conteúdo abaixo
-- é a definição exata que está no banco (pg_get_functiondef/triggerdef).
--
-- "Disponível" = profissional ativo e, se tiver login, com o login ativo.
-- Escalas, reservas, despesas e trocas novas recusam quem não está
-- disponível; o histórico (escalas e pagamentos antigos) é preservado.
-- =====================================================================

-- O login só "é" um profissional enquanto os dois estão ativos
create or replace function meu_profissional_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from profissionais p
  join usuarios u on u.id = p.usuario_id and u.ativo
  where p.usuario_id = auth.uid() and p.ativo
$$;

create function profissional_disponivel(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profissionais p
    where p.id = p_id and p.ativo
      and (p.usuario_id is null or exists (
        select 1 from usuarios u where u.id = p.usuario_id and u.ativo
      ))
  )
$$;
revoke execute on function profissional_disponivel(uuid) from public, anon, authenticated;

-- Lista para as telas: só quem o login pode ver e que está disponível
create function profissionais_disponiveis() returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select p.id from profissionais p
  where meu_perfil() is not null
    and (eh_operacao() or p.usuario_id = auth.uid() or colega_de_evento(p.id))
    and profissional_disponivel(p.id)
$$;
revoke execute on function profissionais_disponiveis() from public, anon;
grant execute on function profissionais_disponiveis() to authenticated;

create or replace function substitutos_disponiveis(p_escala_id uuid)
returns table (profissional_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome
  from evento_escala e
  join profissional_personagens pp on pp.personagem_id = e.personagem_id
  join profissionais p on p.id = pp.profissional_id
  where e.id = p_escala_id and e.ativo
    and (eh_operacao() or e.profissional_id = meu_profissional_id())
    and profissional_disponivel(p.id)
    and 'artista' = any (p.funcoes)
    and p.id <> e.profissional_id
    and not exists (
      select 1 from evento_escala x
      where x.profissional_id = p.id and x.ativo and x.periodo && e.periodo
    )
  order by p.nome
$$;

-- Novos vínculos (escala, reserva, despesa, troca) exigem profissional disponível
create function validar_profissional_novo_vinculo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_validar boolean := false;
begin
  if tg_table_name = 'evento_escala' then
    v_id := new.profissional_id;
    if new.ativo then
      if tg_op = 'INSERT' then v_validar := true;
      else v_validar := not old.ativo
        or (new.profissional_id, new.funcao, new.personagem_id, new.fantasia_id)
          is distinct from (old.profissional_id, old.funcao, old.personagem_id, old.fantasia_id);
      end if;
    end if;
  elsif tg_table_name = 'reservas_veiculo' then
    v_id := new.responsavel_id;
    if new.ativo then
      if tg_op = 'INSERT' then v_validar := true;
      else v_validar := not old.ativo
        or (new.responsavel_id, new.veiculo_id, new.evento_id, new.retirada, new.devolucao_prevista)
          is distinct from (old.responsavel_id, old.veiculo_id, old.evento_id, old.retirada, old.devolucao_prevista);
      end if;
    end if;
  elsif tg_table_name = 'despesas' then
    v_id := new.responsavel_id;
    if tg_op = 'INSERT' then v_validar := true;
    else v_validar := new.responsavel_id is distinct from old.responsavel_id;
    end if;
  elsif tg_table_name = 'substituicoes' then
    v_id := new.substituto_id;
    if tg_op = 'INSERT' then v_validar := true;
    else v_validar := new.substituto_id is distinct from old.substituto_id
      or (new.situacao in ('aguardando_aprovacao', 'aprovada') and new.situacao is distinct from old.situacao);
    end if;
  end if;

  if v_validar and v_id is not null then
    -- Serializa a seleção com a exclusão/desativação do profissional e do login.
    perform 1 from profissionais where id = v_id for share;
    perform 1 from usuarios where id = (select usuario_id from profissionais where id = v_id) for share;
    if not profissional_disponivel(v_id) then
      raise exception 'Este profissional não está mais disponível. Atualize a lista e escolha outra pessoa.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function validar_profissional_novo_vinculo() from public, anon, authenticated;

create trigger escala_profissional_disponivel before insert or update on evento_escala
  for each row execute function validar_profissional_novo_vinculo();
create trigger reserva_profissional_disponivel before insert or update on reservas_veiculo
  for each row execute function validar_profissional_novo_vinculo();
create trigger despesa_profissional_disponivel before insert or update on despesas
  for each row execute function validar_profissional_novo_vinculo();
create trigger substituicao_profissional_disponivel before insert or update on substituicoes
  for each row execute function validar_profissional_novo_vinculo();

-- Tirar o login de um profissional também o desativa (não fica um cadastro "órfão" ativo)
create function proteger_desvinculo_profissional() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.usuario_id is not null and new.usuario_id is null then
    new.ativo := false;
  end if;
  return new;
end;
$$;

create trigger profissional_desvincular before update of usuario_id on profissionais
  for each row execute function proteger_desvinculo_profissional();

-- Apagar um login desliga o profissional, mas preserva escalas e pagamentos
create function desligar_profissional_do_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profissionais set usuario_id = null, ativo = false where usuario_id = old.id;
  return old;
end;
$$;
revoke execute on function desligar_profissional_do_usuario() from public, anon, authenticated;

create trigger usuario_desligar_profissional before delete on usuarios
  for each row execute function desligar_profissional_do_usuario();

-- >>>>> migrations/20261106000002_excluir_profissional.sql

-- =====================================================================
-- Mundinho Kids — excluir profissional sem perder o histórico (task #63)
--
-- RECUPERADA do banco em 2026-11-10: esta migração foi aplicada no
-- projeto Supabase, mas o arquivo nunca foi commitado. O conteúdo abaixo
-- é a definição exata que está no banco. Ver docs/exclusao-profissionais.md.
--
-- A exclusão é lógica: excluido_em marca quando ocorreu, o profissional
-- fica inativo e perde o vínculo com o login. Escalas e pagamentos ficam.
-- Só Direção e Gerente excluem; só a Direção exclui quem tem acesso de Direção.
-- =====================================================================

alter table profissionais add column excluido_em timestamptz;
alter table profissionais add constraint profissional_excluido_inativo
  check (excluido_em is null or (not ativo and usuario_id is null));

-- Barra a exclusão por update direto de quem não pode, e impede reativar um excluído
create function proteger_exclusao_profissional() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.excluido_em is distinct from old.excluido_em then
    if not eh_gestao() then
      raise exception 'Só a direção e a gerência podem excluir profissionais.' using errcode = '42501';
    end if;
    if old.excluido_em is not null then
      raise exception 'Este profissional já foi excluído. Crie um novo cadastro se necessário.';
    end if;
    if exists (select 1 from usuarios where id = old.usuario_id and perfil = 'diretora')
      and meu_perfil() <> 'diretora' then
      raise exception 'Só a Direção pode excluir um profissional ligado a um acesso de Direção.';
    end if;
  end if;
  if new.excluido_em is not null then
    new.ativo := false;
    new.usuario_id := null;
  end if;
  return new;
end;
$$;
revoke execute on function proteger_exclusao_profissional() from public, anon, authenticated;

create trigger profissional_proteger_exclusao before update on profissionais
  for each row execute function proteger_exclusao_profissional();

create function excluir_profissional(p_profissional_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profissional profissionais%rowtype;
begin
  if not eh_gestao() then
    raise exception 'Só a direção e a gerência podem excluir profissionais.' using errcode = '42501';
  end if;
  select * into v_profissional from profissionais where id = p_profissional_id for update;
  if not found or v_profissional.excluido_em is not null then
    raise exception 'Profissional não encontrado ou já excluído.';
  end if;
  update profissionais
    set excluido_em = clock_timestamp(), ativo = false, usuario_id = null
    where id = p_profissional_id;
end;
$$;
revoke execute on function excluir_profissional(uuid) from public, anon;
grant execute on function excluir_profissional(uuid) to authenticated;

-- >>>>> migrations/20261107000001_notificacoes_desktop.sql

-- Preferências individuais e leitura da central de notificações.
alter table notificacoes add column lida_em timestamptz;

create table notificacao_preferencias (
  usuario_id uuid not null references usuarios (id) on delete cascade,
  tipo       text not null check (tipo in
               ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
                'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario')),
  ativa      boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, tipo)
);

alter table notificacao_preferencias enable row level security;

create policy notif_pref_propria on notificacao_preferencias for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy not_atualizar_leitura on notificacoes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- >>>>> migrations/20261108000001_notificacoes_gestao.sql

-- Avisos específicos para Direção e Gerente.
alter table notificacoes drop constraint if exists notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario'));

alter table notificacao_preferencias drop constraint if exists notificacao_preferencias_tipo_check;
alter table notificacao_preferencias add constraint notificacao_preferencias_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario'));

create index notificacoes_gestao_idx on notificacoes (usuario_id, tipo, criado_em desc);

create function notificar_gestao(p_tipo text, p_evento_id uuid, p_mensagem text) returns void
language sql security definer set search_path = public as $$
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select id, p_evento_id, p_tipo, p_mensagem
  from usuarios
  where ativo and perfil in ('diretora', 'gerente');
$$;

create function notificar_despesa_gestao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.aprovacao = 'pendente'
     and (tg_op = 'INSERT' or old.aprovacao is distinct from new.aprovacao) then
    perform notificar_gestao(
      'despesa_aprovacao', new.evento_id,
      'Despesa aguardando aprovação: ' || coalesce(new.descricao, 'sem descrição')
    );
  end if;
  return new;
end;
$$;

create trigger despesa_notificar_gestao after insert or update of aprovacao on despesas
  for each row execute function notificar_despesa_gestao();

create function notificar_evento_gestao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    perform notificar_gestao('evento_gestao', new.id, 'Evento cancelado: ' || new.titulo);
  elsif new.periodo is distinct from old.periodo then
    perform notificar_gestao('evento_gestao', new.id, 'Evento remarcado: ' || new.titulo);
  end if;
  return new;
end;
$$;

create trigger evento_notificar_gestao after update of situacao, inicio, fim on eventos
  for each row execute function notificar_evento_gestao();

-- A regra inicial de pendência é evento nas próximas 48h sem nenhuma pessoa ativa.
create function gerar_notificacoes_gestao() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select u.id, e.id, 'pendencia_operacional',
         'Evento sem equipe escalada nas próximas 48 horas: ' || e.titulo
  from usuarios u
  cross join eventos e
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and e.situacao not in ('cancelado', 'realizado')
    and e.inicio between now() and now() + interval '48 hours'
    and not exists (select 1 from evento_escala es where es.evento_id = e.id and es.ativo)
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.evento_id = e.id and n.tipo = 'pendencia_operacional'
        and n.criado_em >= date_trunc('day', now())
    );

  insert into notificacoes (usuario_id, tipo, mensagem)
  select u.id, 'resumo_diario',
         'Resumo diário: ' || count(e.id)::text || ' evento(s) previsto(s) para os próximos 7 dias.'
  from usuarios u
  left join eventos e on e.situacao not in ('cancelado', 'realizado')
                       and e.inicio between now() and now() + interval '7 days'
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.tipo = 'resumo_diario'
        and n.criado_em >= date_trunc('day', now())
    )
  group by u.id;
end;
$$;

-- >>>>> migrations/20261109000001_realtime_notificacoes.sql

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end;
$$;

-- >>>>> migrations/20261110000001_minha_conta.sql

-- Dados editáveis pela própria pessoa e armazenamento de avatar.
alter table usuarios add column if not exists telefone text;
alter table usuarios add column if not exists foto_path text;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

drop policy if exists avatares_inserir_proprio on storage.objects;
create policy avatares_inserir_proprio
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatares_alterar_proprio on storage.objects;
create policy avatares_alterar_proprio
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatares_apagar_proprio on storage.objects;
create policy avatares_apagar_proprio
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.atualizar_minha_conta(
  p_nome text,
  p_telefone text,
  p_disponibilidade text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'nome_obrigatorio'; end if;

  update usuarios
     set nome = trim(p_nome), telefone = nullif(trim(p_telefone), '')
   where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;

  update profissionais
     set nome = trim(p_nome),
         telefone = nullif(trim(p_telefone), ''),
         disponibilidade = nullif(trim(p_disponibilidade), '')
   where usuario_id = v_usuario and ativo;
end;
$$;

create or replace function public.atualizar_foto_minha_conta(p_foto_path text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update usuarios set foto_path = nullif(trim(p_foto_path), '')
   where id = auth.uid() and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;

grant execute on function public.atualizar_minha_conta(text, text, text) to authenticated;
grant execute on function public.atualizar_foto_minha_conta(text) to authenticated;

create or replace function public.sincronizar_email_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update usuarios set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists sincronizar_email_usuario on auth.users;
create trigger sincronizar_email_usuario
  after update of email on auth.users
  for each row execute function public.sincronizar_email_usuario();

-- >>>>> migrations/20261110000002_aviso_conferencia_fantasias.sql

-- =====================================================================
-- Mundinho Kids — aviso de conferência para quem cuida das fantasias
--
-- Quando uma festa termina e alguma fantasia usada nela ainda não foi
-- conferida (devolução, limpeza, reparo), quem cuida das fantasias recebe
-- um aviso para conferir. "Quem cuida" = login com perfil Fantasias ou
-- ligado a um profissional com a função Fantasias.
--
-- O aviso é gerado pela mesma rotina que já roda a cada 5 minutos
-- (gerar_notificacoes_gestao, chamada pela Edge Function enviar-notificacoes),
-- então não é preciso publicar a função de novo.
--
-- Cada festa gera no máximo um aviso por pessoa. Festas canceladas não avisam.
-- Só olha festas que terminaram nos últimos 3 dias, para não avisar sobre
-- festas antigas quando esta migração for aplicada.
-- =====================================================================

alter table notificacoes drop constraint if exists notificacoes_tipo_check;
alter table notificacoes add constraint notificacoes_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario',
   'conferencia_fantasias'));

alter table notificacao_preferencias drop constraint if exists notificacao_preferencias_tipo_check;
alter table notificacao_preferencias add constraint notificacao_preferencias_tipo_check check (tipo in
  ('escalado', 'lembrete', 'alterado', 'cancelado', 'removido', 'substituicao',
   'despesa_aprovacao', 'evento_gestao', 'pendencia_operacional', 'resumo_diario',
   'conferencia_fantasias'));

create function gerar_avisos_conferencia() returns void
language sql security definer set search_path = public as $$
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select u.id, e.id, 'conferencia_fantasias',
         'Festa encerrada: confira as fantasias da ' || e.titulo
  from eventos e
  cross join usuarios u
  where e.situacao <> 'cancelado'
    and e.fim <= now()
    and e.fim > now() - interval '3 days'
    -- alguma fantasia da festa ainda sem conferência
    and exists (
      select 1 from evento_escala es
      where es.evento_id = e.id and es.ativo and es.fantasia_id is not null
        and not exists (
          select 1 from conferencias_fantasia c
          where c.evento_id = e.id and c.fantasia_id = es.fantasia_id
        )
    )
    -- quem cuida das fantasias
    and u.ativo
    and (
      u.perfil = 'fantasias'
      or exists (
        select 1 from profissionais p
        where p.usuario_id = u.id and p.ativo and 'fantasias'::funcao_profissional = any (p.funcoes)
      )
    )
    -- um aviso por festa e por pessoa
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.evento_id = e.id and n.tipo = 'conferencia_fantasias'
    );
$$;

-- Só a rotina do servidor gera avisos
revoke execute on function gerar_avisos_conferencia() from public, anon, authenticated;

-- Mesma rotina de antes (avisos da gestão), agora também com o aviso de conferência
create or replace function gerar_notificacoes_gestao() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notificacoes (usuario_id, evento_id, tipo, mensagem)
  select u.id, e.id, 'pendencia_operacional',
         'Evento sem equipe escalada nas próximas 48 horas: ' || e.titulo
  from usuarios u
  cross join eventos e
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and e.situacao not in ('cancelado', 'realizado')
    and e.inicio between now() and now() + interval '48 hours'
    and not exists (select 1 from evento_escala es where es.evento_id = e.id and es.ativo)
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.evento_id = e.id and n.tipo = 'pendencia_operacional'
        and n.criado_em >= date_trunc('day', now())
    );

  insert into notificacoes (usuario_id, tipo, mensagem)
  select u.id, 'resumo_diario',
         'Resumo diário: ' || count(e.id)::text || ' evento(s) previsto(s) para os próximos 7 dias.'
  from usuarios u
  left join eventos e on e.situacao not in ('cancelado', 'realizado')
                       and e.inicio between now() and now() + interval '7 days'
  where u.ativo and u.perfil in ('diretora', 'gerente')
    and not exists (
      select 1 from notificacoes n
      where n.usuario_id = u.id and n.tipo = 'resumo_diario'
        and n.criado_em >= date_trunc('day', now())
    )
  group by u.id;

  perform gerar_avisos_conferencia();
end;
$$;

-- >>>>> migrations/20261110000003_despesas_so_producao.sql

-- =====================================================================
-- Mundinho Kids — só a produção lança despesas do evento
--
-- Antes, qualquer pessoa escalada no evento (inclusive artista e
-- maquiagem) podia lançar uma despesa nele. Agora lança:
--   * a gestão (Direção e Gerente), em qualquer evento ou sem evento;
--   * quem tem a função Produção (pelo perfil ou pelo cadastro do
--     profissional) e está escalado no evento, sempre em nome próprio.
-- Quem é artista e também produtor continua podendo lançar.
-- As despesas já lançadas não mudam.
-- =====================================================================

drop policy desp_criar on despesas;
create policy desp_criar on despesas for insert to authenticated
  with check (
    eh_gestao()
    or (
      criado_por = auth.uid()
      and evento_id is not null
      and tenho_funcao('produtor')
      and participa_do_evento(evento_id)
    )
  );

-- >>>>> migrations/20261110000004_abas_mobile.sql

-- =====================================================================
-- Mundinho Kids — abas do celular escolhidas por cada pessoa
--
-- RECUPERADA do banco em 2026-11-10: esta mudança foi aplicada direto no
-- projeto Supabase e não está em nenhuma branch do repositório (nem a
-- migração nem o código do app que a usa). O conteúdo abaixo é a definição
-- exata que está no banco. A data no nome é a da recuperação, não a original.
--
-- Cada login pode escolher 3 menus para a barra de baixo do celular.
-- null = abas padrão do perfil.
-- =====================================================================

alter table usuarios add column abas_mobile text[];
alter table usuarios add constraint usuarios_abas_mobile_validas check (
  abas_mobile is null or (
    cardinality(abas_mobile) = 3
    and abas_mobile <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
                             '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]
  )
);

create function atualizar_abas_mobile(p_abas text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_abas, 1), 0) <> 3 then
    raise exception 'Escolha exatamente três menus.';
  end if;
  if (select count(distinct aba) from unnest(p_abas) as aba) <> 3 then
    raise exception 'Escolha três menus diferentes.';
  end if;
  if not (p_abas <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
    '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]) then
    raise exception 'Menu mobile inválido.';
  end if;

  update usuarios set abas_mobile = p_abas where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;
revoke execute on function atualizar_abas_mobile(text[]) from public, anon;
grant execute on function atualizar_abas_mobile(text[]) to authenticated;

-- >>>>> migrations/20261111000001_abas_mobile.sql

-- Preferência pessoal das três abas principais exibidas no celular.
-- Diferente de usuarios.telas, esta configuração não altera permissões.
alter table usuarios add column if not exists abas_mobile text[];

alter table usuarios drop constraint if exists usuarios_abas_mobile_validas;
alter table usuarios add constraint usuarios_abas_mobile_validas check (
  abas_mobile is null
  or (
    cardinality(abas_mobile) = 3
    and abas_mobile <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
      '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]
  )
);

create or replace function public.atualizar_abas_mobile(p_abas text[]) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_abas, 1), 0) <> 3 then
    raise exception 'Escolha exatamente três menus.';
  end if;
  if (select count(distinct aba) from unnest(p_abas) as aba) <> 3 then
    raise exception 'Escolha três menus diferentes.';
  end if;
  if not (p_abas <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
    '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]) then
    raise exception 'Menu mobile inválido.';
  end if;

  update usuarios set abas_mobile = p_abas where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;

revoke execute on function public.atualizar_abas_mobile(text[]) from public, anon;
grant execute on function public.atualizar_abas_mobile(text[]) to authenticated;

-- >>>>> migrations/20261111000002_abas_mobile_todos_menus.sql

-- Permite escolher qualquer menu acessível como atalho mobile.
alter table usuarios drop constraint if exists usuarios_abas_mobile_validas;
alter table usuarios add constraint usuarios_abas_mobile_validas check (
  abas_mobile is null
  or (
    cardinality(abas_mobile) = 3
    and abas_mobile <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
      '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]
  )
);

create or replace function public.atualizar_abas_mobile(p_abas text[]) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_abas, 1), 0) <> 3 then
    raise exception 'Escolha exatamente três menus.';
  end if;
  if (select count(distinct aba) from unnest(p_abas) as aba) <> 3 then
    raise exception 'Escolha três menus diferentes.';
  end if;
  if not (p_abas <@ array['/', '/eventos', '/profissionais', '/personagens', '/fantasias', '/veiculos',
    '/financeiro', '/cadastros', '/usuarios', '/configuracoes']::text[]) then
    raise exception 'Menu mobile inválido.';
  end if;

  update usuarios set abas_mobile = p_abas where id = v_usuario and ativo;
  if not found then raise exception 'sem_permissao'; end if;
end;
$$;

revoke execute on function public.atualizar_abas_mobile(text[]) from public, anon;
grant execute on function public.atualizar_abas_mobile(text[]) to authenticated;

-- >>>>> migrations/20261111000003_limpar_vinculos_ao_remover_da_escala.sql

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

-- >>>>> seed.sql

-- =====================================================================
-- Mundinho Kids — dados de teste
-- Rodar depois das migrações, só no projeto de TESTE.
--
-- As datas são relativas à semana atual: o "sábado" é o próximo sábado
-- (ou hoje, se hoje for sábado). Assim a base sempre tem eventos na
-- semana, pendências e uma troca para aprovar, como nos mocks.
--
-- Os logins (gerente e supervisora) não são criados aqui: crie os
-- usuários em Authentication > Users e rode supabase/vincular_usuarios.sql.
-- =====================================================================

-- Data/hora relativa ao sábado da semana, no horário de São Paulo
create function pg_temp.quando(p_dias int, p_hora text) returns timestamptz
language sql stable as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select (((d + ((6 - extract(dow from d)::int) % 7)) + p_dias) + p_hora::time) at time zone 'America/Sao_Paulo'
  from hoje
$$;

-- ---------------------------------------------------------------------
-- Configurações de teste
-- ---------------------------------------------------------------------

update configuracoes set valor = 'https://forms.gle/exemplo-feedback' where chave = 'link_formulario_produtor';

-- ---------------------------------------------------------------------
-- Profissionais e personagens
-- ---------------------------------------------------------------------

insert into profissionais (id, nome, telefone, funcoes, disponibilidade) values
  ('a0000000-0000-0000-0000-000000000001', 'Júlia Martins', '(11) 98111-2001', '{artista}',   'Fins de semana'),
  ('a0000000-0000-0000-0000-000000000002', 'Lucas Pereira', '(11) 98111-2002', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000003', 'Rafael Lima',   '(11) 98111-2003', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000004', 'Ana Costa',     '(11) 98111-2004', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000005', 'Bia Rocha',     '(11) 98111-2005', '{artista}',   'Só sábado e domingo'),
  ('a0000000-0000-0000-0000-000000000006', 'Caio Mendes',   '(11) 98111-2006', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000007', 'Bruno Alves',   '(11) 98111-2007', '{produtor}',  null),
  ('a0000000-0000-0000-0000-000000000008', 'Diego Souza',   '(11) 98111-2008', '{produtor}',  null),
  ('a0000000-0000-0000-0000-000000000009', 'Carla Dias',    '(11) 98111-2009', '{maquiador}', null),
  ('a0000000-0000-0000-0000-000000000010', 'Paula Nunes',   '(11) 98111-2010', '{fantasias}', null);

insert into personagens (id, nome, descricao, orientacoes) values
  ('b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'Princesa de vestido azul e capa de neve.', 'Fala calma, canta a música do gelo no parabéns.'),
  ('b0000000-0000-0000-0000-000000000002', 'Herói Aranha',     'Herói de uniforme vermelho e azul.',        'Brincadeira da teia com as crianças maiores.'),
  ('b0000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'Sereia de cauda verde.',                    'Bolhas de sabão na entrada.'),
  ('b0000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'Astronauta de capacete prateado.',          'Contagem regressiva antes do parabéns.');

insert into profissional_personagens (profissional_id, personagem_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------
-- Contratantes, locais, fantasias e veículo
-- ---------------------------------------------------------------------

insert into contratantes (id, nome, telefone, email) values
  ('c0000000-0000-0000-0000-000000000001', 'Mariana Souza (mãe)',   '(11) 98765-4321', null),
  ('c0000000-0000-0000-0000-000000000002', 'Renata Oliveira (mãe)', '(11) 97654-3210', null),
  ('c0000000-0000-0000-0000-000000000003', 'Paulo Henrique (pai)',  '(11) 96543-2109', null),
  ('c0000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',  '(11) 3456-7890',  'eventos@pequenosaber.com.br');

insert into contratantes_notas (contratante_id, observacoes) values
  ('c0000000-0000-0000-0000-000000000002', 'Prefere contato por WhatsApp depois das 18h.');

insert into locais (id, nome, tipo, endereco, contato, link_localizacao, orientacoes_acesso) values
  ('d0000000-0000-0000-0000-000000000001', 'Buffet Castelo Encantado', 'buffet', 'Rua das Acácias, 245 · Jardim América', '(11) 3333-1010', 'https://maps.google.com/?q=Rua+das+Acacias+245', 'Estacionar na entrada lateral, pela Rua das Acácias.'),
  ('d0000000-0000-0000-0000-000000000002', 'Buffet Pula-Pula',         'buffet', 'Av. dos Ipês, 1200 · Vila Nova',        '(11) 3333-2020', 'https://maps.google.com/?q=Av+dos+Ipes+1200',      'Entrada de artistas pelos fundos.'),
  ('d0000000-0000-0000-0000-000000000003', 'Buffet Mundo Mágico',      'buffet', 'Rua das Flores, 88 · Centro',           '(11) 3333-3030', 'https://maps.google.com/?q=Rua+das+Flores+88',      null),
  ('d0000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',     'escola', 'Rua do Saber, 10 · Jardim Escola',      '(11) 3456-7890', 'https://maps.google.com/?q=Rua+do+Saber+10',        'Apresentar-se na secretaria.'),
  ('d0000000-0000-0000-0000-000000000005', 'Residência da família',    'casa',   'Rua das Palmeiras, 51 · Morumbi',       null,             'https://maps.google.com/?q=Rua+das+Palmeiras+51',   'Interfone 51. Festa no salão do prédio.');

insert into fantasias (id, personagem_id, identificacao, tamanho, situacao, previsao_disponivel, observacoes) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'M', 'disponivel', null, 'Inclui coroa e luvas'),
  ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'P', 'limpeza', pg_temp.quando(-1, '12:00'), 'Inclui coroa'),
  ('f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Herói Aranha',     'G', 'disponivel', null, 'Máscara com tela respirável'),
  ('f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'M', 'disponivel', null, null),
  ('f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'G', 'disponivel', null, 'Capacete na caixa azul');

insert into veiculos (id, nome, placa, observacoes) values
  ('e0000000-0000-0000-0000-000000000001', 'Doblò', 'ABC1D23', 'Chave fica com a gerente.');

-- ---------------------------------------------------------------------
-- Eventos (dia 0 = sábado da semana)
-- ---------------------------------------------------------------------

insert into eventos (id, titulo, aniversariante, idade, contratante_id, local_id, inicio, fim, situacao, tem_maquiagem, maquiagem_pessoas, orientacoes) values
  ('10000000-0000-0000-0000-000000000001', 'Festa do Davi',  'Davi',  6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(-14, '14:00'), pg_temp.quando(-14, '17:00'), 'realizado', false, 0, null),
  ('10000000-0000-0000-0000-000000000002', 'Festa da Sofia', 'Sofia', 5, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(-13, '16:00'), pg_temp.quando(-13, '19:00'), 'realizado', false, 0, null),
  ('10000000-0000-0000-0000-000000000003', 'Festa do Miguel', 'Miguel', 7, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(-7, '15:00'), pg_temp.quando(-7, '18:00'), 'realizado', false, 0, null),
  ('10000000-0000-0000-0000-000000000004', 'Festa da Alice', 'Alice', 4, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(-7, '19:00'), pg_temp.quando(-7, '22:00'), 'realizado', false, 0, null),
  ('10000000-0000-0000-0000-000000000005', 'Festa do Arthur', 'Arthur', 6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', pg_temp.quando(-6, '15:00'), pg_temp.quando(-6, '18:00'), 'realizado', false, 0, null),
  ('10000000-0000-0000-0000-000000000006', 'Escola Pequeno Saber', null, null, 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', pg_temp.quando(-5, '10:00'), pg_temp.quando(-5, '12:00'), 'realizado', false, 0, 'Dia das Crianças: apresentação no pátio para três turmas.'),
  ('10000000-0000-0000-0000-000000000007', 'Festa da Helena', 'Helena', 6, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(-1, '18:00'), pg_temp.quando(-1, '21:00'), 'confirmado', false, 0,
    E'Chegar às 17h30 para trocar de roupa na sala 2.\nParabéns às 20h.'),
  ('10000000-0000-0000-0000-000000000008', 'Festa do Theo', 'Theo', 4, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(0, '11:00'), pg_temp.quando(0, '14:00'), 'confirmado', false, 0,
    E'Festa no salão de baixo.\nDevolver a Doblò até 14h para a Festa da Laura.'),
  ('10000000-0000-0000-0000-000000000009', 'Festa da Laura', 'Laura', 5, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(0, '15:00'), pg_temp.quando(0, '18:00'), 'confirmado', true, 2,
    E'Entrada dos personagens às 16h, depois do teatrinho do buffet.\nA aniversariante é tímida: a Princesa do Gelo chega primeiro e se apresenta com calma.\nParabéns às 17h30, com os dois personagens ao lado da mesa.\nEstacionar a Doblò na entrada lateral, pela Rua das Acácias.'),
  ('10000000-0000-0000-0000-000000000010', 'Festa do Gael', 'Gael', 7, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(0, '19:00'), pg_temp.quando(0, '21:30'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000011', 'Festa da Valentina', 'Valentina', 5, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', pg_temp.quando(1, '16:00'), pg_temp.quando(1, '19:00'), 'confirmado', true, 2,
    'Festa no salão do prédio. Interfone 51.'),
  ('10000000-0000-0000-0000-000000000012', 'Festa do Bento', 'Bento', 3, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(7, '15:00'), pg_temp.quando(7, '18:00'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000013', 'Festa da Cecília', 'Cecília', 8, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(8, '14:00'), pg_temp.quando(8, '17:00'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000014', 'Festa à fantasia da Liz', 'Liz', 6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(14, '16:00'), pg_temp.quando(14, '19:00'), 'agendado', false, 0, null);

-- ---------------------------------------------------------------------
-- Escala (passa pelas travas de horário, personagem e fantasia)
-- ---------------------------------------------------------------------

insert into evento_escala (id, evento_id, profissional_id, funcao, personagem_id, fantasia_id, maquiar, horario_maquiagem) values
  -- realizados
  (default, '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', false, null),
  (default, '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false, null),
  (default, '10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Helena
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false, null),
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Theo
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', false, null),
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  -- Laura (o Lucas vai pedir a troca)
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', true, null),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'artista', 'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', true, null),
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'maquiador', null, null, false, pg_temp.quando(0, '14:00')),
  -- Gael (sem veículo)
  (default, '10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  -- Valentina (fantasia em limpeza e sem maquiagem escalada)
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', true, null),
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', true, null),
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Bento
  (default, '10000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null);

-- Conferência das fantasias de um evento realizado
insert into conferencias_fantasia (evento_id, fantasia_id, devolvida, condicao, precisa_limpeza, pendencias) values
  ('10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005', true, 'ok', false, null);

-- ---------------------------------------------------------------------
-- Veículo
-- ---------------------------------------------------------------------

insert into reservas_veiculo (veiculo_id, evento_id, responsavel_id, retirada, devolucao_prevista) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(-1, '16:45'), pg_temp.quando(-1, '21:45')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', pg_temp.quando(0, '09:00'),  pg_temp.quando(0, '14:00')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(0, '14:15'),  pg_temp.quando(0, '19:00')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(1, '14:30'),  pg_temp.quando(1, '19:45'));

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------

insert into evento_financeiro (evento_id, valor_contratado) values
  ('10000000-0000-0000-0000-000000000007', 1500),
  ('10000000-0000-0000-0000-000000000008', 1400),
  ('10000000-0000-0000-0000-000000000009', 1800),
  ('10000000-0000-0000-0000-000000000010', 900),
  ('10000000-0000-0000-0000-000000000011', 1600);

insert into recebimentos (evento_id, valor, recebido_em, forma) values
  ('10000000-0000-0000-0000-000000000007', 1500, current_date - 14, 'pix'),
  ('10000000-0000-0000-0000-000000000008', 700,  current_date - 10, 'pix'),
  ('10000000-0000-0000-0000-000000000009', 900,  current_date - 13, 'pix'),
  ('10000000-0000-0000-0000-000000000011', 800,  current_date - 7,  'transferência');

insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado, situacao, pago_em) values
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 250, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', 250, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 200, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 200, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 200, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 220, 'pago', current_date - 1);

insert into despesas (evento_id, tipo, descricao, valor, responsavel_id, comprovante) values
  ('10000000-0000-0000-0000-000000000009', 'extra',  'Balões e fita para a entrada', 45, 'a0000000-0000-0000-0000-000000000007', 'Nota da papelaria (foto no WhatsApp)'),
  (null,                                   'insumo', 'Reposição de glitter e tinta facial', 68, 'a0000000-0000-0000-0000-000000000009', null);

-- ---------------------------------------------------------------------
-- Troca aguardando aprovação (Lucas indicou Rafael, que já aceitou)
-- ---------------------------------------------------------------------

insert into substituicoes (escala_id, solicitante_id, substituto_id, motivo, situacao, solicitado_em, respondido_em) values
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'Consulta médica no sábado à tarde', 'aguardando_aprovacao', now() - interval '2 hours', now() - interval '80 minutes');
