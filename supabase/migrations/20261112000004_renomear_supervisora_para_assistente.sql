-- Renomeia o perfil de Supervisora para Assistente sem alterar os acessos.
-- O enum mantém os mesmos registros e as mesmas permissões após a troca.

alter type perfil_acesso rename value 'supervisora' to 'assistente';

-- Preserva os valores já configurados com as chaves novas.
insert into configuracoes (chave, valor, descricao)
select 'assistente_pode_cancelar', valor, replace(descricao, 'supervisora', 'assistente')
from configuracoes
where chave = 'supervisora_pode_cancelar'
on conflict (chave) do update
set valor = excluded.valor, descricao = excluded.descricao;

insert into configuracoes (chave, valor, descricao)
select 'assistente_pode_alterar_equipe', valor, replace(descricao, 'supervisora', 'assistente')
from configuracoes
where chave = 'supervisora_pode_alterar_equipe'
on conflict (chave) do update
set valor = excluded.valor, descricao = excluded.descricao;

delete from configuracoes
where chave in ('supervisora_pode_cancelar', 'supervisora_pode_alterar_equipe');

create or replace function eh_operacao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil() in ('diretora', 'gerente', 'assistente'), false)
$$;

create or replace function pode_cancelar_evento() returns boolean
language sql stable security definer set search_path = public as $$
  select eh_gestao()
      or (meu_perfil() = 'assistente' and config_texto('assistente_pode_cancelar') = 'true')
$$;

create or replace function pode_alterar_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select eh_gestao()
      or (meu_perfil() = 'assistente' and config_texto('assistente_pode_alterar_equipe') = 'true')
$$;
