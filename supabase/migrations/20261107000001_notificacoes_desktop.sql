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
